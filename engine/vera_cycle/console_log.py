"""Human-readable console transcript, in the vera-cycle style.

The live event journal records every atomic step (including the noisy
"Collecting X / Collection returned: X" pairs). This module folds that raw
stream into short operator sentences -- "which node, which loop, where is it
stuck" -- and appends them to ``console.log`` next to the evidence, the same
file the HTML report renders in its Console panel.

Only this module decides what is worth a line. It never drops evidence: the
structured journal and the per-loop evidence files are untouched.
"""
from __future__ import annotations

import threading
from datetime import datetime, timezone
from pathlib import Path

# Events that carry operator meaning. Everything else is either noise
# (COLLECTION_STARTED/FINISHED for a successful collection) or already
# summarised by the per-loop result block.
# COMMAND_DISPATCHING/DISPATCHED are handled separately because the wording
# depends on the job's cycle_mode (reboot / power_cycle / aux_cycle), not on a
# fixed label -- a reboot must never read as "aux cycle".
_PHASE_LABELS = {
    "RESPONSE_RETURNED": "command returned; verifying boot",
    "WAIT_OFFLINE": "waiting OS boot",
    "OS_UNREACHABLE": "waiting OS boot",
    "WAIT_RECOVERY": "waiting OS boot",
    "BOOT_ID_CHANGED": "OS up, system check running",
    "RECOVERY_DETECTED": "OS up, system check running",
    "POST_STARTED": "system check running",
    "POST_COMPLETED": "system check done",
    "IDENTITY_CHECK": None,       # folded into the phase headline, not printed
    "IDENTITY_VERIFIED": None,
    "PCI_COMPARISON": None,
    "SENSOR_COMPARISON": None,
    "ACTION_PREPARING": None,
    "DEPENDENCY_CHECK": None,
    "DEPENDENCY_CHECK_COMPLETE": None,
    "BASELINE_COLLECTION": None,
    "COLLECTION_STARTED": None,   # the noise we deliberately drop
    "COLLECTION_FINISHED": None,
}

_CONTROLLER_EVENTS = {
    "CREATED": "Job created; targets and configuration reserved",
    "PRE_STARTED": "PRE started; every target is probed for identity and baseline",
    "AWAITING_CONFIRMATION": "PRE finished; waiting for operator confirmation",
    "CONFIRMED": "Operator confirmed; campaign is now RUNNING",
    "STOP_REQUESTED": "Stop requested; no new action will be dispatched",
    "STOPPING_AFTER_ROUND": "Stopping after the current round",
}

# Operator-facing short label per cycle mode, used for the "<label> sent" stage
# line. reboot/aux mirror vera-cycle; power_cycle uses the UI's own wording
# ("DC Power Cycle"). Unknown/missing modes fall back to a neutral "cycle" so
# nothing is silently presented as AUX.
_MODE_LABELS = {
    "aux_cycle": "aux cycle",
    "reboot": "reboot",
    "power_cycle": "DC Power Cycle",
}


def _mode_label(cycle_mode: str | None) -> str:
    return _MODE_LABELS.get(str(cycle_mode or "").strip().lower(), "cycle")


