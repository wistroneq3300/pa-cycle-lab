# Visual review

## First-pass findings

- Test Case selection was constrained by fixed inline modal widths and search rebuilt the whole dialog.
- The footer claimed every selection entered PA Agent although multi-selection only generated batch instructions.
- Criteria was below lower-priority content and not visible on the initial 1366 detail viewport.
- Selected rows and the row currently inspected used ambiguous treatment.
- The result window still described a multi-selection as a PA Agent assignment and exposed a first-case Agent path.
- PA Agent context was split between panes, long-lived state was hard to scan, DONE read too much like success and temporary sync failure had weak visibility.
- Attachments did not clearly distinguish uploaded, parsed, unsupported and failed states; send failure could lose confidence about retained input.
- The compact 1366 system header let connection observations squeeze `chassis-01` into two lines.

## Implemented corrections

- Test Case uses a viewport-aware desktop workspace with a persistent Project/System/Node/IP target strip, independently scrolling list/detail regions and a stable footer.
- Criteria is promoted directly below the detail header. Purpose, preconditions, risk and original work-order content keep their source text.
- Search updates only the body, preserves focus/caret and guards IME composition; selection Set, list scroll and detail scroll remain stable.
- Selection is green-accented while the inspected row has a separate blue focus treatment.
- No/single/multiple CTA text now reflects real behavior. Multi-select produces complete batch instructions, hides the Agent control and explicitly states that neither Agent nor test started.
- PA Agent uses a full-width persistent Case/Target/Run/Status/duration/sync strip, 36/64 working columns, independent scroll, bounded reading width and keyboard focus containment.
- DONE is neutral and says it awaits engineering judgement. ERROR displays the backend `failure_reason` in a persistent alert.
- Composer failures retain text and require explicit retry. Attachment chips distinguish uploading, uploaded, parsed, unparsed, unsupported-image and failed/retry states.
- A non-blocking new-message control appears when the engineer is reading above the latest message.
- Reopening initializes attachment state so a new run cannot inherit the previous run's attachment snapshot.
- At compact desktop widths, system identity and OS selection retain the first header row while connectivity observations move below; the hostname no longer wraps.
- Current OS target styling uses the platform accent rather than success green.

## Bounded rendered review

- First rendered pass found the criteria visibility problem at 1366 and corrected its placement.
- Confirmation pass covered 1366 and 3440, both themes, no/single/multiple selection and Agent waiting. The final strict matrix adds DONE, ERROR, reconnect and attachment states.
- The final error-state review exposed stale attachment carry-over; state initialization and an automated regression assertion were added.
- 66 browser assertions pass, including canonical active-node targeting, 1366 criteria visibility, IME/caret preservation, selected-vs-inspected semantics, exact CTA behavior, error reason and attachment isolation.
- Platform regression found and corrected the 1366 system-header wrap; all 36 final platform records have no page error or horizontal overflow.

The review intentionally left frozen Hero and Rack/CDU presentation owners unchanged. Existing advanced Cycle, Telemetry and Inspection workspaces were retained rather than restyled through another global override layer.
