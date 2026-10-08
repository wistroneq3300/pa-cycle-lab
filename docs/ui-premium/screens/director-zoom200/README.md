# Director 200% browser-zoom acceptance evidence

This directory records a bounded, loopback-only UI acceptance run against commit
`419f9ca071bdabefc2e3e23dc0582bf8154f32ee` with a dirty worktree. It is synthetic
UI evidence and is not a real-hardware validation result.

## Zoom evidence

- Browser: Microsoft Edge 154 via Playwright.
- Requested browser zoom: `2` (200%).
- Applied through the MV3 extension using `chrome.tabs.setZoom`, then read back
  using `chrome.tabs.getZoom`.
- Read-back result: `2` in both light and dark runs; no zoom application failure.
- Requested browser viewport: 1366×768 pixels.
- Resulting CSS viewport: 683×384 CSS pixels.
- Reported `devicePixelRatio`: `2`; the launch configuration kept
  `deviceScaleFactor: 1`, so device-scale emulation was not used as a substitute
  for browser zoom.
- Screenshot dimensions: 1366×768 pixels.
- Windows registry `AppliedDPI`: 192 (200%). This is OS-level evidence only and
  may differ from a particular monitor's effective scaling.

This run is **not** OS text-only scaling acceptance and is **not** physical
projector/display acceptance.

## Site surfaces

`site/capture-manifest.json` is the machine-readable source of truth. It records
28 current-version screenshots: 14 production surfaces in light and dark. The
captured set includes Shell, System Nodes, Test Case assignment, PA Agent,
Cycle entry, Telemetry, Inspection, Terminal, Broadcast, KVM frame, Topology,
and User Guide.

- Body horizontal overflow failures: 0/28.
- Captures with a declared primary operation that could not be focused or was
  outside the viewport after the scripted reachability action: 0.
- Page errors: 0.
- External requests: 0.
- Unknown strict-provider requests: 0.
- Hardware dispatches: 0.

Local scrolling remains part of the intended access path for dense workspaces at
this zoom. The per-image JSON files record the focus target, bounding rectangle,
CSS viewport, DPR, body overflow, browser-zoom read-back, and screenshot hash.

## Cycle workspace

`cycle/metadata.json` records a separate strict synthetic Cycle acceptance run.
It includes 16 screenshots covering Create, PRE confirmation, running Console,
and Evidence at 1366×768 and 1920×1080 in light and dark. Browser zoom was set
and read back as `2`, `deviceScaleFactor` remained `1`, body overflow was absent,
and the harness successfully operated the controls needed to progress through the
states. Unknown requests and page errors were zero.

Closing the browser surface did not contact a DUT. The fixture's state and log
events are explicitly synthetic; no live Cycle, power, SSH, BMC, Gateway, Agent,
or KVM operation was performed.
