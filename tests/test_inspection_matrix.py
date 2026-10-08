import tempfile
import unittest
from pathlib import Path

from integration.inspection import InspectionEvaluator, InspectionStore
from integration.inspection_service import InspectionService


class InspectionMatrix(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = InspectionStore(Path(self.temp.name) / "inspection.sqlite3")
        self.now = 10_000.0
        self.store.configure("system", {"enabled": True}, "tester", self.now)

    def tearDown(self):
        self.temp.cleanup()

    def evaluate(self, *, state="FRESH", collected_at=None, details=None, findings=None, evidence=True):
        collected_at = self.now if collected_at is None else collected_at
        ref = {"snapshot_id": "snapshot-1"} if evidence else None
        coverage = [{"node_id": "node-1", "source": "Hardware", "state": state,
                     "collected_at": collected_at, "freshness_seconds": 300,
                     "evidence_ref": ref}]
        snapshots = []
        if evidence:
            snapshots.append({"snapshot_id": "snapshot-1", "node_id": "node-1",
                              "collected_at": collected_at, "collector_name": "Hardware",
                              "data": details or {}, "findings": findings or [],
                              "raw_evidence": "snapshot-1.txt"})
        batch = {"snapshots": snapshots, "states": {"node-1": {"version": ["v", "c", "p", 1],
                 "sources": {"Hardware": coverage[0]}}}, "summary": {}}
        InspectionEvaluator(self.store, lambda: self.now).evaluate(
            "system", [], coverage=coverage, batch=batch)

    def test_project_checker_rows_keep_health_separate_from_coverage(self):
        self.evaluate(details={
            "CPU_ONLINE": {"name": "CPU_ONLINE", "status": "PASS", "values": {"actual": "2", "minimum": "2"}, "raw": "cpu"},
            "SSD_COUNT": {"name": "SSD_COUNT", "status": "FAIL", "values": {"actual": "1", "exact": "2"}, "raw": "ssd"},
            "GPU": {"name": "GPU", "status": "UNSUPPORTED", "values": {"state": "unsupported"}, "raw": "gpu"},
        }, findings=[{"severity": "FAIL", "component": "SSD_COUNT", "detail": "Expected 2 / Observed 1"}])
        result = self.store.check_matrix("system", [{"node_id": "node-1", "label": "N1"}], self.now)
        rows = {row["check_name"]: row for row in result["rows"]}
        self.assertEqual(rows["CPU_ONLINE"]["status"], "PASS")
        self.assertEqual(rows["SSD_COUNT"]["status"], "FAIL")
        self.assertEqual(rows["SSD_COUNT"]["expected"], "2")
        self.assertEqual(rows["SSD_COUNT"]["observed"], "1")
        self.assertEqual(rows["GPU"]["status"], "NOT_APPLICABLE")
        self.assertEqual(result["summary"]["completed"], 2)
        self.assertEqual(result["summary"]["required"], 2)
        self.assertEqual(result["summary"]["coverage"], 100.0)
        self.assertEqual(result["summary"]["fail"], 1)

    def test_stale_missing_and_disabled_never_become_pass(self):
        self.evaluate(collected_at=self.now - 301,
                      details={"CPU": {"name": "CPU", "status": "PASS", "values": {}, "raw": "cpu"}})
        stale = self.store.check_matrix("system", [{"node_id": "node-1", "label": "N1"}], self.now)
        self.assertEqual(stale["rows"][0]["status"], "STALE")
        self.assertEqual(stale["summary"]["completed"], 0)
        self.store.configure("system", {"enabled": False}, "tester", self.now)
        disabled = self.store.check_matrix("system", [{"node_id": "node-1", "label": "N1"}], self.now)
        self.assertEqual(disabled["rows"][0]["status"], "NOT_MONITORED")
        self.assertEqual(disabled["summary"]["completed"], 0)

    def test_disabled_not_applicable_check_stays_out_of_coverage_denominator(self):
        self.evaluate(details={"GPU":{"name":"GPU / NVLink","status":"UNSUPPORTED","values":{},"raw":"gpu"}})
        self.store.configure("system",{"enabled":False},"tester",self.now)
        result=self.store.check_matrix("system",[{"node_id":"node-1","label":"N1"}],self.now)
        self.assertEqual(result["rows"][0]["status"],"NOT_MONITORED")
        self.assertFalse(result["rows"][0]["required"])
        self.assertEqual(result["summary"]["required"],0)

    def test_node_override_controls_scheduled_coverage_state(self):
        self.store.configure("system", {"enabled": False, "node_overrides": {"node-1": True}}, "tester", self.now)
        self.evaluate(details={"CPU": {"name": "CPU", "status": "PASS", "values": {}, "raw": "cpu"}})
        nodes = self.store.coverage_nodes("system", now=self.now)
        self.assertTrue(nodes["node-1"]["enabled"])
        self.assertTrue(nodes["node-1"]["valid"])

    def test_node_override_runs_scheduler_when_project_default_is_disabled(self):
        calls=[]
        system={"id":"system","name":"System","project":"Project","nodes":[{"node_id":"node-1"}]}
        def source(*args):
            calls.append(args[1]["_scheduled"])
            return [],[],[]
        service=InspectionService(self.store.path,lambda:[system],source,clock=lambda:self.now+100)
        try:
            self.store.configure("system",{"enabled":False,"node_overrides":{"node-1":True}},"tester",self.now-100)
            service.run(system,scheduled=True)
        finally:
            service.close()
        self.assertEqual(calls,[True])


if __name__ == "__main__":
    unittest.main()
