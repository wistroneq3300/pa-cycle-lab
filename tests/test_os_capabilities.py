"""PATCH /api/machines/{name}/os/{slot} capabilities editing (BMC hostname query)."""
import copy
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from integration import web
import node_identity


def sample_node(slot=1):
    return {"slot": slot, "ip": f"10.0.0.{slot}", "user": "root", "pass": "pw", "port": 22,
            "label": f"OS {slot}", "bmc_ip": f"10.0.1.{slot}", "bmc_user": "root", "bmc_pass": "pw",
            "bmc_ssh_port": 22, "ipmi_port": 623}


class OsCapabilities(unittest.TestCase):
    def setUp(self):
        self.main = web.pa
        self.client = TestClient(web.app)
        self._saved = copy.deepcopy(self.main.machines)
        self.main.machines.clear()
        self.main.machines["box"] = {"name": "box", "project": "p", "mgx_type": "server",
                                     "os": [node_identity.canonical({"name": "box", "os": [sample_node()]})["os"][0]]}
        self.saved_writes = []
        self._orig_save = self.main._save_data
        # Avoid touching the real data file / caches during the request.
        self.main._save_data = lambda: self.saved_writes.append(1)
        self._orig_invalidate = self.main._invalidate_machine_cache
        self.main._invalidate_machine_cache = lambda name: None

    def tearDown(self):
        self.main._save_data = self._orig_save
        self.main._invalidate_machine_cache = self._orig_invalidate
        self.main.machines.clear()
        self.main.machines.update(self._saved)
        self.client.close()

    def node(self):
        return self.main.machines["box"]["os"][0]

    def revision(self):
        return node_identity.binding(self.node())

    def patch(self, body):
        return self.client.patch("/api/machines/box/os/1", json=body)

    def test_sets_ssh_capability_and_bumps_revision(self):
        before = self.revision()
        response = self.patch({"expected_node_id": self.node()["node_id"],
                               "expected_binding_revision": before,
                               "capabilities": {"bmc_hostname_query": "ssh_hostname"}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.node()["capabilities"], {"bmc_hostname_query": "ssh_hostname"})
        self.assertEqual(int(self.node()["binding_revision"]), 2)
        self.assertNotEqual(self.revision(), before)
        # Frontend needs the capability back with a fresh revision.
        entry = response.json()["machine"]["os"][0]
        self.assertEqual(entry["capabilities"], {"bmc_hostname_query": "ssh_hostname"})
        self.assertEqual(entry["expected_binding_revision"], self.revision())

    def test_merge_preserves_existing_capabilities(self):
        self.node()["capabilities"] = {"other_flag": "keep"}
        response = self.patch({"capabilities": {"bmc_hostname_query": "ssh_hostname"}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.node()["capabilities"],
                         {"other_flag": "keep", "bmc_hostname_query": "ssh_hostname"})

    def test_empty_value_removes_capability(self):
        self.node()["capabilities"] = {"bmc_hostname_query": "ssh_hostname"}
        response = self.patch({"capabilities": {"bmc_hostname_query": ""}})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.node()["capabilities"], {})

    def test_rejects_unknown_capability_and_value(self):
        self.assertEqual(self.patch({"capabilities": {"evil": "x"}}).status_code, 422)
        self.assertEqual(self.patch({"capabilities": {"bmc_hostname_query": "nope"}}).status_code, 422)
        self.assertNotIn("capabilities", self.node())

    def test_accepts_redfish_and_auto_modes(self):
        for value in ("auto", "redfish", "ssh_hostname"):
            self.assertEqual(self.patch({"capabilities": {"bmc_hostname_query": value}}).status_code, 200, value)
            self.assertEqual(self.node()["capabilities"], {"bmc_hostname_query": value})

    def test_stale_revision_conflicts(self):
        response = self.patch({"expected_node_id": self.node()["node_id"],
                               "expected_binding_revision": "deadbeef",
                               "capabilities": {"bmc_hostname_query": "ssh_hostname"}})
        self.assertEqual(response.status_code, 409)

    def test_omitted_capabilities_untouched(self):
        self.node()["capabilities"] = {"bmc_hostname_query": "ssh_hostname"}
        before = self.revision()
        response = self.patch({"label": "OS 1"})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.node()["capabilities"], {"bmc_hostname_query": "ssh_hostname"})
        self.assertEqual(self.revision(), before)


class SshHostnameObservation(unittest.TestCase):
    def _collect(self, capability=None, ssh_ok=True):
        from engine.vera_cycle.validation_identity import collect_identity
        calls = []

        class Transport:
            def ssh(self, target, role, command, timeout, strict):
                calls.append(("ssh", role, command))
                if not ssh_ok:
                    return type("R", (), {"code": 255, "output": "connection refused"})
                return type("R", (), {"code": 0, "output": "bmc.example\n"})

            def redfish_login(self, target):
                calls.append(("redfish",))
                return "tok"

            def redfish_get(self, target, path, token, timeout):
                calls.append(("redfish_get", path))
                if path == "/redfish/v1/Managers":
                    return type("R", (), {"code": 0, "output": '{"Members":[{"@odata.id":"/redfish/v1/Managers/bmc"}]}'})
                return type("R", (), {"code": 0, "output": '{"HostName":"rf.example"}'})

            def redfish_logout(self, target, token):
                calls.append(("redfish_logout",))

        class Collector:
            transport = Transport()
            target = {"name": "box"}

            def read(self, key):
                return {"raw": "HOSTNAME=os.example\nBOOT_ID=2f9a7e2a-0000-0000-0000-000000000000\n",
                        "collection_status": "SUCCESS", "collected_at": "2026-10-04T00:00:00Z"}

        binding = {"node_id": "n1", "chassis_id": "c1", "revision": "r1", "os_ip": "10.0.0.1",
                   "bmc_ip": "10.0.1.1"}
        if capability is not None:
            binding["capabilities"] = {"bmc_hostname_query": capability}
        return collect_identity(Collector(), binding), calls

    def test_default_auto_prefers_ssh(self):
        result, calls = self._collect()
        self.assertEqual(result["bmc_hostname"], "bmc.example")
        self.assertEqual(result["bmc_status"], "SUCCESS")
        self.assertEqual(result["bmc_source"], "bmc_ssh_hostname")
        self.assertEqual(calls, [("ssh", "bmc", "hostname")])

    def test_auto_falls_back_to_redfish_when_ssh_fails(self):
        result, calls = self._collect(ssh_ok=False)
        self.assertEqual(result["bmc_hostname"], "rf.example")
        self.assertEqual(result["bmc_status"], "SUCCESS")
        self.assertEqual(result["bmc_source"], "/redfish/v1/Managers/bmc/HostName")
        self.assertEqual(calls[0], ("ssh", "bmc", "hostname"))
        self.assertIn(("redfish",), calls)

    def test_explicit_redfish_skips_ssh(self):
        result, calls = self._collect(capability="redfish")
        self.assertEqual(result["bmc_source"], "/redfish/v1/Managers/bmc/HostName")
        self.assertFalse(any(c[0] == "ssh" for c in calls))

    def test_pinned_ssh_does_not_fall_back(self):
        result, calls = self._collect(capability="ssh_hostname", ssh_ok=False)
        self.assertIsNone(result["bmc_hostname"])
        self.assertFalse(any(c[0] == "redfish" for c in calls))


if __name__ == "__main__":
    unittest.main()
