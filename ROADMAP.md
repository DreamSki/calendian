# Calendian Requirement-Driven Roadmap

> Status: roadmap derived from `SPEC.md` requirements  
> Last updated: 2026-06-07  
> Process: Specification-Driven Development

This roadmap is not an independent wish list. Every release is derived from requirement groups in [`SPEC.md`](./SPEC.md), acceptance gates in [`docs/sdd/ACCEPTANCE.md`](./docs/sdd/ACCEPTANCE.md), tasks in [`docs/sdd/TASKS.md`](./docs/sdd/TASKS.md), and risks in [`docs/sdd/RISKS.md`](./docs/sdd/RISKS.md).

Current repository status: **pre-v0.1 / read-only MVP partial**.

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
| v0.1 | Read-only MVP | `REQ-PLAT-*`, `REQ-PERM-*`, `REQ-CAL-001..006`, `REQ-REM-001..004`, `REQ-SRC-001..004`, `REQ-CACHE-001..005`, `REQ-UX-001..004`, `REQ-PRIV-*`, `REQ-ERR-001..004` | Next target |
| v0.2 | Read-only polish | event details, overdue/no-date reminders, multi-day events, diagnostics, manual refresh | Planned |
| v0.3 | Safe create | simple event/reminder creation, validation, write verification | Planned |
| v0.4 | Safe edit/delete | simple event/reminder edit/delete, reminder completion, recurring safety | Planned |
| v0.5 | Note association | frontmatter association, meeting notes, templates, limited Tasks integration | Planned |
| v0.6 | Advanced views/search | timeline, week view, search, basic statistics | Planned |
| v1.x | Platform expansion | cross-platform architecture, Microsoft Graph/Android investigation | Deferred |

---

## v0.1 — Read-only MVP

### Goal

A macOS Obsidian user can open Calendian, grant permissions, select a date, and see that day's Calendar events and Reminders without modifying source data.

### Required requirements

- Platform: `REQ-PLAT-001` to `REQ-PLAT-004`
- Permissions: `REQ-PERM-001` to `REQ-PERM-004`
- Calendar read: `REQ-CAL-001` to `REQ-CAL-006`
- Reminder read: `REQ-REM-001` to `REQ-REM-004`
- Source selection: `REQ-SRC-001` to `REQ-SRC-004`
- Cache/performance: `REQ-CACHE-001` to `REQ-CACHE-005`, `REQ-PERF-001`, `REQ-PERF-002`, `REQ-PERF-004`
- UX: `REQ-UX-001` to `REQ-UX-004`
- Privacy/error handling: `REQ-PRIV-001` to `REQ-PRIV-003`, `REQ-ERR-001` to `REQ-ERR-004`
- Documentation: `REQ-DOC-001` to `REQ-DOC-003`

### Deliverables

- Plugin metadata aligned across manifest and docs.
- macOS-only support clearly documented.
- Calendar read integration hardened for basic event fields.
- Reminders read integration hardened for basic reminder fields.
- Selected-date sidebar panel.
- Single-click date selection.
- Cmd/Ctrl-click daily-note behavior preserved.
- Source discovery and basic filtering.
- Bounded cache and configurable refresh.
- Permission/empty/error states.
- README corrected to avoid planned-feature overclaiming.

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

- Event details and edge cases: `REQ-CAL-007` to `REQ-CAL-012`
- Reminder polish: `REQ-REM-005` to `REQ-REM-009`
- Cache/diagnostics: `REQ-CACHE-006` to `REQ-CACHE-008`, `REQ-DIAG-001` to `REQ-DIAG-004`
- UX polish: `REQ-UX-006`, `REQ-UX-010`
- Error hardening: `REQ-ERR-003`

### Deliverables

- Expandable event details.
- Location, URL, notes, and recurrence summary display where available.
- Overdue reminder styling.
- No-date reminder section.
- Reminder display range selector.
- Past event treatment.
- Multi-day event overlap display.
- Month-cell event dots.
- Manual refresh.
- Diagnostic panel with redaction.
- Large-calendar behavior reviewed.

### Explicit exclusions

- Still read-only.
- No automatic Tasks sync.
- No recurring mutation.

---

## v0.3 — Safe create

### Goal

Allow users to create simple non-recurring events and simple reminders from Obsidian with validation, confirmation, and source-of-truth refresh.

### Required requirements

- Event create: `REQ-WRITE-001` to `REQ-WRITE-005`
- Reminder create: `REQ-WRITE-006` to `REQ-WRITE-010`
- Error safety: `REQ-ERR-005`, `REQ-ERR-006`
- Recurring safety: `REQ-REC-001` to `REQ-REC-003`
- Architecture: `REQ-ARCH-001`

### Deliverables

- Event creation form or side panel.
- Reminder creation form or side panel.
- Required-field validation.
- Save feedback.
- Refresh-after-create verification.
- Safe failure state.
- Recurring event creation blocked until separately specified.
- Module refactor started before write complexity grows.

### Explicit exclusions

- No editing or deleting yet.
- No recurring event creation.
- No automatic natural-language parsing requirement unless separately specified.

---

## v0.4 — Safe edit/delete

### Goal

Support simple event/reminder mutation while protecting users from accidental destructive changes.

### Required requirements

- Event edit/delete: `REQ-WRITE-011` to `REQ-WRITE-015`
- Reminder edit/delete/complete: `REQ-WRITE-016` to `REQ-WRITE-020`
- Recurring safety: `REQ-REC-004` to `REQ-REC-008` if recurring mutation is enabled; otherwise block with explanation.
- Error safety: `REQ-ERR-007`, `REQ-ERR-008`

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

### Explicit exclusions

- No automatic two-way Tasks ↔ Reminders sync until identity and conflict strategy are specified.

---

## v0.6 — Advanced views, search, and statistics

### Goal

Add richer planning views while reusing the same domain model and cache strategy.

### Required requirements

- Views: `REQ-VIEW-001` to `REQ-VIEW-006`
- Search: `REQ-SEARCH-001` to `REQ-SEARCH-005`
- Statistics: `REQ-STATS-001` to `REQ-STATS-004`

### Deliverables

- Vertical timeline view.
- Week view.
- Global local search across cache range.
- Date range filtering.
- Basic event/reminder statistics.
- Markdown summary export.

### Explicit exclusions

- No cloud search.
- No external analytics.

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

- natural-language `/event` parsing;
- AI schedule summary;
- saved custom views;
- annual heatmap;
- project management dashboards;
- automatic daily-note agenda insertion;
- full two-way Tasks sync;
- direct Google Calendar support;
- direct Microsoft Graph support.
