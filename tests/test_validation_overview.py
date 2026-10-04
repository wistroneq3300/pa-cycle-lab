import copy
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from integration.inspection import InspectionStore, encode as inspection_encode
from integration.store import Store, encode as store_encode
from integration.targets import inventory as node_inventory
from integration.telemetry_monitoring import MonitoringConfig
from integration.telemetry_store import ProvisionStore
from scripts.native_demo import fixture


class ValidationOverviewAggregation(unittest.TestCase):
    def setUp(self):
        from integration import web

        self.web=web
        self.folder=tempfile.TemporaryDirectory()
        root=Path(self.folder.name)
        self.previous=dict(store=web.store,machines=web.pa.machines,projects=web.pa.projects,
                           provider=getattr(web.app.state,'cycle_provider',None),
                           inspection_service=web.inspection_service,
                           telemetry_service=web.telemetry_provision_service)
        doc=fixture(chassis=1,nodes=5,project='A')
        web.pa.projects=copy.deepcopy(doc['projects'])
        web.pa.machines=copy.deepcopy(doc['machines'])
        web.store=Store(root/'jobs.sqlite3')
        self.inspection_store=InspectionStore(root/'inspection.sqlite3')
        self.telemetry_store=ProvisionStore(root/'telemetry.sqlite3')
        self.telemetry=SimpleNamespace(store=self.telemetry_store,config=MonitoringConfig(freshness_seconds=120))
        self.inspection=SimpleNamespace(store=self.inspection_store,systems=self.systems)
        web.inspection_service=lambda:self.inspection
        web.telemetry_provision_service=lambda:self.telemetry

        class Provider:
            def authenticate(self,request): return 'overview-reader'
            def authorize(self,actor,project,action):
                if actor!='overview-reader': return False
                if project is None: return action=='global.read'
                return project=='A' and action=='read'

        web.app.state.cycle_provider=Provider()
        self.client=TestClient(web.app)
        self.targets=node_inventory(web.pa)
        self.chassis_id=self.targets[0]['chassis_id']

    def tearDown(self):
        self.client.close()
        self.web.store=self.previous['store']
        self.web.pa.machines=self.previous['machines']
        self.web.pa.projects=self.previous['projects']
        self.web.app.state.cycle_provider=self.previous['provider']
        self.web.inspection_service=self.previous['inspection_service']
        self.web.telemetry_provision_service=self.previous['telemetry_service']
        self.folder.cleanup()

    def systems(self):
        targets=node_inventory(self.web.pa)
        active=self.web.pa.machines['chassis-01'].get('active_os')
        nodes=[dict(node_id=target['node_id'],slot=int(target['slot_key'][1:]),label=target['slot_key']) for target in targets]
        if active is not None:
            scoped=[node for node in nodes if node['slot']==active]
            if scoped: nodes=scoped
        return [dict(id=self.chassis_id,name='chassis-01',project='A',active_os=active,nodes=nodes)]

    def seed_inspected(self,*indexes):
        completed=1000
        with self.inspection_store.tx() as db:
            system=self.inspection_store.system(self.chassis_id,db)
            system.update(last_completed_at=completed,next_due=completed+60,coverage=[])
            self.inspection_store.save_system(db,system)
            for index in indexes:
                node_id=self.targets[index]['node_id']
                state={'last_completed':completed+index,
                       'sources':{'Identity':{'state':'FRESH','last_success':completed+index,'collected_at':completed+index}}}
                db.execute('INSERT OR REPLACE INTO inspection_nodes VALUES(?,?,?)',
                           (node_id,self.chassis_id,inspection_encode(state)))

    def seed_issue(self,index,severity):
        node_id=self.targets[index]['node_id']
        item=dict(id='issue-'+str(index),system_id=self.chassis_id,node_id=node_id,status='ACTIVE',severity=severity,
                  component='gpu' if severity=='FAIL' else 'telemetry',rule='fixture.'+severity.lower(),facts='fixture issue',
                  affected_nodes=[],first_seen_at=1000,last_seen_at=1000,observations=1,recurrences=0)
        with self.inspection_store.tx() as db:
            db.execute('INSERT OR REPLACE INTO inspection_items VALUES(?,?,?)',(item['id'],self.chassis_id,inspection_encode(item)))

    def seed_failed_inspection(self,index):
        node_id=self.targets[index]['node_id']
        state={'last_completed':1000+index,
               'sources':{'Identity':{'state':'FAILED','last_attempt':1000+index,'last_success':None}}}
        with self.inspection_store.tx() as db:
            db.execute('INSERT OR REPLACE INTO inspection_nodes VALUES(?,?,?)',
                       (node_id,self.chassis_id,inspection_encode(state)))

    def overview(self):
        response=self.client.get('/api/validation/overview')
        self.assertEqual(response.status_code,200,response.text)
        return response.json()

    def test_inspection_coverage_stays_with_original_node_after_active_os_switch(self):
        self.seed_inspected(0)
        first=self.overview()
        self.assertEqual(first['totals']['validation'],{'checked':1,'pass':1,'total':5})

        self.web.pa.machines['chassis-01']['active_os']=2
        second=self.overview()
        self.assertEqual(second['totals']['validation'],{'checked':1,'pass':1,'total':5})
        self.assertEqual(self.inspection_store.successful_nodes(self.chassis_id),{self.targets[0]['node_id']:1000})

    def test_mixed_per_node_inspection_and_active_issues_aggregate_correctly(self):
        self.seed_inspected(0,1,2)
        self.seed_failed_inspection(3)
        self.seed_issue(1,'WARNING')
        self.seed_issue(2,'FAIL')
        self.web.pa.machines['chassis-01']['active_os']=5

        data=self.overview();project=data['projects'][0]
        self.assertEqual(project['validation'],{'checked':3,'pass':1,'total':5})
        self.assertEqual(project['issues'],{'fail':1,'warning':1})
        self.assertEqual(data['totals']['validation'],{'checked':3,'pass':1,'total':5})
        self.assertEqual({issue['node'] for issue in data['issues']},{'N2','N3'})

    def test_host_reporting_requires_fresh_canonical_health_row(self):
        now=time.time();freshness=self.telemetry.config.freshness_seconds
        # Fresh Host READY.
        self.telemetry_store.health(self.targets[0],'READY','fresh')
        self.telemetry_store.components(self.targets[0]['node_id'],{'host':'READY','gpu':{'state':'READY'}})
        # Host READY, but stale.
        self.telemetry_store.health(self.targets[1],'READY','stale')
        self.telemetry_store.components(self.targets[1]['node_id'],{'host':'READY'})
        # Fresh durable row, but Host is not READY.
        self.telemetry_store.health(self.targets[2],'READY','host degraded')
        self.telemetry_store.components(self.targets[2]['node_id'],{'host':'DEGRADED'})
        # Host remains reportable even when GPU and node-level aggregate are degraded.
        self.telemetry_store.health(self.targets[3],'DEGRADED','gpu requires attention')
        self.telemetry_store.components(self.targets[3]['node_id'],{'host':'READY','gpu':{'state':'DEGRADED'}})
        # Node five deliberately has no durable Telemetry state.
        with self.telemetry_store.tx() as db:
            db.execute('UPDATE telemetry_nodes SET checked_at=? WHERE node_id=?',
                       (now-freshness-1,self.targets[1]['node_id']))

        data=self.overview()
        self.assertEqual(data['projects'][0]['monitoring'],{'reporting':2,'total':5})
        self.assertEqual(data['totals']['monitoring'],{'reporting':2,'total':5})

    def test_pre_running_is_in_progress_and_complete_is_terminal(self):
        def job(job_id,state,project='A'):
            at=time.time()
            record=dict(id=job_id,project=project,state=state,health='PENDING',created_at=at,updated_at=at)
            with self.web.store.tx() as db:
                db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?)',
                           (job_id,project,job_id,'fixture-'+job_id,state,at,store_encode(record)))

        job('pre','PRE_RUNNING')
        job('done','COMPLETE')
        # An unauthorized project's active job must not enter totals or recent activity.
        self.web.pa.projects['B']={'name':'B'}
        job('hidden','RUNNING','B')

        data=self.overview()
        self.assertEqual(data['projects'][0]['cycle'],{'running':1,'completed':1})
        self.assertEqual(data['totals']['cycle'],{'running':1,'completed':1})
        self.assertEqual({row['id'] for row in data['recent_runs']},{'pre','done'})


if __name__=='__main__':
    unittest.main()
