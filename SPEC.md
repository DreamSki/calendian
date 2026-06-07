# Calendian Specification

> Status: authoritative product specification  
> Version target: pre-v0.1 / read-only MVP  
> Last updated: 2026-06-07  
> Process: Specification-Driven Development (SDD)

Calendian is an Obsidian desktop plugin that brings macOS Calendar events and macOS Reminders into the Obsidian sidebar. The product is local-first: early versions read from Calendar.app and Reminders.app through macOS automation rather than sending data to a cloud service.

This specification is the single source of truth for scope, requirements, non-goals, data model, safety rules, and release acceptance. Roadmap, tasks, tests, and README must trace back to this file.

See also:

- [`docs/sdd/README.md`](./docs/sdd/README.md) — SDD process and document hierarchy
- [`docs/sdd/CURRENT_STATUS.md`](./docs/sdd/CURRENT_STATUS.md) — actual implementation status
- [`docs/sdd/ACCEPTANCE.md`](./docs/sdd/ACCEPTANCE.md) — release gates
- [`docs/sdd/TRACEABILITY.md`](./docs/sdd/TRACEABILITY.md) — requirement traceability
- [`docs/sdd/TASKS.md`](./docs/sdd/TASKS.md) — implementation backlog
- [`docs/sdd/TESTING.md`](./docs/sdd/TESTING.md) — test strategy
- [`docs/sdd/RISKS.md`](./docs/sdd/RISKS.md) — risk register

---

## 1. Product scope

### 1.1 Product goal

Calendian helps Obsidian users review and eventually manage their schedule without leaving their note-taking environment.

Primary goals:

1. Show selected-day Calendar events in the Obsidian sidebar.
2. Show selected-day Reminders in the Obsidian sidebar.
3. Keep calendar/reminder data local by default.
4. Preserve Obsidian daily-note workflows.
5. Later, enable safe write operations and note associations.

### 1.2 Target users

- macOS users who already use Calendar.app and/or Reminders.app.
- Obsidian users who use daily notes, meeting notes, task notes, or weekly planning workflows.
- Users who want local-first schedule visibility without direct Google/Microsoft API setup.

### 1.3 Current release posture

The current repository must be treated as **pre-v0.1 / read-only MVP in progress**. Feature claims in README and release notes must match `docs/sdd/CURRENT_STATUS.md`.

---

## 2. Non-goals and explicit boundaries

### 2.1 v0.1 non-goals

The following are explicitly out of scope for v0.1:

- Creating Calendar events.
- Editing Calendar events.
- Deleting Calendar events.
- Creating, editing, deleting, or completing Reminders.
- Editing recurring events.
- Two-way sync between Obsidian Tasks and macOS Reminders.
- Android, Windows, Linux, or web support.
- Direct Google Calendar API, Microsoft Graph API, or CalDAV API integration.
- Cloud sync managed by Calendian.
- AI summarization or remote processing of private calendar data.

### 2.2 Future non-goal unless re-specified

Calendian will not send event titles, reminder text, attendees, notes, locations, or URLs to any external service unless a future spec adds an opt-in external integration with a separate privacy model.

---

## 3. Platforms and dependencies

### 3.1 Platform matrix

| Platform | Status | Notes |
|---|---|---|
| macOS desktop | Target | Uses `/usr/bin/osascript` and JXA. |
| Obsidian desktop | Target | Plugin runs inside Obsidian desktop. |
| iOS / iPadOS | Rejected for current architecture | JXA and macOS automation unavailable. |
| Windows / Linux | Deferred | Requires non-JXA architecture. |
| Android | Deferred to v1.x platform track | Requires external API/auth design. |

### 3.2 External apps

- Calendar.app is the source of calendar events.
- Reminders.app is the source of reminders.
- Account support is inherited from what the user has configured in macOS Calendar/Reminders.

### 3.3 Packaging consistency requirement

`manifest.json`, README, SPEC, and release notes must agree on:

- plugin display name;
- plugin id;
- version;
- minimum Obsidian version;
- desktop/macOS-only scope.

---

## 4. Domain model

### 4.1 Event model

Internal event records should converge toward this shape:

```ts
interface CalendianEvent {
  id: string;
  source: "macos-calendar";
  calendarId?: string;
  calendarName: string;
  calendarColor?: string;
  title: string;
  start: string; // ISO-like internal representation
  end?: string;
  isAllDay: boolean;
  isRecurring?: boolean;
  recurrenceSummary?: string;
  location?: string;
  url?: string;
  notes?: string;
  attendees?: string[];
  alarms?: CalendianAlarm[];
  rawSource?: "redacted" | unknown;
}
```

v0.1 may use a reduced display model, but write operations and note association must not ship until stable IDs exist.

### 4.2 Reminder model

```ts
interface CalendianReminder {
  id: string;
  source: "macos-reminders";
  listId?: string;
  listName: string;
  title: string;
  dueDate?: string;
  dueTime?: string;
  priority?: "none" | "low" | "medium" | "high";
  completed: boolean;
  parentId?: string;
  notes?: string;
  rawSource?: "redacted" | unknown;
}
```

### 4.3 Association model

Future note associations must use stable source IDs:

```yaml
---
calendian:
  associations:
    - type: event
      source: macos-calendar
      id: "stable-event-id"
      title: "Product review"
      date: 2026-06-07
      calendar: "Work"
---
```

Fallback IDs derived from title/time/calendar may be used only for display hints, not destructive operations.

---

## 5. Requirement status vocabulary

| Status | Meaning |
|---|---|
| Implemented | Behavior exists and passes acceptance. |
| Partial | Behavior exists but lacks edge cases, tests, or documentation. |
| Planned | Approved scope, not implemented. |
| Deferred | Valid idea postponed to later track. |
| Rejected | Explicitly out of scope. |

---

## 6. Requirements

### 6.1 Platform requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-PLAT-001 | THE SYSTEM SHALL run as an Obsidian desktop plugin. | P0 | v0.1 | Partial |
| REQ-PLAT-002 | THE SYSTEM SHALL clearly communicate macOS-only support for early releases. | P0 | v0.1 | Partial |
| REQ-PLAT-003 | THE SYSTEM SHALL keep manifest metadata consistent with documentation. | P0 | v0.1 | Planned |
| REQ-PLAT-004 | IF the platform is unsupported, THE SYSTEM SHALL show an unsupported-platform message instead of crashing. | P0 | v0.1 | Planned |

### 6.2 Permission requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-PERM-001 | WHEN Calendar permission is unavailable or denied, THE SYSTEM SHALL show actionable recovery guidance. | P0 | v0.1 | Partial |
| REQ-PERM-002 | WHEN Reminders permission is unavailable or denied, THE SYSTEM SHALL show actionable recovery guidance. | P0 | v0.1 | Planned |
| REQ-PERM-003 | WHILE only one source is permitted, THE SYSTEM SHALL continue showing available data from the permitted source. | P0 | v0.1 | Planned |
| REQ-PERM-004 | THE SYSTEM SHALL distinguish permission failure from empty calendar/reminder data. | P0 | v0.1 | Planned |
| REQ-PERM-005 | THE SYSTEM SHALL provide a retry or refresh path after permission changes. | P1 | v0.2 | Planned |

