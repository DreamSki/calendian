# Requirement-Driven Task Backlog

> Status: living task backlog  
> Last updated: 2026-06-08

Tasks are ordered by dependency and release target. Every task references requirement IDs from `SPEC.md` and acceptance gates from `ACCEPTANCE.md`.

## Task status vocabulary

| Status | Meaning |
|---|---|
| Todo | Not started. |
| In progress | Implementation or documentation work has started. |
| Blocked | Cannot proceed until dependency is resolved. |
| Review | Implementation complete, awaiting verification. |
| Done | Code/docs/tests/status updates complete. |

## v0.1 — Read-only MVP

### TASK-001 — Align packaging and compatibility metadata

- Requirements: `REQ-PLAT-001`, `REQ-PLAT-002`, `REQ-PLAT-003`
- Status: Done
- Priority: P0
- Deliverables:
  - Align plugin name, id, description, version, and minimum Obsidian version.
  - Decide whether existing `calendar-macos-sync` id is temporary or permanent.
  - Document desktop-only/macOS-only behavior.
- Definition of Done:
  - README, SPEC, ROADMAP, and `manifest.json` do not contradict each other.
- Evidence: `manifest.json` id=calendian, name=Calendian. Folder renamed from `calendar-macos-sync` to `calendian`. VIEW_TYPE_CALENDAR updated.

### TASK-002 — Permission state model and recovery UI

- Requirements: `REQ-PERM-001` to `REQ-PERM-005`, `REQ-ERR-001`
- Status: Done
- Priority: P0
- Evidence: `MacOSIntegration.permissionState`, `.lastError`, `.isLoading` — independent per-source states. `renderPermissionBanner()` with System Settings guidance and retry button. `classifyError()` distinguishes permission_denied/timeout/error. Code at main.js:4464-4476, 5232-5256.

### TASK-003 — Harden Calendar read model

- Requirements: `REQ-CAL-001` to `REQ-CAL-006`
- Status: Done
- Priority: P0
- Evidence: EventKit helper provides stable UUID event IDs, all-day detection, calendar colors. `preloadAll()` maps helper JSON to CalendianEvent model. Display includes title, time range, calendar badge with color, ongoing/soon highlights. Code at main.js:4699-4757.

### TASK-004 — Harden Reminders read model

- Requirements: `REQ-REM-001` to `REQ-REM-004`
- Status: Done
- Priority: P0
- Evidence: EventKit helper provides stable reminder IDs, priority, completion state. `preloadReminders()` maps to CalendianReminder model. Completed reminders filtered. Priority displayed in UI. Code at main.js:4759-4804.

### TASK-005 — Source discovery and filtering

- Requirements: `REQ-SRC-001` to `REQ-SRC-006`
- Status: Done
- Priority: P0
- Evidence: `discoverCalendars()` and `discoverReminderLists()` use EventKit helper. Account name disambiguation ("日历 — iCloud"). Filter by stable UUID with backward-compat. Empty/error states handled. Instant in-memory filter apply via `render()`. Code at main.js:5400-5454, 977-1077.

### TASK-006 — Cache lifecycle and refresh

- Requirements: `REQ-CACHE-001` to `REQ-CACHE-008`, `REQ-PERF-001` to `REQ-PERF-004`
- Status: Done
- Priority: P0
- Evidence: Disk cache save/load for events and reminders. Cache freshness check (2x interval, min 15min). Two-phase init (cache-first then background refresh). Manual refresh button. Last refresh time in footer. Anti-concurrent guard. Timer cleanup on unload. Code at main.js:4568-4669, 4965-5041, 5456-5471.

### TASK-007 — Sidebar UX states

- Requirements: `REQ-UX-001` to `REQ-UX-004`, `REQ-ERR-002` to `REQ-ERR-004`
- Status: Done
- Priority: P0
- Evidence: `render()` handles: loading, empty, error, permission-denied, partial-permission, cache-miss, unsupported-platform. Date click selects + updates panel. Cmd/Ctrl-click preserves daily-note. All states use Obsidian theme variables. Code at main.js:5098-5229.

### TASK-008 — Privacy and diagnostics baseline

- Requirements: `REQ-PRIV-001` to `REQ-PRIV-002`, `REQ-DIAG-001`
- Status: Done
- Priority: P1
- Evidence: Privacy section in settings tab documents local-only behavior. Diagnostic panel in settings shows plugin version, platform, helper status, permissions, source counts, cache stats, refresh timing, and error classification (REQ-DIAG-001). Export and redaction deferred to v0.2 (REQ-DIAG-002). Code at main.js:833-879.
- Remaining: Diagnostic export with consent and redaction (REQ-DIAG-002, v0.2).

