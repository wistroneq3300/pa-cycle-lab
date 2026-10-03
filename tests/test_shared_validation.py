"""Shared rules and independent collection; every remote operation is a spy."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'engine'/'vera_cycle'))


class SharedContract(unittest.TestCase):
    def test_cycle_exports_are_the_same_rule_objects(self):
        import cycle_core
        import validation_rules
        for name in ('parse_sensors','sensor_issues','parse_pci','parse_pci_verbose',
                     'pci_issues','config_issues','dmesg_issues','sel_delta','redfish_entries'):
            self.assertIs(getattr(cycle_core,name),getattr(validation_rules,name),name)

    def test_read_plan_has_no_cycle_side_effects(self):
        from validation_collectors import OPERATIONS
        commands=[o.command for o in OPERATIONS.values()]
        for bad in ('reboot','power cycle','power off','aux_cycle','dmesg -c','sel clear','apt-get','mst start','-Dxxx'):
            self.assertFalse(any(bad in cmd for cmd in commands),bad)
        self.assertEqual(commands.count('lspci -Dvv -nn'),1)

    def test_sensor_warning_and_kernel_are_native_shared_findings(self):
        from validation_rules import sensor_issues,parse_sensors,dmesg_issues
        self.assertEqual(sensor_issues(parse_sensors('CPU Temp | 80 | degrees C | unc'))[0]['severity'],'WARN')
        self.assertTrue(dmesg_issues('[1.0] NVRM: Xid (PCI:0000:01:00): 79, GPU has fallen off the bus.'))

    def test_cycle_shares_pci_capture_and_preserves_distinct_evidence(self):
        import tempfile
        from types import SimpleNamespace
        from cycle_core import Target,digest
        from cycle_engine import NodeSession
        from integration.synthetic import SyntheticTransport
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); engine=Path(__file__).resolve().parents[1]/'engine/vera_cycle'
            script=(engine/'neutrino_config.sh').read_bytes()
            fake=SyntheticTransport({},root/'ssh')
            node=Target('t','n1','198.51.100.1','192.0.2.1','bmc1','os1')
            options=SimpleNamespace(project='neutrino',cycle_mode='reboot',channel='inband',boot_timeout=.1,poll_interval=.001,loops=1,hours=0,memory_min_ratio=.9)
            session=NodeSession(node,fake,root,'fixture',script,digest(script),options,[])
            session.precheck()
            commands=[c[2] for c in fake.calls]
            self.assertEqual(commands.count('lspci -Dvv -nn'),1)
            self.assertEqual(commands.count('lspci -Dnn'),0)
            self.assertEqual(commands.count('lspci -Dvvv'),0)
            self.assertEqual(commands.count('lspci -Dtv'),1)
            self.assertEqual(commands.count('lspci -Dxxx'),1)
            self.assertTrue(any('VALIDATION_PCI_INPUT=' in c for c in commands))
            self.assertTrue(list(root.rglob('pre_pci_tree.txt')))
            self.assertTrue(list(root.rglob('pre_pci_config.txt')))

if __name__=='__main__': unittest.main()
