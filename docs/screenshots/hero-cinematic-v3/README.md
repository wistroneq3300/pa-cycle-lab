# Hero V3 — screenshot review

These are real Chromium / WebGL captures of the local synthetic Overview fixture, not image-generation mockups. The first and final passes are both 3440×1440. The build agent opened all 15 stages individually in both passes. Final captures include the completed silver connector cages, NVLink / PSU / TOR details, corrected 1U fasteners and callout visibility fix.

The separate QA finish review is saved in [evidence/independent-review.md](evidence/independent-review.md). The [delivery report](../../HERO-CINEMATIC-V3-DELIVERY.md) explains implementation, timeline, sources and known test limitations.

## 3440×1440 — every major stage

| Stage | First pass | Final pass | Visual review result |
| --- | --- | --- | --- |
| Empty rack / .07 | [01](first/3440x1440-dark-01-empty-rack.png) | [01](final/3440x1440-dark-01-empty-rack.png) | 框架、深度、內側導軌與背板從暗部可辨識；沒有裝好的 tray pop-in。第二輪提升暗金屬讀性，保留 opening 暗部。 |
| Device constellation / .20 | [02](first/3440x1440-dark-02-device-constellation.png) | [02](final/3440x1440-dark-02-device-constellation.png) | Compute 左側上下組、NVLink 右側中層、power 右侧上下層、network 上方；設備有順序和深度。此時間點故意只開始 anchor / leader，文字尚未完全進場。 |
| Identify / .27 | [03](first/3440x1440-dark-03-identification.png) | [03](final/3440x1440-dark-03-identification.png) | 四個 class / count 清楚，硬體仍是主角。第二輪改用真實角點候選，使四條線都能避開硬體；沒有 labels 蓋住左側資訊。 |
| Early convergence / .38 | [04](first/3440x1440-dark-04-early-convergence.png) | [04](final/3440x1440-dark-04-early-convergence.png) | 多台設備正在 lateral / depth 對位，callouts 已全部消失；設備維持各自 U 高度，不是單台排隊。 |
| Mid convergence / .46 | [05](first/3440x1440-dark-05-mid-convergence.png) | [05](final/3440x1440-dark-05-mid-convergence.png) | 多類設備形成重疊波次；當下有 22 台移動、7 台已 seating。上方已組成、下方仍在前進，沒有 neon 動線代替物理動作。 |
| Compute insertion / .55 | [06](first/3440x1440-dark-06-compute-insertion.png) | [06](final/3440x1440-dark-06-compute-insertion.png) | 第二輪讓上方設備先 seating，U40 lid / silver ports / rail 近拍更清楚；下方 NVLink 波次仍可見。整櫃底部刻意離開近拍畫框，主 tray 保持完整。 |
| Near-complete / .68 | [07](first/3440x1440-dark-07-near-complete.png) | [07](final/3440x1440-dark-07-near-complete.png) | Camera 已拉回；最後 4 台接近 seating，整櫃輪廓穩定。這一幕剩餘深度差很小，需與前一幕連續觀看，不誇大靜態截圖的移動感。 |
| Complete rack / .74 | [08](first/3440x1440-dark-08-complete-rack.png) | [08](final/3440x1440-dark-08-complete-rack.png) | 41 placements 完成，bronze face / dark PSU / frame 分層清楚，沒有浮空殘件。 |
| Engineering exploded / .84 | [09](first/3440x1440-dark-09-engineering-exploded.png) | [09](final/3440x1440-dark-09-engineering-exploded.png) | NVLink、compute、network、power 以短距離 depth / lateral 展開，設備仍保持機構排列，沒有爆炸感；完整輪廓不裁切。 |
| Returned assembly / .94 | [10](first/3440x1440-dark-10-returned-assembly.png) | [10](final/3440x1440-dark-10-returned-assembly.png) | 重新完全 seating。測試另確認每個 placement transform 精準歸零；這不是單靠外觀判定。 |
| Final hero / 1 | [11](first/3440x1440-dark-11-final-hero.png) | [11](final/3440x1440-dark-11-final-hero.png) | Rack 高度約 Hero 的 76.97%；文字退為次要資訊。Three-quarter 機櫃保留重量感、側面深度與接地陰影。 |
| Rear inspection | [12](first/3440x1440-dark-12-rear-inspection.png) | [12](final/3440x1440-dark-12-rear-inspection.png) | 增加四列 cartridge backplane、後部接口和配管結構；不是重複一張前面板，亦未改動 operational Rack 的 cabling。 |
| Side inspection | [13](first/3440x1440-dark-13-side-inspection.png) | [13](final/3440x1440-dark-13-side-inspection.png) | 側板、48U rails、結構橫桿與後部輪廓連續；不是薄片貼圖。深色表面有可辨識的反射。 |
| Mid-rack detail | [14](first/3440x1440-dark-14-mid-rack.png) | [14](final/3440x1440-dark-14-mid-rack.png) | NVLink 上部穿孔、USB / 五個 RJ45、低矮拉把，以及 compute silver cage / SSD 可辨識。此 inspection 刻意裁切上下設備以展示細節。 |
| Top three-quarter | [15](first/3440x1440-dark-15-top-three-quarter.png) | [15](final/3440x1440-dark-15-top-three-quarter.png) | 機櫃上蓋、厚度、側板、前面板在同一幾何中一致；final 不靠正面單視角成立。 |