### 6.3 Calendar read requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-CAL-001 | THE SYSTEM SHALL read events from macOS Calendar.app through local automation. | P0 | v0.1 | Partial |
| REQ-CAL-002 | THE SYSTEM SHALL display events for the selected date. | P0 | v0.1 | Partial |
| REQ-CAL-003 | THE SYSTEM SHALL display event title, start time, end time where available, and calendar name. | P0 | v0.1 | Partial |
| REQ-CAL-004 | THE SYSTEM SHALL display all-day events separately or before timed events. | P0 | v0.1 | Partial |
| REQ-CAL-005 | THE SYSTEM SHALL sort events by all-day status and start time. | P0 | v0.1 | Partial |
| REQ-CAL-006 | THE SYSTEM SHALL visually indicate ongoing and soon-starting events. | P1 | v0.1 | Partial |
| REQ-CAL-007 | THE SYSTEM SHALL display event location, link, notes, calendar source, and recurrence summary where available. | P1 | v0.2 | Planned |
| REQ-CAL-008 | THE SYSTEM SHALL support an expandable event detail state. | P1 | v0.2 | Planned |
| REQ-CAL-009 | THE SYSTEM SHALL display multi-day events on every overlapping day. | P1 | v0.2 | Planned |
| REQ-CAL-010 | THE SYSTEM SHALL visibly mark past events or hide them according to user settings. | P1 | v0.2 | Planned |
| REQ-CAL-011 | THE SYSTEM SHALL treat recurring events as read-only until recurring mutation is specified. | P0 | v0.1 | Planned |
| REQ-CAL-012 | THE SYSTEM SHOULD display source calendar colors where available. | P1 | v0.2 | Partial |

### 6.4 Reminder read requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-REM-001 | THE SYSTEM SHALL read incomplete reminders from macOS Reminders.app through local automation. | P0 | v0.1 | Partial |
| REQ-REM-002 | THE SYSTEM SHALL display reminders due on the selected date. | P0 | v0.1 | Partial |
| REQ-REM-003 | THE SYSTEM SHALL display reminder title and reminder list. | P0 | v0.1 | Partial |
| REQ-REM-004 | THE SYSTEM SHALL hide completed reminders by default. | P0 | v0.1 | Partial |
| REQ-REM-005 | THE SYSTEM SHALL visually distinguish overdue reminders. | P1 | v0.2 | Planned |
| REQ-REM-006 | THE SYSTEM SHALL display no-date reminders in a separate configurable section. | P1 | v0.2 | Planned |
| REQ-REM-007 | THE SYSTEM SHALL support display ranges: selected day, next 7 days, all incomplete. | P1 | v0.2 | Planned |
| REQ-REM-008 | THE SYSTEM SHOULD display reminder priority where available. | P2 | v0.2 | Planned |
| REQ-REM-009 | THE SYSTEM SHOULD display reminder subtasks where available. | P2 | v0.2 | Planned |

### 6.5 Source selection requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-SRC-001 | THE SYSTEM SHALL discover available macOS calendars. | P0 | v0.1 | Partial |
| REQ-SRC-002 | THE SYSTEM SHALL discover available macOS reminder lists. | P0 | v0.1 | Partial |
| REQ-SRC-003 | THE SYSTEM SHALL let users include or exclude individual calendars. | P0 | v0.1 | Partial |
| REQ-SRC-004 | THE SYSTEM SHALL let users include or exclude individual reminder lists. | P0 | v0.1 | Partial |
| REQ-SRC-005 | THE SYSTEM SHALL handle duplicate source names safely. | P1 | v0.2 | Planned |
| REQ-SRC-006 | THE SYSTEM SHALL show source discovery empty/error states. | P1 | v0.2 | Planned |

### 6.6 Cache and performance requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-CACHE-001 | THE SYSTEM SHALL preload a bounded date range for fast date switching. | P0 | v0.1 | Partial |
| REQ-CACHE-002 | THE SYSTEM SHALL define behavior when users select dates outside the cached range. | P0 | v0.1 | Planned |
| REQ-CACHE-003 | THE SYSTEM SHALL refresh source data on a configurable interval. | P0 | v0.1 | Partial |
| REQ-CACHE-004 | WHILE refreshing, THE SYSTEM SHALL avoid falsely showing an empty state before refresh completes. | P0 | v0.1 | Planned |
| REQ-CACHE-005 | THE SYSTEM SHALL clear refresh timers when the plugin unloads. | P0 | v0.1 | Partial |
| REQ-CACHE-006 | THE SYSTEM SHOULD provide manual refresh. | P1 | v0.2 | Planned |
| REQ-CACHE-007 | THE SYSTEM SHOULD display last refresh time. | P1 | v0.2 | Planned |
| REQ-CACHE-008 | THE SYSTEM SHOULD measure refresh duration for diagnostics. | P2 | v0.2 | Planned |
| REQ-PERF-001 | Date switching from cache SHOULD complete in under 100ms for normal datasets. | P1 | v0.1 | Planned |
| REQ-PERF-002 | Initial read SHOULD not block the Obsidian UI. | P0 | v0.1 | Planned |
| REQ-PERF-003 | Large calendars SHOULD degrade gracefully. | P1 | v0.2 | Planned |
| REQ-PERF-004 | Plugin unload SHALL not leave active intervals or detached DOM. | P0 | v0.1 | Partial |

