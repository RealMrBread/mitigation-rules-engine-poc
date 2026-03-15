# Mitigation Rules Engine -- UX Recommendations

**Version**: 1.0
**Date**: 2026-03-15
**Author**: ArchitectUX
**Status**: Ready for review

> Opinionated UX guidance for the React + shadcn/ui implementation, based on a
> thorough review of the five HTML mocks and the HLD-final.md specification
> (Sections 3, 6.7). This document focuses on the underwriter evaluation flow
> (Iteration 5) while providing directional guidance for the Applied Science
> screens.

---

## Table of Contents

1. [Mock Review](#1-mock-review)
2. [Evaluation Flow UX](#2-evaluation-flow-ux)
3. [Results Page UX](#3-results-page-ux)
4. [Information Architecture](#4-information-architecture)
5. [Accessibility](#5-accessibility)
6. [Responsive Design](#6-responsive-design)
7. [Design System Recommendations](#7-design-system-recommendations)

---

## 1. Mock Review

### 1.1 Evaluation Form (`evaluation-form.html`)

**What works well:**

- Card-per-section layout with icons gives clear visual grouping. Each property
  domain (State, Property Info, Roof & Structure, etc.) is its own card, which
  reduces cognitive load.
- Required field indicators are consistent (red asterisk).
- The vegetation dynamic array has a clean add/remove pattern with slide
  animation -- this is the hardest interaction on the form and the mock handles
  it intuitively.
- Helper text below Home-to-Home Distance clarifies what the measurement means.
- The "Active Release" badge in the header sets context for the evaluation
  without cluttering the form.
- Two-column grid on desktop collapses to single column on mobile -- correct
  responsive behavior.

**What needs improvement:**

- No validation feedback is visible. The mock submits with a hard redirect. The
  real implementation must show inline validation errors (field-level, not just a
  toast) and prevent submission until required fields are filled.
- The form has no "dirty state" protection. If the underwriter accidentally
  navigates away, all data is lost. Add an unsaved-changes warning.
- The "Clear Form" button has no confirmation. One misclick wipes everything.
  Add a confirmation dialog or make it a secondary action that requires a second
  step.
- The State selector is a full-width card for a single dropdown. This wastes
  vertical space. Combine State with the Property Information section since state
  is a property attribute.
- No property identifier field (property_id) is present. The HLD lists it as a
  globally required field. It needs to appear prominently at the top of the form.
- The Windows & Openings section has only one field but occupies a full card.
  Consider merging it into the Roof & Structure section (both relate to the
  building envelope) or planning for additional fields that would justify the
  separate section.

**Missing elements:**

- Property ID input (required per FR-1.1).
- Form auto-save or draft persistence (even just sessionStorage).
- A "load previous evaluation" shortcut for re-evaluating properties.
- Tooltips or info icons explaining less obvious fields (e.g., what qualifies as
  "Ember Resistant" vs "Standard" for attic vents).
- Loading/submitting state on the Evaluate button (spinner, disabled state).

### 1.2 Evaluation Results (`evaluation-results.html`)

**What works well:**

- The summary bar (4 stat cards) provides an instant overview before the
  underwriter dives into details. This is the right hierarchy.
- The auto-decline banner is visually urgent (red background, warning icon) and
  clearly explains what happened and why. The note about informational
  mitigations below is a smart touch.
- Vulnerability cards use color-coded borders (red for unmitigatable, amber for
  mitigatable) that create an instant visual scan path.
- The "Why flagged" boxes explain the failure in plain English with observed vs.
  required values -- this directly satisfies the HLD's Tenet 2 (Transparency).
- The computation breakdown on the Window Safety Distance card (base x modifier
  x modifier = result) is excellent. Non-technical underwriters can follow the
  math and explain it to policyholders.
- Bridge mitigation stacking shows running totals inline ("90 x 0.8 = 72 ft --
  Still fails" / "90 x 0.8 x 0.5 = 36 ft -- Passes") which makes the
  progressive effect of stacking visible.
- The bridge counter in the summary bar updates dynamically and the banner
  communicates remaining budget.

**What needs improvement:**

- Mitigation sections default to collapsed and require a click to expand. For
  the primary workflow (underwriter reviewing and selecting mitigations), the
  mitigatable cards should be expanded by default. Collapsed state should be
  reserved for the unmitigatable card (since there is nothing actionable there).
- The full vs. bridge mitigation distinction relies only on small colored badges
  ("Full" / "Bridge"). These need more visual differentiation. See Section 3
  for detailed recommendations.
- The bridge budget banner only appears after selecting a bridge. It should
  always be visible (showing "0 of 3 used") so the underwriter knows the limit
  exists before they start selecting.
- There is no indication of what combination of mitigations would make the
  property fully insurable. The underwriter must mentally track which
  vulnerabilities are resolved and which are not. Add a "resolution status" to
  each card.
- The "Submit Mitigation Selections" button uses `alert()`. The real
  implementation needs a proper confirmation flow showing a summary of what is
  being submitted.
- No "back to form with values preserved" functionality. The "Back to Form" link
  does a hard navigation, which would lose the evaluation context.

**Missing elements:**

- Per-card resolution status indicator (resolved / unresolved / auto-decline).
- Overall property status summary ("Insurable with mitigations" / "Uninsurable
  -- auto-decline" / "Partially resolved -- X vulnerabilities remaining").
- Print or export option for sharing results with policyholders.
- Timestamp and evaluation ID for auditability.
- Warning when bridge selections alone do not resolve a vulnerability (the mock
  shows the math but does not surface a clear "this combination still fails"
  warning at the card level).

### 1.3 Rule Reference (`rule-reference.html`)

**What works well:**

- Search + type filter combination is appropriate for the expected rule count
  (4 in POC, scaling to ~100).
- Accordion-style expand/collapse keeps the list scannable.
- Rule type badges use consistent color coding (blue = Simple, purple =
  Conditional, amber = Computed) which carries over from the results page.
- The "Unmitigatable" badge on Home-to-Home Distance makes its special status
  immediately visible.
- Rule logic is shown in a monospaced pseudo-code block -- readable for
  underwriters who want to understand the threshold without needing to parse
  JSON.

**What needs improvement:**

- The search only matches against `data-name` and `data-desc` attributes. The
  React implementation should do full-text search across rule name, description,
  mitigation names, and field names.
- No indication of how many mitigations each rule has in the collapsed view. Add
  a count badge (e.g., "3 mitigations") to the collapsed header so underwriters
  can see at a glance which rules have bridge options.
- The rule detail sections have no consistent structure. Simple rules show just
  the logic, but all rules should show: logic, mitigations, and the "what
  happens on failure" consequence.

**Missing elements:**

- Mitigation count in the collapsed header row.
- A "last updated" or "effective since" date per rule.
- Link from a rule in the reference to its appearance in a past evaluation
  (deferred, but worth planning the URL structure now).

### 1.4 Rule Editor (`rule-editor.html`)

**What works well:**

- The Form View / JSON Editor toggle is exactly what the HLD specifies. Applied
  Science users who are comfortable with forms use the form; power users can
  drop into JSON.
- Rule type selector cards (Simple / Conditional / Computed) are visual and
  self-documenting with short descriptions.
- Conditional branch editor with WHEN/THEN/DEFAULT structure maps directly to
  the schema. The color coding (purple for conditional branches) provides clear
  visual structure.
- Modifier value mappings (field = value pairs) are presented as simple
  key-value rows that are easy to add and remove.
- The mitigations section cleanly separates Full (green background) from Bridge
  (amber background) with their respective fields.
- "Test Rule" button provides the authoring-to-testing loop described in the
  HLD.

**What needs improvement:**

- No field validation is visible. The Rule Name, Description, and config fields
  all need inline validation (required checks, format checks for value
  mappings).
- The Form View and JSON View are not synchronized. In the real implementation,
  edits in either view must reflect in the other. This is technically complex;
  consider making one the source of truth and the other a read-only preview, or
  requiring an explicit "sync" action.
- Value mapping rows lack an "add row" button within each modifier. The mock
  starts with a fixed set of rows.
- No indication of which fields are available in the observation schema. The
  field inputs are free-text, but should offer autocomplete from the known
  observation fields to prevent typos.
- "Save Draft" and "Cancel" lack confirmation when there are unsaved changes.
- The draft status ("Last saved 2 minutes ago") is good but should include
  auto-save behavior.

**Missing elements:**

- Field autocomplete from the observation schema.
- Validation error display (inline and summary).
- Auto-save with conflict detection (optimistic locking per HLD 6.9).
- A "Duplicate Rule" action for creating variations.
- Version history or change log for the draft.
- Form/JSON sync strategy.

### 1.5 Release Manager (`release-manager.html`)

**What works well:**

- The release timeline (newest first) with expandable details is the right
  pattern. Active release is visually distinct with a green border.
- Summary stats (Total Releases, Active, Rules in Draft) provide instant
  context.
- The publish modal clearly shows what will be snapshotted (list of rules with
  checkmarks) and warns about immutability.
- "Activate This Release" is available on each past release, supporting rollback
  scenarios.
- The draft workspace card (dashed border, muted colors) visually separates
  unpublished work from published releases.

**What needs improvement:**

- The "Activate This Release" action needs a confirmation dialog. Activating a
  release changes what underwriters evaluate against -- this is a high-impact
  action.
- No diff view between releases. When publishing v2.1, the Applied Science user
  should see what changed since v2.0 (rules added, modified, removed).
- The publish modal does not validate rules before publishing. Per the HLD
  (FR-6.3), publishing must run full validation on all rules. The UI should show
  a validation step (potentially with a loading state) before allowing the
  publish action.
- No indication of which release each past evaluation used. This matters for
  auditability but may be shown on the evaluation history screen instead.

**Missing elements:**

- Confirmation dialog for "Activate This Release".
- Pre-publish validation step with pass/fail status per rule.
- Release diff (comparison between two releases).
- Release notes or description field (why was this release created?).
- Indicator of how many evaluations were run against each release.

---

## 2. Evaluation Flow UX

### 2.1 Form Layout: Single Scrollable Page (Recommended)

**Decision: Single scrollable page with card sections.** Not a wizard. Not
collapsible accordions.

**Rationale:**

- The form has 6-8 fields plus a vegetation array. This is not long enough to
  justify a multi-step wizard, which adds navigation overhead and hides context.
- Underwriters evaluate many properties per day. They need to see the full form,
  fill it out quickly, and submit. A wizard slows this down with
  next/back/step-indicator overhead.
- Collapsible sections add unnecessary clicks for a form this size. The
  underwriter should never need to hunt for a field.
- The card-per-section layout in the mock is correct: it provides visual
  grouping without hiding content.

**Implementation notes:**

- Keep sections in a logical order: identification (Property ID, State) at top,
  building characteristics in the middle, surroundings (vegetation, proximity)
  at bottom.
- Use sticky submit button area on mobile so the "Evaluate" button is always
  reachable.
- Add a floating "scroll to errors" indicator if validation fails on fields not
  currently in the viewport.

### 2.2 Progressive Disclosure: Show All Fields Upfront

**Decision: Show all fields. No conditional reveal.**

**Rationale:**

- For the POC, the form is small enough that all fields should be visible. There
  is no benefit to hiding fields until a condition is met.
- Conditional reveal would only make sense if the form grew to 20+ fields and
  certain fields only applied based on earlier selections (e.g., state-specific
  fields). That is a post-POC concern.
- Underwriters filling out the same form repeatedly will develop muscle memory.
  Fields appearing and disappearing breaks that muscle memory.

**Exception: Vegetation array.** The "Add Vegetation" pattern IS a form of
progressive disclosure and it is the correct one. Start with zero items and let
the underwriter add as needed. But show at least a prompt or empty state that
makes it clear vegetation entries are expected.

### 2.3 Vegetation Array UX

The vegetation array is the most complex interaction on the form. Recommendations:

**Start with one empty row, not zero.** The current mock starts with two
pre-filled rows. The real implementation should start with one empty row to
signal that at least one vegetation entry is expected, while clearly indicating
that more can be added.

**Numbering.** Label each row with a number ("Vegetation 1", "Vegetation 2")
for reference. If a middle row is deleted, do not renumber -- the gap signals
that something was removed.

**Delete confirmation.** Do not add a confirmation dialog for individual row
deletion (too slow). The slide-out animation in the mock is sufficient feedback.
But add an "Undo" toast that appears for 5 seconds after deletion, allowing
recovery.

**Maximum items.** Display a soft maximum (e.g., after 10 items, show a note:
"10 vegetation items added. Add more if needed.") but do not enforce a hard
limit. The data model supports unlimited array items.

**Compact layout.** Each vegetation row should be a single horizontal line on
desktop: [Type dropdown] [Distance input] [Delete button]. The two-column grid
in the mock works but wastes vertical space when there are many items.

### 2.4 Validation Timing

**Decision: Validate on blur + on submit. Not on keystroke.**

- **On blur (field exit):** Validate the individual field. Show inline error
  message directly below the field. Use `aria-describedby` to associate error
  with field for screen readers.
- **On submit:** Validate all fields. Scroll to the first error. Show a summary
  count at the top ("3 fields need attention") with anchor links to each error.
- **Never on keystroke.** Showing errors while the user is still typing is
  hostile UX, especially for numeric fields.

**Error display pattern:**

```
[Field Label] *
[Input field with red border]
  ^ This field is required.
```

Use shadcn/ui's `FormMessage` component, which handles this pattern natively
with `react-hook-form` integration.

### 2.5 Submit Experience

**Loading state:**

1. Button text changes to "Evaluating..." with a spinner icon.
2. Button becomes disabled (prevent double-submit).
3. Form fields become read-only (prevent editing during submission).
4. If evaluation takes > 2 seconds (NFR-1 target), show a subtle progress
   message: "Running evaluation against 4 rules..."

**Success:**

1. Navigate to the Results page.
2. Pass the evaluation ID via URL parameter (e.g., `/evaluations/{id}/results`).
3. Show a brief success toast: "Evaluation complete -- 4 vulnerabilities found."
4. Do NOT clear the form yet -- the underwriter may want to go back and adjust.

**Error:**

1. If a server error occurs, show an error banner at the top of the form (not
   just a toast -- toasts are easy to miss).
2. Preserve all form values.
3. If the error is a validation error (400), map server-side field errors to
   inline form errors.
4. If the error is a missing active release (503), show a clear message: "No
   active release is configured. Please contact Applied Science." Do not show a
   generic error.

### 2.6 Results Navigation

**Form to Results:** Use React Router navigation with evaluation ID. The form
state should be preserved in the router history so the browser back button
returns to the filled form.

**Results to Form (re-evaluate):** Provide an "Edit & Re-evaluate" button that
navigates back to the form pre-filled with the original observation values. This
is different from "New Evaluation" (which starts fresh).

**Results to History:** Link each evaluation result to its entry in the
evaluation history. Show the evaluation ID and timestamp.

**URL structure:**

```
/evaluations/new          -- Blank evaluation form
/evaluations/:id/results  -- Results for a specific evaluation
/evaluations/:id/edit     -- Form pre-filled with evaluation's observations
/evaluations              -- Evaluation history list
```

---

## 3. Results Page UX

This is the most information-dense screen in the application and the screen
where the underwriter makes decisions. Every pixel must earn its place.

### 3.1 Vulnerability Card Hierarchy

Prioritize information in this order (top to bottom within each card):

1. **Vulnerability name + status badge** (Mitigatable / Unmitigatable) -- the
   underwriter needs to instantly categorize the card.
2. **Resolution status** (NEW -- not in mock, must add) -- a green "Resolved"
   badge when mitigations are selected that fully address the vulnerability.
3. **Why flagged** -- plain-English explanation with observed vs. required.
4. **Computation breakdown** (for computed rules only).
5. **Mitigation options** (expanded by default for mitigatable cards).

**Card ordering on the page:**

1. Unmitigatable (auto-decline) cards first. These determine the outcome. If any
   exist, the property is declined regardless of other mitigations.
2. Mitigatable cards sorted by: unresolved first, then resolved.

### 3.2 Bridge Stacking Visualization

The mock's approach of showing inline math is good but needs refinement for
clarity:

**Show the stacking as a visual pipeline, not just text.** For each bridge
mitigation checkbox, show:

```
Base threshold: 90 ft
  |
  +-- Apply Protective Film (x0.8) --> 72 ft  [Still fails: 50 < 72]
  |
  +-- Prune Nearby Trees (x0.5) --> 36 ft     [Passes: 50 >= 36]
```

**Implementation approach:** Use a vertical timeline or step indicator within
the mitigation section. Each checked bridge adds a step to the timeline. Steps
dynamically appear/disappear as checkboxes are toggled.

**Key principle:** Always show the final result of the current selections. If
two bridges are selected, show the running calculation. If one is deselected,
recalculate immediately. The underwriter should never have to do math in their
head.

**Color the outcome.** The final comparison line should be green text if the
combination passes, red if it still fails. This gives instant visual feedback on
whether more bridges are needed.

### 3.3 Full vs. Bridge Mitigation Distinction

This distinction is critical to the business logic and must be unmistakable:

**Full mitigations:**

- Green color scheme (green-50 background, green-500 border when selected).
- Shield icon (as in mock).
- Badge text: "Full -- Eliminates this vulnerability".
- When selected, the vulnerability card header should show a green "Resolved"
  badge.

**Bridge mitigations:**

- Amber/yellow color scheme (amber-50 background, amber-500 border when
  selected).
- Clock icon (as in mock -- implies temporary/time-limited).
- Badge text: "Bridge -- Reduces threshold by X%".
- When selected, show the stacking effect inline AND update the card header to
  show either "Resolved via bridges" (green if the stack passes) or "Partially
  mitigated" (amber if more is needed).

**Mutual exclusivity within a vulnerability:** If an underwriter selects a Full
mitigation, auto-deselect any bridge mitigations for that vulnerability (since
the full mitigation eliminates the need for bridges). Show a brief explanation:
"Full mitigation selected -- bridge mitigations are not needed for this
vulnerability."

### 3.4 Bridge Budget Communication

**Always visible, never anxiety-inducing.**

- Display the bridge budget as a persistent bar below the summary stats:
  `Bridge Budget: 0 / 3 used [========--------]`
- Use a progress bar (shadcn/ui `Progress` component). Green when under limit,
  amber at 2/3, red when full.
- When the limit is reached, disable unchecked bridge checkboxes across ALL
  vulnerability cards (not just the current one). Show a tooltip on hover:
  "Bridge limit reached (3/3). Deselect a bridge mitigation to free up a slot."
- Do NOT use alarming language. The limit exists to manage risk, not to punish.
  Frame it as a budget: "You have 1 bridge slot remaining" rather than "WARNING:
  Approaching bridge limit."

### 3.5 Auto-Decline Presentation

**Tone: Factual and definitive, not alarming.**

The auto-decline banner should:

- Be the first thing the underwriter sees (placed above all vulnerability cards).
- State the fact clearly: "This property cannot be insured under current rules."
- Name the specific rule(s) that caused the decline.
- Explain why no mitigations are available for those rules.
- If there are also mitigatable vulnerabilities, explain: "The remaining
  vulnerabilities and their mitigations are shown below for reference. However,
  the auto-decline takes precedence."

**Actions available on auto-decline:**

- "New Evaluation" -- start fresh with a different property.
- "Edit & Re-evaluate" -- go back to the form to check if observations were
  entered correctly.
- "View Rule" -- link to the declining rule in the Rule Reference.
- Do NOT show the "Submit Mitigation Selections" button when auto-decline is
  active. There is no valid submission.

**Visual treatment:**

- Red banner with warning icon (as in mock, this is correct).
- Auto-decline vulnerability card uses a red border (as in mock).
- Mitigatable cards below are slightly dimmed (opacity: 0.85) to signal they
  are informational, not actionable.

---

## 4. Information Architecture

### 4.1 Navigation Structure by Role

**Underwriter sidebar:**

```
New Evaluation        (primary action)
Evaluation History    (not in mock -- add)
Rule Reference        (secondary reference)
```

**Applied Science sidebar:**

```
Rule Management
  All Rules           (list + CRUD)
  Rule Editor         (create/edit -- contextual)
  Test Sandbox        (test rules)
Releases
  Release Manager     (publish/activate)
```

**Admin sidebar:**

```
Settings
  Bridge Limits
  User Management
```

### 4.2 Screen Flow Diagram

```
UNDERWRITER FLOW:
                                    +------------------+
                                    | Rule Reference   |
                                    | (read-only)      |
                                    +--------+---------+
                                             ^
                                             | "View Rule" link
                                             |
+----------------+   submit    +------------------+   submit     +-----------+
| Evaluation     | ----------> | Evaluation       | -----------> | Evaluation|
| Form           |             | Results          |              | History   |
| (enter obs)    | <---------- | (vulns + mits)   | <----------- | (browse)  |
+----------------+  "Edit &    +------------------+   select     +-----------+
                   Re-evaluate"

APPLIED SCIENCE FLOW:

+------------+   create/edit   +--------------+   test   +---------------+
| Rule List  | -------------> | Rule Editor  | -------> | Test Sandbox  |
| (browse)   | <------------- | (form/JSON)  | <------- | (run samples) |
+------------+    back         +--------------+   back   +---------------+
                                                           |
                                                    results inform edits
                                                           |
+------------------+   publish   +--------------+          |
| Release Manager  | <---------- | Rule List    | <--------+
| (publish/active) |             | (select for  |
+------------------+             |  release)    |
                                 +--------------+
```

### 4.3 Breadcrumbs and Back Navigation

**Use breadcrumbs on nested screens:**

- Results page: `Evaluations > #P-2026-0847 > Results`
- Rule editor: `Rules > Window Safety Distance > Edit`

**Browser back button must work.** Use React Router's history correctly. Never
use `window.location.href` for navigation (as the mocks do).

**Every screen must have an explicit "back" affordance** -- do not rely solely
on the browser back button. The "Back to Form" link in the results mock is a
good example.

---

## 5. Accessibility

### 5.1 Color Contrast Requirements

All text must meet WCAG 2.1 AA minimum contrast ratios:

- Normal text (< 18px): 4.5:1 contrast ratio minimum.
- Large text (>= 18px or >= 14px bold): 3:1 minimum.
- UI components and graphical objects: 3:1 minimum.

**Specific concerns in the mocks:**

- The gray helper text (`text-gray-400`, which is `#9ca3af`) on white
  backgrounds fails AA for normal text. Use `text-gray-500` (`#6b7280`)
  minimum, or preferably `text-gray-600` (`#4b5563`) for all secondary text.
- The amber-on-amber combinations for bridge mitigations need verification.
  `text-amber-700` on `bg-amber-50` should pass, but verify programmatically.
- The red auto-decline text on red background needs verification. `text-red-700`
  on `bg-red-50` should pass.

**Do not use color alone to convey information.** The current mocks use
color-coded borders (red = unmitigatable, amber = mitigatable). Supplement with:

- Text labels ("Unmitigatable", "Mitigatable").
- Icons (X-circle for auto-decline, warning triangle for mitigatable, shield
  for resolved).
- Pattern or shape differences (the mocks already include badge text, which is
  good).

### 5.2 Screen Reader Considerations

**Form fields:**

- Every `<input>` and `<select>` must have an associated `<label>` with a `for`
  attribute (or be wrapped in a `<label>`). The mocks use `<label>` elements but
  they are not associated via `for`/`id` -- fix this in the React implementation.
- Required fields: use `aria-required="true"` in addition to the visual asterisk.
- Error messages: use `aria-describedby` to link the error message `<p>` to the
  field. Use `aria-invalid="true"` on fields with errors.

**Vulnerability cards:**

- Use semantic headings (`<h3>` for vulnerability names within the results page
  which has an `<h2>` page title).
- The expand/collapse buttons for mitigations must have `aria-expanded` and
  `aria-controls` attributes.
- Mitigation checkboxes must have visible labels (they do in the mock, but
  the `hidden` class on the actual `<input>` means the label association must
  be explicit).

**Dynamic content:**

- When bridge stacking recalculates, use `aria-live="polite"` on the stacking
  result region so screen readers announce the updated pass/fail status.
- When the bridge budget updates, announce it via an `aria-live` region.

### 5.3 Keyboard Navigation

**Forms:**

- Tab order must follow visual order (top to bottom, left to right in grid
  layouts).
- In the vegetation array, Tab should move through fields within a row, then to
  the next row. The "Delete" button on each row should be reachable via Tab.
- The "Add Vegetation" button should be reachable after the last vegetation row.

**Vulnerability cards (Results page):**

- Each mitigation option (Full or Bridge) is a checkbox. These must be focusable
  and toggleable via Space key.
- The expand/collapse button must be focusable and toggleable via Enter or Space.
- When a card is expanded, Tab should move into the mitigation options within
  that card before moving to the next card.

**Modal dialogs (Release Manager):**

- Focus must be trapped within the modal when open.
- Escape key must close the modal.
- Focus should return to the trigger button after modal closes.

### 5.4 Focus Management After Form Submission

When the evaluation form is submitted and navigates to the results page:

1. Set focus to the page heading ("Evaluation Results") or the first meaningful
   content element.
2. If the page includes an auto-decline banner, set focus to the banner so the
   underwriter immediately knows the outcome.
3. Use `document.title` to update the page title to include the result status
   (e.g., "Results: Auto-Decline -- Mitigation Rules Engine").

---

## 6. Responsive Design

### 6.1 Desktop-First (Recommended)

**Decision: Desktop-first design, with tablet and mobile support for the
underwriter screens only.**

**Rationale:**

- Underwriters primarily use this tool at a desk. The data density of the
  results page (computation breakdowns, bridge stacking math, multiple
  vulnerability cards) is not suited to a phone screen.
- Applied Science users (rule editors) are definitively desktop users. The rule
  editor's form builder, JSON editor, and modifier mapping tables require a wide
  viewport.
- Field use case: There is a plausible scenario where underwriters inspect
  properties in the field and need to enter observations on a tablet. Support
  tablet for the evaluation form and results. Phone support is not a POC
  priority.

### 6.2 Breakpoint Strategy

Use Tailwind's default breakpoints, which align with shadcn/ui:

| Breakpoint | Width    | Target              |
|------------|----------|---------------------|
| `sm`       | 640px    | Large phones        |
| `md`       | 768px    | Tablets (portrait)  |
| `lg`       | 1024px   | Tablets (landscape) / small laptops |
| `xl`       | 1280px   | Desktop             |

### 6.3 Per-Screen Mobile Support

| Screen               | Phone (< 640px) | Tablet (768px) | Desktop (1024px+) |
|----------------------|------------------|----------------|-------------------|
| Evaluation Form      | Functional       | Good           | Full              |
| Evaluation Results   | Deprioritize     | Functional     | Full              |
| Rule Reference       | Functional       | Good           | Full              |
| Rule Editor          | Not supported    | Deprioritize   | Full              |
| Release Manager      | Not supported    | Functional     | Full              |

### 6.4 Key Responsive Behaviors

**Sidebar:** Collapse to a hamburger menu on tablet and below. On desktop, the
sidebar is always visible (as in the mocks).

**Evaluation Form:**

- Two-column grid fields collapse to single column below `sm` (already handled
  in mock).
- Vegetation rows collapse to stacked layout (type above, distance below) on
  mobile.
- Submit button area becomes sticky at the bottom of the viewport on mobile.

**Evaluation Results:**

- Summary stat cards: 4-column on desktop, 2x2 grid on tablet, vertical stack
  on phone.
- Vulnerability cards: Full width on all breakpoints (they already are).
- Computation breakdown: On narrow screens, switch from horizontal layout to
  vertical stack.
- Bridge stacking timeline: Works on all widths since it is vertical.

---

## 7. Design System Recommendations

### 7.1 shadcn/ui Component Mapping

| UI Pattern                  | shadcn/ui Component        | Notes |
|-----------------------------|---------------------------|-------|
| Form fields                 | `Form`, `FormField`, `FormItem`, `FormLabel`, `FormMessage` | Integrates with `react-hook-form` + `zod` |
| Select dropdowns            | `Select`                  | Native-feeling, keyboard accessible |
| Number inputs               | `Input` type="number"     | Add custom stepper for distance fields |
| Buttons                     | `Button`                  | Variants: `default`, `outline`, `destructive`, `ghost` |
| Vulnerability cards         | `Card`, `CardHeader`, `CardContent` | Add custom border color variants |
| Expand/collapse             | `Collapsible`             | For mitigation sections in cards |
| Summary stats               | Custom cards              | No direct shadcn equivalent; build with `Card` |
| Badges                      | `Badge`                   | Variants for: mitigatable, unmitigatable, full, bridge, resolved |
| Auto-decline banner         | `Alert` variant="destructive" | With custom icon |
| Bridge budget               | `Progress`                | Custom color thresholds |
| Modal (publish)             | `Dialog`                  | With `DialogTrigger`, focus trap built in |
| Search input                | `Input` with icon         | Use `Command` if adding keyboard shortcuts |
| Tabs (form/JSON toggle)     | `Tabs`                    | With `TabsList`, `TabsTrigger`, `TabsContent` |
| Toast notifications         | `Sonner`                  | For success/error feedback |
| Confirmation dialogs        | `AlertDialog`             | For destructive actions (clear form, activate release) |

### 7.2 Color Palette

Use Tailwind's built-in color palette. Do not introduce custom brand colors
beyond what the mocks define.

**Semantic color assignments:**

| Semantic Use                    | Color Token         | Tailwind Class        |
|---------------------------------|--------------------|-----------------------|
| Primary brand / actions         | Blue 600           | `bg-blue-600`, `text-blue-600` |
| Success / Resolved / Full mit.  | Green 600          | `bg-green-600`, `text-green-600` |
| Warning / Bridge mitigation     | Amber 600          | `bg-amber-600`, `text-amber-600` |
| Error / Auto-decline / Fail     | Red 600            | `bg-red-600`, `text-red-600` |
| Neutral / Inactive              | Gray 500           | `bg-gray-500`, `text-gray-500` |

**Vulnerability severity mapping:**

| Status          | Border Color   | Badge Background | Badge Text     |
|-----------------|---------------|-----------------|----------------|
| Unmitigatable   | `border-red-300` | `bg-red-100`   | `text-red-700` |
| Mitigatable     | `border-amber-200` | `bg-amber-100` | `text-amber-700` |
| Resolved        | `border-green-200` | `bg-green-100` | `text-green-700` |

**Bridge vs. Full mitigation:**

| Type     | Background (selected)    | Border (selected)     | Icon    |
|----------|--------------------------|-----------------------|---------|
| Full     | `bg-green-50`            | `border-green-500`    | Shield  |
| Bridge   | `bg-amber-50`            | `border-amber-500`    | Clock   |

**Rule type badges (consistent across all screens):**

| Rule Type              | Badge Background | Badge Text        |
|------------------------|-----------------|-------------------|
| Simple Threshold       | `bg-blue-50`    | `text-blue-700`   |
| Conditional Threshold  | `bg-purple-50`  | `text-purple-700` |
| Computed with Modifiers| `bg-amber-50`   | `text-amber-700`  |

### 7.3 Typography Scale

Stick with Tailwind's default type scale. Do not introduce custom sizes.

| Element              | Tailwind Class          | Size     |
|----------------------|------------------------|----------|
| Page title (h2)      | `text-xl font-semibold` | 20px    |
| Section heading (h3) | `text-base font-semibold`| 16px    |
| Card title           | `font-semibold` (base)  | 16px    |
| Body text            | `text-sm`               | 14px    |
| Helper text          | `text-xs text-gray-500` | 12px    |
| Badge text           | `text-xs font-medium`   | 12px    |
| Monospace (code)     | `text-sm font-mono`     | 14px    |

**Font family:** `Inter` as primary (matches the mocks). Fall back to
`system-ui, -apple-system, sans-serif`. Load Inter via Google Fonts or bundle
it.

### 7.4 Spacing System

**Use Tailwind's default spacing scale.** Do not create custom spacing tokens.

Key spacing decisions:

| Context                        | Spacing          | Tailwind Class |
|--------------------------------|-----------------|----------------|
| Page padding (horizontal)      | 32px            | `px-8`         |
| Page padding (vertical)        | 32px            | `py-8`         |
| Card internal padding          | 24px            | `p-6`          |
| Card gap (between cards)       | 24px            | `space-y-6`    |
| Form field gap (in grid)       | 20px            | `gap-5`        |
| Section heading to content     | 16px            | `mb-4`         |
| Compact element spacing        | 8px             | `gap-2`        |

**Max content width:**

| Screen           | Max Width   | Tailwind Class    |
|------------------|------------|-------------------|
| Evaluation Form  | 896px      | `max-w-4xl`       |
| Evaluation Results| 1024px    | `max-w-5xl`       |
| Rule Reference   | 896px      | `max-w-4xl`       |
| Rule Editor      | 1024px     | `max-w-5xl`       |
| Release Manager  | 896px      | `max-w-4xl`       |

The results page gets a wider max width because vulnerability cards with
computation breakdowns need horizontal room.

---

## Summary of Highest-Priority Changes from Mocks

These are the changes that will have the most impact on the underwriter
experience and should be addressed first in the React implementation:

| Priority | Change | Screen | Rationale |
|----------|--------|--------|-----------|
| P0 | Add property_id field | Evaluation Form | Required by HLD; missing from mock entirely |
| P0 | Inline form validation | Evaluation Form | No validation exists in mock; critical for data quality |
| P0 | Expand mitigatable cards by default | Results | Primary workflow requires seeing mitigations immediately |
| P0 | Add per-card resolution status | Results | Underwriter has no way to track which vulns are resolved |
| P0 | Hide submit button on auto-decline | Results | Submitting mitigations is invalid when auto-declined |
| P1 | Always-visible bridge budget bar | Results | Underwriter needs to know the limit before selecting |
| P1 | Loading/error states on submit | Evaluation Form | Mock uses hard redirect with no feedback |
| P1 | Form state preservation on back-nav | Form <-> Results | Losing form data on back navigation is unacceptable |
| P1 | Confirmation for "Activate Release" | Release Manager | High-impact action with no safety net |
| P2 | Pre-publish validation step | Release Manager | HLD requires validation before publish |
| P2 | Bridge stacking visual pipeline | Results | Current inline text math is functional but hard to scan |
| P2 | Full/bridge mutual exclusivity logic | Results | Selecting full should auto-clear bridges for that vuln |
| P2 | Field autocomplete in Rule Editor | Rule Editor | Free-text field names invite typos |
