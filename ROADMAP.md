# Calendian Requirement-Driven Roadmap

> Status: roadmap derived from `SPEC.md` requirements  
> Last updated: 2026-06-08  
> Plugin ID: `calendian`  
> Process: Specification-Driven Development

This roadmap is not an independent wish list. Every release is derived from requirement groups in [`SPEC.md`](./SPEC.md), acceptance gates in [`docs/sdd/ACCEPTANCE.md`](./docs/sdd/ACCEPTANCE.md), tasks in [`docs/sdd/TASKS.md`](./docs/sdd/TASKS.md), and risks in [`docs/sdd/RISKS.md`](./docs/sdd/RISKS.md).

Current repository status: **v0.3 safe create — complete**. Event/reminder creation (10/10 REQ-WRITE), NL parsing with AI (5/5 REQ-NL), default settings (1/1), post-write refresh + write error handling, window focus + EK notification watch + concurrent safety, display-only marking + stable ID guard, today summary panel (REQ-UX-010), code split via `cat` concatenation (REQ-ARCH-001). 8/8 v0.3 acceptance gates passed. 11/11 deferred v0.2 items resolved.

---

## Roadmap principles

1. **Ship safe vertical slices.** Each version must be usable without requiring later phases.
2. **Do not overpromise.** README may only list current behavior that is reflected in `docs/sdd/CURRENT_STATUS.md`.
3. **Read before write.** Read-only display must be stable before any Calendar/Reminder mutation ships.
4. **Stable identity before mutation.** Editing, deleting, and note association require reliable event/reminder IDs.
5. **Recurring events are safety-critical.** Recurring mutation is blocked until explicitly specified and tested.
6. **Cross-platform is a separate architecture track.** Android/Microsoft Graph is deferred to v1.x.

---

## Version overview

| Version | Theme | Requirement groups | Release posture |
|---|---|---|---|
| v0.1 | Read-only MVP | `REQ-PLAT-*`, `REQ-PERM-*`, `REQ-CAL-001..007`, `REQ-REM-001..004,008`, `REQ-SRC-001..005`, `REQ-CACHE-001..008`, `REQ-UX-001..004`, `REQ-PRIV-*`, `REQ-ERR-001..004`, `REQ-DIAG-001`, `REQ-DATA-*` | Complete |
| v0.2 | Read-only polish | expandable details, overdue/no-date reminders, multi-day events, month-cell dots, full diagnostic panel | Complete |
| v0.3 | Safe create | simple event/reminder creation, natural language (regex + AI), validation, write verification, refresh system, code split | **Complete** |
| v0.4 | Safe edit/delete | simple event/reminder edit/delete, reminder completion, recurring safety | Planned |
| v0.5 | Note association & notifications | frontmatter association, meeting notes, templates, in-app notifications, limited Tasks integration | Planned |
| v0.5.5 | Self-direction | goals, habits, nudges, reflections, encouragement statistics | Planned |
| v0.6 | Advanced views/search | timeline, week view, search, data export, UI customization | Planned |
| v1.x | Platform expansion | cross-platform architecture, Microsoft Graph/Android investigation | Deferred |

---

## v0.1 — Read-only MVP

### Goal

A macOS Obsidian user can open Calendian, grant permissions, select a date, and see that day's Calendar events and Reminders without modifying source data.

### Required requirements

- Platform: `REQ-PLAT-001` to `REQ-PLAT-004`
- Permissions: `REQ-PERM-001` to `REQ-PERM-004`
- Calendar read: `REQ-CAL-001` to `REQ-CAL-007`
- Reminder read: `REQ-REM-001` to `REQ-REM-004`, `REQ-REM-008`
- Source selection: `REQ-SRC-001` to `REQ-SRC-005`
- Cache/performance: `REQ-CACHE-001` to `REQ-CACHE-008`, `REQ-PERF-002`, `REQ-PERF-004`
- UX: `REQ-UX-001` to `REQ-UX-004`
- Privacy/error handling: `REQ-PRIV-001` to `REQ-PRIV-002`, `REQ-ERR-001` to `REQ-ERR-004`
- Diagnostics: `REQ-DIAG-001` (partial)
- Documentation: `REQ-DOC-001` to `REQ-DOC-003`

### Deliverables

