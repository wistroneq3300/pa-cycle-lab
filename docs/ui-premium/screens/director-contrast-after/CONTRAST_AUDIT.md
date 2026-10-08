# Director contrast hardening evidence

This evidence was rendered from the production HTML/CSS/JavaScript with the
deterministic loopback Director fixture. It does not connect to hardware.

## Capture result

| Run | Viewports | Themes | Browser zoom | PNGs | Solid-background contrast violations |
|---|---|---|---:|---:|---:|
| `director-contrast-after/` | 1366 x 768, 1920 x 1080 | Light, Dark | 100% | 68 | 0 |
| `director-contrast-after-zoom125/` | 1366 x 768, 1920 x 1080 | Light, Dark | true 125% (`chrome.tabs.setZoom/getZoom`) | 68 | 0 |

The automated audit covers visible own text over computable solid ancestor
backgrounds. It intentionally reports gradient/image backgrounds separately as
approximations; there are 473 approximation-only findings at 100% and 287 at
125%. Therefore this is targeted contrast evidence, not a complete WCAG claim.

## Hardened targets

| Surface | Target | Before | Selected foreground/background | Calculated ratio |
|---|---|---:|---|---:|
| S02 | project WARN | 3.25:1 | `#835600` / `#edf0ef` | 5.56:1 |
| S02 | project PASS | 4.12:1 | `#2f6f4c` / `#edf0ef` | 5.23:1 |
| S03 | active project count | 4.03:1 | `#516b75` / `#e4eedb` | 4.73:1 |
| S03 | project count | 4.30:1 | `#516b75` / `#eef3f2` | 5.05:1 |
| S03 | OS / BMC label | 4.11:1 | `#536e78` / `#f8faf7` | 5.17:1 |
| S05 | sensor KPI value | 1.26:1 | `#203b49` / `#e6efef` | 10.07:1 |
| S05 | sensor KPI label | 4.48:1 | `#456674` / `#e6efef` | 5.27:1 |
| S06 | amber risk / approval badges | 1.64:1 | `#765000` / `#f3eee1` | 6.21:1 |
| S07 / S13 | waiting status, light | 1.90-2.03:1 | `#875d00` / light surfaces | 5.48:1 minimum |
| S07 / S13 | attachment control, light | 2.78:1 | `#315462` / `#ffffff` | 8.16:1 |
| S07 / S13 | send button | 1.94-2.63:1 | `#ffffff` / `#0a7d78` | 4.98:1 |
| S11 | Broadcast label/status, light | 2.30-2.81:1 | light text / `#17313f` | 8.57:1 minimum |
| S11 | KVM offline target/status | 2.51-4.28:1 | theme-local engineering tokens | 5.09:1 minimum |
| S15 | unchecked topology state | 3.57-3.88:1 | theme-local neutral tokens | 4.94:1 minimum |

Colors are scoped to each owner layer. Hero geometry, Rack/CDU rendering, KVM
framebuffer pixels, transport, target resolution, and request semantics are not
changed.

## 125% Test Case modal reachability

At requested 1366 x 768 and true browser zoom 125%, the CSS viewport is
1093 x 614. In both themes the assignment dialog is `top=24`, `bottom=590.4`;
the footer is `top=515.2`, `bottom=589.6`, and `footerFullyInViewport=true`.
The body reports `scrollHeight=413`, `clientHeight=413`. The capture harness
resets document scroll before a fixed modal screenshot so the PNG does not
misrepresent the visible footer. Exact rectangles are stored in each S06
sidecar under `routeState.details`.
