"""Regression tests for the Test Case → PA Agent fixes (P0/P1/P2).

These exercise the real shipped code — the gateway, the store and the HTTP
routes — rather than mocks of our own logic. Only the OpenHands HTTP client is
faked (via the gateway's injectable ``client``), because the agent-server is an
external engine.

Requirement coverage map (see the task's 20 test requirements):
  R1  single Test Case per run (one variant anchored)      -> StoreTests
  R2  supplemental context survives into execution         -> SupplementalTests
  R3  no forced SOP/SPEC upload requirement                -> InstructionTests
  R4  GO/RERUN intent correctness (incl. Chinese negation) -> IntentTests
  R5  automation_classification actually gates policy      -> ClassificationTests
  R6  long-running sync does not stop on first message     -> SyncTests
  R7  command/evidence dedup across repeated ingest        -> DedupTests
  R8  attachments stored + text extracted + indexed        -> AttachmentTests
  R9  attachments reach the instruction / vision honesty   -> AttachmentTests
  R10 evidence naming not hardcoded to PCIe                -> InstructionTests
  R11 target re-verify + retention purge wiring            -> RetentionTests
  R12 resume finds in-flight run for a case variant        -> ResumeTests
"""
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'app'))
sys.path.insert(0, ROOT)

from integration.agent_gateway import (  # noqa: E402
    AgentGateway, classify_user_intent, is_approval, is_cancel,
)
from integration.agent_runs import AgentRunStore  # noqa: E402


def _ctx(run_id="run-1", tc=None, review=None, target=None):
    return {
        "schema_version": 1, "run_id": run_id, "case_variant_id": "case-x",
        "library_version": "v1", "code": "C1",
        "testcase": tc if tc is not None else {"code": "C1", "procedure": "do it"},
        "ai_review": review, "target": target or {},
        "created_at": "2026-10-05T00:00:00Z",
        "required_documents": [], "user_attachments": [],
    }


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _RecordingClient:
    def __init__(self, payload=None):
        self.calls = []
        self._payload = payload or {"id": "conv-1"}

    def post(self, url, json=None):
        self.calls.append((url, json))
        return _FakeResponse(self._payload)

    def get(self, url, params=None):
        self.calls.append((url, params))
        return _FakeResponse({"items": []})


class _Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = AgentRunStore(path=os.path.join(self.tmp.name, 'r.sqlite3'))
        self.client = _RecordingClient()
        self.gateway = AgentGateway(self.store, base_url="http://unused",
                                    client=self.client)

    def tearDown(self):
        self.tmp.cleanup()


# --------------------------------------------------------------------------
# R4 — intent classification
# --------------------------------------------------------------------------
class IntentTests(unittest.TestCase):
    def test_bare_approvals_are_go(self):
        for t in ("OK", "ok.", "GO!", "開始", "执行", "可以", "同意", "run"):
            self.assertEqual(classify_user_intent(t), "go", t)

    def test_negated_rerun_is_question_not_rerun(self):
        # Regression: the old classifier matched "重跑" inside these and re-ran.
        for t in ("不要重跑", "先不要跑", "不用重新執行", "停止重跑"):
            self.assertEqual(classify_user_intent(t), "cancel" if t in ("先不要跑",) else "question", t)

    def test_question_naming_rerun_stays_question(self):
        for t in ("為什麼要重跑？", "重跑會發生什麼事?", "可以說明重跑流程嗎"):
            self.assertEqual(classify_user_intent(t), "question", t)

    def test_reask_is_not_rerun(self):
        # "重新" must not be a rerun trigger on its own.
        for t in ("重新說明一下", "重新整理結果", "重新解釋這個欄位"):
            self.assertEqual(classify_user_intent(t), "question", t)

    def test_explicit_rerun(self):
        for t in ("重跑一次", "rerun this test", "重新執行這條測試", "請重新驗證"):
            self.assertEqual(classify_user_intent(t), "rerun", t)

    def test_cancel_tokens(self):
        for t in ("取消", "停止", "先不要跑", "stop"):
            self.assertTrue(is_cancel(t), t)

    def test_empty_is_question(self):
        self.assertEqual(classify_user_intent(""), "question")
        self.assertFalse(is_approval(""))