### TASK-009 — Error classification and recovery

- Requirements: `REQ-ERR-001` to `REQ-ERR-004`
- Status: Done
- Priority: P0
- Evidence: `classifyError()` for permission_denied/timeout/error. Per-source error banners with retry. Parse-failure isolation in `parseEvents()`/`parseReminders()`. Empty vs error distinction. Old cache retained on refresh failure. Code at main.js:4515-4526, 5232-5256.

## v0.2 — Read-only polish

### TASK-010 — Event details panel

- Requirements: `REQ-CAL-007`, `REQ-CAL-008`, `REQ-UX-005`
- Status: Done
- Priority: P1
- Deliverables:
  - Expandable event details.
  - Location/link/notes/recurrence summary where available.
- Evidence: `renderEventsSection()` at main.js~5325. Click-to-expand with `_expandedEvents` Set. Detail panel shows location, URL, notes, attendees, calendar source, recurrence summary.

### TASK-011 — Multi-day and past event behavior

- Requirements: `REQ-CAL-009`, `REQ-CAL-010`, `REQ-CAL-011`
- Status: Done
- Priority: P1
- Evidence: `getEventsForDate()` uses overlap-based filter for multi-day events. `pastEventDisplay` setting (normal/dimmed/hidden) with `calendian-event-past` CSS class. Recurring indicator (⟳) in title row.

### TASK-012 — Reminder polish

- Requirements: `REQ-REM-005` to `REQ-REM-009`
- Status: Done
- Priority: P1
- Deliverables:
  - Overdue styling.
  - No-date section.
  - Display range selector.
  - Priority and subtasks where supported.
- Evidence: Overdue reminders visually distinguished (red border + badge + due date). No-date reminders in collapsible section. Display range selector (today / 7 days / all incomplete). Subtask rendering ready (data-dependent — helper parentId not yet populated). Code at main.js `renderRemindersSection()`.

### TASK-013 — Month cell event dots

- Requirements: `REQ-UX-006`, `REQ-PERF-002`
- Status: Done
- Priority: P1
- Evidence: Calendar-colored dots on month cells showing event presence per calendar. Hollow reminder dot. Multi-day event span support. Uses in-memory cache only (no helper calls). Respects source filters. Dynamic CSS injection for per-calendar colors. Code at main.js `renderMonthDots()`.

### TASK-014 — Manual refresh and diagnostics panel

- Requirements: `REQ-DIAG-001` to `REQ-DIAG-002`, `REQ-CACHE-006`
- Status: Done
- Priority: P1
- Evidence: REQ-DIAG-001 diagnostic panel in settings (main.js:833-888). REQ-DIAG-002 export with consent modal (`ExportConsentModal` at main.js:1360-1468) redacts titles, notes, locations, URLs, attendee names, calendar UUIDs, helper paths, and error messages. Copies redacted JSON to clipboard via `navigator.clipboard.writeText()`. Error messages reduced to type+timestamp only. Event/reminder counts by calendar/list name included (counts only, no content). Code at main.js:880-889, 1360-1468.

## v0.3 — Safe create

### TASK-019 — Code split into src/ modules (REQ-ARCH-001)

- Requirements: `REQ-ARCH-001`
- Status: Done
- Priority: P1
- Evidence: `build-main.sh` produces valid `main.js` (8451 lines). Concatenation order verified: upstream → MacOSIntegration skeleton → `src/macos/helper-executor.js` (7 prototype methods: execHelper, classifyError, execJXA, isPermissionError, startAutoRefresh, stopAutoRefresh, destroy) → `src/cache/schedule-cache.js` (13 prototype methods: cache I/O, preload, date queries) → CalendarView → CalendarPlugin. 20/20 EXTRACTED markers match 20/20 prototype methods. No duplicate definitions. All key non-extracted methods (init, render, discoverCalendars, startWatch, etc.) remain in class body.

### TASK-020 — Event create form

- Requirements: `REQ-WRITE-001` to `REQ-WRITE-005`
- Status: Done
- Priority: P0
- Evidence: `EventCreateModal` class at main.js ~1549. Fields: title (required), calendar selector (dropdown from discoverCalendars), start/end date, start/end time, all-day toggle, location, URL, notes. Validates title + calendar before calling `integ.execHelper(["create-event", ...])`. Shows error banner on failure, calls `integ.init(true)` to refresh on success.

### TASK-021 — Reminder create form

