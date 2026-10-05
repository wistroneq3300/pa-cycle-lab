"""PA Agent Gateway (P3-c): bridge a PA AgentRun to an OpenHands conversation.

OpenHands is a backend engine only — this module is the seam. It:

* creates a conversation on the isolated PA agent-server for a run, injecting the
  case instruction (from ``ai_review.openhands_instruction`` when present);
* polls the conversation's event stream and **aggregates / coalesces** it into
  the run's mutable state:

  ================================================  ==================================
  OpenHands event                                   destination
  ================================================  ==================================
  ``MessageEvent`` (agent/user)                     chat messages
  ``ActionEvent`` (tool call)                       ``commands`` (run detail)
  ``ObservationEvent`` (tool result)                ``evidence`` (expandable block)
  ``ConversationStateUpdateEvent(execution_status)`` run ``status``
  ``waiting_for_confirmation`` status               approval request (card)
  ================================================  ==================================

The policy engine (what to *do* about a classification) is P3-d; the Gateway only
records observable facts and maps status. Raw tool output never enters chat.

The HTTP client is injectable so the aggregation logic can be tested without a
live agent-server.
"""
from __future__ import annotations

import json
import os

# OpenHands execution status -> PA run status. ``waiting_for_confirmation`` and
# ``paused`` both mean the run is blocked on an operator, i.e. WAITING_FOR_USER.
#
# ``finished`` maps to DONE, never PASS/FAIL: the agent only produces a log, and
# the PASS/FAIL/BLOCKED verdict is the engineer's call (made outside this system).
# Mapping ``finished`` to PASS was a false-green — a run that merely stopped
# (e.g. the agent had no shell tool and gave up) was reported as a pass.
_STATUS_MAP = {
    "idle": "PENDING",
    "running": "RUNNING",
    "paused": "WAITING_FOR_USER",
    "waiting_for_confirmation": "WAITING_FOR_USER",
    "finished": "DONE",
    "error": "ERROR",
    "stuck": "ERROR",
    "deleting": "ERROR",
}


def _text_of(llm_message):
    """Flatten an OpenHands llm_message content list into plain text."""
    if not isinstance(llm_message, dict):
        return ""
    parts = []
    for chunk in llm_message.get("content") or []:
        if isinstance(chunk, dict) and chunk.get("type") == "text":
            parts.append(chunk.get("text") or "")
        elif isinstance(chunk, str):
            parts.append(chunk)
    return "\n".join(p for p in parts if p).strip()


def classify_event(event):
    """Return ``(channel, payload)`` for one OpenHands event.

    ``channel`` is one of ``message`` / ``command`` / ``evidence`` / ``status`` /
    ``approval`` / ``ignore``. Pure function: no I/O, easy to unit-test.
    """
    kind = event.get("kind") or event.get("type")
    if kind == "MessageEvent":
        role = event.get("source") or (event.get("llm_message") or {}).get("role") or "agent"
        text = _text_of(event.get("llm_message"))
        if not text:
            return "ignore", None
        return "message", {"role": role, "text": text, "event_id": event.get("id")}
    if kind == "ActionEvent":
        action = event.get("action") or {}
        tool = event.get("tool_name") or action.get("kind")
        payload = {
            "event_id": event.get("id"),
            "tool": tool,
            "thought": _text_of({"content": event.get("thought") or []}),
            "timestamp": event.get("timestamp"),
        }
        # The agent's closing statement carries the log the engineer reads. It
        # arrives as a FinishAction (channel "command"), not a MessageEvent, so
        # surface it here or it never reaches final_result / the chat body.
        if tool == "finish" or action.get("kind") == "FinishAction":
            payload["finish_message"] = action.get("message") or ""
        return "command", payload
    if kind == "ObservationEvent":
        return "evidence", {
            "event_id": event.get("id"),
            "tool": event.get("tool_name"),
            "content": event.get("content"),
            "timestamp": event.get("timestamp"),
        }
    if kind == "ConversationStateUpdateEvent":
        key = event.get("key")
        if key == "execution_status":
            return "status", event.get("value")
        return "ignore", None
    return "ignore", None