- Plugin metadata aligned across manifest and docs (`REQ-PLAT-003` — partial).
- macOS-only support clearly documented.
- Calendar read integration via native EventKit helper (fast, stable UUIDs).
- Reminders read integration via native EventKit helper.
- Selected-date sidebar panel with event/reminder display.
- Single-click date selection; Cmd/Ctrl-click daily-note behavior preserved.
- Event display: title, time, calendar badge (colored), location, recurrence indicator.
- Reminder display: title, due time, list badge, priority indicator.
- Source discovery with account name disambiguation and empty/error states.
- Source filtering by stable UUID with instant in-memory apply.
- Bounded cache (±6 months) with disk persistence and configurable refresh.
- Two-phase init: cache-first instant render, stale background refresh.
- Manual refresh button and last refresh time footer.
- Permission denied / error / timeout / empty / cache-miss UI states.
- Independent Calendar/Reminders permission/error tracking with retry.
- Privacy declaration in settings tab.

### Release gates

See `GATE-V001-*` in `docs/sdd/ACCEPTANCE.md`.

### Explicit exclusions

- No Calendar/Reminder writes.
- No event/reminder context-menu mutation.
- No note association beyond existing daily-note behavior inherited from the base calendar plugin.
- No recurring event mutation.
- No Android/cross-platform support.

---

## v0.2 — Read-only polish

### Goal

Make the read-only experience reliable enough for daily use across common event/reminder shapes.

### Required requirements

- Event details: `REQ-CAL-008` to `REQ-CAL-012` (expandable panel, multi-day events, past events, recurring read-only)
- Reminder polish: `REQ-REM-005` to `REQ-REM-007`, `REQ-REM-009` (overdue styling, no-date section, display range, subtasks)
- Cache/diagnostics: `REQ-DIAG-001` (full panel), `REQ-DIAG-002`
- UX polish: `REQ-UX-006` (month-cell dots)

### Deliverables

- Expandable event details panel.
- Event URL, notes, and attendees display in details panel.
- Overdue reminder styling.
- No-date reminder section.
- Reminder display range selector.
- Past event treatment.
- Multi-day event overlap display.
- Month-cell event dots.
- Full diagnostic panel with permission status, source counts, timing.
- Diagnostic export with consent modal and redaction.
- Recurring event read-only indicator.

### Explicit exclusions

- Still read-only.
- No automatic Tasks sync.
- No recurring mutation.
- No today summary panel (`REQ-UX-010`, deferred to v0.3).
- No window-focus refresh (`REQ-SYNC-004`, deferred to v0.3).
- No macOS system notification watch (`REQ-SYNC-005`/`007`, deferred to v0.3).
- No large-calendar degradation review (`REQ-PERF-003`, deferred to v0.3).
- No DST transition handling (`REQ-TIME-005`, deferred to v0.3).
- No permission-change retry path (`REQ-PERM-005`, deferred to v0.3).
- No display-only marking for unstable IDs (`REQ-DATA-003`, deferred to v0.3).
- Subtask display is data-dependent (`REQ-REM-009`, helper parentId not yet populated).

---

## v0.3 — Safe create

### Goal

Allow users to create simple non-recurring events and simple reminders from Obsidian with validation, confirmation, and source-of-truth refresh.

### Required requirements

- Event create: `REQ-WRITE-001` to `REQ-WRITE-005`
- Reminder create: `REQ-WRITE-006` to `REQ-WRITE-010`
- Natural language creation: `REQ-NL-001` to `REQ-NL-005`
- Error safety: `REQ-ERR-005`, `REQ-ERR-006`
- Recurring safety: `REQ-REC-001` to `REQ-REC-003`
- Architecture: `REQ-ARCH-001`
- Sync polish (deferred from v0.2): `REQ-SYNC-004`, `REQ-SYNC-005`, `REQ-SYNC-007`
- Data safety (deferred from v0.2): `REQ-DATA-003`, `REQ-TIME-005`
- Misc polish (deferred from v0.2): `REQ-UX-010`, `REQ-PERM-005`, `REQ-PERF-003`
- Reminder polish (deferred from v0.2): `REQ-REM-009` (subtask display — helper parentId needed)

### Deliverables

