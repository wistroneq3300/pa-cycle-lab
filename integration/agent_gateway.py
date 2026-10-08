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

import base64
import json
import os
import re

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
# Engineer chat-turn intent (state-aware)
# ---------------------------------------------------------------------------
# A free-text chat turn is one of several intents, and they must travel
# different paths on the agent-server. Classification is deliberately
# *conservative*: it is far worse to trigger an execution the engineer did not
# ask for than to ask them to repeat themselves.
#
#   QUESTION        ask/explain/why/what/how            -> ask_agent (no loop)
#   PLAN_UPDATE     a supplementary constraint/change   -> record supplemental + ask
#   APPROVE_EXECUTION  explicit go-ahead (OK/GO/開始…)   -> agent-loop turn
#   RERUN           explicit re-run request             -> agent-loop turn
#   CANCEL/STOP     abort the run                        -> state change
#   NORMAL_CHAT     anything else                        -> ask_agent
#
# The old implementation was ``if keyword in text`` over a keyword tuple that
# contained "重新", so "重新說明一下" / "重新整理結果" matched as rerun, and
# "不要重跑" matched as rerun too. Both are wrong and are covered by tests.
_GO_EXACT = {
    "ok", "okay", "go", "開始", "开始", "執行", "执行", "可以", "run",
    "確認執行", "确认执行", "同意", "approved", "approve", "yes", "y",
}
_RERUN_EXACT = {
    "重跑", "再跑", "rerun", "re-run", "run again", "重跑一次", "再執行一次",
    "重新執行這條測試", "重新執行此測試", "重新驗證", "重新验证", "重新測試",
    "rerun this test", "重新執行", "重新执行", "重新跑一次",
}
_CANCEL_EXACT = {
    "取消", "停止", "中止", "不要跑", "不要執行", "不要执行", "先不要跑",
    "stop", "cancel", "abort",
}
# Negation / interrogative markers. If a turn contains any of these, it is NOT
# an approval or a rerun, whatever else it contains ("不要重跑", "為什麼要重跑?").
_NEGATION_MARKERS = ("不要", "不用", "別", "别", "先不要", "取消", "停止", "中止",
                     "不執行", "不执行", "先別", "先别", "not", "don't", "do not",
                     "cancel", "stop")
_QUESTION_MARKERS = ("為什麼", "为什么", "為何", "为何", "嗎", "吗", "?", "？",
                     "what", "why", "how", "when", "where", "which", "是否",
                     "是不是", "能不能", "可不可以", "說明", "说明", "解釋", "解释",
                     "整理", "總結", "总结", "review")


def _strip_punct(text):
    return text.strip().strip("。.!！~～ 、,，:：;；\t\n\"'“”‘’()（）")


def classify_user_intent(text):
    """Classify an engineer chat turn into a state-agnostic intent.

    Returns one of ``"go"`` / ``"rerun"`` / ``"cancel"`` / ``"question"``.

    Rules (in order):
      1. Empty -> ``question``.
      2. A bare approval token (OK/GO/開始/…) -> ``go``.
      3. A bare rerun phrase (重跑/rerun this test/…) -> ``rerun``.
      4. A bare cancel token -> ``cancel``.
      5. Any turn containing a negation marker is never go/rerun: a question
         that merely names a rerun verb ("為什麼要重跑") stays a question.
      6. Otherwise -> ``question`` (safe default: never auto-executes).
    """
    raw = (text or "").strip()
    if not raw:
        return "question"
    lowered = raw.lower()
    stripped = _strip_punct(lowered)

    # Exact-token approvals (a bare "GO!" etc.). Punctuation around it is fine.
    if stripped in _GO_EXACT:
        return "go"
    if stripped in _CANCEL_EXACT:
        return "cancel"
    # A rerun phrase must be the whole turn (or an explicit short imperative),
    # never merely embedded — "重新" inside "重新說明" must not match.
    if stripped in _RERUN_EXACT:
        return "rerun"

    negated = any(m in lowered for m in _NEGATION_MARKERS)
    interrogative = any(m in lowered for m in _QUESTION_MARKERS)

    # A negated or interrogative turn is never an approval.
    if negated or interrogative:
        return "question"

    # A sentence that *contains* a go-ahead as a whole word/phrase, e.g.
    # "那你先GO吧" / "好, 開始吧" / "please go ahead". The keyword must be a
    # standalone token (word boundary for latin, or a known CJK phrase) so
    # "good" / "logo" / "google" never match. Negation/interrogation already
    # returned above, so "不要GO吧" / "要不要GO?" stay questions.
    if _contains_go_token(lowered):
        return "go"

    # Explicit *imperative* rerun ("請重跑一次" / "重新執行這條測試") — only when
    # a rerun verb is present and no negation/question guard tripped.
    if any(k in lowered for k in _RERUN_EXACT):
        return "rerun"

    return "question"


