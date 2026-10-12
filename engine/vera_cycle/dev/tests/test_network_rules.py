"""Network interface link-state parsing for the inspection Network source."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from validation_rules import parse_network_state, network_link_issues


SAMPLE = """\
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN
    inet 127.0.0.1/8 scope host lo
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP
    inet 10.0.0.5/24 brd 10.0.0.255 scope global eth0
3: eth1: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc mq state DOWN
4: eth2: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP
5: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN
"""


class NetworkStateTests(unittest.TestCase):
    def test_parses_up_running_and_addresses(self):
        rows = parse_network_state(SAMPLE)
        self.assertTrue(rows['eth0']['up'])
        self.assertTrue(rows['eth0']['running'])
        self.assertEqual(rows['eth0']['addrs'], ['10.0.0.5/24'])

    def test_no_carrier_is_up_but_not_running(self):
        rows = parse_network_state(SAMPLE)
        self.assertTrue(rows['eth1']['up'])
        self.assertFalse(rows['eth1']['running'])

    def test_link_down_reported_for_physical_interface(self):
        items = network_link_issues(parse_network_state(SAMPLE))
        codes = {(i['code'], i['detail'].split()[2]) for i in items}
        self.assertIn(('NET_LINK_DOWN', 'eth1'), codes)

    def test_up_interface_without_address_reported(self):
        items = network_link_issues(parse_network_state(SAMPLE))
        codes = {(i['code'], i['detail'].split()[2]) for i in items}
        self.assertIn(('NET_NO_ADDRESS', 'eth2'), codes)

    def test_virtual_interfaces_are_excluded(self):
        items = network_link_issues(parse_network_state(SAMPLE))
        self.assertFalse(any('docker0' in i['detail'] for i in items))

    def test_loopback_is_excluded(self):
        items = network_link_issues(parse_network_state(SAMPLE))
        self.assertFalse(any(' lo ' in i['detail'] for i in items))

    def test_healthy_fabric_has_no_findings(self):
        text = ("1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n"
                "2: ibs108f0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 4092\n    inet 10.0.0.9/24 scope global ibs108f0\n")
        self.assertEqual(network_link_issues(parse_network_state(text)), [])


if __name__ == '__main__':
    unittest.main()