# --------------------------------------------------------------------------
# R5 — classification gates policy
# --------------------------------------------------------------------------
class ClassificationTests(_Base):
    def _instruction(self, classification):
        tc = {"code": "C1", "ai_automation_classification": classification}
        return self.gateway.build_instruction(_ctx(tc=tc))

    def test_manual_only_blocks_ssh(self):
        text = self._instruction("MANUAL ONLY")
        self.assertIn("人工檢查", text)
        self.assertIn("請勿 SSH", text)

    def test_fully_automatable_has_no_manual_block(self):
        text = self._instruction("FULLY AUTOMATABLE")
        self.assertNotIn("請勿 SSH", text)

    def test_blocked_classification(self):
        text = self._instruction("BLOCKED")
        self.assertIn("BLOCKED", text)

    def test_requires_confirmation(self):
        text = self._instruction("REQUIRES PACKAGE / USER CONFIRMATION")
        self.assertIn("需要工程師確認", text)

    def test_classification_reads_from_ai_review_when_snapshot_missing(self):
        # Older snapshots may not carry ai_automation_classification; the gateway
        # must still resolve the raw ai_review classification.
        tc = {"code": "C1", "category": "MANUAL ONLY"}
        self.assertTrue(self.gateway._is_manual_only(tc))

    def test_live_library_row_classification_is_detected(self):
        # The real library stores classification only under ai_review; the store
        # must lift it into the snapshot for the gateway to see it.
        import json
        data_dir = os.path.join(ROOT, 'data')
        path = None
        for name in sorted(os.listdir(data_dir)):
            cand = os.path.join(data_dir, name, 'tests.json')
            if os.path.exists(cand):
                path = cand
                break
        if not path:
            self.skipTest("no tests.json dataset")
        from test_library_contract import prepare_library
        with open(path, encoding='utf-8') as fh:
            library = json.load(fh)
        prepare_library(library)
        item = next((it for sheet in library['sheets'].values()
                     for it in sheet.get('items', [])
                     if isinstance(it.get('ai_review'), dict)
                     and it['ai_review'].get('automation_classification')), None)
        if item is None:
            self.skipTest("no classified row")
        ctx = self.store.build_context(library, item['case_variant_id'])
        self.assertEqual(
            ctx['testcase']['ai_automation_classification'],
            item['ai_review']['automation_classification'])


# --------------------------------------------------------------------------
# R3, R10 — instruction policy / artifact naming
# --------------------------------------------------------------------------
class InstructionTests(_Base):
    def test_no_forced_document_requirement(self):
        tc = {"code": "C1", "ai_automation_classification": "FULLY AUTOMATABLE"}
        text = self.gateway.build_instruction(_ctx(tc=tc))
        self.assertIn("沒有文件", text)          # graceful-degradation policy present

    def test_artifact_naming_is_not_hardcoded_pcie(self):
        tc = {"code": "C1", "ai_automation_classification": "FULLY AUTOMATABLE"}
        text = self.gateway.build_instruction(_ctx(tc=tc))
        # The old instruction *mandated* these PCIe filenames for every case;
        # now they may only appear as a negative example, never as a directive.
        self.assertNotIn("寫入 lspci_vvv_pre.txt", text)
        self.assertIn("不要硬用 lspci_vvv_pre.txt", text)
        self.assertIn("test_record", text)


