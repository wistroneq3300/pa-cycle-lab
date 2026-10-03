"""Export this branch's isolated acceptance artifacts, never runtime data/secrets."""
import hashlib
import json
from pathlib import Path
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/shared-validation'
capture=OUT/'acceptance'
files=[p for p in capture.iterdir() if p.is_file() and p.suffix in {'.webm','.png','.zip','.json'}]
files += [OUT/n for n in ('backend-results.json','process-results.json','crash-results.json','instance.txt') if (OUT/n).exists()]
files += [p for p in (OUT/'comparison').iterdir() if p.is_file() and p.suffix in {'.xml','.json','.txt'}]
manifest=[dict(path=p.relative_to(OUT).as_posix(),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files]
(OUT/'EXPORT.json').write_text(json.dumps(dict(offline=True,real_hardware=False,files=manifest),indent=2),encoding='utf8')
with zipfile.ZipFile(OUT/'validation-acceptance.zip','w',zipfile.ZIP_DEFLATED) as archive:
    for p in files+[OUT/'EXPORT.json']:archive.write(p,p.relative_to(OUT))
screens=ROOT/'docs/screenshots/shared-validation';screens.mkdir(parents=True,exist_ok=True)
for name in ('inspection-1366-light.png','inspection-1366-dark.png','inspection-1920-light.png','inspection-1920-dark.png','fail-evidence-1920-light.png','waiting-ready.png','cycle-console.png','cycle-report.png','identity-auto-sync.png'):
    shutil.copy2(capture/name,screens/name)
proof=ROOT/'docs/validation-evidence/2026-10-03';proof.mkdir(parents=True,exist_ok=True)
for source,name in ((OUT/'comparison/final-delta.json','final-delta.json'),(OUT/'process-results.json','process-results.json'),(OUT/'crash-results.json','crash-results.json'),(capture/'results.json','browser-results.json')):
    shutil.copy2(source,proof/name)
print(OUT/'validation-acceptance.zip')
