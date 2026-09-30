> **Policy exceptions not active in V1.** This file is reference material and is
> retained in the evidence snapshot. Runtime classification is PRE-relative
> KNOWN / NEW / WORSENED. These rules do not accept, suppress, or downgrade
> hardware failures. Severity FAIL remains FAIL. Future policy disposition must
> be represented separately from severity and baseline classification.

# Historical policy examples (inactive)

The legacy parser can read these examples for offline compatibility tests. Neither
the integrated runner nor the copied CLI applies them during V1 execution. The
`Active` column below is historical and does not enable an exception. Editing this
file invalidates pending PRE approval because it is part of the runtime manifest.

| Project | Code | Component | Classification | Reason | Active |
| --- | --- | --- | --- | --- | --- |
| neutrino | BF4_MISSING | BF4 | KNOWN | BF4 card has not arrived; still mandatory. Remove this rule after installation. | yes |
