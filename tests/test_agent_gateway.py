"""Gateway aggregation tests (P3-c).

Two layers, both against real code (no mocks of our own logic):

* ``classify_event`` — pure mapping from OpenHands events to channels, checked
  against payloads captured from a live agent-server.
* ``AgentGateway.ingest`` — folding a batch of real-shaped events into a run's
  mutable state, verifying chat vs commands/evidence separation and status maps.
"""
import os
import sys
import tempfile
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'app'))
sys.path.insert(0, ROOT)

from integration.agent_gateway import AgentGateway, classify_event  # noqa: E402
from integration.agent_runs import AgentRunStore  # noqa: E402

# Shapes captured from a live 18010 conversation (see gateway docstring).
_MSG_AGENT = {
    "id": "e2", "kind": "MessageEvent", "source": "agent",
    "llm_message": {"role": "assistant",
                    "content": [{"type": "text", "text": "PA-AGENT-27B-OK"}]},
}
_MSG_USER = {
    "id": "e1", "kind": "MessageEvent", "source": "user",
    "llm_message": {"role": "user",
                    "content": [{"type": "text", "text": "run the test"}]},
}
_STATE_RUNNING = {
    "id": "s1", "kind": "ConversationStateUpdateEvent",
    "key": "execution_status", "value": "running",
}
_STATE_WAIT = {
    "id": "s2", "kind": "ConversationStateUpdateEvent",
    "key": "execution_status", "value": "waiting_for_confirmation",
}
_STATE_DONE = {
    "id": "s3", "kind": "ConversationStateUpdateEvent",
    "key": "execution_status", "value": "finished",
}
_ACTION = {"id": "a1", "kind": "ActionEvent", "tool_name": "terminal",
           "thought": [{"type": "text", "text": "checking fio"}],
           "timestamp": "2026-10-05T00:00:00Z"}
_FINISH = {"id": "a2", "kind": "ActionEvent", "tool_name": "finish",
           "thought": [{"type": "text", "text": "done"}],
           "action": {"kind": "FinishAction",
                      "message": "lspci shows 2 GPUs; LnkSta x16"},
           "timestamp": "2026-10-05T00:00:02Z"}
_OBS = {"id": "o1", "kind": "ObservationEvent", "tool_name": "terminal",
        "content": "fio not installed", "timestamp": "2026-10-05T00:00:01Z"}


class ClassifyEventTests(unittest.TestCase):
    def test_agent_message_is_chat(self):
        channel, payload = classify_event(_MSG_AGENT)
        self.assertEqual(channel, "message")
        self.assertEqual(payload["role"], "agent")
        self.assertEqual(payload["text"], "PA-AGENT-27B-OK")

    def test_action_is_command_not_chat(self):
        channel, payload = classify_event(_ACTION)
        self.assertEqual(channel, "command")
        self.assertEqual(payload["tool"], "terminal")

    def test_observation_is_evidence_not_chat(self):
        channel, payload = classify_event(_OBS)
        self.assertEqual(channel, "evidence")
        self.assertIn("fio", payload["content"])

    def test_status_event(self):
        self.assertEqual(classify_event(_STATE_RUNNING), ("status", "running"))
        self.assertEqual(classify_event(_STATE_WAIT), ("status", "waiting_for_confirmation"))

    def test_unknown_is_ignored(self):
        self.assertEqual(classify_event({"kind": "SystemPromptEvent"}), ("ignore", None))

    def test_empty_message_ignored(self):
        empty = {"id": "x", "kind": "MessageEvent", "source": "agent",
                 "llm_message": {"role": "assistant", "content": []}}
        self.assertEqual(classify_event(empty), ("ignore", None))


class GatewayIngestTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = AgentRunStore(path=os.path.join(self.tmp.name, 'r.sqlite3'))
        self.gateway = AgentGateway(self.store, base_url="http://unused")
        ctx = {"run_id": "run-1", "case_variant_id": "case-x",
               "library_version": "v1", "code": "C1",
               "testcase": {"code": "C1", "procedure": "do it"},
               "ai_review": None, "target": {}, "created_at": "2026-10-05T00:00:00Z",
               "required_documents": [], "user_attachments": [], "schema_version": 1}
        self.store.create_run(ctx)

    def tearDown(self):
        self.tmp.cleanup()

    def test_ingest_separates_chat_from_tool_output(self):
        events = [_MSG_USER, _STATE_RUNNING, _ACTION, _OBS, _MSG_AGENT, _STATE_DONE]
        summary = self.gateway.ingest("run-1", events=events)
        run = self.store.get_run("run-1")
        # chat carries only the two messages
        texts = [m["text"] for m in run["messages"]]
        self.assertIn("run the test", texts)
        self.assertIn("PA-AGENT-27B-OK", texts)
        self.assertNotIn("fio not installed", texts)
        # tool output went to commands/evidence, not chat
        self.assertEqual(len(run["commands"]), 1)
        self.assertEqual(len(run["evidence"]), 1)
        self.assertEqual(summary["messages"], 2)
        # finished with NO FinishAction means the agent delivered a turn (e.g. the
        # plan) and is idle awaiting the engineer — NOT "task done". The old
        # finished->DONE mapping showed a false "完成" with no output.
        self.assertEqual(summary["status"], "WAITING_FOR_USER")
        self.assertEqual(run["status"], "WAITING_FOR_USER")
        self.assertIsNone(run["ended_at"])

    def test_finish_action_becomes_final_result_and_agent_message(self):
        summary = self.gateway.ingest("run-1", events=[_FINISH, _STATE_DONE])
        run = self.store.get_run("run-1")
        # the closing statement is the deliverable the engineer reads
        self.assertEqual(run["final_result"], "lspci shows 2 GPUs; LnkSta x16")
        self.assertEqual(run["status"], "DONE")
        # and it is mirrored into chat as an agent message (it is a FinishAction,
        # not a MessageEvent, so it would otherwise never reach the drawer body)
        finished = [m for m in run["messages"] if m["kind"] == "finish"]
        self.assertEqual(len(finished), 1)
        self.assertEqual(finished[0]["role"], "agent")
        self.assertEqual(finished[0]["text"], "lspci shows 2 GPUs; LnkSta x16")

    def test_plan_turn_without_finish_action_is_waiting_not_done(self):
        """Regression: a plan turn (agent message, no FinishAction) must NOT be DONE.

        The "completed but nothing produced" report came from mapping the
        agent-server's per-turn ``finished`` to DONE. In plan mode the agent only
        delivered its plan and is awaiting OK/GO, so the run is WAITING_FOR_USER.
        """
        events = [_MSG_USER, _STATE_RUNNING, _MSG_AGENT, _STATE_DONE]
        summary = self.gateway.ingest("run-1", events=events)
        run = self.store.get_run("run-1")
        self.assertEqual(summary["status"], "WAITING_FOR_USER")
        self.assertEqual(run["status"], "WAITING_FOR_USER")
        self.assertIsNone(run["final_result"])
        # the plan message is the only agent output; no finish message is invented
        self.assertEqual([m["kind"] for m in run["messages"] if m["role"] == "agent"],
                         ["message"])

    def test_finished_after_result_stays_done_not_waiting(self):
        """A run that already produced a result must never fall back to WAITING.

        Regression: the agent-server emits ``finished`` per turn. After a
        FinishAction produced the log (status DONE), a later turn that stops
        without a new FinishAction used to flip the run back to WAITING_FOR_USER.
        Because WAITING_FOR_USER is non-terminal, the finished run was then
        treated as live and reopened forever — every reopen showed the same stale
        conversation. A persisted final_result must keep the run DONE.
        """
        self.gateway.ingest("run-1", events=[_FINISH, _STATE_DONE])
        self.assertEqual(self.store.get_run("run-1")["status"], "DONE")
        # a subsequent idle turn, no new FinishAction
        summary = self.gateway.ingest("run-1", events=[_STATE_DONE])
        run = self.store.get_run("run-1")
        self.assertEqual(summary["status"], "DONE")
        self.assertEqual(run["status"], "DONE")
        self.assertEqual(run["final_result"], "lspci shows 2 GPUs; LnkSta x16")
        self.assertIsNotNone(run["ended_at"])

    def test_waiting_approval_is_recorded_once_across_polls(self):
        """Polling re-ingests the same finished turn; approval must not accumulate."""
        for _ in range(3):
            self.gateway.ingest("run-1", events=[_MSG_AGENT, _STATE_DONE])
        run = self.store.get_run("run-1")
        approvals = [a for a in run["approvals"]
                     if a.get("kind") == "confirmation_required"]
        self.assertEqual(len(approvals), 1)

    def test_status_maps_to_waiting_and_records_approval(self):
        summary = self.gateway.ingest("run-1", events=[_STATE_WAIT])
        self.assertTrue(summary["approval_requested"])
        run = self.store.get_run("run-1")
        self.assertEqual(run["status"], "WAITING_FOR_USER")
        self.assertEqual(run["approvals"][0]["kind"], "confirmation_required")

    def test_ingest_is_idempotent_for_messages(self):
        self.gateway.ingest("run-1", events=[_MSG_AGENT])
        self.gateway.ingest("run-1", events=[_MSG_AGENT])
        self.assertEqual(len(self.store.list_messages("run-1")), 1)

    def test_conversation_required_when_no_events(self):
        with self.assertRaises(ValueError):
            self.gateway.ingest("run-1")

    def test_build_instruction_includes_case_and_review(self):
        ctx = {"case_variant_id": "case-x",
               "testcase": {"code": "C1", "procedure": "P", "criteria": "C",
                            "ai_precheck": "pre"},
               "ai_review": {"openhands_instruction": "DO THIS CAREFULLY"}}
        text = self.gateway.build_instruction(ctx)
        self.assertIn("C1", text)
        self.assertIn("DO THIS CAREFULLY", text)
        self.assertIn("pre", text)

    def test_build_instruction_execute_mode_is_unchanged(self):
        """Default/execute mode must not gain the plan preamble (no regression)."""
        ctx = {"case_variant_id": "case-x", "testcase": {"code": "C1"},
               "ai_review": None}
        text = self.gateway.build_instruction(ctx)
        self.assertNotIn("進場模式", text)
        # explicit execute mode is identical to the default
        self.assertEqual(text, self.gateway.build_instruction(ctx, mode="execute"))

    def test_build_instruction_plan_mode_waits_for_go(self):
        ctx = {"case_variant_id": "case-x", "testcase": {"code": "C1"},
               "ai_review": None}
        text = self.gateway.build_instruction(ctx, mode="plan")
        self.assertIn("進場模式", text)
        self.assertIn("不要執行任何指令", text)
        # The agent must state the go keyword explicitly (engineer must not guess).
        self.assertIn("OK", text)
        self.assertIn("GO", text)


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload


class _RecordingClient:
    """Minimal httpx-like client capturing POSTs for gateway unit tests."""

    def __init__(self, payload=None):
        self.calls = []
        self._payload = payload or {"id": "conv-1"}

    def post(self, url, json=None):
        self.calls.append((url, json))
        return _FakeResponse(self._payload)

    def get(self, url, params=None):
        self.calls.append((url, params))
        return _FakeResponse({"items": []})


class GatewayMessageTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.store = AgentRunStore(path=os.path.join(self.tmp.name, 'r.sqlite3'))
        self.client = _RecordingClient()
        self.gateway = AgentGateway(self.store, base_url="http://unused",
                                    client=self.client)
        ctx = {"run_id": "run-1", "case_variant_id": "case-x",
               "library_version": "v1", "code": "C1",
               "testcase": {"code": "C1", "procedure": "do it"},
               "ai_review": None, "target": {}, "created_at": "2026-10-05T00:00:00Z",
               "required_documents": [], "user_attachments": [], "schema_version": 1}
        self.store.create_run(ctx)

    def tearDown(self):
        self.tmp.cleanup()

    def test_send_user_message_requires_conversation(self):
        with self.assertRaises(ValueError):
            self.gateway.send_user_message("run-1", "hello")

    def test_send_user_message_posts_user_event_to_conversation(self):
        self.store.update_state("run-1", conversation_ref="conv-1", status="RUNNING")
        cid = self.gateway.send_user_message("run-1", "請補充 PCIe SPEC")
        self.assertEqual(cid, "conv-1")
        url, payload = self.client.calls[-1]
        self.assertEqual(url, "/api/conversations/conv-1/events")
        # The agent-server SendMessageRequest shape is role/content/run; an
        # llm_message field is dropped server-side, so it must not be sent.
        self.assertEqual(payload["role"], "user")
        self.assertEqual(payload["content"][0]["text"], "請補充 PCIe SPEC")
        self.assertTrue(payload["run"])

    def test_start_run_plan_mode_sends_plan_preamble(self):
        self.gateway.start_run("run-1", mode="plan")
        _, payload = self.client.calls[-1]
        text = payload["initial_message"]["content"][0]["text"]
        self.assertIn("進場模式", text)
        # Plan mode must still run the loop so the agent produces its plan.
        self.assertTrue(payload["initial_message"]["run"])


if __name__ == '__main__':
    unittest.main()
