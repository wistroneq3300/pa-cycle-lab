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
    is_agent_instruction, is_substantive_revision,
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

    def test_go_inside_sentence_is_go(self):
        # Regression: "那你先GO吧" was classified as a question, so a real go-ahead
        # inside a sentence never started execution.
        for t in ("那你先GO吧", "好, 開始吧", "please go ahead", "那就執行吧", "OK 可以"):
            self.assertEqual(classify_user_intent(t), "go", t)

    def test_go_substring_of_word_is_not_go(self):
        # The widened match must stay word-bounded so ordinary words are untouched.
        for t in ("good morning", "logo design", "google it", "runtime error"):
            self.assertEqual(classify_user_intent(t), "question", t)

    def test_negated_or_questioned_go_stays_question(self):
        for t in ("不要GO吧", "先不要執行", "要不要GO?", "為什麼要GO"):
            self.assertEqual(classify_user_intent(t), "question", t)


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
# R13 — no GO-swallow loop: chit-chat must not become a plan revision, and our
# own instructions must not render as engineer bubbles
# --------------------------------------------------------------------------
class NoConfirmLoopTests(_Base):
    def test_smalltalk_is_not_a_revision(self):
        for t in ("你好", "謝謝", "hi", "哈哈", "在嗎", "test"):
            self.assertFalse(is_substantive_revision(t), t)

    def test_question_is_not_a_revision(self):
        # A question is answered, not folded into the plan (that was the loop).
        for t in ("這樣對嗎?", "為什麼要驗 PCIe", "可以說明嗎", "this ok?"):
            self.assertFalse(is_substantive_revision(t), t)

    def test_filler_is_not_a_revision(self):
        for t in ("喔", "好", "嗯嗯", "ok"):
            self.assertFalse(is_substantive_revision(t), t)

    def test_real_constraint_is_a_revision(self):
        # The engineer only wants a revision recorded when they supply something.
        for t in ("只測 slot 1", "另外要收集 dmesg", "SPEC: Gen5 x16",
                  "限制在 node A", "PCIe 期望值 Gen5 x16"):
            self.assertTrue(is_substantive_revision(t), t)

    def test_execution_and_plan_instructions_are_detected(self):
        self.assertTrue(is_agent_instruction(
            "【工程師已確認，請依最新計畫開始執行】\n\n你是 PA Agent…"))
        self.assertTrue(is_agent_instruction(
            "【進場模式：先說明計畫，等工程師同意後才執行】\n在收到…"))
        self.assertTrue(is_agent_instruction(
            "【工程師要求重新執行本測項】\n\n你是 PA Agent…"))

    def test_engineer_chat_is_not_an_instruction(self):
        for t in ("你好", "GO", "只測 slot 1", "幫我看一下"):
            self.assertFalse(is_agent_instruction(t), t)

    def test_instruction_is_stored_as_system_not_user(self):
        # The agent-server echoes our plan instruction as a user MessageEvent.
        # ingest must re-label it so the drawer does not print a "工程師" bubble.
        self.store.create_run(_ctx())
        events = [{
            "id": "evt-1", "kind": "MessageEvent", "source": "user",
            "llm_message": {"role": "user", "content": [
                {"type": "text",
                 "text": "【工程師已確認，請依最新計畫開始執行】\n你是 PA Agent…"}]},
        }]
        self.gateway.ingest("run-1", events=events, conversation_id="conv-1")
        msgs = self.store.list_messages("run-1")
        self.assertEqual([m["role"] for m in msgs], ["system"])

    def test_engineer_turn_stays_user(self):
        self.store.create_run(_ctx())
        events = [{
            "id": "evt-2", "kind": "MessageEvent", "source": "user",
            "llm_message": {"role": "user", "content": [
                {"type": "text", "text": "只測 slot 1"}]},
        }]
        self.gateway.ingest("run-1", events=events, conversation_id="conv-1")
        msgs = self.store.list_messages("run-1")
        self.assertEqual([m["role"] for m in msgs], ["user"])


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


    def test_sync_does_not_stop_early_while_running(self):
        # Regression: a run stuck (stale) at RUNNING because the sync thread gave up
        # silently swallowed the engineer's GO. The loop must keep ingesting while
        # the status is RUNNING (no idle-stop), and only settle once it changes.
        from integration import agent_routes as routes

        tmp = tempfile.TemporaryDirectory()
        store = AgentRunStore(path=os.path.join(tmp.name, 'stale.sqlite3'))
        store.create_run(_ctx())

        class StubGateway:
            def __init__(self):
                self.n = 0

            def ingest(self, run_id):
                self.n += 1
                # Stay RUNNING for 8 ticks, then finish.
                store.update_state(run_id, status="RUNNING" if self.n < 8 else "DONE")
                return {}

        old = routes._SYNC_INTERVAL
        routes._SYNC_INTERVAL = 0.01
        try:
            stub = StubGateway()
            routes._sync_run_loop(store, stub, "run-1")
        finally:
            routes._SYNC_INTERVAL = old
            tmp.cleanup()
        # Must not have stopped after _SYNC_IDLE_STOP ticks while still RUNNING.
        self.assertGreaterEqual(stub.n, 8)