- Requirements: `REQ-WRITE-006` to `REQ-WRITE-010`
- Status: Done
- Priority: P0
- Evidence: `ReminderCreateModal` class at main.js ~1710. Fields: title (required), list selector (dropdown from discoverReminderLists), due date, due time, priority (none/low/medium/high), notes. Validates title + list before create. Post-create refresh.

### TASK-022 — Write confirmation and refresh verification

- Requirements: `REQ-WRITE-003`, `REQ-WRITE-008`, `REQ-ERR-005` to `REQ-ERR-006`
- Status: Done
- Priority: P0
- Evidence: Both modals show `new obsidian.Notice("Event/Reminder created: ...")` on success. Error display via `.calendian-form-error` div with red styling. Post-create `init(true)` call refreshes cache from EventKit.

### TASK-022a — Default calendar/list settings for create form

- Requirements: `REQ-UX-011`
- Status: Done
- Priority: P2
- Evidence: `defaultCalendarId` and `defaultReminderListId` in defaultSettings. Settings tab dropdowns populated from `discoverCalendars()`/`discoverReminderLists()`. Create modals read saved preference first, fall back to auto-detect (Outlook). Calendar IDs stored in `data.json` (gitignored).

### TASK-023 — Natural language event creation

- Requirements: `REQ-NL-001` to `REQ-NL-005`
- Status: Done
- Priority: P1
- Evidence: `parseNaturalLanguage()` English + expanded Chinese (compact dates: YYMMDD, X月Y日/号, Chinese numerals, 明早/明晚/今早/今晚, 周末, 下下周; relative: X天后/周后/月后, 下个月/明年; times: 凌晨/N点一刻/三刻; duration: X小时Y分钟/一个半小时; helpers: mapCnNumber, stripOrphanPeriodHints, addMinutesToTime). `QuickEventModal` (⚡) with live regex preview (300ms debounce) + dual "→ Event"/"→ Reminder" buttons. EventCreateModal and ReminderCreateModal accept optional `prefill` parameter. Code in main.js.

### TASK-023a — AI-powered NL parsing (optional)

- Requirements: `REQ-NL-001` (enhanced accuracy path)
- Status: Done
- Priority: P2
- Evidence: `callAIForParsing()` with AbortController (10s timeout + cancel-on-type). Compact system prompt. `response_format: json_object`. Dual-strategy JSON extraction. Settings: `aiParsingEnabled`, `aiEndpoint`, `aiApiKey`, `aiModel`. Enter-key trigger only (never auto). Two-tier result: `_aiResult` (locked after Enter, cleared on new input) + `_parsedResult` (live regex). Collapsible raw AI JSON in preview. Console timing log. Privacy note in settings UI. API key in gitignored data.json.

### TASK-024 — Recurring event safety UX (REQ-REC-002/003/007)

- Requirements: `REQ-REC-002`, `REQ-REC-003`, `REQ-REC-007`
- Status: Todo
- Priority: P0
- Deliverables:
  - Detect recurring events on edit/delete entry points and block the operation with a clear message.
  - Explain why recurring editing is blocked (one-sentence: "重复事件编辑涉及整体系列/单次发生的选择，请在 Calendar.app 中操作").
  - Document recurrence limitations in SPEC.md, README, and user-facing UI.
  - Recurrence classification model already documented in SPEC.md §5.1 and §7.11.1.
- Definition of Done:
  - Edit/delete entry points check `isRecurring` flag → if true, show safe block dialog with reason.
  - User can click "Open in Calendar.app" to handle the event natively.
  - Limitation documented in README Planned / Known limitations section.

### TASK-025 — Subtask display (REQ-REM-009)

- Requirements: `REQ-REM-009`
- Status: Blocked (Apple API limitation)
- Priority: P2
- Evidence: EKReminder has no public `parent` or `subtask` property in EventKit headers (verified in EKReminder.h). Subtask hierarchy is iCloud-internal and not exposed to third-party apps. JS rendering code for indentation exists but helper cannot populate `parentId`. All reminders are displayed as independent items per SPEC.md §7.4.1.

### TASK-026 — Window focus refresh (REQ-SYNC-004)