- ✅ Event creation form (`EventCreateModal`).
- ✅ Reminder creation form (`ReminderCreateModal`).
- ✅ Required-field validation.
- ✅ Save feedback (Obsidian notice + error display).
- ✅ Refresh-after-create verification (`init(true)` after write).
- ✅ Post-write refresh from source of truth (REQ-SYNC-006).
- ✅ Safe failure state (error classification + red error banner, REQ-ERR-005).
- ✅ Recurring event creation blocked (only `.thisEvent` span).
- ✅ Default calendar/list settings (`defaultCalendarId`, `defaultReminderListId`).
- ✅ Natural language creation (`QuickEventModal` + `parseNaturalLanguage()`, English + expanded Chinese).
- ✅ Chinese NL: compact dates (YYMMDD, Chinese numerals, X月Y日), times (凌晨/一刻/三刻), duration (X小时Y分钟).
- ✅ NL dual-path: "→ Event" and "→ Reminder" buttons, both pre-fill their respective modals.
- ✅ Optional AI-powered NL parsing via configurable OpenAI-compatible API (Enter-triggered, not auto).
- ✅ AI: 10s timeout, cancel on type, `response_format: json_object`, collapsible raw JSON preview.
- ✅ Code split via `cat` concatenation (REQ-ARCH-001): `main-head.js` + `src/macos/helper-executor.js` (7 methods) + `src/cache/schedule-cache.js` (13 methods) → `build-main.sh` → `main.js`.
- ✅ Deferred v0.2 items (10/11 resolved): window focus refresh, EK notification watch, permission retry, display-only marking, large-calendar benchmark, today summary, concurrent safety, watch fallback, data identity guard, DST excluded by user.
- ⏸️ Recurring event safety UX (REQ-REC-002/003/007) — classification documented; edit-block code to be added in v0.4 entry points.
- ⏸️ Subtask display (REQ-REM-009) — permanently blocked by Apple EventKit API (no public parent/child for reminders).

### Explicit exclusions

- No editing or deleting yet.
- No recurring event creation.

---

## v0.4 — Safe edit/delete

### Goal

Support simple event/reminder mutation while protecting users from accidental destructive changes.

### Required requirements

- Event edit/delete: `REQ-WRITE-011` to `REQ-WRITE-015`
- Reminder edit/delete/complete: `REQ-WRITE-016` to `REQ-WRITE-020`
- Recurring safety: `REQ-REC-004` to `REQ-REC-008` if recurring mutation is enabled; otherwise block with explanation.
- Error safety: `REQ-ERR-005`, `REQ-ERR-006` (write-path errors)

### Deliverables

- Edit simple non-recurring events.
- Delete simple non-recurring events with confirmation.
- Mark reminders complete.
- Edit reminders.
- Delete reminders with confirmation.
- Unsupported recurring operations open Calendar.app or show safe block.
- Operation result feedback.

### Explicit exclusions

- No silent destructive operation.
- No mutation without stable source identity.

---

## v0.5 — Note association and Tasks integration

### Goal

Connect calendar/reminder items to Obsidian notes using stable metadata and useful meeting/task workflows.

### Required requirements

- Note association: `REQ-NOTE-001` to `REQ-NOTE-010`
- Tasks integration: `REQ-TASK-001` to `REQ-TASK-004`
- In-app notifications: `REQ-NOTIF-001` to `REQ-NOTIF-005`
- Privacy: `REQ-PRIV-003`

### Deliverables

- Associate event/reminder with existing note.
- Create note from event/reminder using template.
- Show associated note links in details.
- Store associations in frontmatter.
- Handle missing/renamed notes safely.
- Meeting-note template variables.
- Copy-as-Markdown.
- Manual, non-automatic Tasks integration experiment.
- Event start notifications (configurable lead time).
- Overdue reminder notifications.
- Notification enable/disable settings.

### Explicit exclusions

- No automatic two-way Tasks ↔ Reminders sync until identity and conflict strategy are specified.

---

## v0.5.5 — Self-direction

### Goal

Help users build consistency through lightweight goals, habits, encouragement nudges, and structured reflection — without shame, without streaks, and without sending personal data anywhere.

### Design principles (encoded as requirements)

These are not optional polish. Key psychological principles are hard-coded as P0/P1 requirements in the spec:

1. **Presence over perfection.** Progress is measured as appearance rate over a window, not an unbroken streak (`REQ-HABIT-003`, `REQ-HABIT-004`). A single missed period does not reset progress to zero.
2. **No shaming by default.** The system SHALL NOT use punitive or guilt-inducing language (`REQ-NUDGE-007`). Users control tone and can disable nudges entirely (`REQ-NUDGE-005`, `REQ-NUDGE-006`).
3. **Intention over schedule.** The system prompts for a daily intention rather than imposing a schedule (`REQ-NUDGE-001`).
4. **Abandoning is not all-or-nothing.** Goals can be paused or archived without deleting history (`REQ-GOAL-007`). Habits can be edited or retired without losing history (`REQ-HABIT-009`).

### Required requirements

