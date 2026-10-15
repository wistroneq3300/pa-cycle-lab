import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from integration.formal_test_locks import (  # noqa: E402
    FormalTestBusy,
    FormalTestCoordinator,
    formal_scopes,
)
from integration.agent_routes import AgentRunCreateReq  # noqa: E402
from integration.store import Store  # noqa: E402


class FormalTestCoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.coordinator = FormalTestCoordinator(
            os.path.join(self.tmp.name, "formal-tests.sqlite3"))

    def tearDown(self):
        self.tmp.cleanup()

    def test_same_node_rejected_without_queue(self):
        target = {"node_id": "node-a", "bmc_ip": "192.0.2.10",
                  "power_domain": "pdu-a"}
        self.coordinator.acquire("agent:r1", "AGENT", [target])
        with self.assertRaisesRegex(FormalTestBusy, "未建立自動 Queue"):
            self.coordinator.acquire("cycle:j1", "CYCLE", [target])
        self.assertEqual({row["owner"] for row in self.coordinator.rows()},
                         {"agent:r1"})

    def test_distinct_nodes_run_concurrently(self):
        self.coordinator.acquire("agent:r1", "AGENT", [
            {"node_id": "node-a", "bmc_ip": "192.0.2.10",
             "power_domain": "pdu-a"}])
        self.coordinator.acquire("agent:r2", "AGENT", [
            {"node_id": "node-b", "bmc_ip": "192.0.2.11",
             "power_domain": "pdu-b"}])
        self.assertTrue(self.coordinator.owns("agent:r1"))
        self.assertTrue(self.coordinator.owns("agent:r2"))

    def test_shared_bmc_or_power_domain_conflicts(self):
        self.coordinator.acquire("agent:r1", "AGENT", [
            {"node_id": "node-a", "bmc_ip": "192.0.2.10",
             "power_domain": "shared-pdu"}])
        with self.assertRaises(FormalTestBusy):
            self.coordinator.acquire("cycle:j1", "CYCLE", [
                {"node_id": "node-b", "bmc_ip": "192.0.2.20",
                 "power_domain": "shared-pdu"}])
        with self.assertRaises(FormalTestBusy):
            self.coordinator.acquire("cycle:j2", "CYCLE", [
                {"node_id": "node-c", "bmc_ip": "192.0.2.10",
                 "power_domain": "pdu-c"}])

    def test_release_and_restart_prune(self):
        target = {"node_id": "node-a"}
        self.coordinator.acquire("agent:r1", "AGENT", [target])
        restarted = FormalTestCoordinator(self.coordinator.path)
        self.assertTrue(restarted.owns("agent:r1"))
        self.assertEqual(restarted.prune("agent:", set()), ["agent:r1"])
        restarted.acquire("cycle:j1", "CYCLE", [target])
        restarted.release("cycle:j1")
        self.assertFalse(restarted.owns("cycle:j1"))

    def test_scopes_do_not_include_interactive_sessions(self):
        scopes = formal_scopes({"node_id": "node-a", "controller_id": "bmc-a",
                                "bmc_ip": "192.0.2.10", "power_domain": "pdu-a"})
        self.assertIn("node:node-a", scopes)
        self.assertIn("controller:bmc-a", scopes)
        self.assertNotIn("terminal", " ".join(scopes).lower())
        self.assertNotIn("kvm", " ".join(scopes).lower())

    def test_cycle_store_reserves_and_releases_formal_scope(self):
        store = Store(os.path.join(self.tmp.name, "jobs.sqlite3"))
        target = {"name": "node-a", "node_id": "node-a",
                  "bmc_ip": "192.0.2.10", "power_domain": "pdu-a"}
        request = {"idempotency_key": "formal-cycle-1",
                   "cycle_mode": "reboot", "channel": "inband"}
        job = store.create("Project A", request, [target], "engineer",
                           mode="synthetic")
        with self.assertRaises(FormalTestBusy):
            store.formal_tests.acquire("agent:r1", "AGENT", [target])
        store.stop(job["id"], "engineer")
        store.formal_tests.acquire("agent:r1", "AGENT", [target])
        self.assertTrue(store.formal_tests.owns("agent:r1"))


class SingleCaseRequestTests(unittest.TestCase):
    def test_single_variant_is_accepted(self):
        request = AgentRunCreateReq(case_variant_id="variant-a", node_id="node-a")
        self.assertEqual(request.case_variant_id, "variant-a")

    def test_batch_payload_is_rejected(self):
        with self.assertRaises(Exception):
            AgentRunCreateReq(case_variant_id="variant-a",
                              case_variant_ids=["variant-a", "variant-b"])


if __name__ == "__main__":
    unittest.main()
