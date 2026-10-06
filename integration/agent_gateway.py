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

    # Plan-first opening: the agent introduces itself, states how it intends to
    # test, then STOPS and waits for the engineer's go-ahead. Nothing is executed
    # until the engineer replies with a go keyword (OK/GO/開始/執行/可以/run).
    # ``mode="plan"`` selects this; the default ``"execute"`` keeps the historical
    # behaviour so existing runs are unchanged.
    #
    # The agent must state the go keyword explicitly in its message: the engineer
    # should not have to guess what to type (C: 不讓使用者猜半天).
    _PLAN_PREAMBLE = [
        "【進場模式：先說明計畫，等工程師同意後才執行】",
        "在收到工程師明確同意（回覆「OK」或「GO」）之前，不要執行任何指令，也不要 SSH 連線。",
        "請先以繁體中文，主動向工程師說明你打算如何執行本測項，內容需包含：",
        "  1) 目標節點（DUT）與連線方式；",
        "  2) 你要執行的步驟順序（盤點 → 收集 → 解析 → 比對 → 產出）；",
        "  3) 需要工程師提供的資料（SPEC / SOP / 附件等），若不需要請說明；",
        "  4) 風險評估（是否 read-only、是否有破壞性動作）。",
        "說明完畢後停下來等待，並在最後清楚告訴工程師：「要開始請回覆 OK 或 GO」。",
        "工程師收到後若提出問題或補充資訊，你應據此修正計畫，再等待下一次同意。",
        "當工程師回覆「OK」或「GO」表示可以執行時，直接依你剛才說明的計畫執行，",
        "不需要再次詢問；執行完畢後產出測試記錄。",
        "",
    ]

    def build_instruction(self, context, user_note="", mode="execute"):
        """Compose the opening message sent to OpenHands for a run.

        Only the fields the case needs are sent (design §5.3), not the whole
        library row. ``user_note`` is the free-text the engineer typed in the
        chat drawer; it is appended last so it takes precedence. ``mode="plan"``
        prefixes the plan-first preamble (talk, then wait for GO) so no command
        runs until the engineer approves.
        """
        tc = context.get("testcase") or {}
        review = context.get("ai_review") or {}
        target = context.get("target") or {}
        lines = list(self._PLAN_PREAMBLE) if mode == "plan" else []
        lines += [
            "你是 PA Agent，正在執行測試案例 "
            f"{tc.get('code')}（variant {context.get('case_variant_id')}）。",
            "",
            "【輸出語言】全程使用繁體中文回覆（指令、程式碼、原始 log 可保留原文）。",
            "",
            f"子功能：{tc.get('sub_function') or '-'}",
            f"測試集：{tc.get('test_set') or '-'}",
            f"測項：{tc.get('items') or '-'}",
            "",
            "執行程序：",
            (tc.get("procedure") or "-"),
            "",
            "驗收標準：",
            (tc.get("criteria") or "-"),
        ]

        # 人工（MANUAL ONLY）測項：本質是人工目視／物理檢查，沒有可執行的指令。
        # 若不特別說明，agent 會自行 SSH 猛跑指令，把 context 撐爆而報錯。
        if self._is_manual_only(tc):
            lines += [
                "",
                "【重要：本測項為「人工檢查」(MANUAL ONLY)】",
                "此測項由工程師以目視／物理方式檢查，沒有可由指令自動驗證的項目。",
                "請勿 SSH 到 DUT 執行任何指令，也不要嘗試模擬或聲稱已完成物理檢查。",
                "你只需要：",
                "  1) 列出此測項需要工程師提供的證據（照片、檢查清單、blackbox 狀態等）；",
                "  2) 說明判定所需的資訊；",
                "  3) 等待工程師提供證據後，再依其內容整理紀錄。",
                "PASS／FAIL／BLOCKED 一律由工程師裁定。",
            ]

        # Execution target. Without this the agent has no DUT to run against and
        # will fabricate results; it MUST SSH into the given host to run commands.
        dut = self._dut_block(target)
        if dut and not self._is_manual_only(tc):
            lines += ["", dut]
        instruction = (review.get("openhands_instruction")
                       or tc.get("ai_agent_instruction"))
        if instruction:
            lines += ["", "Agent 指示：", instruction]
        if tc.get("ai_precheck"):
            lines += ["", "執行前檢查：", tc["ai_precheck"]]
        if tc.get("ai_commands"):
            lines += ["", "指令：", tc["ai_commands"]]
        if tc.get("ai_postcheck"):
            lines += ["", "執行後檢查：", tc["ai_postcheck"]]

        lines += [
            "",
            "【執行原則】",
            "- 動手前先確認測試步驟；有疑慮時先停下詢問，不要自行假設。",
            "- 指令輸出只需摘要重點，勿將整包原始輸出貼回；避免累積過長內容。",
            "- 不得捏造指令輸出；SSH 失敗就據實回報。",
        ]
        if (user_note or "").strip():
            lines += ["", "【工程師備註（請遵循）】", user_note.strip()]
        return "\n".join(lines)

    @staticmethod
    def _is_manual_only(tc):
        """True when the case is a manual/physical check (no runnable commands).

        Library rows carry this as ``category`` == "MANUAL ONLY" (also seen as
        ``manual_only`` boolean or ``mode``); check all shapes.
        """
        cat = str(tc.get("category") or "").upper()
        if "MANUAL" in cat:
            return True
        if tc.get("manual_only") is True:
            return True
        return str(tc.get("mode") or "").upper() in {"MANUAL", "MANUAL_ONLY"}

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

    def start_run(self, run_id, *, workspace_dir=None, auto_run=True, user_note="",
                  mode="execute"):
        """Create the OpenHands conversation for a run and bind it to the run.

        ``mode="plan"`` sends the plan-first preamble so the agent states its
        plan and waits for the engineer instead of executing immediately. The
        default ``"execute"`` preserves the historical behaviour.

        ``auto_run`` is passed straight through as the initial message's ``run``
        flag ("whether the agent loop should automatically run"). Plan mode still
        needs ``run=True`` so the agent actually *produces* its plan; the plan
        preamble is what makes it stop and wait rather than execute. (Suppressing
        ``run`` here would leave the drawer blank — the agent would never reply.)
        """
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
                # Environment tools must be listed explicitly: with no `tools`,
                # agent-server 1.49.6 gives the agent only FinishTool/ThinkTool
                # (see openhands.sdk.tool.builtins.BUILT_IN_TOOLS), so it can
                # think but not run anything. The names are the registered
                # short forms (``terminal``, ``file_editor``), not the class
                # names, and they only resolve once openhands-tools is installed
                # in the agent-server environment (see /srv/pa-agent/start-*.sh).
                "tools": [
                    {"name": "terminal", "params": {}},
                    {"name": "file_editor", "params": {}},
                    {"name": "task_tracker", "params": {}},
                ],
            },
            "initial_message": {
                "role": "user",
                "content": [{"type": "text",
                             "text": self.build_instruction(run["context"], user_note, mode=mode)}],
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

    # Endpoint used to append a user turn to an existing conversation and let the
    # agent respond. Overridable because the exact agent-server route is an
    # integration detail that must be verified against the live 18010 server.
    _MESSAGE_ENDPOINT = os.environ.get(
        "PA_AGENT_MESSAGE_ENDPOINT", "/api/conversations/{cid}/events")

    def send_user_message(self, run_id, text):
        """Append an engineer chat turn to the run's conversation and let it run.

        Returns the conversation id. Raises ValueError when the run has no
        bound conversation. Never fabricates a reply — the agent's response
        arrives through :meth:`ingest` like any other event.
        """
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        cid = run.get("conversation_ref")
        if not cid:
            raise ValueError("run has no conversation; start it first")
        payload = {
            "kind": "MessageEvent",
            "source": "user",
            "llm_message": {
                "role": "user",
                "content": [{"type": "text", "text": text}],
            },
            "run": True,
        }
        response = self._http().post(self._MESSAGE_ENDPOINT.format(cid=cid), json=payload)
        response.raise_for_status()
        return cid

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
            # "finished" is the agent-server's per-turn state: the agent stopped
            # and is idle waiting for the next engineer message. It does NOT mean
            # the test task is done. It is only DONE when the turn also carried a
            # FinishAction (the agent's closing test record). Otherwise the run is
            # actually blocked on the engineer (in plan mode: awaiting OK/GO), so
            # map it to WAITING_FOR_USER — claiming "done" with no output was the
            # "completed but nothing produced" report.
            if summary["status"] == "DONE" and not finish_log:
                updates["status"] = "WAITING_FOR_USER"
            if updates["status"] in {"PASS", "FAIL", "BLOCKED", "DONE", "ERROR"}:
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
            summary["status"] = updates["status"]
            if updates["status"] == "WAITING_FOR_USER":
                # Idempotent: polling re-ingests the same "finished" turn, so only
                # record the pending approval once (else approvals_json grows every tick).
                existing = self.store.get_run(run_id) or {}
                already = any(
                    a.get("kind") == "confirmation_required" and a.get("status") == "pending"
                    for a in existing.get("approvals", [])
                )
                if not already:
                    self.store.record_approval(run_id, {
                        "kind": "confirmation_required", "status": "pending",
                        "created_at": _now(),
                    })
                    summary["approval_requested"] = True
        return summary


def _now():
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
