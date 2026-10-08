# Future functional work

This file contains only work that needs a new backend/schema/provider capability or a new product workflow. It is not a parking lot for unfinished UI verification. Final clean-SHA capture, deterministic fixtures, truthful rendering of existing results, loaded-text expansion, copy feedback, remaining S12/S13 coverage, physical-display checks and walkthroughs stay in the current Director scope.

## New contracts required

1. **Batch Agent execution**

   Multi-select currently and correctly produces Batch Instructions only. Executing a batch through PA Agent would require a product decision plus a new batch-run contract: target/case membership, authorization, confirmation policy, idempotency, partial failure, cancellation/recovery and evidence aggregation. The UI must not simulate this by starting one run per selection.

2. **Engineer adjudication / validation verdict**

   PA Agent `DONE` means the Agent finished, not that validation passed. A future PASS/FAIL adjudication experience requires a persisted verdict API, actor/audit fields, evidence linkage, RBAC and rules for conflict/revision. Until then the UI must keep “待工程師判定.”

3. **Complete Agent activity-history contract**

   The frontend can expand all content it has received, but it cannot claim exhaustive history when the backend response is bounded. A complete-history feature needs cursor/pagination or a downloadable immutable activity artifact, including explicit truncation/completeness metadata.

4. **Structured Agent progress / ETA / stage telemetry**

   CONNECT/EXECUTE/ANALYZE stages, percentages, token counts and ETA must come from structured provider events with documented semantics. They must not be inferred from prose, elapsed time or tool names.

5. **Full Evidence provenance where absent**

   Some sources do not provide all of Project/System/Node/Run/source/collection-time/truncation metadata. Filling those fields reliably requires schema/provider changes and migration rules. The current UI must display “未提供” rather than infer them.

6. **Central capability / role manifest, if product requires proactive hiding**

   The current UI relies on existing backend authorization responses. A consistent preflight view of viewer/operator/admin capabilities would require an authoritative capability endpoint and cache/invalidation contract; the UI must not infer permission from a previous 403.

7. **Download completion acknowledgement**

   A normal browser link can only report that a download request was issued. Claiming that a file was saved successfully would require a managed download client/provider callback or another explicit acknowledgement contract.

## Explicitly not future work

The following remain current acceptance work and must not be deferred here: final clean-SHA broad screenshots, untested owner/role/error combinations, S13 completion, physical-display verification, the non-green full suite and Director walkthroughs.

True-125% compact-modal reachability, the targeted solid-background contrast matrix and 200% browser zoom now have evidence and are **not** listed here as future or open functional work. Their documented scope limits—partial WCAG methodology and browser zoom not being an OS text-only/physical-display test—remain truthful limitations rather than requests for a new backend.
