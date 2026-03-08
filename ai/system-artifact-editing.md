PRD: Artifact Editing in Chat View

Document Info

Product: Holokai Desktop
Feature: Artifact Editing
Status: Draft for implementation
Scope: Markdown-first document editing with versioned AI/user changes and visual diffing

Summary

Artifact Editing enables Holokai Desktop users to iteratively refine documents through AI-assisted chat while maintaining a full, reviewable version history. When a user activates Document Mode on a file attachment, the desktop silently tracks every AI- and user-driven change as an internal version snapshot, presents changes through configurable diff display styles, and gives users granular accept/reject control over individual edits. Versioning is entirely a desktop-internal concern — the AI model receives only the current document content plus augmented diff instructions, and the user interacts with the document naturally, while the desktop manages history, attribution, and rollback transparently in the background.

Requirements Summary

| # | Requirement | Description |
|---|-------------|-------------|
| R1 | Document Mode Activation | A "Document Mode" badge appears on any file attachment (user-uploaded or AI-returned). Clicking it activates document mode, making the attachment the active artifact and creating version 1. |
| R2 | Single Active Artifact | Only one artifact may be active per thread at a time. If a second document is introduced while document mode is active, the user is prompted to replace the current artifact or start a new document session. |
| R3 | Desktop-Internal Versioning | Versions are sequential snapshots managed entirely by the desktop and are never exposed to the user by number or communicated to the AI model. The model has no awareness of version history. |
| R4 | Version Creation Triggers | AI-attributed versions are created automatically when the AI returns a structured diff response. User-attributed versions are created when the user submits a prompt, exports, or exits with unsaved direct edits. |
| R5 | AI Prompt Augmentation | When document mode is active, every prompt is automatically appended with instructions directing the AI to return a GitHub unified diff and a concise change summary. The desktop applies the diff to reconstruct the new canonical version. |
| R6 | Comparison Scope | Users can compare any two versions using a version picker; default shortcuts are last step (vN-1 → vN) and first-to-current (v1 → vN). Comparison scope and display style are independent, orthogonal controls. |
| R7 | Display Styles | Four display styles are available: Final (clean rendered document, editable), Inline Markup (tracked-changes style, editable, accept/reject enabled), Diff-Only (changed hunks only, accept/reject enabled), and Side-by-Side (view only). |
| R8 | Modification Detection | The desktop post-processes unified diff hunks client-side at render time to identify adjacent deletion+insertion pairs as "modifications," displaying them as a single paired change rather than two separate operations. |
| R9 | Accept / Reject | Users can accept or reject individual changes or all visible changes in the current scope, each operation creating a new version. A configurable setting controls how unresolved changes are handled when a version-creating action occurs. |
| R10 | Attribution Filtering | Each version is attributed to AI or User. The Changes pane supports filtering by All, AI, or User to isolate changes by source. |
| R11 | Discard | Only the most recent version can be discarded. Discarding permanently removes it from history and reverts to the prior version. Version 1 cannot be discarded. |
| R12 | Unresolved Changes Setting | A desktop setting controls what happens to unresolved changes when a version-creating action occurs: include them, remove them, or ask the user (default: ask). |
| R13 | Export | The document edit view provides export to Markdown, DOCX, or PDF with or without markup. A full change history export option produces a document containing each version's summary and annotated content. |
| R14 | Format Pipeline | DOCX and PDF imports are converted to canonical Markdown on document mode activation. Minimum preserved structures are headings, lists, inline emphasis, and links. |
| R15 | Document Size Limit | Maximum editable document size is configurable in desktop settings (default 2 MB). Operations on files exceeding the configured limit are blocked with a clear error message. |

Problem
Users edit documents iteratively via chat prompts, but cannot reliably see what changed between prompts, review/resolve individual edits, or manage version history with clear comparison modes.

Goals

Provide automatic, reliable version history for document edits driven by chat.
Provide clear visual diff modes for short-step and cumulative review.
Enable granular change resolution (accept/reject) and attribution filtering.
Support markdown-first editing with DOCX/PDF import and export.
Keep user control over history by enabling “discard version” as a reversible-forward action.
Non-Goals (Phase 1)

Section-level or paragraph-scoped diff mode.
User-defined version names.
Real-time multi-user collaborative editing semantics.
Perfect layout fidelity for all DOCX/PDF edge cases.
Personas

Writer/analyst iterating content through AI prompts.
Reviewer validating exactly what AI changed before publishing.
User importing DOCX/PDF, editing in chat, exporting final deliverable.
Core User Flows

