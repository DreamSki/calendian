# Testing Strategy

> Status: normative testing document  
> Last updated: 2026-06-07

Calendian testing is requirement-driven. Every P0 requirement must have a documented acceptance test before release. Automated tests should be added where feasible, but manual tests are required for macOS permission, Calendar, Reminders, and Obsidian UI behavior.

## Supported test matrix

| Dimension | Required cases |
|---|---|
| macOS | 12+, latest available macOS used by maintainers |
| Obsidian | minimum supported version, latest stable desktop version |
| Calendar accounts | local calendar, iCloud, Google via macOS Calendar, Exchange/Outlook via macOS Calendar where available |
| Reminder lists | local list, iCloud list, no-date reminders, overdue reminders |
| Permissions | Calendar allowed, Calendar denied, Reminders allowed, Reminders denied, both denied, partial access |
| Data volume | empty calendar, small calendar, large calendar with 1k+ events in cache range |
| Event shapes | timed, all-day, multi-day, recurring, event with location, event with URL, event with notes |
| Reminder shapes | due date only, due date + time, no due date, overdue, priority, subtasks where supported |

## Manual test suites

### TS-001 — Plugin lifecycle

Requirements: `REQ-PLAT-001`, `REQ-ERR-001`, `REQ-PERF-004`

1. Install plugin manually in a test vault.
2. Enable plugin.
3. Confirm the calendar view opens in the sidebar.
4. Disable plugin.
5. Confirm timers and UI panel are removed without errors.

### TS-002 — Permission handling

Requirements: `REQ-PERM-001` through `REQ-PERM-005`

1. Start from a clean macOS Automation permission state if possible.
2. Open plugin and grant Calendar but deny Reminders.
3. Confirm Calendar data can load and Reminders failure is shown safely.
4. Repeat with Reminders granted and Calendar denied.
5. Deny both and confirm no crash.
6. Re-enable permissions in System Settings and confirm retry/refresh works.

### TS-003 — Calendar read display

Requirements: `REQ-CAL-001` through `REQ-CAL-009`

Create fixture events:

- one timed event today;
- one all-day event today;
- one event starting within 30 minutes;
- one currently ongoing event;
- one past event;
- one multi-day event;
- one recurring event;
- one event with location/link/notes.

Expected:

- correct sorting;
- correct time formatting;
- correct all-day placement;
- correct status styling;
- no data mutation.

### TS-004 — Reminder read display

Requirements: `REQ-REM-001` through `REQ-REM-008`

Create fixture reminders:

- due today;
- overdue;
- due in 7 days;
- no due date;
- completed reminder;
- high priority reminder if supported.

Expected:

- incomplete reminders are shown;
- completed reminders are hidden by default;
- overdue and no-date behavior matches display settings;
- list badge is shown.

### TS-005 — Source discovery and filtering

Requirements: `REQ-SRC-001` through `REQ-SRC-006`

1. Discover calendars.
2. Toggle one calendar off.
3. Confirm events from that calendar are hidden after refresh.
4. Toggle all back on.
5. Repeat for Reminder lists.

### TS-006 — Cache and refresh

Requirements: `REQ-CACHE-001` through `REQ-CACHE-008`

1. Load plugin with known events in range.
2. Change selected dates rapidly.
3. Confirm UI remains responsive.
4. Add event in Calendar.app.
5. Wait refresh interval or trigger manual refresh when implemented.
6. Confirm new event appears.
7. Navigate outside cache range and confirm documented behavior.

### TS-007 — Create operations, future v0.3

Requirements: `REQ-WRITE-001` through `REQ-WRITE-010`

1. Create simple event.
2. Confirm event appears in Calendar.app.
3. Confirm plugin refresh shows event.
4. Create simple reminder.
5. Confirm reminder appears in Reminders.app.
6. Force write failure and confirm safe rollback.

### TS-008 — Edit/delete operations, future v0.4

Requirements: `REQ-WRITE-011` through `REQ-WRITE-020`

1. Edit simple non-recurring event.
2. Delete simple non-recurring event after confirmation.
3. Attempt recurring event edit/delete.
4. Confirm safe block or explicit scope selection.
5. Mark reminder complete.
6. Confirm Reminders.app state matches.

### TS-009 — Note association, future v0.5

Requirements: `REQ-NOTE-001` through `REQ-NOTE-010`

1. Associate event with existing note.
2. Create note from event template.
3. Rename associated note.
4. Delete associated note.
5. Confirm plugin handles broken references safely.

## Future automated test targets

| Area | Suggested automation |
|---|---|
| Data parsing | Unit tests for event/reminder raw JXA parse output. |
| Time overlap | Unit tests for day filtering, all-day, multi-day, DST boundaries. |
| Formatting | Unit tests for time ranges and duration labels. |
| Settings migration | Unit tests for data.json shape changes. |
| Frontmatter association | Unit tests for write/read/repair logic. |
| Error classification | Unit tests for permission, timeout, parse, and unsupported-platform errors. |

## Test data policy

- Do not commit real calendar, reminder, attendee, or location data.
- Use synthetic fixture names.
- Diagnostics exports must redact private fields by default.
