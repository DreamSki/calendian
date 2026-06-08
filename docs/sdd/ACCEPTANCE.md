# Acceptance Model

> Status: normative acceptance document  
> Last updated: 2026-06-08

This document defines when a requirement, task, version, or release is accepted. A feature is not complete merely because code exists; it must pass its acceptance checks.

## Acceptance levels

| Level | Accepted when |
|---|---|
| Requirement | All acceptance checks attached to the `REQ-*` item pass. |
| Task | Implementation, documentation, tests, and status updates are complete. |
| Version | Every P0 requirement for the version passes, P1 gaps are documented, and risks are accepted. |
| Release | Version gate passes on supported platform matrix and README accurately describes current capabilities. |

## Global release gates

These gates apply to every release.

### GATE-GLOBAL-01 — Documentation truthfulness

- README distinguishes Current, Planned, Experimental, and Non-goal features.
- No current-feature claim exists without a corresponding `Implemented` or `Partial` status in `CURRENT_STATUS.md`.
- Roadmap items reference requirement IDs.

### GATE-GLOBAL-02 — Privacy and local-first behavior

- Calendar and Reminder data is not sent to third-party services.
- Any future external API integration is disabled by default and documented separately.
- Debug logs must not expose event titles, notes, attendees, locations, or reminder text unless the user explicitly exports diagnostics.

### GATE-GLOBAL-03 — Permission safety

- Calendar permission denied, Reminders permission denied, partial permission, and non-macOS states do not crash the plugin.
- User-facing recovery guidance is shown when permissions fail.
- Read failures and empty calendars are visually distinguishable.

### GATE-GLOBAL-04 — Data mutation safety

Applies to any release with Calendar/Reminder write behavior.

- User confirmation exists for delete and destructive edits.
- Failed writes do not leave the UI in a false-success state.
- Recurring event operations are either explicitly supported with clear scope selection or blocked with a safe message.
- The plugin can refresh from source of truth after each write.

## Version gates

## v0.1 — Read-only MVP

Required P0 acceptance:

- GATE-V001-01: Plugin loads on supported macOS + Obsidian desktop environment.
- GATE-V001-02: If Calendar permission is granted, at least basic event fields can be displayed for the selected date.
- GATE-V001-03: If Reminders permission is granted, incomplete reminders can be displayed for the selected date.
- GATE-V001-04: Date selection updates the event/reminder panel from cache without opening or creating a note.
- GATE-V001-05: Cmd/Ctrl + click retains daily-note open/create behavior.
- GATE-V001-06: Calendar and reminder source discovery can list available sources or show a safe failure state.
- GATE-V001-07: Auto-refresh can be disabled only by unloading the plugin; unload clears timers.
- GATE-V001-08: README labels this release as read-only and partial where appropriate.

## v0.2 — Read-only polish

Required P0/P1 acceptance:

- Overdue reminders are visually distinct.
- No-date reminders are displayed in a separate configurable section.
- Past events can be grayed out or hidden based on setting.
- Multi-day events appear on every day they overlap.
- Month cells can show event dots without making date navigation slow.
- Event details expose location, links, notes, recurrence summary, and calendar source where available.

## v0.3 — Safe create

Required P0 acceptance:

- User can create simple non-recurring events.
- User can create simple reminders.
- Required fields are validated before write.
- Write success is confirmed only after macOS source reports success or refresh confirms the new item.
- Write failure shows a recoverable error and does not update UI as if successful.
- Natural language input ("tomorrow 3pm meeting") extracts title, date, time, and duration.
- Ambiguous natural language input shows a confirmation dialog with extracted fields.
- Manual event creation form remains available alongside NL parsing.

## v0.4 — Safe edit/delete ✅ PASSED (2026-06-08)

Required P0 acceptance:

- ✅ User can edit simple non-recurring events.
- ✅ User can delete simple non-recurring events with confirmation.
- ✅ User can mark reminders complete.
- ✅ User can edit and delete reminders with confirmation where destructive.
- ✅ Recurring event edit/delete is blocked or explicitly scoped.

## v0.5 — Note association and notifications

Required P0 acceptance:

- Event/reminder association writes stable frontmatter.
- Associated notes are discoverable from event/reminder details.
- Missing or renamed notes fail gracefully.
- Template variables are documented and validated.
- Event-start notifications fire within Obsidian at configurable lead time.
- Overdue reminder notifications fire within Obsidian.
- Users can configure notification lead time and enable/disable notifications.
- Notification unavailability degrades gracefully with documented limitation.

## v0.5.5 — Self-direction

Required P0 acceptance:

- Goals can be defined, broken into steps, paused, and archived without data loss.
- Goal content is stored in Obsidian only; never written to Calendar.app or Reminders.app.
- Habits can be defined, completed with one click, and retired without losing history.
- Habit progress is displayed as consistency rate (appearance days / total days), not as an unbroken streak.
- A single missed period does not reset accumulated habit progress to zero.
- Nudge tone and frequency are user-configurable; nudges can be disabled entirely.
- Default nudge language does not use shaming, punitive, or guilt-inducing phrasing.
- Daily intention prompt fires once per day.
- Re-engagement prompts after a lapse are framed as restarts, not failures.
- Daily and weekly review notes are generated from templates with pre-filled variables.
- Completed items (small wins) are surfaced before missed items in reviews.
- All self-direction data (goals, habits, nudges, reviews, stats) is computed locally.

## v0.6 — Advanced views, search, and export

Required P0/P1 acceptance:

- Timeline view shows events with correct vertical position and duration.
- Week view shows seven-day schedule consistently with day list data.
- Search returns events/reminders across cache range.
- Date range can be exported as Markdown.
- Data can be exported as JSON for backup.
- Export does not send data to external services.
- Custom view configuration does not corrupt source filters.

## Requirement acceptance template

Use this template when adding new requirements:

```md
### REQ-XXX — Requirement title

- Priority:
- Target release:
- Status:
- Acceptance:
  - GIVEN ... WHEN ... THEN ...
  - IF ... THEN ...
- Tests:
- Risks:
```