class AgentGateway:
    """Create conversations and ingest their events into run state."""

    def __init__(self, store, base_url=None, api_key=None, client=None,
                 settings_dir=None, llm_profile=None):
        self.store = store
        self.base_url = (base_url or os.environ.get("PA_AGENT_SERVER_URL")
                         or "http://127.0.0.1:18010").rstrip("/")
        self.api_key = api_key or os.environ.get("PA_AGENT_API_KEY") or self._load_key()
        self.settings_dir = (settings_dir or os.environ.get("PA_AGENT_SETTINGS_DIR")
                             or "/srv/pa-agent/settings")
        self.llm_profile = (llm_profile or os.environ.get("PA_AGENT_LLM_PROFILE")
                            or "qwen3.8-27b")
        self._client = client

    def _llm_config(self):
        """Load the bound LLM profile so conversations use the PA model.

        The agent-server requires an explicit agent on create; we build one from
        the saved profile rather than relying on a server default.
        """
        path = os.path.join(self.settings_dir, "profiles", f"{self.llm_profile}.json")
        with open(path, encoding="utf-8") as fh:
            profile = json.load(fh)
        llm = {"model": profile["model"]}
        for key in ("api_key", "base_url", "api_version", "max_output_tokens",
                    "max_input_tokens", "native_tool_calling", "stream"):
            if profile.get(key) is not None:
                llm[key] = profile[key]
        # The qwen3.8-27b server rejects the SDK default reasoning_effort "high"
        # (it accepts xhigh/medium/low). Use a supported value explicitly.
        llm["reasoning_effort"] = profile.get("reasoning_effort", "medium")
        return llm

    @staticmethod
    def _load_key():
        for path in ("/srv/pa-agent/api-key.txt",):
            try:
                with open(path, encoding="utf-8") as fh:
                    return fh.read().strip()
            except OSError:
                continue
        return None

    def _http(self):
        if self._client is not None:
            return self._client
        import httpx
        self._client = httpx.Client(
            base_url=self.base_url, timeout=30, trust_env=False,
            headers={"X-Session-API-Key": self.api_key} if self.api_key else {},
        )
        return self._client

    # -- conversation lifecycle ---------------------------------------------

    def build_instruction(self, context):
        """Compose the opening message sent to OpenHands for a run.

        Only the fields the case needs are sent (design §5.3), not the whole
        library row.
        """
        tc = context.get("testcase") or {}
        review = context.get("ai_review") or {}
        target = context.get("target") or {}
        lines = [
            f"You are the PA Agent running test case {tc.get('code')} "
            f"(variant {context.get('case_variant_id')}).",
            "",
            f"Sub-function: {tc.get('sub_function') or '-'}",
            f"Test set: {tc.get('test_set') or '-'}",
            f"Items: {tc.get('items') or '-'}",
            "",
            "Procedure:",
            (tc.get("procedure") or "-"),
            "",
            "Acceptance criteria:",
            (tc.get("criteria") or "-"),
        ]

        # Execution target. Without this the agent has no DUT to run against and
        # will fabricate results; it MUST SSH into the given host to run commands.
        dut = self._dut_block(target)
        if dut:
            lines += ["", dut]
        instruction = (review.get("openhands_instruction")
                       or tc.get("ai_agent_instruction"))
        if instruction:
            lines += ["", "Agent instruction:", instruction]
        if tc.get("ai_precheck"):
            lines += ["", "Pre-check:", tc["ai_precheck"]]
        if tc.get("ai_commands"):
            lines += ["", "Commands:", tc["ai_commands"]]
        if tc.get("ai_postcheck"):
            lines += ["", "Post-check:", tc["ai_postcheck"]]
        return "\n".join(lines)

    @staticmethod
    def _dut_block(target):
        """Render the DUT connection block, or "" if no target was resolved.

        Plaintext credentials (per product decision): the engineer reads the log
        and the conversation is internal, so we accept the credential appearing in
        the transcript rather than gating the agent behind a secret broker.
        """
        ip = (target or {}).get("os_ip")
        if not ip:
            return ""
        user = target.get("os_user") or "root"
        port = target.get("os_port") or 22
        pwd = target.get("os_password") or ""
        auth = f"password: {pwd}" if pwd else "key-based auth (no password)"
        lines = [
            "Execution target (DUT):",
            f"  SSH host: {user}@{ip}  (port {port}, {auth})",
            f"  Project: {target.get('project') or '-'}   Node: {target.get('node_id') or '-'}",
            "",
            "You MUST run every test command on this DUT over SSH — none of the "
            "commands run locally. Example:",
            f"  sshpass -p '<password>' ssh -o StrictHostKeyChecking=no "
            f"-p {port} {user}@{ip} 'lspci -nn'",
            "If SSH fails, report the failure as the log; never invent command output.",
        ]
        return "\n".join(lines)

    def start_run(self, run_id, *, workspace_dir=None, auto_run=True):
        """Create the OpenHands conversation for a run and bind it to the run."""
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        if run.get("conversation_ref"):
            return run["conversation_ref"]

        payload = {
            "workspace": {
                "kind": "LocalWorkspace",
                "working_dir": workspace_dir or f"/srv/pa-agent/workspace/{run_id}",
            },
            "agent": {
                "kind": "Agent",
                "llm": self._llm_config(),
                # Do NOT send `include_default_tools`: openhands-agent-server
                # 1.49.6 expects a list[str] of built-in tool classes (not the
                # boolean True the old code sent -> HTTP 422), and it already
                # registers the full default toolset (terminal, file editor, ...)
                # at startup. Omitting the field therefore gives the agent every
                # default tool it needs to actually run the test commands instead
                # of fabricating a report.
            },
            "initial_message": {
                "role": "user",
                "content": [{"type": "text", "text": self.build_instruction(run["context"])}],
                "run": bool(auto_run),
            },
        }
        response = self._http().post("/api/conversations", json=payload)
        response.raise_for_status()
        conversation_id = response.json().get("id")
        self.store.update_state(
            run_id, conversation_ref=conversation_id, status="RUNNING",
            started_at=run.get("started_at") or _now(),
        )
        return conversation_id

    # -- event ingestion -----------------------------------------------------

    def fetch_events(self, conversation_id, limit=100):
        response = self._http().get(
            f"/api/conversations/{conversation_id}/events/search",
            params={"limit": limit},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("items") or data.get("events") or []

    def ingest(self, run_id, *, events=None, conversation_id=None):
        """Fold a batch of OpenHands events into the run's state.

        Returns a small summary of what changed. Idempotent for message/command/
        evidence entries because appends are keyed by the source event id.
        """
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        cid = conversation_id or run.get("conversation_ref")
        if events is None:
            if not cid:
                raise ValueError("no conversation bound to run")
            events = self.fetch_events(cid)

        summary = {"messages": 0, "commands": 0, "evidence": 0, "status": None,
                   "approval_requested": False}
        pending_commands, pending_evidence = [], []
        finish_log = ""
        for event in events:
            channel, payload = classify_event(event)
            if channel == "message":
                seq = self.store.add_message(
                    run_id, role=payload["role"], text=payload["text"],
                    source_event_id=payload.get("event_id"),
                )
                if seq is not None:
                    summary["messages"] += 1
            elif channel == "command":
                pending_commands.append(payload)
                if payload.get("finish_message"):
                    finish_log = payload["finish_message"]
            elif channel == "evidence":
                pending_evidence.append(payload)
            elif channel == "status":
                status = _STATUS_MAP.get(str(payload), None)
                if status:
                    summary["status"] = status

        if pending_commands:
            self.store.append_commands(run_id, pending_commands)
            summary["commands"] = len(pending_commands)
        if pending_evidence:
            self.store.append_evidence(run_id, pending_evidence)
            summary["evidence"] = len(pending_evidence)

        if summary["status"]:
            updates = {"status": summary["status"]}
            if summary["status"] in {"PASS", "FAIL", "BLOCKED", "DONE", "ERROR"}:
                updates["ended_at"] = _now()
            # The engineer reads the agent's log to reach a verdict, so persist
            # the closing statement as final_result and mirror it into the chat
            # as an agent message (it is a FinishAction, not a MessageEvent, and
            # would otherwise never reach the drawer body).
            if finish_log:
                updates["final_result"] = finish_log
                seq = self.store.add_message(
                    run_id, role="agent", text=finish_log, kind="finish",
                )
                if seq is not None:
                    summary["messages"] += 1
            self.store.update_state(run_id, **updates)
            if summary["status"] == "WAITING_FOR_USER":
                self.store.record_approval(run_id, {
                    "kind": "confirmation_required", "status": "pending",
                    "created_at": _now(),
                })
                summary["approval_requested"] = True
        return summary


def _now():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