# Latin go tokens that must match on a word boundary so they cannot be a
# substring of another word ("go" in "logo"/"good", "run" in "runtime").
_GO_LATIN_RE = re.compile(r"(?<![a-z])(ok|okay|go|run|yes|y|approve|approved)(?![a-z])")
# CJK go phrases. These are matched as substrings because they carry no word
# boundaries; they are specific enough not to appear inside unrelated words.
_GO_CJK = ("開始", "开始", "執行", "执行", "確認執行", "确认执行", "同意", "可以")


def _contains_go_token(lowered):
    """True when *lowered* contains a standalone go-ahead token."""
    if _GO_LATIN_RE.search(lowered):
        return True
    return any(k in lowered for k in _GO_CJK)


# Markers that identify a message *we* generated to drive the agent (the plan
# preamble / the execution instruction), as opposed to the engineer typing in the
# drawer. The agent-server echoes these back as user MessageEvents; ingest must
# not surface them as "工程師" chat bubbles (they are system instructions, and a
# 3–4 KB block repeated on every GO drowns the actual conversation).
_INSTRUCTION_MARKERS = (
    "【進場模式：先說明計畫，等工程師同意後才執行】",
    "【工程師已確認，請依最新計畫開始執行】",
    "【工程師要求重新執行本測項】",
)


def is_agent_instruction(text):
    """True when *text* is an internal instruction we sent, not engineer chat."""
    head = (text or "").lstrip()[:80]
    return any(head.startswith(m) for m in _INSTRUCTION_MARKERS)


# Words that carry no plan content. A turn made only of these must not become a
# "plan revision" — otherwise a casual「你好」makes the agent believe the plan
# changed and re-ask for confirmation instead of executing (the GO-swallow loop).
_TRIVIAL_CHAT = {
    "你好", "您好", "hi", "hello", "hey", "哈囉", "哈罗", "在嗎", "在吗",
    "謝謝", "谢谢", "thanks", "thank you", "thx", "收到",
    "哈哈", "呵呵", "測試", "测试", "test", "嗨",
}


def is_substantive_revision(text):
    """True only when an engineer turn plausibly adds a constraint / spec / SOP.

    A question or small talk is *not* a plan change: recording it as one is what
    made the agent reply「計畫確認（Plan v2）」and demand another GO forever. The
    engineer only wants a revision recorded when they actually supply something
    (a SPEC value, a scope limit, an extra log to collect, …).
    """
    raw = (text or "").strip()
    if not raw:
        return False
    stripped = _strip_punct(raw.lower())
    if stripped in _TRIVIAL_CHAT:
        return False
    lowered = raw.lower()
    # A question is answered, not folded into the plan.
    if any(m in lowered for m in _QUESTION_MARKERS):
        return False
    # Very short non-question turns are almost always filler ("喔", "好", "嗯嗯").
    if len(stripped) <= 2:
        return False
    return True


def is_approval(text):
    """True only for an unambiguous go-ahead (used to gate execution)."""
    return classify_user_intent(text) == "go"