User attaches a document or AI returns a response with an attachment.
System displays a "Document Mode" command badge on the attachment.
User clicks the badge to activate document mode; the attachment becomes the active artifact.
User prompts edits in chat.
If assistant response includes an attachment while in document mode, system treats it as an edit and auto-creates next version.
User opens Changes pane and:
Selects a comparison scope (any two versions; defaults: last step vN-1→vN, or first-to-current v1→vN)
Selects a display style (inline markup, diff-only, or side-by-side)
User filters changes by attribution (AI, User, All).
User accepts/rejects individual or all visible changes, creating a new version.
User discards a selected version; system creates a new version from prior content.
User exports with or without markup to Markdown, DOCX, or PDF.
Functional Requirements

Artifact Definition

An artifact is a single named document that is either uploaded by the user or returned as an attachment by the AI.

A file becomes an artifact only when the user explicitly activates document mode by clicking the "Document Mode" command badge displayed on the attachment.

Only one artifact may be active per thread at a time.

While document mode is active, any attachment returned by the AI in a response is automatically treated as an edit of the active artifact and triggers a new version.

If the user introduces a second document while document mode is active, the system prompts the user to either replace the current artifact or start a new document session (new thread context).

Supported artifact types: Markdown, DOCX, PDF. All are converted to canonical Markdown on activation.

Version 1 creation depends on how document mode is entered:

If the user activates document mode on an existing attachment (clicks the "Document Mode" badge on a file), that attachment is immediately converted to canonical Markdown and saved as version 1.
If the user enters document mode without an existing attachment (e.g. to start a document from scratch via prompting), version 1 is deferred. The first file to appear — whether user-attached or AI-returned — becomes version 1.

The Changes pane shows a "no versions yet" empty state until version 1 is created.

When only version 1 exists, the Changes pane behaviour depends on display style:

Diff-only: the pane is blank (no hunks to show).
Inline markup: the document is displayed with no change markup (version 1 content shown as-is, no insertions or deletions).
Side-by-side: version 1 is shown on the left; the right side is empty.
Final: version 1 is shown as a clean rendered document (unaffected by version count).

Versioning Model

Versions are a desktop-internal concept only. They are not exposed to the user by number or name, and are never communicated to the AI model. The model has no awareness of version history.

Versions are immutable snapshots with sequential numeric IDs (1,2,3...) assigned internally by the desktop.

Each version stores canonical Markdown content.

Each version stores diff metadata against its immediate prior version (used for last-step comparison).

Diffs between any two arbitrary versions are computed on demand client-side from stored canonical content. Caching strategy for computed diffs is left to the implementation team.

Default comparison scope on open is last step (vN-1 → vN).

Version creation triggers:

AI-attributed version: assistant returns structured output containing a unified diff and change summary (triggered by prompt augmentation when document mode is active).
User-attributed version (auto-save): user exits the thread or application with unsaved direct edits.
User-attributed version (on export): user exports while unsaved direct edits exist; user version is created before export.
User-attributed version (on prompt submit): user submits a prompt while unsaved direct edits exist; user version is created before AI processes the prompt.

Prompts without unsaved user edits and without a returned edited attachment do not create versions.

Diff Visualization

Dedicated Changes pane is always available for versioned artifacts.

Comparison scope and display style are two independent, orthogonal controls.

Comparison Scope:

User can select any two versions as the comparison base and target.
Default scope shortcuts: last step (vN-1 → vN) and first-to-current (v1 → vN).
The version picker is not limited to these shortcuts; any version pair is valid.

Display Style (independent of scope):

Inline markup: full document rendered with insertions/deletions marked inline (tracked-changes style). Accept/reject available. Direct editing of the document is allowed; user edits create User-attributed changes.
Diff-only: only the changed hunks are shown (patch/unified diff view). Accept/reject available.
Side-by-side: base version on left, target version on right. View only.
Final: clean rendered document with no change markup. No accept/reject. Direct editing of the document is allowed; user edits create User-attributed changes.

Diff distinguishes insertions, deletions, and modifications. The underlying diff format (GitHub unified diff) expresses only insertions and deletions. The system post-processes each hunk to identify adjacent deletion+insertion pairs that are sufficiently similar (by token or character overlap) and promotes them to a "modification" (edit) type for display purposes. Modifications are rendered as a distinct paired change rather than two separate operations.

Full-document diff only in Phase 1.

