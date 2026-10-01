"""Input session admission; reservations live until the entire socket closes.

Closed broadcast members remain conservatively reserved until socket teardown.
This protects late SSH callbacks without inspecting terminal command text.
"""
import json
import re
from contextlib import ExitStack
from urllib.parse import parse_qs, unquote, urlencode
import copy
from fastapi import HTTPException, WebSocket
from .authorization import authorize
from .coordinator import session
from .targets import inventory
from .store import Conflict


class SessionReservations:
    def __init__(self, app, pa, store_getter, mode):
        self.inner, self.pa, self.store_getter, self.mode = app, pa, store_getter, mode

    def targets(self, name, slot=None):
        parent=self.pa.machines[name]
        rows=[t for t in inventory(self.pa) if t.get('parent_name',t['name'])==name]
        if parent.get('os') is not None:
            selected=slot if slot is not None else parent.get('active_os')
            rows=[t for t in rows if t.get('slot_key')=='N'+str(selected)]
        if len(rows)!=1: raise Conflict('Explicit installed node required')
        return rows

    async def __call__(self, scope, receive, send):
        if scope['type']!='websocket': return await self.inner(scope,receive,send)
        if self.mode=='synthetic':
            await send({'type':'websocket.close','code':1008}); return
        connection=WebSocket(scope,receive,send)
        query=parse_qs(scope.get('query_string',b'').decode())
        stack=ExitStack()
        try:
            def reserve(rows):
                actors=[authorize(connection,t.get('project'),'operate') for t in rows]
                stack.enter_context(session(self.store_getter(),rows,str(actors[0])))
            match=re.fullmatch(r'/ws/(terminal|kvm)/([^/]+)(?:/[^/]+)?',scope['path'])
            if match:
                if query.get('manual') or query.get('mode')==['manual']:
                    raise Conflict('Unregistered manual endpoints are not admitted')
                with self.pa._DATA_LOCK:
                    name=unquote(match[2])
                    rows=self.targets(name,int(query['slot'][0]) if query.get('slot') else None)
                    role='bmc' if match[1]=='kvm' or scope['path'].endswith('/bmc') else 'os'
                    for field,key in (('host',role+'_ip'),('user',role+'_user'),('port',role+'_port')):
                        if query.get(field) and str(query[field][0])!=str(rows[0].get(key,22 if field=='port' else '')):
                            raise Conflict('Session endpoint changed; reload canonical target')
                    reserve(rows)
                    # Freeze selection before yielding to the proxy. ACTIVE OS may
                    # subsequently change without redirecting this admitted session.
                    if rows[0].get('slot_key'):
                        slot=int(rows[0]['slot_key'][1:]);query['slot']=[str(slot)]
                        entry=next(e for e in self.pa.machines[name]['os'] if e['slot']==slot)
                        scope=dict(scope,query_string=urlencode(query,doseq=True).encode(),
                                   cycle_bmc=copy.deepcopy(entry))
                await self.inner(scope,receive,send)
            elif scope['path']=='/ws/rack-broadcast':
                admitted=False
                async def guarded_receive():
                    nonlocal admitted
                    message=await receive()
                    if message['type']=='websocket.receive' and not admitted:
                        body=json.loads(message.get('text') or message.get('bytes',b''))
                        requested=body.get('targets')
                        if not isinstance(requested,list) or not 1<=len(requested)<=128: raise Conflict('Explicit broadcast targets required')
                        with self.pa._DATA_LOCK:
                            rows=[]
                            for target in requested:
                                name,sep,slot=str(target).partition('#')
                                if self.pa.machines[name].get('os') is not None and not sep:
                                    raise Conflict('Canonical broadcast requires explicit physical slot')
                                rows.extend(self.targets(name,int(slot) if sep else None))
                            reserve(rows); admitted=True
                    return message
                await self.inner(scope,guarded_receive,send)
            else:
                raise Conflict('Unregistered input session')
        except (ValueError,KeyError,HTTPException):
            await send({'type':'websocket.close','code':1008})
        finally:
            stack.close()