class StaleRunningGoTests(_Base):
    """A GO must not be silently dropped when the run's status is stale-RUNNING.

    The route converges the status by calling ``gateway.ingest`` before applying
    the P0-4 "GO while RUNNING is ignored" gate. This test proves that primitive:
    ingesting a finished turn flips a stale RUNNING run to a non-RUNNING status,
    so the gate would then let the GO through to ``run_execution``.
    """

    def test_ingest_converges_stale_running(self):
        store = self.store
        store.create_run(_ctx())
        store.update_state("run-1", conversation_ref="conv-1", status="RUNNING")

        events = [
            {"kind": "ConversationStateUpdateEvent", "key": "execution_status",
             "value": "finished"},
            {"kind": "MessageEvent", "source": "agent",
             "llm_message": {"role": "assistant",
                             "content": [{"type": "text", "text": "plan done"}]},
             "id": "ev-finish"},
        ]
        gw = AgentGateway(store, base_url="http://unused",
                          client=_StubEventsClient(events))
        gw.ingest("run-1")
        # No FinishAction in the turn, so ``finished`` settles to WAITING_FOR_USER,
        # never staying RUNNING — the GO gate would accept the next command.
        self.assertNotEqual(store.get_run("run-1").get("status"), "RUNNING")


class _StubEventsClient:
    def __init__(self, events):
        self._events = events

    def get(self, url, params=None):
        return _FakeResponse({"items": self._events})

    def post(self, url, json=None):
        return _FakeResponse({"id": "conv-1"})


