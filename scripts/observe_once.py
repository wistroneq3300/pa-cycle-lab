"""One-shot observation run for manual verification. Uses the caller's CYCLE_* env."""
import sys
import time
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'engine' / 'vera_cycle'))

# Must import integration.settings before telemetry_core: settings resolves
# PA_DATA_DIR, which telemetry_core snapshots into DB_FILE at import time.
from integration.settings import DATA  # noqa: F401
from integration.observation_service import collect_once
from integration.store import Store
from integration.authorization import configured_provider

sys.path.insert(0, str(ROOT / 'app'))
import telemetry_core as T

print('DB_FILE =', T.DB_FILE, flush=True)
store = Store()
provider = configured_provider()
start = time.time()
results = collect_once(store, provider)
print('elapsed %.1fs' % (time.time() - start), flush=True)
for r in results:
    print(json.dumps(r, ensure_ascii=False), flush=True)
