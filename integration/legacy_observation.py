"""Admit legacy observations through the same canonical reservation boundary.

The trusted provider approves read-only operations; this is not command-text
classification. Destructive operations must use the durable control API.
"""
from contextvars import ContextVar
from contextlib import ExitStack
from .authorization import configured_provider
from .coordinator import session
from .targets import inventory
from .store import Conflict, scopes

caller = ContextVar('legacy_caller', default=None)
project_scope = ContextVar('legacy_project_scope', default=None)
held = ContextVar('legacy_observation_scopes', default=frozenset())


def install(pa, store_getter, provider_getter=configured_provider):
    def bind_actor(fn):
        actor=caller.get()
        scope=project_scope.get()
        def invoke(*args,**kwargs):
            token=caller.set(actor)
            scope_token=project_scope.set(scope)
            try: return fn(*args,**kwargs)
            finally:
                project_scope.reset(scope_token)
                caller.reset(token)
        return invoke
    pa._background_target=bind_actor
    def wrap(name, endpoints, operation):
        original=getattr(pa,name)
        def invoke(*args,**kwargs):
            from . import enrollment
            if name=='ssh_run' and enrollment.current.get() is not None:
                return enrollment.consume(*args,**kwargs)
            addresses=set(filter(None,endpoints(*args,**kwargs)))
            with ExitStack() as stack:
                with pa._DATA_LOCK:
                    rows=[t for t in inventory(pa) if addresses & {t.get('os_ip'),t.get('bmc_ip')}]
                    keys=frozenset(s for t in rows for s in scopes(t))
                    if not keys: raise Conflict('Legacy observation needs a registered canonical target')
                    if not keys.issubset(held.get()):
                        provider=provider_getter();actor=caller.get()
                        # The actor ContextVar does not survive every execution boundary
                        # (background runner threads/subprocesses). When no caller is bound,
                        # fall back to the provider's service principal so an internal
                        # all-permissive provider (local_provider) still admits these
                        # read-only observations. A strict provider with no service_principal
                        # keeps the original refusal.
                        if provider is None:
                            # No provider configured: mirror authorize()/authenticate(), which
                            # treat this internal instance as local-operator for every action.
                            actor='local-operator'
                        else:
                            if not actor:
                                principal=getattr(provider,'service_principal',None)
                                if callable(principal):
                                    try: actor=principal('legacy-observation')
                                    except Exception: actor=None
                            approve=getattr(provider,'approve_legacy_observation',None)
                            if not actor or not callable(approve) or not all(provider.authorize(actor,t.get('project'),'read') for t in rows):
                                raise Conflict('Verified observation provider/caller required')
                            if not approve(actor,rows,operation(*args,**kwargs)):
                                raise Conflict('Legacy command is not approved as read-only')
                        stack.enter_context(session(store_getter(),rows,str(actor),kind='observation'))
                        token=held.set(held.get()|keys);stack.callback(held.reset,token)
                return original(*args,**kwargs)
        setattr(pa,name,invoke)
    if hasattr(pa,'ssh_login_ok'):
        def enrolled_login(host,user,password,port=22,timeout=8):
            from . import enrollment
            return enrollment.consume(host,user,password,port,'echo ok',timeout)[1]==0
        pa.ssh_login_ok=enrolled_login
    endpoint=lambda m,*a,**k:(m.get('os_ip'),m.get('bmc_ip'))
    wrap('ssh_run',lambda host,*a,**k:(host,),lambda host,user,password,port,command,*a,**k:dict(kind='ssh',host=host,port=port,command=command))
    for name in ('ssh_ipmi','_ipmi_run_any'):
        wrap(name,endpoint,lambda m,sub_args,*a,**k:dict(kind='ipmi',argv=list(sub_args)))
    power=pa.ipmi_power
    def guarded_power(machine,action):
        if action!='status': raise Conflict('Use durable manual control; legacy power fallback is disabled')
        return power(machine,action)
    pa.ipmi_power=guarded_power
    def destructive(*args,**kwargs):
        raise Conflict('Use durable manual control; legacy destructive dispatch is disabled')
    pa.run_control_cmd=destructive
    pa._reboot_machine=destructive
