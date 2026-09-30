"""One-time, asserted edits to the copied sources only."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
path=root/'app/AGENTS.md'
historical=root/'docs/source-pa-AGENTS.md'
historical.parent.mkdir(exist_ok=True)
historical.write_bytes(path.read_bytes())
path.write_text('# Isolated PA Cycle Lab copy\n\nFollow ../AGENTS.md. Historical production instructions are archived in\n../docs/source-pa-AGENTS.md and must not be executed.\n',encoding='utf-8')
path=root/'engine/vera_cycle/cycle_transport.py'
text=path.read_text(encoding='utf-8')
text=text.replace('def __init__(self, credentials, known_hosts):','def __init__(self, credentials, known_hosts, users=None, ports=None, cipher=17):\n        self.users = users or {}\n        self.ports = ports or {}\n        self.cipher = cipher')
text=text.replace('os.environ.get(role.upper() + "_USER", USERS[role])','self.users.get(role, USERS[role])')
text=text.replace('username=self.users.get(role, USERS[role]),','username=self.users.get(role, USERS[role]), port=self.ports.get(role, 22),')
text=text.replace('"-C", "17",','"-C", str(self.cipher),')
text=text.replace('os.environ.get("BMC_USER", "root")','self.users.get("bmc", "root")')
text=text.replace('    def _connect(self, target, role, timeout):','    def redact(self, text):\n        for secret in self.credentials.values():\n            if secret:\n                text = text.replace(secret, "[REDACTED]")\n        return text\n\n    def _connect(self, target, role, timeout):')
text=text.replace('b"".join(chunks).decode(errors="replace"), "RETURNED"','self.redact(b"".join(chunks).decode(errors="replace")), "RETURNED"')
text=text.replace('result.stdout + result.stderr, duration=', 'self.redact(result.stdout + result.stderr), duration=')
path.write_text(text,encoding='utf-8')
# Copy the strict in-memory transport, without importing test modules in production.
text=(root/'engine/vera_cycle/dev/tests/test_cycle.py').read_text(encoding='utf-8')
block=text[text.index('class FakeTransport:'):text.index('class PureTests')]
block=block.replace('class FakeTransport:','class SyntheticTransport:').replace('self.hardware_failure = True','self.hardware_failure = False')
header='''"""SYNTHETIC only: no sockets, subprocesses or remote execution. Derived from Vera test fixture."""
from pathlib import Path
import time
from . import settings
from cycle_core import digest
from cycle_engine import CAPTURES
from cycle_transport import Command
PCI = '0000:01:00.0 Ethernet controller [0200]: Synthetic [1234:5678]\\n'
SENSORS = 'Temp | 30 | degrees C | ok | na\\nFan | 12000 | RPM | ok | na\\n'
'''
block=block.replace('    def action(self, t):','    def action(self, t):\n        time.sleep(0.35)')
(root/'integration/synthetic.py').write_text(header+block,encoding='utf-8')
# Disable automatic monitoring in offline mode; all actual transports are guarded separately.
path=root/'app/main.py'; text=path.read_text(encoding='utf-8')
text=text.replace('    if force:\n        _refresh_status(force=True)', '    if os.environ.get("CYCLE_MODE", "synthetic") == "synthetic":\n        return\n    if force:\n        _refresh_status(force=True)')
text=text.replace('    if _telemetry_thread is None:', '    if os.environ.get("CYCLE_MODE", "synthetic") == "live" and _telemetry_thread is None:')
text=text.replace('directory="static"','directory=os.path.join(os.path.dirname(__file__), "static")')
text=text.replace('FileResponse("static/index.html")','FileResponse(os.path.join(os.path.dirname(__file__), "static/index.html"))')
path.write_text(text,encoding='utf-8')
# The copied terminal bridge is not deployed. Repair closeOne if used in future.
path=root/'app/terminal_bridge/server.js'; text=path.read_text(encoding='utf-8')
needle="    } else if (msg && msg.type === 'sendOne'"
replacement="    } else if (msg && msg.type === 'closeOne' && msg.name && shells[msg.name]) {\n      shells[msg.name].end();\n      delete shells[msg.name];\n"+needle
assert needle in text
text=text.replace(needle,replacement)
path.write_text(text,encoding='utf-8')