### 6.7 UX requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-UX-001 | WHEN a user clicks a date, THE SYSTEM SHALL select that date and update the event/reminder panel. | P0 | v0.1 | Partial |
| REQ-UX-002 | WHEN a user Cmd/Ctrl-clicks a date, THE SYSTEM SHALL preserve open/create daily-note behavior. | P0 | v0.1 | Partial |
| REQ-UX-003 | THE SYSTEM SHALL show loading, empty, error, unsupported, and partial-permission states. | P0 | v0.1 | Partial |
| REQ-UX-004 | THE SYSTEM SHALL use Obsidian theme variables where possible. | P1 | v0.1 | Partial |
| REQ-UX-005 | THE SYSTEM SHOULD support event/reminder context menus only when actions are implemented safely. | P1 | v0.3 | Planned |
| REQ-UX-006 | THE SYSTEM SHOULD show calendar dots on month cells without harming navigation performance. | P1 | v0.2 | Planned |
| REQ-UX-007 | THE SYSTEM SHOULD support keyboard navigation and commands. | P2 | v0.6 | Planned |
| REQ-UX-008 | THE SYSTEM SHOULD support a compact and comfortable density option. | P2 | v0.6 | Planned |
| REQ-UX-009 | THE SYSTEM SHOULD provide copy-as-Markdown actions. | P2 | v0.5 | Planned |
| REQ-UX-010 | THE SYSTEM SHOULD support a today summary panel. | P2 | v0.2 | Planned |

### 6.8 Privacy and diagnostics requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-PRIV-001 | THE SYSTEM SHALL keep Calendar and Reminders data local by default. | P0 | v0.1 | Planned |
| REQ-PRIV-002 | THE SYSTEM SHALL NOT send event/reminder content to third-party services by default. | P0 | v0.1 | Planned |
| REQ-PRIV-003 | THE SYSTEM SHALL document what data is stored in Obsidian settings/frontmatter. | P0 | v0.1 | Planned |
| REQ-DIAG-001 | THE SYSTEM SHOULD expose diagnostic status without private event/reminder content by default. | P1 | v0.2 | Planned |
| REQ-DIAG-002 | THE SYSTEM SHOULD show Calendar and Reminders permission status. | P1 | v0.2 | Planned |
| REQ-DIAG-003 | THE SYSTEM SHOULD show source counts and last refresh status. | P1 | v0.2 | Planned |
| REQ-DIAG-004 | THE SYSTEM SHOULD redact diagnostics unless the user explicitly exports raw data. | P0 | v0.2 | Planned |

