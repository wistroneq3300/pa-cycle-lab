# Future functional work

These items require backend/schema/transport policy work or separate test-infrastructure ownership and are intentionally excluded from the Premium UI branch.

- Define an explicit batch Agent run model before allowing multi-selection to start Agent work. The current UI correctly remains instruction-only.
- Add structured Agent stage events before showing CONNECT / EXECUTE / ANALYZE, progress, token counts or ETA. The UI must not infer them from prose.
- Add an engineering adjudication API only through a product/backend contract; Agent `DONE` must not become automatic validation `PASS`.
- Provide complete activity-history/download APIs before claiming the visible activity list is exhaustive.
- Define whether `/api/ai/gpu-alerts` is optional at the shell level or should have a supported empty-state endpoint; the strict UI fixture currently records its 404.
- Repair Windows test cleanup so all SQLite connections close before `TemporaryDirectory` teardown. This is the dominant source of the non-green Python suite.
- Refresh stale browser contracts that still expect `#new-os-port-input` or omit current port fields from node edit payloads.
- Add a deterministic completed-Cycle fixture for the Cycle browser suite instead of creating a real/synthetic run as a side effect of UI verification.
- Run a dedicated real 125% browser-zoom accessibility pass; this branch does not claim one.
- Any future live Terminal/KVM/Broadcast validation must use an explicitly approved isolated target. No live connection was made for this branch.