- Goals and focus: `REQ-GOAL-001` to `REQ-GOAL-008`
- Habits and consistency: `REQ-HABIT-001` to `REQ-HABIT-010`
- Encouragement nudges: `REQ-NUDGE-001` to `REQ-NUDGE-009`
- Reflection and review: `REQ-REVIEW-001` to `REQ-REVIEW-007`
- Encouragement statistics: `REQ-STATS-001` to `REQ-STATS-006`

### Deliverables

- **Goals**:
  - Define lightweight goals in Obsidian (note/frontmatter), not in Calendar.app or Reminders.app
  - Break goals into small actionable steps
  - Declare a single current focus for a week or phase
  - Complete a step with a single action
  - Pause or archive goals without deleting history
  - Local-only, no external services

- **Habits**:
  - Define lightweight recurring habits tracked within Obsidian
  - Record habit completion for a given day with a single action
  - Display consistency/appearance rate (NOT unbroken streak)
  - Configurable restart threshold before re-engagement prompt
  - Minimum-viable version support for low-energy days
  - Mark scheduled rest periods (not counted as misses)
  - Edit or retire habits without losing history
  - Local-only, no Reminders.app dependency

- **Nudges**:
  - Daily intention prompt (once per day)
  - Optional gentle end-of-day check-in
  - Re-engagement prompt framed as restart, not failure
  - "Start now for N minutes" quick action
  - Configurable tone (gentle / neutral / firm)
  - Configurable frequency and full disable option
  - In-panel degradation when Obsidian notification APIs are unavailable
  - Local-only, no behavioral data sent externally

- **Reflection and review**:
  - Daily reflection from template (pre-filled with events, completed items, intention)
  - Weekly review (completed steps, habit consistency, current focus)
  - Template variables: intention, completed items, missed items, next focus
  - Completed items surfaced before missed items
  - Carry unfinished focus forward without penalty
  - Review notes linked to goals/habits/events via stable metadata
  - Local-only, no reflection content sent externally

- **Encouragement statistics**:
  - Step/habit completion count over configurable window
  - Consistency rate (appearance days / total days), not streak
  - Current focus surfaced alongside progress metrics
  - Small-wins count before gap analysis
  - Progress summaries emphasizing presence over perfection
  - Local computation only

### Dependencies

This phase depends on note association, frontmatter templates, and notification infrastructure from v0.5. Goal, habit, nudge, and review data live entirely in Obsidian (plugin settings, note frontmatter, or note content) and SHALL NOT touch the Apple data pipeline.

### Explicit exclusions

- No external goal/habit tracking services.
- No social or sharing features.
- No AI-generated reflection content.
- No automatic goal/habit creation from calendar data.

---

## v0.6 — Advanced views, data export, and UI customization

### Goal

Add richer planning views and export capabilities while reusing the same domain model and cache strategy.

### Required requirements

- Views: `REQ-VIEW-001` to `REQ-VIEW-006`
- Search: `REQ-SEARCH-001` to `REQ-SEARCH-005`
- Data export: `REQ-EXPORT-001` to `REQ-EXPORT-004`
- UI customization: `REQ-UI-001` to `REQ-UI-004`

### Deliverables

- **Views**:
  - Vertical timeline view with current-time indicator
  - Week view with consistent filtering

- **Search**:
  - Search events/reminders across cache range
  - Match title, calendar/list, location, notes, and associated note title
  - Date range filtering
  - Local-only, no external services

- **Data export**:
  - Export selected date range as Markdown
  - Export data as JSON for backup
  - Local-only, no external services

- **UI customization**:
  - Compact/comfortable density options
  - Configurable event field display
  - Theme-aware styling

### Explicit exclusions

- No cloud search or external analytics.
- No AI-powered features.
- No mobile or cross-platform support (deferred to v1.x).

---

## v1.x — Cross-platform track, deferred

### Goal

Investigate whether Calendian should support Android or non-macOS platforms through a separate architecture.

### Required pre-work

- Architecture proposal.
- Authentication model.
- Token storage and revocation model.
- Privacy model.
- Conflict handling model.
- Platform-specific test matrix.

### Related requirements

- `REQ-XPLAT-001` to `REQ-XPLAT-005`

### Notes

This track must not block the macOS local-first roadmap.

---

## Release cadence

Versions should be released only after their gates pass. Estimated effort should be updated after implementation evidence exists; this roadmap intentionally avoids hard day estimates until the SDD artifacts and tests stabilize.

## Backlog ideas not yet committed

These ideas require new requirements before implementation:

- AI schedule summary;
- saved custom views;
- annual heatmap;
- project management dashboards;
- automatic daily-note agenda insertion;
- full two-way Tasks sync;
- direct Google Calendar support;
- direct Microsoft Graph support.