- Requirements: `REQ-SYNC-004`
- Status: Done
- Priority: P1
- Evidence: `window.addEventListener('focus', this._handleWindowFocus)` in CalendarView.onOpen; handler calls `init()` only if `isCacheFresh()` returns false; listener removed in onClose.
- Deliverables:
  - Add `window.onfocus` handler that calls `init()` if cache is stale.
  - Use `isCacheFresh()` to avoid unnecessary refreshes (don't refresh if cache is still fresh).
  - Clean up the handler on plugin unload.
- Definition of Done:
  - Switch away from Obsidian → wait → switch back → panel auto-refreshes if cache stale.
  - Does not trigger refresh if cache is fresh.
  - Handler cleaned up on unload, no memory leak.

### TASK-027 — Permission retry path (REQ-PERM-005)

- Requirements: `REQ-PERM-005`
- Status: Done
- Priority: P1
- Evidence: Retry button already exists in `renderPermissionBanner()` at main.js:7413 — calls `this.init()` which re-runs `preloadAll()`/`preloadReminders()` and re-detects permission state. SPEC table was stale.
- Deliverables:
  - When permission is denied, show a "Check Permissions" button that re-invokes `init()`.
  - After user grants permission in System Settings, retry should pick up the new state.
- Definition of Done:
  - Permission banner includes actionable retry button.
  - Retry correctly detects newly granted permission.

### TASK-028 — Display-only marking for unstable IDs (REQ-DATA-003/004)

- Requirements: `REQ-DATA-003`, `REQ-DATA-004`
- Status: Done
- Priority: P0
- Evidence: `isDisplayOnly` flag set in `preloadAll()` and `preloadReminders()` when id is missing or doesn't match UUID pattern (`/^[A-F0-9-]{30,}$/i`). Flag persisted in disk cache (saveEventsToCache/saveRemindersToCache) and restored on load. Enforcement in edit/delete/note-association entry points deferred to v0.4 (no mutation paths exist in v0.3 beyond create).

### TASK-029a — EK notification watch (REQ-SYNC-005/007)

- Requirements: `REQ-SYNC-005`, `REQ-SYNC-007`
- Status: Done
- Priority: P1
- Evidence: Helper `watch` command subscribes `EKEventStoreChanged` via `NotificationCenter.default.notifications` with 1s debounce, writes ISO timestamp to signal file. JS `startWatch()` spawns detached process in `onOpen`, polls signal file every 2s, calls `refreshInBackground()` on change. `stopWatch()` cleans up process + timer in `destroy()`. Watch exit logs warning and falls back to timer-based refresh.

### TASK-029 — Concurrent refresh+write safety (REQ-SYNC-008)

- Requirements: `REQ-SYNC-008`
- Status: Done
- Priority: P0
- Evidence: `initBackground(initStart, force)` parameter added — force=true (post-write) bypasses `_refreshRunning` guard. Timer refresh (`refreshInBackground`) respects guard and backs off when force refresh is running. No data loss possible — concurrent EventKit reads are idempotent.

## v0.4 — Safe edit/delete

### TASK-030 — Recurring event safety model

- Requirements: `REQ-REC-001` to `REQ-REC-008`
- Status: Todo
- Priority: P0

### TASK-031 — Event edit/delete

- Requirements: `REQ-WRITE-011` to `REQ-WRITE-015`
- Status: Todo
- Priority: P0

### TASK-032 — Reminder edit/delete/complete

- Requirements: `REQ-WRITE-016` to `REQ-WRITE-020`
- Status: Todo
- Priority: P0

## v0.5 — Note association and Tasks integration

### TASK-040 — Frontmatter association schema

- Requirements: `REQ-NOTE-001` to `REQ-NOTE-004`
- Status: Todo
- Priority: P0

### TASK-041 — Create/open associated notes

- Requirements: `REQ-NOTE-005` to `REQ-NOTE-008`
- Status: Todo
- Priority: P0

### TASK-042 — Template variables and daily note summary

- Requirements: `REQ-NOTE-009`, `REQ-NOTE-010`
- Status: Todo
- Priority: P1

### TASK-043 — In-app notifications

- Requirements: `REQ-NOTIF-001` to `REQ-NOTIF-005`
- Status: Todo
- Priority: P1
- Deliverables:
  - Event-start notifications with configurable lead time.
  - Overdue reminder notifications.
  - Notification enable/disable settings.
  - Graceful degradation when Obsidian notification APIs are unavailable.

### TASK-050 — Tasks plugin import/export experiment

- Requirements: `REQ-TASK-001` to `REQ-TASK-004`
- Status: Todo
- Priority: P2

## v0.5.5 — Self-direction

### TASK-090 — Goal definition and step tracking

- Requirements: `REQ-GOAL-001` to `REQ-GOAL-005`, `REQ-GOAL-008`
- Status: Todo
- Priority: P0
- Deliverables:
  - Goal creation UI stored in Obsidian (note/frontmatter), not Calendar.app or Reminders.app.
  - Break goals into ordered actionable steps.
  - Single-action step completion with progress reflection.
  - Current focus declaration for a week or phase.
  - Current focus surfaced prominently in panel.
  - Local-only data; no external services.

### TASK-091 — Goal lifecycle management

- Requirements: `REQ-GOAL-006`, `REQ-GOAL-007`
- Status: Todo
- Priority: P1
- Deliverables:
  - Link goals to events/reminders/notes via stable association metadata.
  - Pause or archive goals without deleting history.
  - Goal status transitions (active → paused → archived → active).

### TASK-095 — Habit definition and completion

- Requirements: `REQ-HABIT-001` to `REQ-HABIT-004`, `REQ-HABIT-010`
- Status: Todo
- Priority: P0
- Deliverables:
  - Habit creation UI stored in Obsidian only.
  - Single-action daily habit completion recording.
  - Progress displayed as consistency rate (appearance days / total days), not unbroken streak.
  - No progress reset to zero on a single missed period.
  - No Reminders.app dependency.

### TASK-096 — Habit restart and minimum viable version

- Requirements: `REQ-HABIT-005` to `REQ-HABIT-009`
- Status: Todo
- Priority: P1
- Deliverables:
  - Configurable miss threshold before low-friction restart prompt.
  - Minimum-viable habit version support for low-energy days.
  - Scheduled rest period marking (not counted as misses).
  - Habit history visualization emphasizing presence over perfection.
  - Edit or retire habits without losing history.

### TASK-100 — Nudge system

- Requirements: `REQ-NUDGE-001` to `REQ-NUDGE-009`
- Status: Todo
- Priority: P1
- Deliverables:
  - Daily intention prompt (once per day).
  - Optional gentle end-of-day check-in.
  - Re-engagement prompt framed as restart after goal/habit lapse.
  - "Start now for N minutes" quick action.
  - Configurable tone (gentle / neutral / firm).
  - Configurable frequency with full disable option.
  - Default language must not use shaming/punitive/guilt-inducing phrasing.
  - In-panel degradation when Obsidian notification APIs are unavailable.
  - Local-only; no behavioral data sent externally.

### TASK-105 — Daily and weekly reviews

- Requirements: `REQ-REVIEW-001` to `REQ-REVIEW-007`
- Status: Todo
- Priority: P1
- Deliverables:
  - Daily reflection generated from template with day's events, completed items, and intention.
  - Weekly review summarizing completed steps, habit consistency, and current focus.
  - Template variables: intention, completed items, missed items, next focus.
  - Completed items surfaced before missed items in output.
  - Unfinished focus carried forward without penalty.
  - Review notes linked to goals/habits/events via stable metadata.
  - Local computation only; no reflection content sent externally.

### TASK-110 — Encouragement statistics

- Requirements: `REQ-STATS-001` to `REQ-STATS-006`
- Status: Todo
- Priority: P1
- Deliverables:
  - Step/habit completion count over configurable window.
  - Consistency rate display (appearance days / total days), not streak-based.
  - Current focus surfaced alongside progress metrics.
  - Small-wins count displayed before gap/miss analysis.
  - Progress summaries emphasizing presence and consistency.
  - Local computation only.

## v0.6 — Advanced views, search, and export

### TASK-060 — Timeline view

- Requirements: `REQ-VIEW-001` to `REQ-VIEW-004`
- Status: Todo
- Priority: P1

### TASK-061 — Week view

- Requirements: `REQ-VIEW-005`, `REQ-VIEW-006`
- Status: Todo
- Priority: P1

### TASK-070 — Global search

- Requirements: `REQ-SEARCH-001` to `REQ-SEARCH-005`
- Status: Todo
- Priority: P1

### TASK-075 — Data export

- Requirements: `REQ-EXPORT-001` to `REQ-EXPORT-004`
- Status: Todo
- Priority: P1
- Deliverables:
  - Export selected date range as Markdown.
  - Export data as JSON for backup.
  - Include all event fields in export.
  - Local-only; no external services.

### TASK-076 — UI customization

- Requirements: `REQ-UI-001` to `REQ-UI-004`
- Status: Todo
- Priority: P2
- Deliverables:
  - Compact and comfortable density options.
  - Configurable event field display.
  - Theme-aware styling.

## Future platform track

### TASK-100 — Cross-platform architecture proposal

- Requirements: `REQ-XPLAT-001` to `REQ-XPLAT-005`
- Status: Deferred
- Priority: P3
- Notes: Microsoft Graph / Android support requires separate auth, storage, privacy, and sync specifications.
