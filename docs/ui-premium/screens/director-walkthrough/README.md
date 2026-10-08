# Director synthetic walkthrough — bounded result

The three-round run was executed once against commit
`419f9ca071bdabefc2e3e23dc0582bf8154f32ee`. It used an ephemeral loopback static
server, the repository's rack-network fixture, and an explicit strict provider.
No real hardware transport was opened.

## Result

Overall status: **FAIL / incomplete continuous path**.

All three rounds produced the same deterministic result. The following steps
passed in every round:

1. Overview opened.
2. Theme changed.
3. The page refreshed and the strict provider was reinstalled.
4. Project → System → Node → Inventory opened.
5. Inspection opened; the first Evidence request deliberately returned 503;
   the persistent error was visible; reopening then loaded the retained evidence.
6. Telemetry reached READY with real fixture series.
7. A single Test Case opened PA Agent; the engineer sent `GO`; the run reached
   DONE while continuing to say that engineer judgement was required.
8. The completed Agent run closed and reopened successfully.

The next step failed in every round: after selecting two Test Cases, the footer
showed the Batch Instructions CTA, but clicking it produced neither the expected
confirmation surface nor a visible Batch Result surface within 15 seconds. This
run therefore does not prove the multi-select batch path. The evidence does not
establish whether the cause is the synthetic fixture lifecycle or a product UI
defect; that distinction requires a focused reproduction.

## Precise NOT-RUN gaps

Because the required path is continuous, every step after the repeated batch
boundary was left NOT-RUN in all three rounds:

- Cycle PRE → confirm → running Console → Report.
- Terminal → Broadcast → KVM frames.
- Rack → Topology → return/reopen.
- User Guide.

Those surfaces do have independent current-version evidence in
`../director-zoom200/` (including a strict Cycle state run), but that evidence is
not presented as a successful end-to-end continuous walkthrough.

## Error and request accounting

- Browser external requests: 0 in each round.
- Browser page errors: 0 in each round.
- Static-server unknown paths: 0.
- The metadata reports strict-provider unknown requests as 0, but the provider
  trace was scheduled to be harvested at the next navigation boundary and the
  batch timeout occurred before that boundary. Treat that field as
  **not independently established** for the failed rounds.
- The Evidence 503 was deliberate and was followed by a verified successful
  reopen; it is not a hidden infrastructure failure.

`metadata.json` contains each attempted step, duration, stack location, hashes for
the six saved screenshots, fixture mode, and the exact three repeated failures.
This run does not claim physical-display, OS text-only scaling, real-provider, or
real-hardware end-to-end acceptance.
