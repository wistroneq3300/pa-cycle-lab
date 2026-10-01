# PA Cycle Lab — PA Next × Vera native Cycle integration

This repository is the only modification and publication destination. PA Server
Manager Next and Vera CPU Rack Cycle are read-only upstream sources. No production
inventory, telemetry database, deployed service or hardware is part of this build.

The product brings Vera Cycle Stability Test into the copied Next desktop
application. It is not Full NVIDIA Rack Qualification. Neutrino is the sole V1
profile; expected hardware quantities remain those of the pinned Vera engine.

Operators select canonical chassis/installed-node targets, create a persistent
PRE, review findings and complete action scope, then confirm that exact version.
Independent workers save START/POST and raw evidence. COMPLETE describes the
execution limit, while hardware health and valid-cycle coverage remain separate.

The native routes are `#/cycle`, `#/cycle/new` and `#/cycle/runs/{id}`. The run
workspace includes a read-only persistent Console with filters, incremental
reconnection, bounded rendering, copy and complete-log download. Closing the page
or Console does not stop the worker. Stop prevents further dispatch; dispatched
operations recover or retain an explicit incomplete/uncertain result.

Default local mode is SYNTHETIC with fake transport. Live requires an authenticated
server-side provider, identity/trust validation and confirmed capability/domain
mapping. Shared power selectors remain unavailable live; their coordinator is
tested synthetically. No hardware success is claimed by synthetic demonstrations.

Desktop acceptance covers 1366×768 and 1920×1080, light/dark. Next's Wistron colors,
Rack 3D, device materials and unrelated layout remain authoritative. Mobile and
the separate design-preview proposal are outside this delivery.

See `docs/NATIVE_INTEGRATION.md`, `PROJECT_STATUS.md` and `docs/ACCEPTANCE.md` for
the maintained contracts, actual checks, source versions and remaining live gates.