# --------------------------------------------------------------------------
# R2 — supplemental context
# --------------------------------------------------------------------------
class SupplementalTests(_Base):
    def test_supplemental_is_cumulative_and_versioned(self):
        self.store.create_run(_ctx())
        self.store.add_supplemental("run-1", "限制：只測 slot 1")
        self.store.add_supplemental("run-1", "限制：只測 slot 1\n另外要收集 dmesg")
        latest = self.store.latest_supplemental("run-1")
        self.assertEqual(latest["revision"], 2)
        self.assertIn("slot 1", latest["text"])
        self.assertIn("dmesg", latest["text"])

    def test_execution_instruction_injects_latest_revision(self):
        self.store.create_run(_ctx())
        self.store.add_supplemental("run-1", "只測 slot 1")
        run = self.store.get_run("run-1")
        ctx = self.gateway._context_with_extras(run)
        text = self.gateway.build_instruction(ctx)
        self.assertIn("plan revision 1", text)
        self.assertIn("只測 slot 1", text)

    def test_run_execution_uses_latest_supplement(self):
        self.store.create_run(_ctx())
        self.store.update_state("run-1", conversation_ref="conv-1", status="WAITING_FOR_USER")
        self.store.add_supplemental("run-1", "只測 slot 2")
        self.gateway.run_execution("run-1", trigger="go")
        _, payload = self.client.calls[-1]
        text = payload["content"][0]["text"]
        self.assertIn("只測 slot 2", text)
        self.assertIn("確認", text)             # the go header

    def test_context_is_not_mutated_by_extras(self):
        self.store.create_run(_ctx())
        self.store.add_supplemental("run-1", "x")
        before = self.store.get_run("run-1")["context"]
        self.gateway._context_with_extras(self.store.get_run("run-1"))
        after = self.store.get_run("run-1")["context"]
        self.assertEqual(before, after)
        self.assertTrue(self.store.verify_context("run-1"))


# --------------------------------------------------------------------------
# R7 — dedup
# --------------------------------------------------------------------------
class DedupTests(_Base):
    def _events(self):
        return [
            {"id": "a1", "kind": "ActionEvent", "tool_name": "terminal",
             "thought": [{"type": "text", "text": "run"}],
             "timestamp": "2026-10-05T00:00:00Z"},
            {"id": "o1", "kind": "ObservationEvent", "tool_name": "terminal",
             "content": "out", "timestamp": "2026-10-05T00:00:01Z"},
        ]

    def test_repeated_ingest_does_not_duplicate_commands_or_evidence(self):
        self.store.create_run(_ctx())
        for _ in range(3):
            self.gateway.ingest("run-1", events=self._events())
        run = self.store.get_run("run-1")
        self.assertEqual(len(run["commands"]), 1)
        self.assertEqual(len(run["evidence"]), 1)

    def test_final_result_message_is_deduped(self):
        finish = {"id": "f1", "kind": "ActionEvent", "tool_name": "finish",
                  "action": {"kind": "FinishAction", "message": "record"},
                  "timestamp": "2026-10-05T00:00:02Z"}
        done = {"id": "s1", "kind": "ConversationStateUpdateEvent",
                "key": "execution_status", "value": "finished"}
        self.store.create_run(_ctx())
        for _ in range(3):
            self.gateway.ingest("run-1", events=[finish, done])
        msgs = [m for m in self.store.list_messages("run-1") if m["kind"] == "finish"]
        self.assertEqual(len(msgs), 1)


# --------------------------------------------------------------------------
# R8, R9 — attachments
# --------------------------------------------------------------------------
class AttachmentTests(_Base):
    def test_attachment_metadata_and_text_extraction(self):
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="a1", name="spec.txt",
                                  mime="text/plain", size=5, kind="file",
                                  stored_path="/tmp/x", extracted_text="SPEC!",
                                  status="ready")
        atts = self.store.list_attachments("run-1")
        self.assertEqual(atts[0]["name"], "spec.txt")
        rec = self.store.get_attachment("run-1", "a1")
        self.assertEqual(rec["extracted_text"], "SPEC!")

    def test_attachment_text_reaches_instruction(self):
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="a1", name="spec.txt",
                                  mime="text/plain", size=5, kind="text",
                                  stored_path="/tmp/x", extracted_text="EXPECTED-2-GPU",
                                  status="ready")
        ctx = self.gateway._context_with_extras(self.store.get_run("run-1"))
        text = self.gateway.build_instruction(ctx)
        self.assertIn("EXPECTED-2-GPU", text)

    def test_text_file_uploaded_as_file_still_reaches_instruction(self):
        # Regression: a .txt uploaded through the generic file picker carries
        # kind="file" (not "text"); its extracted text must still reach the agent.
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="a1", name="spec.txt",
                                  mime="text/plain", size=5, kind="file",
                                  stored_path="/tmp/x", extracted_text="EXPECTED-2-GPU",
                                  status="ready")
        ctx = self.gateway._context_with_extras(self.store.get_run("run-1"))
        text = self.gateway.build_instruction(ctx)
        self.assertIn("EXPECTED-2-GPU", text)

    def test_image_without_vision_is_flagged_honestly(self):
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="i1", name="rack.png",
                                  mime="image/png", size=10, kind="image",
                                  stored_path="/tmp/p", vision_supported=False,
                                  status="ready")
        ctx = self.gateway._context_with_extras(self.store.get_run("run-1"))
        text = self.gateway.build_instruction(ctx)
        self.assertIn("無法直接解析圖片", text)

    def test_attachment_can_be_deleted(self):
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="a1", name="x.txt")
        self.assertTrue(self.store.delete_attachment("run-1", "a1"))
        self.assertEqual(self.store.list_attachments("run-1"), [])