Changes are viewable on rendered markdown content.

Review Actions

User can accept or reject an individual change.

User can accept all or reject all visible changes in current scope.

Any accept/reject operation creates a new sequential version.

Attribution and Filtering

Each change captures attribution metadata:

Actor type (AI or User). AI = version created by assistant returning an edited attachment. User = version created by the user directly editing the document.
Timestamp
Version ID
Changes pane supports filter by AI, User, All.

Discard Behavior

Only the most recent version can be discarded.

Discarding the most recent version N permanently removes it from version history. The current version reverts to N-1.

No new version is created by a discard operation. The version count decreases by one.

If the user subsequently makes a new edit after discarding, the next version is assigned the next sequential ID from the new current count (e.g. after discarding v4, a new AI edit creates a new v4).

Discard is disabled for version 1. The discard control is greyed out when only one version exists. The user cannot discard the original document.

Display and Output Controls

User can switch display style independently of comparison scope: inline markup, diff-only, side-by-side, or final (clean).
Display styles that allow direct user editing: inline markup and final.
Display styles that support accept/reject: inline markup and diff-only.

Export

The document edit view provides an export control with the following options:

Export format: Markdown, DOCX, or PDF.
Export mode: with markup (change annotations visible) or without markup (clean final document).
Export full change history: exports a document containing the change summary for each version followed by the full document content with changes annotated for that version, repeated for every version in history.

Export/print preview reflects the current markup mode selection.
Export profile (with/without markup, format) is a transient UI preference — it is not persisted between sessions.

Format Pipeline

Canonical internal editing format is Markdown.

DOCX and PDF imports are converted to Markdown before editing/versioning.

Export from canonical Markdown supports Markdown, DOCX, and PDF.

Minimum preserved structures: headings, lists, basic inline emphasis, links.

AI Prompt Augmentation

When document mode is active, every user prompt is automatically appended with system instructions directing the AI to return a structured output containing:

A document diff in GitHub unified diff format (@@-hunks with + and - lines). This format is chosen because it is compact, widely understood by language models, and machine-parseable.
A human-readable concise change summary describing what was changed and why.

The system detects a new AI-attributed version by the presence of this structured output in the response, not by attachment filename or heuristic matching.

The new version's canonical Markdown content is reconstructed by applying the returned diff to the prior version's canonical content.

The returned diff is stored as the version's diff metadata against its immediate prior version and is used directly by the Changes pane for diff visualization.

The Changes pane updates reactively when a new AI response is received containing a diff.

Modification type identification (pairing adjacent deletions and insertions) is computed client-side at render time and is not stored.

Configuration

Maximum editable document size is configurable in desktop settings.

Default maximum size is 2 MB.

Unresolved changes behavior is configurable in desktop settings. This setting controls what happens to changes that have not been accepted or rejected when a new version-creating action occurs (prompt submit, export, or exit):

Include them — unresolved changes are carried forward into the new version as-is.
Remove them — unresolved changes are dropped from the new version.
Ask me — user is prompted to choose at the time of the action (default).

Non-Functional Requirements

Performance target: version switch and mode switch feel immediate for documents up to configured max size.
Reliability: version history must be durable and recoverable.
Accessibility: change indicators cannot rely on color alone; keyboard-accessible mode/filter/action controls.
Auditability: every generated version must have timestamp and source action (edit, accept/reject, discard).
Data Model (Minimum)

Artifact
Version
Diff entry
Change action event
Attribution record
Export format preference (transient UI state, not persisted)
Success Metrics

>=95% of edit-intent prompts that return edited attachment create exactly one new version.
>=90% of users can correctly identify last change in usability test.
>=85% of reviewed sessions use at least one diff mode/filter/review action.
Low discard confusion: >=80% of tested users correctly understand that discarding the most recent version permanently removes it and reverts to the prior version.
Acceptance Criteria (Gherkin-style)

Document Mode Activation — With Attachment

Given a file is attached by the user or returned by the AI in a response

When the attachment is displayed in the thread

Then a "Document Mode" command badge is shown on the attachment

Given a "Document Mode" badge is visible on an attachment

When the user clicks the badge

Then document mode is activated, the attachment is converted to canonical Markdown, and version 1 is created

Document Mode Activation — Without Attachment

Given document mode has been entered without an existing attachment

When the first file appears (user-attached or AI-returned)

Then that file is converted to canonical Markdown and saved as version 1

Changes Pane — No Versions Yet

Given document mode is active and no versions have been created yet