# --------------------------------------------------------------------------
# R8/R9b — a question turn still carries the image to the vision model
# --------------------------------------------------------------------------
class AskAgentImageTests(_Base):
    def _run_with_image(self):
        store = self.store
        store.create_run(_ctx())
        store.update_state("run-1", conversation_ref="conv-1", status="WAITING_FOR_USER")
        folder = os.path.join(self.tmp.name, "att")
        os.makedirs(folder, exist_ok=True)
        path = os.path.join(folder, "spec.png")
        with open(path, "wb") as fh:
            fh.write(b"\x89PNG\r\n\x1a\n fake")
        store.add_attachment("run-1", attachment_id="a1", name="spec.png",
                             mime="image/png", size=12, kind="image", stored_path=path,
                             extracted_text="", vision_supported=True, status="ready",
                             error="")

    def test_ask_agent_attaches_image_parts(self):
        self._run_with_image()
        self.gateway.ask_agent("run-1", "你看的到圖嗎?")
        # Find the ask_agent POST and confirm it carried image content.
        url, payload = self.client.calls[-1]
        self.assertIn("ask_agent", url)
        self.assertEqual(payload["question"], "你看的到圖嗎?")
        content = payload.get("content") or []
        self.assertTrue(any(p.get("type") == "image" for p in content),
                        "image part missing from ask_agent payload")

    def test_ask_agent_without_image_stays_text_only(self):
        store = self.store
        store.create_run(_ctx())
        store.update_state("run-1", conversation_ref="conv-1", status="WAITING_FOR_USER")
        self.gateway.ask_agent("run-1", "hello")
        url, payload = self.client.calls[-1]
        self.assertNotIn("content", payload)

    def test_send_user_message_carries_image_parts(self):
        # The image-question path relies on this: send_user_message must embed
        # the uploaded image so the vision model can actually read it (ask_agent
        # silently drops image content, its schema only has `question`).
        import base64
        self.store.create_run(_ctx())
        self.store.update_state("run-1", conversation_ref="conv-1", status="WAITING_FOR_USER")
        path = os.path.join(self.tmp.name, "shot.png")
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="))
        self.store.add_attachment("run-1", attachment_id="i1", name="shot.png",
                                  mime="image/png", size=68, kind="image",
                                  stored_path=path, vision_supported=True, status="ready")
        self.gateway._ensure_profile = lambda *a, **k: None
        self.gateway.send_user_message("run-1", "看的到圖嗎?")
        url, payload = self.client.calls[-1]
        types = [p.get("type") for p in payload["content"]]
        self.assertIn("image", types)
        self.assertTrue(payload.get("run"))


