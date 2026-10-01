"""Two verified callers race through the actual API and durable reservation store."""
import threading
import unittest
import uuid
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
import test_integration as base
from integration import web
from scripts.native_demo import fixture


class PlatformMultiuser(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def prepare(self,shared=False):
        doc=fixture(shared=shared);web.pa.machines=doc['machines'];web.pa.projects=doc['projects'];web.pa._save_data()
        web.app.state.cycle_provider=SimpleNamespace(
            authenticate=lambda request:request.headers.get('x-fixture-caller'),
            authorize=lambda actor,project,action:actor in {'alice','bob'} and project in {None,'Neutrino Demo'})
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        return [n['node_id'] for n in web.pa.machines['chassis-01']['os']]

    def create(self,actor,node):
        return self.client.post('/api/cycle/runs',headers={'x-fixture-caller':actor},json=dict(
            project='Neutrino Demo',machine_ids=[node],cycle_profile='neutrino',cycle_mode='reboot',
            channel='inband',limits={'loops':1,'hours':0},parallelism=1,idempotency_key=uuid.uuid4().hex))

    def test_distinct_independent_nodes_can_be_reserved_by_two_callers(self):
        nodes=self.prepare()
        a=self.create('alice',nodes[0]);b=self.create('bob',nodes[3])
        self.assertEqual(a.status_code,200,a.text);self.assertEqual(b.status_code,200,b.text)
        self.assertNotEqual(a.json()['id'],b.json()['id'])
        self.assertEqual(a.json()['created_by'],'alice');self.assertEqual(b.json()['created_by'],'bob')
        self.assertEqual(self.store.lock_owners()['node:'+nodes[0]],a.json()['id'])
        self.assertEqual(self.store.lock_owners()['node:'+nodes[3]],b.json()['id'])

    def test_same_node_race_has_one_reservation_and_one_persisted_blocked_request(self):
        nodes=self.prepare();barrier=threading.Barrier(2)
        def attempt(actor):barrier.wait(timeout=5);return self.create(actor,nodes[0])
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(attempt,['alice','bob']))
        self.assertEqual([r.status_code for r in results],[200,200])
        self.assertEqual(sorted(r.json()['state'] for r in results),['BLOCKED','CREATED'])
        winner=next(r.json() for r in results if r.json()['state']=='CREATED')
        conflict=next(r for r in results if r.json()['state']=='BLOCKED')
        self.assertIn(winner['id'],conflict.text)
        self.assertEqual(len(self.store.jobs()),2) # Blocked attempts remain auditable, not runnable.
        self.assertEqual(conflict.json()['pre']['runnable_ids'],[])
        self.assertEqual(self.store.actions(conflict.json()['id']),[])
        self.assertEqual(set(self.store.lock_owners().values()),{winner['id']})
        self.assertEqual(self.store.actions(winner['id']),[])

    def test_distinct_nodes_with_shared_controller_do_not_bypass_scope_lock(self):
        nodes=self.prepare(shared=True)
        a=self.create('alice',nodes[0]);b=self.create('bob',nodes[3])
        self.assertEqual(a.status_code,200,a.text);self.assertEqual(b.status_code,200,b.text)
        self.assertEqual(a.json()['state'],'CREATED');self.assertEqual(b.json()['state'],'BLOCKED')
        self.assertIn(a.json()['id'],b.text)
        self.assertEqual(set(self.store.lock_owners().values()),{a.json()['id']})
        self.assertEqual(self.store.actions(b.json()['id']),[])
