# Risk Register

> Status: living risk register  
> Last updated: 2026-06-07

Risks are reviewed before roadmap changes and before releases. Severity combines user impact, data loss potential, implementation uncertainty, and support cost.

## Risk scale

| Level | Meaning |
|---|---|
| High | Can cause data loss, privacy breach, major support load, or roadmap failure. |
| Medium | Can break common workflows, degrade trust, or require rework. |
| Low | Manageable inconvenience or polish issue. |

## Active risks

### RISK-001 — README overpromises planned features

- Severity: High
- Area: Product trust, release management
- Related requirements: `REQ-DOC-001`, `REQ-DOC-002`
- Description: Current user-facing docs have historically mixed implemented and planned capabilities.
- Mitigation:
  - Use `CURRENT_STATUS.md` as truth source.
  - README must separate Current, Planned, Experimental, and Non-goals.
  - Every release requires `GATE-GLOBAL-01`.

### RISK-002 — Plugin identity drift

- Severity: Medium
- Area: Packaging
- Related requirements: `REQ-PLAT-001`
- Description: Product name, manifest id/name, and documentation naming can diverge.
- Mitigation:
  - Resolve canonical plugin id before public release.
  - Add metadata alignment to `TASK-001`.

### RISK-003 — JXA field availability varies by account/source

- Severity: Medium
- Area: Data model
- Related requirements: `REQ-CAL-*`, `REQ-REM-*`
- Description: Calendar/Reminders JXA properties may be missing, inconsistent, slow, or differently shaped across iCloud, Google, Exchange, local calendars, and macOS versions.
- Mitigation:
  - Treat optional fields as optional.
  - Add parse error isolation.
  - Test across account types where available.

### RISK-004 — Missing stable IDs block write and note association

- Severity: High
- Area: Data integrity
- Related requirements: `REQ-WRITE-*`, `REQ-NOTE-*`
- Description: Without stable event/reminder identifiers, edits, deletes, and note associations can target the wrong item.
- Mitigation:
  - Do not implement write operations until stable identity strategy exists.
  - Add fallback identity only for display, not mutation.

### RISK-005 — Recurring event mutation can damage user calendars

- Severity: High
- Area: Data safety
- Related requirements: `REQ-REC-*`, `REQ-WRITE-*`
- Description: Editing/deleting recurring events requires scope selection and can unintentionally change many events.
- Mitigation:
  - Block recurring event mutation until recurrence model is specified.
  - Add explicit scope UX before support.

### RISK-006 — Permission failures are mistaken for empty data

- Severity: Medium
- Area: UX, support
- Related requirements: `REQ-PERM-*`, `REQ-ERR-*`
- Description: A blank panel can mean no data, no permission, timeout, unsupported platform, or parse failure.
- Mitigation:
  - Add explicit state model.
  - Add diagnostic panel.

### RISK-007 — Cache preload is slow for large calendars

- Severity: Medium
- Area: Performance
- Related requirements: `REQ-CACHE-*`, `REQ-PERF-*`
- Description: ±6 month preload may be slow for users with many accounts/events.
- Mitigation:
  - Keep UI responsive during load.
  - Measure load time.
  - Consider lazy loading or smaller initial range if tests fail.

### RISK-008 — UI click behavior conflicts with original Calendar plugin behavior

- Severity: Medium
- Area: UX migration
- Related requirements: `REQ-UX-001`, `REQ-UX-002`
- Description: Original calendar behavior opens daily notes; Calendian changes single-click to select date and Cmd/Ctrl-click to open/create note.
- Mitigation:
  - Document behavior clearly.
  - Consider setting to restore legacy click behavior.

### RISK-009 — Tasks integration creates duplicate reminders

- Severity: High
- Area: Data duplication
- Related requirements: `REQ-TASK-*`, `REQ-WRITE-*`
- Description: Syncing Obsidian Tasks to macOS Reminders can duplicate or overwrite tasks if identity and sync direction are unclear.
- Mitigation:
  - Start as manual one-way export/import.
  - Require stable mapping metadata before two-way sync.

### RISK-010 — Cross-platform support is a separate product architecture

- Severity: High
- Area: Roadmap feasibility
- Related requirements: `REQ-XPLAT-*`
- Description: Android/Microsoft Graph support requires auth, token storage, cloud API permissions, privacy docs, and conflict handling.
- Mitigation:
  - Defer to v1.x platform track.
  - Do not couple it to early macOS local-first milestones.

### RISK-011 — Diagnostics can leak private calendar data

- Severity: High
- Area: Privacy
- Related requirements: `REQ-PRIV-*`, `REQ-DIAG-*`
- Description: Logs and issue reports may include event titles, attendees, links, notes, or locations.
- Mitigation:
  - Redact by default.
  - Ask user consent before including raw data.

### RISK-012 — Nudge fatigue and user opt-out

- Severity: Medium
- Area: UX, user trust
- Related requirements: `REQ-NUDGE-001` to `REQ-NUDGE-009`
- Description: Well-intentioned motivational nudges can become annoying if too frequent, poorly timed, or tonally mismatched to the user. This can drive users to disable the feature or abandon the plugin.
- Mitigation:
  - P0 requirement for full disable (`REQ-NUDGE-006`).
  - P1 requirement for configurable tone (`REQ-NUDGE-005`).
  - P0 requirement for no shaming language by default (`REQ-NUDGE-007`).
  - Start with conservative defaults; let users increase frequency if desired.

### RISK-013 — Self-direction data model scope creep

- Severity: Medium
- Area: Roadmap, maintainability
- Related requirements: `REQ-GOAL-*`, `REQ-HABIT-*`, `REQ-REVIEW-*`
- Description: Goals, habits, intentions, and reviews add four new domain entities and ~34 new requirements. Without disciplined scoping, these features could delay the core calendar/reminder roadmap.
- Mitigation:
  - Self-direction data is fully local to Obsidian (no Apple pipeline integration).
  - Most requirements target v0.5/v0.5.5, reusing v0.5 note association and notification infrastructure.
  - Hard boundary in §5.8: self-direction data never touches Calendar.app or Reminders.app.

### RISK-014 — Self-direction data loss on vault migration

- Severity: Medium
- Area: Data durability
- Related requirements: `REQ-GOAL-008`, `REQ-HABIT-010`, `REQ-REVIEW-007`
- Description: Goal, habit, and review data stored only in Obsidian (plugin settings or note frontmatter) has no external backup. If a user migrates vaults or loses settings, self-direction history could be lost.
- Mitigation:
  - Document where data is stored.
  - Consider JSON export for self-direction data in future release.
  - Frontmatter-based storage survives note sync (Obsidian Sync, git).

### RISK-015 — Target architecture and actual bundled code diverge

- Severity: Medium
- Area: Maintainability
- Related requirements: `REQ-ARCH-001`, `REQ-DOC-003`
- Description: Docs describe a split module architecture while current implementation is bundled in `main.js`.
- Mitigation:
  - Label architecture as target until refactor is done.
  - Add refactor task before complex Phase 2 work.

## Risk review cadence

- Review before each version release.
- Review before adding any write operation.
- Review before adding external API or cross-platform support.
- Review when user reports permission, data loss, or privacy issues.
