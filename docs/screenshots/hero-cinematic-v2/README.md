# 3440×1440 visual review: first pass → final pass

These are unedited browser captures using synthetic preview data. First means the first implementation of v2, not the original base branch. Click a full-resolution image to inspect it. Camera direction and lighting were intentionally refined between passes.

[Browser verification summary](verification.json) · [16/16 geometry and motion checks](core-scene-results.txt)

| Stage | First implementation | Final polish |
| --- | --- | --- |
| 01 server close up | [First](first/3440x1440-dark-01-server-close-up.png) | [Final](final/3440x1440-dark-01-server-close-up.png) |
| 02 alignment | [First](first/3440x1440-dark-02-alignment.png) | [Final](final/3440x1440-dark-02-alignment.png) |
| 03 rail engagement | [First](first/3440x1440-dark-03-rail-engagement.png) | [Final](final/3440x1440-dark-03-rail-engagement.png) |
| 04 insertion | [First](first/3440x1440-dark-04-insertion.png) | [Final](final/3440x1440-dark-04-insertion.png) |
| 05 mechanical seat | [First](first/3440x1440-dark-05-mechanical-seat.png) | [Final](final/3440x1440-dark-05-mechanical-seat.png) |
| 06 full front | [First](first/3440x1440-dark-06-full-front.png) | [Final](final/3440x1440-dark-06-full-front.png) |
| 07 front three quarter | [First](first/3440x1440-dark-07-front-three-quarter.png) | [Final](final/3440x1440-dark-07-front-three-quarter.png) |
| 08 side | [First](first/3440x1440-dark-08-side.png) | [Final](final/3440x1440-dark-08-side.png) |
| 09 rear three quarter | [First](first/3440x1440-dark-09-rear-three-quarter.png) | [Final](final/3440x1440-dark-09-rear-three-quarter.png) |
| 10 rear hero | [First](first/3440x1440-dark-10-rear-hero.png) | [Final](final/3440x1440-dark-10-rear-hero.png) |
| 11 exploded | [First](first/3440x1440-dark-11-exploded.png) | [Final](final/3440x1440-dark-11-exploded.png) |
| 12 engineering scan | [First](first/3440x1440-dark-12-engineering-scan.png) | [Final](final/3440x1440-dark-12-engineering-scan.png) |
| 13 final hero | [First](first/3440x1440-dark-13-final-hero.png) | [Final](final/3440x1440-dark-13-final-hero.png) |
| 14 mid rack | [First](first/3440x1440-dark-14-mid-rack.png) | [Final](final/3440x1440-dark-14-mid-rack.png) |
| 15 top three quarter | [First](first/3440x1440-dark-15-top-three-quarter.png) | [Final](final/3440x1440-dark-15-top-three-quarter.png) |

The primary agent inspected each of these stages individually. The first pass exposed weak handles, broad flat metal, sparse side/rear structure and weak service detail. Subsequent passes rebuilt the 1U enclosure, side supports, rear architecture and roof, and refined materials/camera. [Full findings, validation and remaining compromises](../../HERO-CINEMATIC-V2-DELIVERY.md).

The final hero measures approximately 76.45% of the right canvas height. The middle close-up deliberately crops the rack; full-rack stages retain all bounds. Capture JSON records camera and adaptive framebuffer quality; software rendering is not a desktop GPU FPS measurement.