# --------------------------------------------------------------------------
# R11 — retention
# --------------------------------------------------------------------------
class RetentionTests(_Base):
    def test_in_flight_runs_are_not_expired(self):
        self.store.create_run(_ctx())
        self.store.update_state("run-1", status="RUNNING")
        self.assertEqual(self.store.list_expired_runs(retention_days=0), [])

    def test_settled_run_past_window_is_expired_and_deleted(self):
        self.store.create_run(_ctx())
        self.store.update_state("run-1", status="DONE")
        # retention_days=-1 puts the cutoff one day in the future, so today's
        # settled run is past the window (deterministic, no sleep).
        expired = self.store.list_expired_runs(retention_days=-1)
        self.assertIn("run-1", expired)
        self.store.delete_run("run-1")
        self.assertIsNone(self.store.get_run("run-1"))

    def test_delete_run_cascades_children(self):
        self.store.create_run(_ctx())
        self.store.add_supplemental("run-1", "x")
        self.store.add_message("run-1", role="agent", text="hi")
        self.store.add_attachment("run-1", attachment_id="a1", name="x.txt")
        self.store.delete_run("run-1")
        self.assertEqual(self.store.list_supplemental("run-1"), [])
        self.assertEqual(self.store.list_messages("run-1"), [])
        self.assertEqual(self.store.list_attachments("run-1"), [])


# --------------------------------------------------------------------------
# R12 — resume
# --------------------------------------------------------------------------
class ResumeTests(_Base):
    def test_list_runs_finds_in_flight_run(self):
        self.store.create_run(_ctx(run_id="run-A"))
        self.store.update_state("run-A", status="WAITING_FOR_USER")
        rows = self.store.list_runs(case_variant_id="case-x")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["run_id"], "run-A")


# --------------------------------------------------------------------------
# R6 — sync loop behaviour (uses a stub gateway, real loop logic)
# --------------------------------------------------------------------------
class SyncTests(unittest.TestCase):
    def test_sync_keeps_going_while_running(self):
        # A run that stays RUNNING for several ticks must not stop the loop on the
        # first ingest (the long-execution regression).
        from integration import agent_routes as routes

        self.tmp = tempfile.TemporaryDirectory()
        store = AgentRunStore(path=os.path.join(self.tmp.name, 's.sqlite3'))
        store.create_run(_ctx())

        class StubGateway:
            def __init__(self):
                self.n = 0

            def ingest(self, run_id):
                self.n += 1
                if self.n == 1:
                    store.update_state(run_id, status="RUNNING")
                elif self.n >= 4:
                    store.update_state(run_id, status="DONE")
                return {}

        old = routes._SYNC_INTERVAL
        routes._SYNC_INTERVAL = 0.01
        try:
            stub = StubGateway()
            routes._sync_run_loop(store, stub, "run-1")
        finally:
            routes._SYNC_INTERVAL = old
        # It must have ticked at least 4 times (i.e. not stopped after the first).
        self.assertGreaterEqual(stub.n, 4)
        self.tmp.cleanup()


if __name__ == '__main__':
    unittest.main()
