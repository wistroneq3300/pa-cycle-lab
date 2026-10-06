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


# ---------------------------------------------------------------------------
# Engineer chat-turn intent
# ---------------------------------------------------------------------------
# A free-text chat turn is one of three things, and they must travel different
# paths on the agent-server:
#
#   "go"       approve execution (OK/GO/開始/執行/…)  -> agent-loop turn
#   "rerun"    explicit re-run request                -> agent-loop turn
#   "question" anything else (ask/explain/path/…)     -> ask_agent (no loop)
#
# The distinction is the whole point: an agent-loop turn lets the model emit a
# FinishAction and re-paste the test record, which is exactly the "I asked a
# question and it dumped the same report again" complaint. ``ask_agent`` is a
# single LLM call with no tool loop, so a question can only be answered — it
# structurally cannot re-run the test.
_GO_KEYWORDS = ("ok", "go", "開始", "开始", "執行", "执行", "可以", "run", "確認", "确认", "同意")
# Explicit re-run intent. Deliberately requires a rerun verb; a bare "執行"
# stays a "go" (some engineers approve with it), which is the safer default.
_RERUN_KEYWORDS = ("重跑", "重新", "再執行", "再执行", "再跑", "rerun", "re-run", "run again", "重新驗證", "重新验证")


def classify_user_intent(text):
    """Classify an engineer chat turn as ``"go"`` / ``"rerun"`` / ``"question"``.

    Pure, case-insensitive, trivially unit-testable. A bare keyword (after
    stripping surrounding punctuation/whitespace) is treated as approval;
    a keyword buried inside a sentence is not, so "GO 之後請補充說明" stays a
    question rather than silently triggering execution.
    """
    raw = (text or "").strip()
    if not raw:
        return "question"
    lowered = raw.lower()
    # Normalise a bare "OK." / "GO!" / "ok~" to its keyword form.
    stripped = lowered.strip("。.!！~～ 、,，:：;；\t\n ")
    if stripped in _GO_KEYWORDS:
        return "go"
    if any(k in lowered for k in _RERUN_KEYWORDS):
        return "rerun"
    return "question"


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
        "計畫執行完（已產出測試記錄）之後，若工程師只是「提問」（例如問檔案路徑、",
        "問某欄位的意義、要求補充說明），請直接針對問題作答，不要重跑測試、不要重新",
        "執行指令、也不要重貼同一份測試記錄。只有當工程師明確要求「重跑、重新驗證、",
        "再執行一次、補充新的檢查項目」時，才再度執行並產出新的記錄。",
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
            "原始手作業單 ⚠ 請勿直接執行（僅供參照）：",
            "以下為原始作業單內容，可能過時、與標題不符或含破壞性步驟。",
            "它僅供你理解測項意圖與背景，不是要你照著直接執行的指令；",
            "實際執行請以下方修正後的計畫與 AI 指令為準，切勿盲目照抄作業單。",
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
            "- 工程師的後續訊息若只是提問（要求說明、問路徑、問欄位），直接回答即可，",
            "  不要重跑指令或重貼已產出的測試記錄；僅在工程師明確要求重跑時才再執行。",
            "- 產出檔案請「同類合併、避免碎檔」。多顆裝置（如多張 GPU）的原始證據要合併成",
            "  單一檔案，並用醒目分隔線標出各裝置，例如：",
            "    * 測試前 lspci -vvv：全部裝置寫入 lspci_vvv_pre.txt，各裝置前加一行",
            "      「===== 03:00.0 (10de:2901) =====」；",
            "    * 測試後 lspci -vvv：同樣合併為 lspci_vvv_post.txt；",
            "    * lspci -nn：合併為 lspci_nn_pre.txt / lspci_nn_post.txt；",
            "    * 摘要與判定：test_record.txt。",
            "  除非工程師另有指示，成果目錄一律只保留上述同類合併的檔案（約 5 個），",
            "  不要為每顆裝置或每個時點各開一個檔案。",
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

        The body must be the server's ``SendMessageRequest`` shape
        (``role``/``content``/``run``). Sending a raw ``MessageEvent``
        (``kind``/``source``/``llm_message``) is accepted with HTTP 200 but the
        unknown ``llm_message`` field is dropped, so the agent receives an
        EMPTY user turn and wonders why nothing was said.
        """
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        cid = run.get("conversation_ref")
        if not cid:
            raise ValueError("run has no conversation; start it first")
        payload = {
            "role": "user",
            "content": [{"type": "text", "text": text}],
            "run": True,
        }
        response = self._http().post(self._MESSAGE_ENDPOINT.format(cid=cid), json=payload)
        response.raise_for_status()
        return cid

    # Endpoint for a *question* turn. ``ask_agent`` is a single LLM call against
    # the conversation that returns the answer directly and does NOT start an
    # agent-loop turn — no tools, so the agent cannot re-run the test or emit a
    # FinishAction. Overridable for the same reason as _MESSAGE_ENDPOINT.
    _ASK_ENDPOINT = os.environ.get(
        "PA_AGENT_ASK_ENDPOINT", "/api/conversations/{cid}/ask_agent")

    def ask_agent(self, run_id, question):
        """Ask the run's conversation a question and return the agent's answer.

        Unlike :meth:`send_user_message`, this neither appends a message to the
        conversation nor triggers a run loop. The reply is a plain string; the
        caller records it as an agent chat message. Raises ValueError when the
        run has no bound conversation.
        """
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        cid = run.get("conversation_ref")
        if not cid:
            raise ValueError("run has no conversation; start it first")
        response = self._http().post(
            self._ASK_ENDPOINT.format(cid=cid), json={"question": question})
        response.raise_for_status()
        data = response.json() or {}
        return (data.get("response") or "").strip()

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
                seq = None
                # A user turn was echoed locally by the route on send; adopt it
                # rather than inserting a duplicate when its event comes back.
                if payload["role"] == "user" and payload.get("event_id"):
                    seq = self.store.claim_pending_user_message(
                        run_id, payload["text"], payload["event_id"])
                if seq is None:
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
