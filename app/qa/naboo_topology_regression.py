"""Naboo topology generator regression; synthetic inventory only."""
import copy
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("configure_naboo_topology", ROOT / "scripts" / "configure_naboo_topology.py")
module = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(module)


class NabooTopologyRegression(unittest.TestCase):
    def inventory(self):
        machines = {}
        for index in range(1, 33):
            machines[f"naboo-{index:02d}"] = {"project": "Naboo", "level": "rack", "mgx_type": "server"}
        for index in range(1, 3):
            machines[f"Switch-{index}"] = {"project": "Naboo", "level": "rack", "mgx_type": "switch"}
        for index in range(1, 4):
            machines[f"power-shelf-{index}"] = {"project": "Naboo", "level": "rack", "mgx_type": "powershelf"}
        machines["CDU-1-main"] = {"project": "Naboo", "level": "rack", "mgx_type": "cdu"}
        machines["not-in-rack"] = {"project": "Naboo", "level": "system", "mgx_type": "server"}
        return {"projects": {"Naboo": {"name": "Naboo"}}, "machines": machines}

    def test_builds_confirmed_32_by_4_topology(self):
        topology = module.build_topology(self.inventory())
        rack = topology["racks"][0]
        servers = [device for device in rack["devices"] if device["kind"] == "server"]
        switches = [device for device in rack["devices"] if device["kind"] == "switch"]
        management = [device for device in rack["devices"] if device["kind"] == "other"]
        self.assertEqual((len(servers), len(switches), len(management)), (32, 2, 4))
        self.assertEqual(sum(len(server["nodes"]) for server in servers), 128)
        self.assertTrue(all(len(server["ports"]) == 2 for server in servers))
        self.assertTrue(all(len(port["nodes"]) == 4 for server in servers for port in server["ports"]))
        self.assertEqual(len(rack["links"]), 69)
        self.assertTrue(all(link["state"] == "confirmed" for link in rack["links"]))
        self.assertEqual({kind: sum(link["network"] == kind for link in rack["links"])
                          for kind in ("host", "dpu", "uplink", "power", "cooling")},
                         {"host": 32, "dpu": 32, "uplink": 1, "power": 3, "cooling": 1})

        by_inventory = {device["inventory"]: device for device in management}
        self.assertEqual(set(by_inventory),
                         {"power-shelf-1", "power-shelf-2", "power-shelf-3", "CDU-1-main"})
        self.assertTrue(all(len(device["ports"]) == 1 for device in management))
        self.assertEqual({by_inventory[f"power-shelf-{index}"]["ports"][0]["role"]
                          for index in range(1, 4)}, {"power"})
        self.assertEqual(by_inventory["CDU-1-main"]["ports"][0]["role"], "cooling")

        links_by_id = {link["id"]: link for link in rack["links"]}
        for index in range(1, 4):
            link = links_by_id[f"naboo-power-{index}"]
            self.assertEqual(link["a"], {"device": "naboo-switch-1", "port": f"sw1-p{32 + index}"})
            self.assertEqual(link["b"]["device"], f"naboo-power-shelf-{index}")
        self.assertEqual(links_by_id["naboo-cooling-1"]["a"],
                         {"device": "naboo-switch-1", "port": "sw1-p36"})
        self.assertEqual(links_by_id["naboo-switch-interconnect"]["a"]["port"], "sw1-p48")

    def test_preserves_existing_node_ips_and_rejects_wrong_inventory(self):
        data = self.inventory(); first = module.build_topology(data)
        node = first["racks"][0]["devices"][2]["nodes"][0]
        node.update(host_os="192.0.2.10", dpu_bmc="2001:db8::10")
        data["projects"]["Naboo"]["topology"] = first
        rebuilt = module.build_topology(copy.deepcopy(data))
        restored = rebuilt["racks"][0]["devices"][2]["nodes"][0]
        self.assertEqual((restored["host_os"], restored["dpu_bmc"]), ("192.0.2.10", "2001:db8::10"))
        del data["machines"]["naboo-32"]
        with self.assertRaisesRegex(ValueError, "32 台伺服器"):
            module.build_topology(data)

        data = self.inventory()
        del data["machines"]["power-shelf-3"]
        with self.assertRaisesRegex(ValueError, "3 台 Power Shelf"):
            module.build_topology(data)

    def test_rebuild_is_stable_except_for_revision(self):
        data = self.inventory()
        first = module.build_topology(data)
        data["projects"]["Naboo"]["topology"] = first
        second = module.build_topology(copy.deepcopy(data))
        data["projects"]["Naboo"]["topology"] = second
        third = module.build_topology(copy.deepcopy(data))
        self.assertEqual((first["revision"], second["revision"], third["revision"]), (1, 2, 3))
        for document in (first, second, third):
            document.pop("revision")
        self.assertEqual(first, second)
        self.assertEqual(second, third)


if __name__ == "__main__":
    unittest.main()