def is_cancel(text):
    return classify_user_intent(text) == "cancel"


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
        # Text default stays qwen3.8-27b. A vision-capable profile is used only
        # when a message actually carries an image, so image reading works
        # without changing the default model for ordinary text runs.
        self.llm_profile = (llm_profile or os.environ.get("PA_AGENT_LLM_PROFILE")
                            or "qwen3.8-27b")
        self.vision_profile = (os.environ.get("PA_AGENT_VISION_PROFILE")
                               or "qwen3-vl-32b")
        self._client = client
        # conversation_id -> profile name actually applied, so we do not issue a
        # redundant switch_llm on every turn.
        self._applied_profile = {}

    def _llm_config(self, profile=None):
        """Load a bound LLM profile so conversations use the PA model.

        The agent-server requires an explicit agent on create; we build one from
        the saved profile rather than relying on a server default. ``profile``
        defaults to the text model; pass the vision profile when the message
        carries an image.
        """
        name = profile or self.llm_profile
        path = os.path.join(self.settings_dir, "profiles", f"{name}.json")
        with open(path, encoding="utf-8") as fh:
            profile_data = json.load(fh)
        llm = {"model": profile_data["model"]}
        # Forward every LLM-recognized field from the profile. The critical
        # ones for image reading are capability_overrides (supports_vision)
        # and disable_vision; dropping them (as an old 8-key whitelist did)
        # left the vision model without a declared vision capability.
        # modify_params is deliberately excluded: the agent-server's LLM-Input
        # schema has no such field, so it is a local-only knob.
        for key, value in profile_data.items():
            if key in ("model", "modify_params"):
                continue
            if value is not None:
                llm[key] = value
        # The qwen3.8-27b server rejects the SDK default reasoning_effort "high"
        # (it accepts xhigh/medium/low). Use a supported value explicitly.
        llm["reasoning_effort"] = profile_data.get("reasoning_effort", "medium")
        # The vision model (qwen3-vl, vLLM :8002) is served WITHOUT a tool-call
        # parser, so it cannot honour native function calling: with
        # native_tool_calling=True the SDK sends tool_choice:"auto", which that
        # vLLM instance rejects ("tool_choice: auto" requires a registered
        # parser; vLLM 0.28 ships none for Qwen-VL). Forcing it to False makes
        # the SDK mock tool-calling in the prompt and POP tool_choice, so vLLM
        # works unchanged. This only affects the vision profile — the text
        # profile (qwen3.8-27b on :8001, which has tool flags) keeps native FC.
        if name == self.vision_profile:
            llm["native_tool_calling"] = False
        return llm

    def vision_available(self):
        """Return True when a vision-capable profile is actually wired up.

        Images can only be read if the agent runs on a model that declares
        ``supports_vision``. This inspects the configured vision profile file so
        the UI/instruction can honestly say "the image will be read" instead of
        always emitting a caveat that the model cannot parse images (which made
        the agent tell the engineer it never received the screenshot).
        """
        path = os.path.join(self.settings_dir, "profiles", f"{self.vision_profile}.json")
        try:
            with open(path, encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, ValueError):
            return False
        caps = data.get("capability_overrides") or {}
        return bool(caps.get("supports_vision")) and not data.get("disable_vision")

    def _profile_for(self, run):
        """Return the LLM profile a run should use right now.

        Images cannot be read by the text model, so when a run carries any
        image attachment the vision profile is selected; otherwise the text
        default is kept. This is evaluated per call so a run that gains an
        image mid-conversation switches over automatically.
        """
        try:
            attachments = self.store.list_attachments(run["run_id"]) if run else []
        except Exception:
            attachments = []
        if any(a.get("kind") == "image" for a in attachments):
            return self.vision_profile
        return self.llm_profile

    def switch_llm(self, conversation_id, profile=None):
        """Point a live conversation at a different bound LLM profile."""
        response = self._http().post(
            f"/api/conversations/{conversation_id}/switch_llm",
            json={"llm": self._llm_config(profile)},
        )
        response.raise_for_status()
        return True

    def _image_parts(self, run, attachments=None):
        """Build image content blocks for a run's image attachments.

        The vision model can only read an image if it is sent as an image part,
        so images are embedded as base64 data URLs (the agent-server runs with a
        different HOME, so a local file path would not resolve). Files that no
        longer exist are skipped rather than failing the send.

        ``attachments`` narrows the set to the current turn's uploads; when it is
        omitted every image on the run is used (execution turns want them all).
        """
        parts = []
        if attachments is None:
            try:
                attachments = self.store.list_attachments(run["run_id"]) if run else []
            except Exception:
                attachments = []
        for att in attachments:
            if att.get("kind") != "image":
                continue
            path = att.get("stored_path")
            if not path or not os.path.isfile(path):
                continue
            try:
                with open(path, "rb") as fh:
                    encoded = base64.b64encode(fh.read()).decode("ascii")
            except OSError:
                continue
            mime = att.get("mime") or "image/png"
            parts.append({"type": "image", "image_urls": [f"data:{mime};base64,{encoded}"]})
        return parts

    def _ensure_profile(self, run_id, cid):
        """Switch the live conversation to the profile the run now needs.

        Called before an execution turn so an image added mid-run is read by
        the vision model even though the conversation was created with the text
        model. The applied profile is tracked in memory per conversation; the
        switch is a no-op when the conversation is already on the right model.
        """
        run = self.store.get_run(run_id)
        desired = self._profile_for(run)
        if self._applied_profile.get(cid) == desired:
            return
        try:
            self.switch_llm(cid, desired)
        except Exception:
            # A failed switch must not abort execution; the agent simply runs
            # with the model it already has.
            return
        self._applied_profile[cid] = desired

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
        "工程師若提出問題或要求補充說明，直接針對問題回答即可，不要重貼整份計畫、",
        "也不要重新徵求同意；只有當工程師實際提供 SPEC / SOP / 附件或明確修正測試範圍時，",
        "才據以修正計畫（簡短說明修改了哪一點即可，無需重貼全文），然後等待下一次同意。",
        "當工程師回覆「OK」或「GO」表示可以執行時，直接依你剛才說明的計畫執行，",
        "不要再一次複述計畫、也不要求二次確認（只認「OK / GO」，不要因為閒聊而重新確認）；",
        "執行完畢後產出測試記錄。",
        "計畫執行完（已產出測試記錄）之後，若工程師只是「提問」（例如問檔案路徑、",
        "問某欄位的意義、要求補充說明）或純粹寒暄，請直接針對內容回應，不要重跑測試、",
        "不要重新執行指令、也不要重貼同一份測試記錄。只有當工程師明確要求「重跑、重新驗證、",
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

        cls = self._classification(tc)

        # Classification-driven policy (P0-5). The reviewed classification lives
        # only under ai_review; it drives what the agent is allowed to do. This
        # runs in the BACKEND (the instruction is built server-side), not the UI.
        if cls == "MANUAL_ONLY":
            # 人工（MANUAL ONLY）測項：本質是人工目視／物理檢查，沒有可執行的指令。
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
        elif cls == "BLOCKED":
            lines += [
                "",
                "【本測項標記為 BLOCKED】",
                "審查結果顯示此測項目前不可執行。請清楚說明阻擋原因（缺少的授權、",
                "危險操作、缺少的關鍵資訊），在條件解除前不要執行任何受影響的步驟。",
                "不要為了「有進度」而執行任何未經授權或高風險的動作。",
            ]
        elif cls == "REQUIRES_CONFIRMATION":
            lines += [
                "",
                "【本測項需要工程師確認後才執行的部分】",
                "先說明缺少什麼（例如需要安裝的套件、需要指定的裝置），",
                "以及哪些部分可以安全地先做。不要因為缺一個項目就整條拒絕執行。",
                "工程師確認後，只執行被允許的部分；破壞性或安裝性動作一律先問。",
            ]

        # Execution target. Without this the agent has no DUT to run against and
        # will fabricate results; it MUST SSH into the given host to run commands.
        dut = self._dut_block(target)
        if dut and cls != "MANUAL_ONLY":
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
            "- 不要自行增加原測項未要求的壓力測試或破壞性操作。",
            "- 不要自行改變測試範圍（scope）。",
            "",
            "【資料取得原則（P0-3：不要因為缺文件就拒絕測試）】",
            "- 「沒有文件」不等於「不能測」。資料足夠就做；能安全收集的就先收集。",
            "- 缺少 SPEC / SOP / 參考文件時，仍可安全地收集 actual 資訊（例如 lspci）。",
            "  例：PCIe inventory 測項缺 expected device list 時：",
            "    * 先安全執行 lspci 收集 actual inventory；",
            "    * 告訴工程師「實際資訊已收集，但 SPEC compliance 尚無法判定」；",
            "    * 不要因為缺 SPEC 就拒絕執行整條測試。",
            "- 若只缺一個關鍵值（例如預期的裝置清單），只問那一個值，",
            "  不要要求工程師上傳整份 SOP。",
            "- 但仍必須阻擋（不可執行）：不知道 DUT、不知道要操作哪顆 device、",
            "  destructive 操作沒有授權、FW flash / PFR / power 等高風險操作沒有必要確認。",
            "- 「沒有判定依據」不等於「可以自行宣告 PASS」；判定一律交給工程師。",
            "",
            "【產出檔案原則（依本測項的證據需求，不要硬套固定檔名）】",
            "- 依本測項的 logs_to_collect / 證據需求決定要收集哪些檔案，不要所有測項都套用",
            "  相同的固定檔名（例如不要硬用 lspci_vvv_pre.txt 這種 PCIe 專屬命名）。",
            "- 同類證據盡量合併、避免產生大量碎檔；原始輸出若很長，摘要重點即可。",
            "- 產出一個 test_record 摘要檔，說明完成了哪些步驟、哪些沒完成、哪些被跳過、",
            "  哪些發生錯誤，以及限制（limitations）。",
            "",
            "【紀錄檔案語言：一律使用英文】",
            "- 你寫入檔案的所有內容（test_record、log 摘要、註解、欄位名稱、說明文字）",
            "  一律使用英文；檔名也必須是英文。",
            "- 只有「對話回覆」使用繁體中文；寫進檔案的內容不要在中文與英文之間混用。",
            "- 指令輸出、原始 log、程式碼可保留原文，不需翻譯。",
            "",
        ]
        out_dir = self._dut_output_dir(target, tc)
        if out_dir:
            ip = (target or {}).get("os_ip") or ""
            user = (target or {}).get("os_user") or "root"
            port = (target or {}).get("os_port") or 22
            lines += [
                "【紀錄檔案輸出位置（DUT 上的固定路徑）】",
                "所有產出的紀錄檔一律寫入 DUT 上的下列目錄（請先在 DUT 上建立目錄再寫入）：",
                f"  {out_dir}",
                "寫入範例（在 DUT 上執行，路徑含空白請用引號）：",
                f"  sshpass -p '<password>' ssh -o StrictHostKeyChecking=no -p {port} "
                f"{user}@{ip} 'mkdir -p \"{out_dir}\"'",
                f"  sshpass -p '<password>' ssh -o StrictHostKeyChecking=no -p {port} "
                f"{user}@{ip} 'cat > \"{out_dir}/test_record.md\"' <<'EOF'  # 內容一律英文",
                "不要寫到本機工作區、/tmp 或其他未指定的路徑。",
                "",
            ]
        # Engineer-supplied supplemental context (P0-2). The latest confirmed
        # revision is injected last so it overrides the plan above; a change the
        # engineer made during discussion must reach the actual execution.
        attachment_text = context.get("_attachment_text")
        if attachment_text and attachment_text.strip():
            lines += [
                "",
                "【工程師提供的附件內容（本次測試請一併參考）】",
                attachment_text.strip(),
            ]
        attachment_index = context.get("_attachment_index") or []
        vision_images = [a["name"] for a in attachment_index
                         if a.get("kind") == "image" and a.get("vision_supported")]
        if vision_images:
            lines += [
                "",
                "【工程師已附上圖片（本次測試請查看並參考）】",
                "以下圖片已隨本訊息附上，你可直接讀取內容：",
                "  - " + "\n  - ".join(vision_images),
                "若圖片是 DUT 外觀、標籤、序號或接線等實體證據，請依圖片內容研判並納入紀錄。",
            ]
        vision_unsupported = [a["name"] for a in attachment_index
                              if a.get("kind") == "image" and not a.get("vision_supported")]
        if vision_unsupported:
            lines += [
                "",
                "【注意：以下圖片已上傳，但目前模型無法直接解析圖片內容】",
                "不要假裝已理解圖片內容；如需圖片中的資訊，請工程師以文字說明。",
                "  - " + "\n  - ".join(vision_unsupported),
            ]
        supplemental = context.get("_supplemental_text")
        if supplemental and supplemental.strip():
            rev = context.get("_supplemental_revision") or 0
            lines += [
                "",
                f"【工程師補充與修正（plan revision {rev}，優先於上方計畫）】",
                "以下為工程師在本次對話中補充或修正的內容，若與上方計畫衝突，以此為準：",
                supplemental.strip(),
            ]
        if (user_note or "").strip():
            lines += ["", "【工程師備註（請遵循）】", user_note.strip()]
        return "\n".join(lines)

    @staticmethod
    def _classification(tc):
        """Normalise the reviewed automation classification to a canonical token.

        The classification lives ONLY under ``ai_review.automation_classification``
        (surfaced into the snapshot as ``ai_automation_classification``); library
        rows have no ``category`` / ``manual_only`` / ``mode``. Returns one of
        ``FULLY_AUTOMATABLE`` / ``REQUIRES_CONFIRMATION`` / ``MANUAL_ONLY`` /
        ``BLOCKED`` / ``UNKNOWN``.
        """
        raw = str(
            tc.get("ai_automation_classification")
            or tc.get("category")
            or tc.get("mode")
            or ""
        ).upper().replace("/", " ").replace("_", " ").strip()
        collapsed = " ".join(raw.split())
        if "FULLY" in collapsed or "AUTOMATABLE" in collapsed:
            return "FULLY_AUTOMATABLE"
        if "MANUAL" in collapsed:
            return "MANUAL_ONLY"
        if "BLOCK" in collapsed:
            return "BLOCKED"
        if "REQUIRES" in collapsed or "CONFIRMATION" in collapsed or "PACKAGE" in collapsed:
            return "REQUIRES_CONFIRMATION"
        return "UNKNOWN"

    @classmethod
    def _is_manual_only(cls, tc):
        """True when the case is a manual/physical check (no runnable commands)."""
        return cls._classification(tc) == "MANUAL_ONLY"

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

    @staticmethod
    def _dut_output_dir(target, tc):
        """Return the DUT directory where test-record files must be written.

        Layout: ``/home/PAagent/<project>/<testcase-code>``. The project comes
        from the resolved target; the leaf is the test case code. Returns "" when
        we cannot form a stable path (no DUT, or no project/code), so the
        instruction simply omits the output-location block rather than inventing
        a wrong path.
        """
        if not (target or {}).get("os_ip"):
            return ""
        project = str((target or {}).get("project") or "").strip()
        code = str((tc or {}).get("code") or "").strip()
        if not project or not code:
            return ""
        # Keep each path segment safe: no whitespace/../ that could escape the base.
        project = project.replace("/", "_").strip() or "PAagent"
        code = code.replace("/", "_").strip()
        return f"/home/PAagent/{project}/{code}"

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

        context = self._context_with_extras(run)
        payload = {
            "workspace": {
                "kind": "LocalWorkspace",
                "working_dir": workspace_dir or f"/srv/pa-agent/workspace/{run_id}",
            },
            "agent": {
                "kind": "Agent",
                "llm": self._llm_config(self._profile_for(run)),
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
                "content": [
                    {"type": "text",
                     "text": self.build_instruction(context, user_note, mode=mode)},
                    *self._image_parts(run),
                ],
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
        # The conversation was created on the profile chosen for the run's
        # current attachment set; remember it so _ensure_profile is a no-op.
        self._applied_profile[conversation_id] = self._profile_for(run)
        return conversation_id

    def _context_with_extras(self, run):
        """Return a copy of the run context carrying supplemental + attachments.

        The sealed AgentRunContext must never be mutated, so the extras the
        engineer added during the run (supplemental plan revisions, attachment
        text) are merged into a *copy* used only to render the instruction. This
        keeps the stored context immutable and hash-verifiable while ensuring the
        latest confirmed plan drives execution.
        """
        run_id = run["run_id"]
        context = dict(run.get("context") or {})
        latest = self.store.latest_supplemental(run_id)
        if latest and (latest.get("text") or "").strip():
            context["_supplemental_text"] = latest["text"]
            context["_supplemental_revision"] = latest.get("revision", 0)
        attachments = self.store.list_attachments(run_id)
        if attachments:
            context["_attachment_index"] = attachments
            extracted = []
            for a in attachments:
                # Any attachment whose content was successfully extracted (text
                # files, parsed PDFs) is handed to the agent; ``kind`` is a UI
                # label, not a gate on whether the text is usable.
                if a.get("status") == "ready":
                    rec = self.store.get_attachment(run_id, a["attachment_id"])
                    if rec and rec.get("extracted_text"):
                        extracted.append(
                            f"--- 附件：{a['name']} ---\n{rec['extracted_text']}")
            if extracted:
                context["_attachment_text"] = "\n\n".join(extracted)
        return context

    # Endpoint used to append a user turn to an existing conversation and let the
    # agent respond. Overridable because the exact agent-server route is an
    # integration detail that must be verified against the live 18010 server.
    _MESSAGE_ENDPOINT = os.environ.get(
        "PA_AGENT_MESSAGE_ENDPOINT", "/api/conversations/{cid}/events")

    def send_user_message(self, run_id, text, attachments=None):
        """Append an engineer chat turn to the run's conversation and let it run.

        Returns the conversation id. Raises ValueError when the run has no
        bound conversation. Never fabricates a reply — the agent's response
        arrives through :meth:`ingest` like any other event.

        ``attachments`` narrows which images ride this turn; when omitted the
        run's whole image set is sent. A question should pass only its own new
        uploads so the agent does not re-read a picture from an earlier turn.

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
        # A mid-run image must be read by the vision model: point the live
        # conversation at the right profile before the turn is sent.
        self._ensure_profile(run_id, cid)
        payload = {
            "role": "user",
            "content": [
                {"type": "text", "text": text},
                *self._image_parts(run, attachments),
            ],
            "run": True,
        }
        response = self._http().post(self._MESSAGE_ENDPOINT.format(cid=cid), json=payload)
        response.raise_for_status()
        return cid

    def run_execution(self, run_id, *, trigger="go"):
        """Start an execution turn using the LATEST confirmed plan revision.

        This is the fix for P0-2: a plain chat turn (question) goes through
        ``ask_agent`` and never reaches execution, so a constraint the engineer
        stated during discussion could be lost. On GO/rerun we build a *fresh*
        instruction that folds in the latest supplemental revision + attachments
        and send it as the execution turn. The agent therefore always executes
        the plan the engineer last confirmed, not the original one.
        """
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        cid = run.get("conversation_ref")
        if not cid:
            raise ValueError("run has no conversation; start it first")
        self._ensure_profile(run_id, cid)
        context = self._context_with_extras(run)
        header = ("【工程師已確認，請依最新計畫開始執行】" if trigger == "go"
                  else "【工程師要求重新執行本測項】")
        instruction = header + "\n\n" + self.build_instruction(context, mode="execute")
        payload = {
            "role": "user",
            "content": [
                {"type": "text", "text": instruction},
                *self._image_parts(run),
            ],
            "run": True,
        }
        response = self._http().post(self._MESSAGE_ENDPOINT.format(cid=cid), json=payload)
        response.raise_for_status()
        self.store.update_state(run_id, status="RUNNING")
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

        A question is still a turn on the conversation, so a run carrying an image
        must be answered by the vision profile with the image attached — otherwise
        "can you see the picture?" would always answer "no" even after a successful
        upload. The content is therefore sent as message parts (text + images)
        when the server supports it; ``question`` stays the plain-text fallback.
        """
        run = self.store.get_run(run_id)
        if run is None:
            raise KeyError("unknown run_id")
        cid = run.get("conversation_ref")
        if not cid:
            raise ValueError("run has no conversation; start it first")
        self._ensure_profile(run_id, cid)
        images = self._image_parts(run)
        payload = {"question": question}
        if images:
            payload["content"] = [
                {"type": "text", "text": question},
                *images,
            ]
        response = self._http().post(
            self._ASK_ENDPOINT.format(cid=cid), json=payload)
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
        finish_event_id = None
        for event in events:
            channel, payload = classify_event(event)
            if channel == "message":
                seq = None
                role = payload["role"]
                # Our own plan/execution instructions are echoed back by the
                # agent-server as *user* events. Surface them as system notes so
                # the drawer does not print a 3–4 KB "工程師" bubble on every GO.
                if role == "user" and is_agent_instruction(payload["text"]):
                    role = "system"
                # A user turn was echoed locally by the route on send; adopt it
                # rather than inserting a duplicate when its event comes back.
                if role == "user" and payload.get("event_id"):
                    seq = self.store.claim_pending_user_message(
                        run_id, payload["text"], payload["event_id"])
                if seq is None:
                    seq = self.store.add_message(
                        run_id, role=role, text=payload["text"],
                        source_event_id=payload.get("event_id"),
                    )
                if seq is not None:
                    summary["messages"] += 1
            elif channel == "command":
                pending_commands.append(payload)
                if payload.get("finish_message"):
                    finish_log = payload["finish_message"]
                    finish_event_id = payload.get("event_id")
            elif channel == "evidence":
                pending_evidence.append(payload)
            elif channel == "status":
                status = _STATUS_MAP.get(str(payload), None)
                if status:
                    summary["status"] = status

        if pending_commands:
            summary["commands"] = self.store.append_commands(run_id, pending_commands)
        if pending_evidence:
            summary["evidence"] = self.store.append_evidence(run_id, pending_evidence)

        if summary["status"]:
            updates = {"status": summary["status"]}
            # ``finished`` is the agent-server's per-turn state: the agent stopped
            # and is idle waiting for the next engineer message. It does NOT mean
            # the test task is done. It is only DONE when the turn also carried a
            # FinishAction (the agent's closing test record) — either in this batch
            # (``finish_log``) or a previous one (already persisted as final_result).
            #
            # A run that already produced a log must NEVER fall back to
            # WAITING_FOR_USER: that made a finished run look like it was still
            # waiting for the engineer, and because WAITING_FOR_USER is treated as
            # non-terminal, reopening the case resumed the stale run forever.
            if summary["status"] == "DONE":
                existing_run = self.store.get_run(run_id) or {}
                has_result = bool(finish_log) or bool(existing_run.get("final_result"))
                if not has_result:
                    updates["status"] = "WAITING_FOR_USER"
            if updates["status"] in {"PASS", "FAIL", "BLOCKED", "DONE", "ERROR"}:
                updates["ended_at"] = _now()
            # The engineer reads the agent's log to reach a verdict, so persist
            # the closing statement as final_result and mirror it into the chat
            # as an agent message (it is a FinishAction, not a MessageEvent, and
            # would otherwise never reach the drawer body). Deduped by the
            # FinishAction's source event id so re-polling the same turn does not
            # render final_result twice.
            if finish_log:
                updates["final_result"] = finish_log
                seq = self.store.add_message(
                    run_id, role="agent", text=finish_log, kind="finish",
                    source_event_id=finish_event_id or f"finish:{run_id}:{len(finish_log)}",
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