When the user opens the Changes pane

Then the pane shows an empty state indicating no versions exist yet

Changes Pane — Version 1 Only, Diff-Only Style

Given only version 1 exists and diff-only display style is selected

When the Changes pane is open

Then the pane is blank

Changes Pane — Version 1 Only, Inline Markup Style

Given only version 1 exists and inline markup display style is selected

When the Changes pane is open

Then the full document is shown with no change markup

Changes Pane — Version 1 Only, Side-by-Side Style

Given only version 1 exists and side-by-side display style is selected

When the Changes pane is open

Then version 1 is shown on the left and the right side is empty

Second Document While Active

Given document mode is active with an existing artifact

When the user attaches or receives a second document

Then the system prompts: replace current document or start a new document session

Auto Version Creation

Given an active artifact and document mode is active

When assistant returns a response containing structured output with a unified diff and change summary

Then the diff is applied to the prior version's canonical content to produce a new sequential version

And the diff and change summary are stored against the new version

No-Op Prompt

Given an active artifact and document mode is active

When assistant response does not contain structured output with a diff

Then no new version is created

Comparison Scope — Last Step Default

Given versions N-1 and N exist

When user opens the Changes pane

Then default comparison scope is set to vN-1 → vN

Comparison Scope — Any Version Pair

Given versions 1...N exist

When user selects any two versions as base and target

Then the Changes pane computes and displays the diff for that pair

Display Style — Inline Markup

Given a selected comparison scope

When user selects inline markup display style

Then the full document is shown with insertions and deletions marked inline (tracked-changes style)

Display Style — Diff-Only

Given a selected comparison scope

When user selects diff-only display style

Then only the changed hunks between base and target are shown

Display Style — Side-by-Side

Given a selected comparison scope

When user selects side-by-side display style

Then base version is shown on the left and target version on the right

Accept Single Change

Given unresolved changes in current comparison

When user accepts one change

Then new version N+1 is created with accepted content applied

And remaining unresolved changes are handled per the unresolved changes setting

Reject All Visible Changes

Given visible filtered change set

When user selects reject all

Then new version N+1 is created with those visible changes rejected

And remaining unresolved changes are handled per the unresolved changes setting

Unresolved Changes — Ask Me (default)

Given unresolved changes exist and the setting is "ask me"

When a version-creating action occurs (prompt submit, export, or exit)

Then the user is prompted to choose: include or remove unresolved changes

Unresolved Changes — Include

Given unresolved changes exist and the setting is "include them"

When a version-creating action occurs

Then unresolved changes are carried forward into the new version without prompting

Unresolved Changes — Remove

Given unresolved changes exist and the setting is "remove them"

When a version-creating action occurs

Then unresolved changes are dropped from the new version without prompting

Attribution Filter

Given mixed AI and User changes

When user filters by AI

Then only AI-attributed changes are visible

Discard Most Recent Version

Given the most recent version is N and N > 1

When the user discards version N

Then version N is permanently removed from history

And the current version becomes N-1

And the version count is N-1

Discard Then New Edit — Version Renumbering

Given version N was discarded and current version is N-1

When the AI or user creates a new version

Then the new version is assigned ID N

Discard — Only Most Recent Allowed

Given versions 1...N exist and the user is viewing version N-1

When the user attempts to discard version N-1

Then the discard control is not available (discard is only offered on the most recent version)

Discard Version 1 — Disabled

Given only version 1 exists

When the user views the discard control

Then the discard control is disabled and greyed out

Export — Standard

Given current artifact and a selected export format and markup mode

When user exports

Then output is produced in the selected format (Markdown, DOCX, or PDF) reflecting the selected markup mode (with or without markup)

Export — Full Change History

Given current artifact with N versions

When user selects "Export full change history"

Then output contains N sections, each with the change summary for that version followed by the full document content with changes annotated for that version

Size Limit

Given desktop setting max size = 2 MB default

When user imports/edits file larger than configured limit

Then system blocks operation with clear message and no new version is created

Risks

DOCX/PDF conversion fidelity loss for complex layouts.
Diff quality degradation on heavy markdown normalization.
Version noise if attachment detection is too permissive.
Implementation Notes

Treat Markdown as single source of truth.
Keep raw import/export conversion artifacts for debugging and QA.
Record source event type for each version: attachment_edit, accept_change, reject_change.
Record discard events separately as version deletion events (not version creation events): discard_version, with the removed version ID and resulting current version ID logged for auditability.