### 6.9 Error handling requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-ERR-001 | IF JXA execution fails due to permission, THE SYSTEM SHALL classify it as permission failure. | P0 | v0.1 | Partial |
| REQ-ERR-002 | IF JXA execution times out, THE SYSTEM SHALL show a timeout error and keep previous data if available. | P0 | v0.1 | Planned |
| REQ-ERR-003 | IF one event/reminder fails to parse, THE SYSTEM SHALL skip that item and continue rendering valid items. | P1 | v0.2 | Planned |
| REQ-ERR-004 | IF the source returns no data, THE SYSTEM SHALL show an empty state distinct from failure. | P0 | v0.1 | Planned |
| REQ-ERR-005 | IF a future write fails, THE SYSTEM SHALL not display false success. | P0 | v0.3 | Planned |
| REQ-ERR-006 | IF a future write partially succeeds, THE SYSTEM SHALL refresh from source of truth. | P0 | v0.3 | Planned |
| REQ-ERR-007 | IF a future delete is requested, THE SYSTEM SHALL require confirmation. | P0 | v0.4 | Planned |
| REQ-ERR-008 | IF a future edit targets unsupported recurrence, THE SYSTEM SHALL block or redirect safely. | P0 | v0.4 | Planned |

### 6.10 Write requirements, future releases

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-WRITE-001 | THE SYSTEM SHALL create simple non-recurring events only after user confirmation or explicit save. | P0 | v0.3 | Planned |
| REQ-WRITE-002 | THE SYSTEM SHALL validate event title, calendar, date, and time before creating an event. | P0 | v0.3 | Planned |
| REQ-WRITE-003 | THE SYSTEM SHALL refresh from Calendar.app after event creation. | P0 | v0.3 | Planned |
| REQ-WRITE-004 | THE SYSTEM SHOULD support event location and notes during creation. | P1 | v0.3 | Planned |
| REQ-WRITE-005 | THE SYSTEM SHALL NOT create recurring events until recurrence creation is specified. | P0 | v0.3 | Planned |
| REQ-WRITE-006 | THE SYSTEM SHALL create simple reminders only after user confirmation or explicit save. | P0 | v0.3 | Planned |
| REQ-WRITE-007 | THE SYSTEM SHALL validate reminder title and list before creating a reminder. | P0 | v0.3 | Planned |
| REQ-WRITE-008 | THE SYSTEM SHALL refresh from Reminders.app after reminder creation. | P0 | v0.3 | Planned |
| REQ-WRITE-009 | THE SYSTEM SHOULD support due date and due time during reminder creation. | P1 | v0.3 | Planned |
| REQ-WRITE-010 | THE SYSTEM SHOULD support priority during reminder creation where available. | P2 | v0.3 | Planned |
| REQ-WRITE-011 | THE SYSTEM SHALL edit simple non-recurring events with validation and safe refresh. | P0 | v0.4 | Planned |
| REQ-WRITE-012 | THE SYSTEM SHALL delete simple non-recurring events only after confirmation. | P0 | v0.4 | Planned |
| REQ-WRITE-013 | THE SYSTEM SHALL open unsupported events in Calendar.app when safe editing is unavailable. | P1 | v0.4 | Planned |
| REQ-WRITE-014 | THE SYSTEM SHALL record safe failure states for event edits/deletes. | P0 | v0.4 | Planned |
| REQ-WRITE-015 | THE SYSTEM SHALL not mutate events without a stable source identity. | P0 | v0.4 | Planned |
| REQ-WRITE-016 | THE SYSTEM SHALL mark reminders complete with safe refresh. | P0 | v0.4 | Planned |
| REQ-WRITE-017 | THE SYSTEM SHALL edit reminders with validation and safe refresh. | P0 | v0.4 | Planned |
| REQ-WRITE-018 | THE SYSTEM SHALL delete reminders only after confirmation. | P0 | v0.4 | Planned |
| REQ-WRITE-019 | THE SYSTEM SHALL not mutate reminders without a stable source identity. | P0 | v0.4 | Planned |
| REQ-WRITE-020 | THE SYSTEM SHOULD expose write operation result feedback. | P1 | v0.4 | Planned |

