"""Read-only pixel comparison of native browser captures, never image editing."""
from pathlib import Path
import json
import hashlib
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/screenshots/l10-cinematic/cooling-v3'

def compare(first, second):
    a, b = [np.asarray(Image.open(evidence / p).convert('RGB')).astype(np.int16) for p in (first, second)]
    assert a.shape == b.shape
    delta = np.abs(a - b)
    return dict(first=first, second=second, dimensions=[a.shape[1], a.shape[0]],
                changedPixels=int(np.count_nonzero(np.max(delta, axis=2))),
                totalPixels=int(a.shape[0]*a.shape[1]), maxChannelDelta=int(delta.max()),
                meanChannelDelta=float(delta.mean()),
                sha256=[hashlib.sha256((evidence/p).read_bytes()).hexdigest() for p in (first, second)])

report = dict(method='Direct RGB difference of unchanged native PNGs; no resampling, image correction or perceptual-score conversion.',
              protected=[compare('before/'+p+'.png', 'after/'+p+'.png') for p in ['guard-gold-front', 'guard-network']],
              flow=[compare('after/C-dynamic-cooling-flow.png', 'after/C-dynamic-cooling-flow-B.png'),
                    compare('after/dashboard-flow-A-2127x1272.png', 'after/dashboard-flow-B-2127x1272.png')])
for pair in report['flow']:
    assert pair['changedPixels'] > 0, 'Actual native flow frames must change'
report['limits'] = 'Protected geometry/material bytes are audited separately. Pixel differences report driver/raster effects, not proof of visual equivalence. Flow drawing/clock/camera invariants are checked in comparison.json and runtime suites.'
(evidence/'evidence/pixel-comparison.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
print(json.dumps(report, indent=2))
