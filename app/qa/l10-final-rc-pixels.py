"""Read-only comparison of native PNGs; never changes or resamples images."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[2]
evidence = root / 'docs/screenshots/l10-cinematic/final-rc'


def compare(first, second):
    arrays = [np.asarray(Image.open(evidence / p).convert('RGB')).astype(np.int16)
              for p in (first, second)]
    a, b = arrays
    assert a.shape == b.shape
    delta = np.abs(a - b)
    return dict(first=first, second=second, dimensions=[a.shape[1], a.shape[0]],
                changedPixels=int(np.count_nonzero(np.max(delta, axis=2))),
                totalPixels=int(a.shape[0] * a.shape[1]), maxChannelDelta=int(delta.max()),
                meanChannelDelta=float(delta.mean()),
                sha256=[hashlib.sha256((evidence / p).read_bytes()).hexdigest()
                        for p in (first, second)])


stages = ['G-bare-board-hero', 'A-cold-plate-installation', 'B-manifold-plumbing',
          'C-dynamic-cooling-flow', 'D-solid-cooling-assembly', 'E-lid-closure',
          'H-gold-front', 'F-rack-integration']
report = dict(
    method='Direct RGB difference of original native PNGs; no resampling, enhancement or perceptual-score conversion.',
    stages=[compare('before/' + p + '.png', 'after/' + p + '.png') for p in stages],
    protected=[compare('before/' + p + '.png', 'after/' + p + '.png')
               for p in ['guard-network', 'rack-full-front', 'rack-bottom-nine-1u-panels-crop']],
    flow=[compare('after/C-dynamic-cooling-flow.png', 'after/C-dynamic-cooling-flow-B.png'),
          compare('after/dashboard-flow-A-2127x1272.png', 'after/dashboard-flow-B-2127x1272.png')],
    secondRound=[compare('evidence/round1/' + p + '.png', 'after/' + p + '.png')
                 for p in ['D-solid-cooling-assembly', 'diagnostic-cold-plate-connector-macro',
                           'E-lid-closure', 'context-open-assembly-16s']])
for pair in report['flow']:
    assert pair['changedPixels'] > 0, 'Actual native flow frames change at different clock positions'
report['limits'] = ('RGB change counts are not quality or correctness scores. Protected geometry, material, '
                    'normal directions, camera/light uniforms and directed phase are checked independently. '
                    'Small raster differences can follow the explicitly authorized normal normalization.')
(evidence / 'evidence/pixel-comparison.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, indent=2))