### 6.11 Recurring event safety requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-REC-001 | THE SYSTEM SHALL identify recurring events where possible. | P0 | v0.2 | Planned |
| REQ-REC-002 | THE SYSTEM SHALL treat recurring event mutation as unsupported until scope UX exists. | P0 | v0.3 | Planned |
| REQ-REC-003 | THE SYSTEM SHALL explain why recurring mutation is blocked. | P0 | v0.3 | Planned |
| REQ-REC-004 | THE SYSTEM SHALL offer explicit scope choices before editing recurring events. | P0 | Future | Planned |
| REQ-REC-005 | THE SYSTEM SHALL offer explicit scope choices before deleting recurring events. | P0 | Future | Planned |
| REQ-REC-006 | THE SYSTEM SHALL distinguish series identity from occurrence identity. | P0 | Future | Planned |
| REQ-REC-007 | THE SYSTEM SHALL document recurrence limitations. | P0 | v0.3 | Planned |
| REQ-REC-008 | THE SYSTEM SHALL test recurring edit/delete before enabling it by default. | P0 | Future | Planned |

### 6.12 Note association requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-NOTE-001 | THE SYSTEM SHALL associate events with notes using stable frontmatter metadata. | P0 | v0.5 | Planned |
| REQ-NOTE-002 | THE SYSTEM SHALL associate reminders with notes using stable frontmatter metadata. | P0 | v0.5 | Planned |
| REQ-NOTE-003 | THE SYSTEM SHALL show associated note links in event/reminder details. | P0 | v0.5 | Planned |
| REQ-NOTE-004 | THE SYSTEM SHALL handle missing or renamed notes safely. | P0 | v0.5 | Planned |
| REQ-NOTE-005 | THE SYSTEM SHALL create a note from an event/reminder using a template. | P0 | v0.5 | Planned |
| REQ-NOTE-006 | THE SYSTEM SHALL support template variables for title, date, time, calendar/list, and location where available. | P1 | v0.5 | Planned |
| REQ-NOTE-007 | THE SYSTEM SHOULD insert associated event/reminder links into daily notes. | P1 | v0.5 | Planned |
| REQ-NOTE-008 | THE SYSTEM SHOULD repair stale associations where possible. | P2 | v0.5 | Planned |
| REQ-NOTE-009 | THE SYSTEM SHOULD support copy-as-Markdown for events/reminders. | P2 | v0.5 | Planned |
| REQ-NOTE-010 | THE SYSTEM SHOULD support meeting-note templates. | P1 | v0.5 | Planned |

### 6.13 Tasks integration requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-TASK-001 | THE SYSTEM SHOULD parse Obsidian Tasks-compatible dates in notes. | P2 | v0.5 | Planned |
| REQ-TASK-002 | THE SYSTEM SHOULD support manual export of selected tasks to Reminders. | P2 | v0.5 | Planned |
| REQ-TASK-003 | THE SYSTEM SHALL NOT enable automatic two-way Tasks/Reminders sync until identity and conflict strategy are specified. | P0 | v0.5 | Planned |
| REQ-TASK-004 | THE SYSTEM SHALL avoid duplicate reminder creation during task export. | P0 | v0.5 | Planned |

### 6.14 Advanced view/search/statistics requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-VIEW-001 | THE SYSTEM SHOULD provide a vertical timeline view. | P1 | v0.6 | Planned |
| REQ-VIEW-002 | Timeline event height SHOULD reflect duration. | P1 | v0.6 | Planned |
| REQ-VIEW-003 | Timeline SHOULD display current-time indicator. | P2 | v0.6 | Planned |
| REQ-VIEW-004 | Timeline SHOULD use calendar source colors. | P1 | v0.6 | Planned |
| REQ-VIEW-005 | THE SYSTEM SHOULD provide a week view. | P1 | v0.6 | Planned |
| REQ-VIEW-006 | Week view SHOULD use the same filtering and cache model as day view. | P1 | v0.6 | Planned |
| REQ-SEARCH-001 | THE SYSTEM SHOULD search events/reminders across the cache range. | P1 | v0.6 | Planned |
| REQ-SEARCH-002 | Search SHOULD match title, calendar/list, location, notes, and associated note title where available. | P1 | v0.6 | Planned |
| REQ-SEARCH-003 | Search SHOULD support date range filtering. | P2 | v0.6 | Planned |
| REQ-SEARCH-004 | Search SHALL not query external services by default. | P0 | v0.6 | Planned |
| REQ-SEARCH-005 | Search results SHOULD clearly distinguish events from reminders. | P1 | v0.6 | Planned |
| REQ-STATS-001 | THE SYSTEM SHOULD provide basic event count statistics by day/week/month. | P2 | v0.6 | Planned |
| REQ-STATS-002 | THE SYSTEM SHOULD group statistics by calendar source. | P2 | v0.6 | Planned |
| REQ-STATS-003 | THE SYSTEM SHOULD generate Markdown summaries. | P3 | v0.6 | Planned |
| REQ-STATS-004 | THE SYSTEM SHALL compute statistics locally. | P0 | v0.6 | Planned |

