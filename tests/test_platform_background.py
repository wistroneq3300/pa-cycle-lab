import threading
import time
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import test_integration as base
from integration import web, legacy_observation
from scripts.native_demo import fixture


class PlatformBackground(unittest.TestCase):
    setUp=base.IntegrationTests.setUp
    tearDown=base.IntegrationTests.tearDown

    def test_power_observation_pool_preserves_actor_and_missing_actor_is_denied(self):
        doc=fixture();web.pa.machines={'chassis-01':doc['machines']['chassis-01']};web.pa.projects=doc['projects']
        web.pa._save_data();web.pa._POWER.clear()
        approved=[]
        web.app.state.cycle_provider=SimpleNamespace(
            authorize=lambda actor,project,action:actor=='pool-reader',
            approve_legacy_observation=lambda actor,targets,operation:approved.append(actor) or True)
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        with patch.object(web.pa.subprocess,'run',return_value=SimpleNamespace(stdout='Chassis Power is on',stderr='',returncode=0)) as io:
            token=legacy_observation.caller.set('pool-reader')
            try:web.pa._collect_power()
            finally:legacy_observation.caller.reset(token)
            self.assertTrue(io.called)
            self.assertEqual(set(approved),{'pool-reader'})
            io.reset_mock();web.pa._POWER.clear()
            web.pa._collect_power()
            io.assert_not_called()

    def test_background_network_collection_carries_actor_but_rechecks_guard(self):
        doc=fixture();web.pa.machines=doc['machines'];web.pa.projects=doc['projects']
        web.pa._save_data()
        machine=dict(web.pa.machines['chassis-01'],bmc_ip='')
        approved=[];io=[]
        provider=SimpleNamespace(authorize=lambda actor,project,action:actor=='reader-A',
            approve_legacy_observation=lambda actor,targets,operation:approved.append((actor,operation)) or True)
        web.app.state.cycle_provider=provider
        self.addCleanup(lambda:delattr(web.app.state,'cycle_provider'))
        web.pa._network_identity_cache.clear()
        def run(*args,**kwargs):
            io.append(threading.get_ident())
            return SimpleNamespace(stdout='2: eth0: <UP>\n link/ether 02:00:00:00:00:01\n inet '+machine['os_ip']+'/24',stderr='',returncode=0)
        token=legacy_observation.caller.set('reader-A')
        try:
            with patch.object(web.pa.subprocess,'run',run):
                web.pa._network_identity(machine,refresh=True)
                deadline=time.monotonic()+2
                while web.pa._network_identity_pending and time.monotonic()<deadline:time.sleep(.01)
        finally:legacy_observation.caller.reset(token)
        self.assertEqual(len(io),1)
        self.assertNotEqual(io[0],threading.get_ident())
        self.assertEqual(approved[0][0],'reader-A')
        self.assertEqual(self.store.lock_owners(),{})