## Responsive dark / light evidence

Five actual viewport sizes were rendered after hardware completion. Each cell links dark / light. Tests also captured early convergence and the compute close-up at all ten viewport/theme combinations; full metadata is in [responsive-captures.json](evidence/responsive-captures.json). Those close-ups intentionally crop the whole rack while keeping the featured tray framed.

| Viewport | Identification | Mid convergence | Exploded | Final | Final rack / Hero height |
| --- | --- | --- | --- | --- | ---: |
| 1366×768 | [D](responsive/1366x768-dark-03-identification.png) / [L](responsive/1366x768-light-03-identification.png) | [D](responsive/1366x768-dark-05-mid-convergence.png) / [L](responsive/1366x768-light-05-mid-convergence.png) | [D](responsive/1366x768-dark-09-engineering-exploded.png) / [L](responsive/1366x768-light-09-engineering-exploded.png) | [D](responsive/1366x768-dark-11-final-hero.png) / [L](responsive/1366x768-light-11-final-hero.png) | 76.97% |
| 1600×900 | [D](responsive/1600x900-dark-03-identification.png) / [L](responsive/1600x900-light-03-identification.png) | [D](responsive/1600x900-dark-05-mid-convergence.png) / [L](responsive/1600x900-light-05-mid-convergence.png) | [D](responsive/1600x900-dark-09-engineering-exploded.png) / [L](responsive/1600x900-light-09-engineering-exploded.png) | [D](responsive/1600x900-dark-11-final-hero.png) / [L](responsive/1600x900-light-11-final-hero.png) | 76.97% |
| 1920×1080 | [D](responsive/1920x1080-dark-03-identification.png) / [L](responsive/1920x1080-light-03-identification.png) | [D](responsive/1920x1080-dark-05-mid-convergence.png) / [L](responsive/1920x1080-light-05-mid-convergence.png) | [D](responsive/1920x1080-dark-09-engineering-exploded.png) / [L](responsive/1920x1080-light-09-engineering-exploded.png) | [D](responsive/1920x1080-dark-11-final-hero.png) / [L](responsive/1920x1080-light-11-final-hero.png) | 76.97% |
| 2560×1440 | [D](responsive/2560x1440-dark-03-identification.png) / [L](responsive/2560x1440-light-03-identification.png) | [D](responsive/2560x1440-dark-05-mid-convergence.png) / [L](responsive/2560x1440-light-05-mid-convergence.png) | [D](responsive/2560x1440-dark-09-engineering-exploded.png) / [L](responsive/2560x1440-light-09-engineering-exploded.png) | [D](responsive/2560x1440-dark-11-final-hero.png) / [L](responsive/2560x1440-light-11-final-hero.png) | 76.97% |
| 3440×1440 | [D](responsive/3440x1440-dark-03-identification.png) / [L](responsive/3440x1440-light-03-identification.png) | [D](responsive/3440x1440-dark-05-mid-convergence.png) / [L](responsive/3440x1440-light-05-mid-convergence.png) | [D](responsive/3440x1440-dark-09-engineering-exploded.png) / [L](responsive/3440x1440-light-09-engineering-exploded.png) | [D](responsive/3440x1440-dark-11-final-hero.png) / [L](responsive/3440x1440-light-11-final-hero.png) | 76.97% |

Final / constellation / convergence / exploded full-system shots remain within the scene and separate from the project information. Narrow canvases keep primary device names and × counts, dropping the longer description. The actual rendered SVG has no text rectangles after identification ends, including in light mode.

## What the review establishes

The second pass addresses first-pass material findings: close-up occlusion, callout leader routing / lingering text, sparse connector detail, rear backplane density, dark structure legibility and the ultrawide copy/rack balance. These screenshots show the resulting art direction and physical arrangement; deterministic pose / collision tests establish reversibility separately.

This remains a photograph-informed procedural model. It is not manufacturer CAD, a wiring certification or proof of photorealistic indistinguishability. No long-duration physical GPU FPS claim is made from the capture run. Synthetic dashboard counts shown in screenshots are local preview data.

## Evidence

- [Final renderer captures and framing](evidence/final-captures.json)
- [First-pass renderer captures](evidence/first-captures.json)
- [Responsive metadata](evidence/responsive-captures.json)
- [Core checks](evidence/core-scene-final.txt)
- [Hero browser behavior](evidence/hero-behavior.json)
- [Operational Rack isolation](evidence/rack-isolation.json)
- [Full QA status, including pre-existing failures](evidence/qa-results.json)
- [Python baseline comparison](evidence/pytest-comparison.json)
- [Python failure causes](evidence/baseline-failure-causes.json)
- [Mechanical design scan](evidence/impeccable-detect.json)