### 6.15 Cross-platform requirements, deferred

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-XPLAT-001 | Cross-platform support SHALL have a separate architecture proposal before implementation. | P0 | v1.x | Deferred |
| REQ-XPLAT-002 | Direct Microsoft Graph support SHALL define authentication, token storage, privacy, and revoke flows. | P0 | v1.x | Deferred |
| REQ-XPLAT-003 | Android support SHALL not be coupled to macOS JXA code. | P0 | v1.x | Deferred |
| REQ-XPLAT-004 | External API integrations SHALL be opt-in. | P0 | v1.x | Deferred |
| REQ-XPLAT-005 | External API integrations SHALL have separate acceptance and test matrices. | P0 | v1.x | Deferred |

### 6.16 Documentation and architecture requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-DOC-001 | README SHALL distinguish current, planned, experimental, and non-goal features. | P0 | v0.1 | Planned |
| REQ-DOC-002 | Roadmap SHALL reference requirement groups or IDs. | P0 | v0.1 | Planned |
| REQ-DOC-003 | Target architecture SHALL be labeled as target until code is refactored. | P0 | v0.1 | Planned |
| REQ-ARCH-001 | THE SYSTEM SHOULD split JXA integration, rendering, settings, sync, and note-link logic into maintainable modules before complex write features. | P1 | v0.3 | Planned |

---

## 7. Target architecture

Current implementation may be bundled. This is the target architecture, not a claim that all files already exist.

```text
calendian/
├── main.js                      # plugin entry, view registration, lifecycle
├── src/
│   ├── macos/
│   │   ├── calendar-reader.ts   # Calendar.app JXA read adapter
│   │   ├── reminder-reader.ts   # Reminders.app JXA read adapter
│   │   ├── writer.ts            # future write adapter, safety-gated
│   │   └── permissions.ts       # permission/error classification
│   ├── domain/
│   │   ├── event.ts             # internal event model
│   │   ├── reminder.ts          # internal reminder model
│   │   └── association.ts       # note association model
│   ├── cache/
│   │   └── schedule-cache.ts
│   ├── ui/
│   │   ├── calendar-panel.ts
│   │   ├── event-list.ts
│   │   ├── reminder-list.ts
│   │   ├── details-panel.ts
│   │   └── settings-tab.ts
│   ├── notes/
│   │   ├── frontmatter.ts
│   │   └── templates.ts
│   └── diagnostics/
│       └── diagnostics.ts
├── styles.css
├── manifest.json
└── docs/sdd/
```

---

## 8. Release policy

A version may be released only when:

1. all P0 requirements for that version pass acceptance;
2. README reflects the current status;
3. risk register is reviewed;
4. manual test suites for the version pass;
5. known limitations are documented.

---

## 9. Open specification questions

These must be resolved before the related release:

1. What stable identifiers are available from Calendar.app and Reminders.app through JXA across macOS versions?
2. How should duplicate calendar/list names be represented in settings?
3. What should happen when selected date is outside the preload cache range?
4. Should source filtering persist by name, id, or compound identity?
5. Should single-click date behavior be configurable for users migrating from the original Calendar plugin?
6. What exact recurrence operations are safe through JXA?
7. What diagnostic fields can be shown without exposing private data?
