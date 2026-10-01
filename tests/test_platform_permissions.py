"""Project permissions must apply to the original PA routes, not only Cycle."""
import unittest
import threading
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from types import SimpleNamespace
import test_integration as base
from integration import web
from scripts.native_demo import fixture


class PlatformPermissions(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def prepare(self):
        doc=fixture(chassis=2)
        web.pa.projects={'A':dict(name='A',project_id='project-a'),
                         'B':dict(name='B',project_id='project-b')}
        web.pa.machines=doc['machines']
        for index,machine in enumerate(web.pa.machines.values()):machine['project']='A' if index==0 else 'B'
        web.pa._save_data()
        web.app.state.cycle_provider=SimpleNamespace(authenticate=lambda request:'A-operator',
            authorize=lambda actor,project,action:project in (None,'A'))
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))

    def test_lists_filter_before_counts_and_cache_cannot_bypass_project(self):
        self.prepare()
        response=self.client.get('/api/projects')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual([p['name'] for p in response.json()['projects']],['A'])
        self.assertEqual(response.json()['projects'][0]['machine_count'],1)
        response=self.client.get('/api/machines')
        self.assertEqual([m['project'] for m in response.json()['machines']],['A'])
        self.assertEqual(self.client.get('/api/machine/chassis-02').status_code,403)
        self.assertEqual(self.client.get('/api/machine/chassis-01').status_code,200)

    def test_move_checks_both_source_and_destination(self):
        self.prepare()
        self.assertEqual(self.client.patch('/api/machines/chassis-01',json={'project':'B'}).status_code,403)
        self.assertEqual(self.client.patch('/api/machines/chassis-02',json={'project':'A'}).status_code,403)
        self.assertEqual(web.pa.machines['chassis-01']['project'],'A')
        self.assertEqual(web.pa.machines['chassis-02']['project'],'B')

    def test_copilot_dispatcher_rejects_cross_project_tool_and_context(self):
        self.prepare()
        # Even an actor allowed in both projects must stay in this AI run's A scope.
        web.app.state.cycle_provider.authorize=lambda *args:True
        messages=[{'role':'assistant','tool_calls':[{'id':'cross-project','function':{
            'name':'get_telemetry','arguments':'{"machine":"chassis-02"}'}}]},
            {'role':'assistant','content':'未取得該目標證據'}]
        payloads=[]
        def llm(url,**kwargs):
            payloads.append(kwargs['json']);message=messages.pop(0)
            return SimpleNamespace(raise_for_status=lambda:None,json=lambda:{'choices':[{'message':message}]})
        with patch.object(web,'MODE','live'),patch('requests.post',llm),\
             patch('requests.get',return_value=SimpleNamespace(status_code=503)),\
             patch.object(web.pa.subprocess,'run',return_value=SimpleNamespace(stdout='',stderr='',returncode=1)),\
             patch.object(web.pa.telemetry_core,'get_os_series') as database:
            response=self.client.post('/api/copilot',json={'project':'A','message':'檢查 telemetry'})
        self.assertEqual(response.status_code,200,response.text)
        database.assert_not_called()
        self.assertNotIn('chassis-02',payloads[0]['messages'][0]['content'])
        tools=[m for m in payloads[-1]['messages'] if m['role']=='tool']
        self.assertIn('outside authorized scope',tools[0]['content'])

    def test_forbidden_cached_detail_and_telemetry_denied_before_io(self):
        self.prepare()
        with patch.object(web,'MODE','live'),patch.object(web.pa.subprocess,'run') as io,\
             patch.object(web.pa.telemetry_core,'get_os_series') as database:
            for path in ('detail','sensors','telemetry','telemetry/analyze'):
                response=self.client.get('/api/machine/chassis-02/'+path)
                self.assertEqual(response.status_code,403,(path,response.text))
            self.assertEqual(self.client.get('/api/rack/B/telemetry').status_code,403)
            self.assertEqual(self.client.get('/api/projects/B/topology').status_code,403)
        io.assert_not_called();database.assert_not_called()

    def test_rack_telemetry_does_not_merge_case_distinct_projects(self):
        self.prepare()
        web.pa.projects['a']=dict(name='a',project_id='different-project')
        web.pa.machines['chassis-02']['project']='a'
        for m in web.pa.machines.values():m['rack_u']=30
        web.pa._save_data()
        response=self.client.get('/api/rack/A/telemetry')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual(response.json()['kinds_count']['server'],1)

    def test_project_reader_does_not_need_global_data_permission(self):
        self.prepare()
        web.app.state.cycle_provider.authorize=lambda actor,project,action: (
            project=='A' and action=='read') or (project is None and action=='navigate')
        self.assertEqual(self.client.get('/').status_code,200)
        response=self.client.get('/api/machines')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual({m['project'] for m in response.json()['machines']},{'A'})
        self.assertEqual(self.client.get('/api/machine/chassis-01').status_code,200)
        self.assertEqual(self.client.get('/api/machine/chassis-02').status_code,403)
        response=self.client.get('/api/cycle/inventory')
        self.assertEqual(response.status_code,200,response.text)
        self.assertEqual([p['name'] for p in response.json()['projects']],['A'])
        self.assertEqual(self.client.patch('/api/machines/chassis-01',json={'order':3}).status_code,403)

    def test_move_race_rechecks_current_project_inside_mutation(self):
        self.prepare()
        entered=threading.Event();moved=threading.Event()
        def grant(actor,project,action):
            if actor=='admin':return True
            if actor=='A-operator' and project=='A' and action=='operate':
                entered.set()
                if not moved.wait(5):raise AssertionError('Concurrent move did not finish')
                return True
            return False
        web.app.state.cycle_provider.authenticate=lambda request:request.headers.get('fixture-actor','A-operator')
        web.app.state.cycle_provider.authorize=grant
        before=web.pa.machines['chassis-01'].get('order')
        with ThreadPoolExecutor(1) as pool:
            pending=pool.submit(self.client.patch,'/api/machines/chassis-01',json={'order':77})
            try:
                self.assertTrue(entered.wait(3))
                response=self.client.patch('/api/machines/chassis-01',json={'project':'B'},headers={'fixture-actor':'admin'})
                self.assertEqual(response.status_code,200,response.text)
            finally:moved.set()
            response=pending.result(timeout=5)
        self.assertEqual(response.status_code,403,response.text)
        self.assertEqual(web.pa.machines['chassis-01']['project'],'B')
        self.assertEqual(web.pa.machines['chassis-01'].get('order'),before)
