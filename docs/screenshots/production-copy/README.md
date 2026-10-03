# Production copy browser evidence

These screenshots use **synthetic/browser-only fixtures**, not company inventory or live hardware. Names such as `Neutrino Demo`, the `demo` account and documentation IP addresses are test input data, not hardcoded production copy. They must not be presented as hardware acceptance.

`tests/production-copy-browser.cjs` loads the real production scripts without `PA_PREVIEW`, intercepts all API network requests and uses a fake WebSocket implementation. Existing completed Cycle data is read only after checking the local source service is synthetic. PRE/RUNNING screens replay snapshots for UI inspection; no worker or power command is dispatched.

- 29 page/state cases × light/dark = 58 cases, recorded in `result.json`.
- 1366×768 for every case; 1920×1080 additionally for Dashboard, System Detail, Rack, Cycle Create and Progress (68 screenshots total).
- Separate create/confirm/stop/delete request compatibility results and full-page Cycle captures are in `../live-branch-ui/`.

Representative images:

- [Dashboard light](dashboard-1366-light.png) / [dark](dashboard-1366-dark.png)
- [Projects](projects-l11-1366-light.png)
- [System Detail](system-detail-1366-light.png)
- [Rack](rack-3d-1920-dark.png)
- [Cycle Create](cycle-create-1920-light.png)
- [PRE](cycle-pre-1366-dark.png)
- [Live Console](cycle-console-1366-dark.png)
- [Test assignment](test-assignment-1366-light.png)
- [User Guide](user-guide-1366-light.png)