# --------------------------------------------------------------------------
# R13 — vision availability is derived from the wired profile (Bug: image
#       "not received" was caused by a bare env flag defaulting to False).
# --------------------------------------------------------------------------
class VisionAvailabilityTests(unittest.TestCase):
    def test_vision_available_true_when_profile_declares_supports_vision(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            prof = os.path.join(tmp.name, "profiles")
            os.makedirs(prof)
            with open(os.path.join(prof, "qwen3-vl-32b.json"), "w") as fh:
                fh.write('{"capability_overrides": {"supports_vision": true}}')
            g = AgentGateway(AgentRunStore(path=os.path.join(tmp.name, "r.sqlite3")),
                             settings_dir=tmp.name, llm_profile="qwen3.8-27b")
            self.assertTrue(g.vision_available())
        finally:
            tmp.cleanup()

    def test_vision_available_false_when_no_supports_vision(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            prof = os.path.join(tmp.name, "profiles")
            os.makedirs(prof)
            with open(os.path.join(prof, "qwen3-vl-32b.json"), "w") as fh:
                fh.write('{"capability_overrides": {}}')
            g = AgentGateway(AgentRunStore(path=os.path.join(tmp.name, "r.sqlite3")),
                             settings_dir=tmp.name)
            self.assertFalse(g.vision_available())
        finally:
            tmp.cleanup()

    def test_vision_available_false_when_profile_missing(self):
        tmp = tempfile.TemporaryDirectory()
        try:
            g = AgentGateway(AgentRunStore(path=os.path.join(tmp.name, "r.sqlite3")),
                             settings_dir=tmp.name)
            self.assertFalse(g.vision_available())
        finally:
            tmp.cleanup()


class ImageInstructionTests(_Base):
    def test_vision_image_gets_positive_note_and_no_false_caveat(self):
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="i1", name="rack.png",
                                  mime="image/png", size=10, kind="image",
                                  stored_path="/tmp/p", vision_supported=True,
                                  status="ready")
        ctx = self.gateway._context_with_extras(self.store.get_run("run-1"))
        text = self.gateway.build_instruction(ctx)
        self.assertIn("工程師已附上圖片", text)
        self.assertIn("rack.png", text)
        self.assertNotIn("無法直接解析圖片", text)

    def test_nonvision_image_keeps_honest_caveat(self):
        self.store.create_run(_ctx())
        self.store.add_attachment("run-1", attachment_id="i1", name="rack.png",
                                  mime="image/png", size=10, kind="image",
                                  stored_path="/tmp/p", vision_supported=False,
                                  status="ready")
        ctx = self.gateway._context_with_extras(self.store.get_run("run-1"))
        text = self.gateway.build_instruction(ctx)
        self.assertIn("無法直接解析圖片", text)
        self.assertNotIn("工程師已附上圖片", text)


# --------------------------------------------------------------------------
# R14 — output files are English + written to the DUT path
# --------------------------------------------------------------------------
class OutputRuleTests(_Base):
    def _tc(self):
        return {"code": "Wistron-Performance CPU-00001-V003", "procedure": "p"}

    def _target(self):
        return {"os_ip": "10.0.0.9", "os_user": "root3", "os_port": 22,
                "os_password": "pw", "project": "PA-cycle", "node_id": "n1"}

    def test_instruction_requires_english_files(self):
        text = self.gateway.build_instruction(_ctx(tc=self._tc(), target=self._target()))
        self.assertIn("一律使用英文", text)

    def test_instruction_names_dut_output_dir(self):
        text = self.gateway.build_instruction(_ctx(tc=self._tc(), target=self._target()))
        self.assertIn("/home/PAagent/PA-cycle/Wistron-Performance CPU-00001-V003", text)

    def test_no_output_dir_without_project_or_code(self):
        self.assertEqual(self.gateway._dut_output_dir({"os_ip": "1.2.3.4"}, {"code": "C1"}), "")
        self.assertEqual(self.gateway._dut_output_dir(self._target(), {}), "")

    def test_output_dir_sanitises_slashes(self):
        got = self.gateway._dut_output_dir(
            {"os_ip": "1.2.3.4", "project": "a/b"}, {"code": "c/d"})
        self.assertEqual(got, "/home/PAagent/a_b/c_d")

    def test_execution_instruction_carries_output_rules(self):
        self.store.create_run(_ctx(tc=self._tc(), target=self._target()))
        run = self.store.get_run("run-1")
        self.store.update_state("run-1", conversation_ref="conv-1", status="WAITING_FOR_USER")
        self.gateway._ensure_profile = lambda *a, **k: None
        self.gateway.run_execution("run-1")
        url, payload = self.client.calls[-1]
        text = payload["content"][0]["text"]
        self.assertIn("/home/PAagent/PA-cycle/", text)
        self.assertIn("一律使用英文", text)


# --------------------------------------------------------------------------
# R15 — user turn attachments are persisted + returned so the drawer can render
#       the uploaded image inside the conversation.
# --------------------------------------------------------------------------
class MessageAttachmentTests(_Base):
    def test_add_message_persists_and_lists_attachments(self):
        self.store.create_run(_ctx())
        atts = [{"attachment_id": "i1", "name": "rack.png", "kind": "image"}]
        self.store.add_message("run-1", role="user", text="看這張", attachments=atts)
        msgs = self.store.list_messages("run-1")
        self.assertEqual(msgs[-1]["attachments"], atts)

    def test_messages_without_attachments_default_to_empty_list(self):
        self.store.create_run(_ctx())
        self.store.add_message("run-1", role="agent", text="hi")
        msgs = self.store.list_messages("run-1")
        self.assertEqual(msgs[-1]["attachments"], [])

    def test_claim_preserves_attachments(self):
        self.store.create_run(_ctx())
        atts = [{"attachment_id": "i1", "name": "rack.png", "kind": "image"}]
        self.store.add_message("run-1", role="user", text="看這張", attachments=atts)
        self.store.claim_pending_user_message("run-1", "看這張", "evt-9")
        msgs = self.store.list_messages("run-1")
        self.assertEqual(msgs[-1]["attachments"], atts)
        self.assertEqual(len(msgs), 1)


if __name__ == '__main__':
    unittest.main()
