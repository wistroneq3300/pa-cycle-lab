"""Read-only equipment classification; never migrates inventory."""
import json
import re
from pathlib import Path

_source = (Path(__file__).parent / "static/js/equipment-rules.js").read_text(encoding="utf-8")
RULES = json.loads(_source.split(" = ", 1)[1].rstrip(";\n"))
KINDS = {kind for kind, _ in RULES}

def classify(m, name=None):
    m = m if isinstance(m, dict) else {}
    explicit = m.get("mgx_type")
    if isinstance(explicit, str) and explicit in KINDS:
        return {"kind": explicit, "status": "explicit"}
    n = str(name or m.get("name") or "").lower()
    hits = {kind for kind, pattern in RULES if re.search(pattern, n)}
    if "nvlink" in hits:
        hits.discard("switch")
    if len(hits) == 1 and not explicit:
        return {"kind": hits.pop(), "status": "inferred"}
    return {"kind": "server", "status": "needs_confirmation"}

def can_power(m, on=None):
    result = classify(m)
    if result["status"] == "needs_confirmation" or result["kind"] == "blanking":
        return False
    if result["kind"] == "server":
        return bool(m.get("os_ip") or m.get("bmc_ip"))
    fields = ("power_on_cmd", "power_off_cmd") if on is None else ("power_on_cmd" if on else "power_off_cmd",)
    return any(str(m.get(field) or "").strip() for field in fields)