def _stamp(timestamp: str | None) -> str:
    """Render the journal timestamp as UTC+8 wall clock, matching evidence files."""
    if not timestamp:
        return datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
    try:
        value = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone().strftime("%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        return str(timestamp)


class ConsoleLog:
    """Append-only operator transcript for one job.

    Thread-safe: node sessions emit events from a thread pool. Every write is
    best-effort -- a console line must never fail a job, so errors are swallowed
    the same way the engine treats optional progress reporting.
    """

    def __init__(self, path: Path, targets: list[str]):
        self.path = Path(path)
        self.targets = [t for t in targets if t]
        self._lock = threading.Lock()
        self._seen_stage: dict[str, str] = {}
        self._seen_loop: set = set()
        self._mode = "cycle"

    # -- public API -------------------------------------------------------
    def header(self, campaign: dict) -> None:
        self._mode = _mode_label(campaign.get("cycle_mode"))
        limits = campaign.get("limits") or {}
        self._write("\n".join([
            f"Run ID: {campaign.get('run_id', '')}",
            "Time zone: UTC+8 (local time in Run ID and +08:00 in console/evidence timestamps)",
            f"Selected targets: {', '.join(self.targets) if self.targets else '(none)'}",
            f"Mode: {campaign.get('cycle_mode', '')}; channel: {campaign.get('channel', '')}; "
            f"loops: {limits.get('loops') or 'unlimited'}; hours: {limits.get('hours') or 'unlimited'}",
        ]))

    def job_event(self, event: dict) -> None:
        key = event.get("event_type") or ""
        text = _CONTROLLER_EVENTS.get(key)
        if not text:
            return
        self._line(event, text)

    def node_event(self, event: dict) -> None:
        key = event.get("event_type") or ""
        node = event.get("node") or event.get("machine_id") or "JOB"

        if key == "LOOP_STARTED":
            loop = event.get("loop")
            # Three nodes each fire LOOP_STARTED; the round is announced once.
            if loop in self._seen_loop:
                return
            self._seen_loop.add(loop)
            self._line(event, event.get("message") or f"Loop {loop} started")
            return

        if key in ("COMMAND_DISPATCHING", "COMMAND_DISPATCHED"):
            # One stage line per node, matching vera's "<mode> sent". "sent"
            # records the attempt, not a confirmed reboot; recovery is proven
            # separately by the boot-ID change.
            self._stage(event, node, f"{self._mode} sent")
            return

        stage = _PHASE_LABELS.get(key, "")
        if stage:
            self._stage(event, node, stage)
            return

        # Issues and anything explicitly FAIL/WARN are always worth a line.
        if key.startswith("ISSUE_") or event.get("level") in {"FAIL", "WARN", "ERROR"}:
            detail = event.get("detail") or ""
            message = event.get("message") or key
            for prefix in ("KNOWN issue: ", "PRE_EXISTING issue: ", "NEW issue: ", "issue: "):
                if message.startswith(prefix):
                    message = message[len(prefix):]
                    break
            suffix = f" — {detail}" if detail and detail not in message else ""
            self._line(event, f"{node} | {message}{suffix}")

    def loop_result(self, node: str, record: dict) -> None:
        """Compact per-loop result block, mirroring vera's ``show_result``."""
        status = "BLOCKED" if record.get("blocked") else record.get("status", "UNKNOWN")
        phase = record.get("phase", "")
        lines = [f"{node} | {phase} | {status}"]
        if record.get("duration_seconds"):
            lines.append(f"  Duration: {_duration(record['duration_seconds'])}")
        summary = record.get("check_summary") or {}
        if summary:
            lines.append("  Checks: " + " | ".join(f"{k} {v}" for k, v in summary.items()))
        for issue in record.get("issues", []):
            severity = issue.get("severity", "")
            if severity not in {"FAIL", "WARN"}:
                continue
            component = issue.get("component", "")
            detail = issue.get("detail", "")
            lines.append(f"  {severity} {component}: {detail}")
        self._write("\n".join(lines))

    def still_running(self, stages: dict[str, str] | None = None) -> None:
        """One heartbeat line summarising every node's current stage."""
        stages = stages if stages is not None else {n: s for n, s in self._seen_stage.items() if s}
        if not stages:
            return
        ordered = ", ".join(f"{node}: {stages[node]}" for node in self.targets if node in stages)
        if not ordered:
            ordered = ", ".join(f"{node}: {stage}" for node, stage in stages.items())
        self._line(None, f"still running — {ordered}")

    # -- internals --------------------------------------------------------
    def _stage(self, event: dict, node: str, stage: str) -> None:
        # Collapse repeats: a node sitting on "waiting OS boot" prints once.
        if self._seen_stage.get(node) == stage:
            return
        self._seen_stage[node] = stage
        loop = event.get("loop")
        prefix = f"Loop {loop}: " if loop else ""
        self._line(event, f"{prefix}{node} | {stage}")

    def _line(self, event: dict | None, message: str) -> None:
        self._write(f"{_stamp(event.get('timestamp') if event else None)} {message}")

    def _write(self, text: str) -> None:
        try:
            with self._lock:
                self.path.parent.mkdir(parents=True, exist_ok=True)
                with self.path.open("a", encoding="utf-8") as stream:
                    stream.write(text.rstrip("\n") + "\n")
        except OSError:
            # A transcript is a convenience; it must never fail a live job.
            pass


def _duration(seconds: float) -> str:
    seconds = int(max(0, seconds))
    hours, remainder = divmod(seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
