from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / 'engine' / 'vera_cycle'
sys.path.insert(0, str(ENGINE))
# Only a relative path under this independent checkout is accepted.
relative = Path(os.environ.get('CYCLE_INSTANCE', 'data'))
DATA = (ROOT / relative).resolve()
if relative.is_absolute() or not DATA.is_relative_to(ROOT) or DATA == ROOT:
    raise RuntimeError('CYCLE_INSTANCE must be a subdirectory of pa-cycle-lab')
DATA.mkdir(parents=True, exist_ok=True)
RUNTIME = DATA / 'runtime'
ARTIFACTS = DATA / 'artifacts'
for directory in (RUNTIME, ARTIFACTS):
    directory.mkdir(exist_ok=True)
MODE = os.environ.get('CYCLE_MODE', 'synthetic')
if MODE not in {'synthetic', 'live'}:
    raise RuntimeError('CYCLE_MODE must be synthetic or live')
os.environ['PA_DATA_DIR'] = str(DATA)
