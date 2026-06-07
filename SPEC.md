# Calendian Specification

> Status: authoritative product specification  
> Version target: v0.3 / safe create — nearly complete  
> Last updated: 2026-06-08  
> Plugin ID: `calendian`  
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
- [`docs/PRIVACY.md`](./docs/PRIVACY.md) — privacy model and data handling
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — target architecture and module boundaries
- [`docs/SETTINGS_SCHEMA.md`](./docs/SETTINGS_SCHEMA.md) — settings data structure and migration
- [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) — per-release execution checklist

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

The current repository must be treated as **v0.2 / read-only polish — complete**. Feature claims in README and release notes must match `docs/sdd/CURRENT_STATUS.md`.

---

## 2. Current implementation status

### 2.1 Implemented (v0.1–v0.2)

The following features are currently implemented in the codebase. All macOS data access goes through a native Swift EventKit helper binary (`calendian-helper`, source at `helper/Sources/main.swift`). A legacy JXA path (`execJXA`) remains in code but is no longer the primary data channel.

#### Data channel
- ✅ Native Swift EventKit helper (`calendian-helper`) — sub-100ms reads via `EKEventStore`
- ✅ Helper supports 8 commands: `calendars`, `lists`, `events`, `reminders`, `permissions`, `request-events`, `request-reminders`, `toggle-reminder`
- ✅ Legacy JXA path (`execJXA`) retained but unused by primary data flows

#### Platform and permissions
- ✅ Obsidian desktop plugin shell (`manifest.json` isDesktopOnly)
- ✅ macOS-only detection (`isMacOS()` check) with graceful non-macOS message
- ✅ Independent Calendar/Reminders permission states (`permissionState.calendar`, `.reminders`) with recovery UI and retry
- ✅ Partial permission support (show available data + banner for denied source)
- ✅ Error classification: `permission_denied`, `timeout`, `error`

#### Calendar reading
- ✅ Event title, start/end time, calendar name, account name
- ✅ All-day event detection and display (all-day first, then timed)
- ✅ Event sorting (all-day first, then by start time)
- ✅ Calendar source discovery with UUID, account name, color
- ✅ Stable event identity (`EKEvent.eventIdentifier`, UUID-based)
- ✅ Event location and recurrence summary displayed in UI
- ✅ URL, notes, attendees parsed from helper and displayed in expandable detail panel
- ✅ Multi-day events displayed on every overlapping day
- ✅ Past event display (normal/dimmed/hidden) configurable in settings
- ✅ Calendar color from EventKit `cgColor`
- ✅ Ongoing/starting-soon visual highlighting
- ✅ Recurring event read-only indicator (⟳)

#### Reminders reading
- ✅ Reminder title, due date/time, list name, account name
- ✅ Reminder list source discovery with UUID, account name
- ✅ Completed reminder filtering (hide by default)
- ✅ Reminder priority display (high/medium/low/none as `!!!`/`!!`/`!`)
- ✅ Stable reminder identity (`EKReminder.calendarItemIdentifier`)
- ✅ Overdue reminders visually distinguished (red border + badge + due date)
- ✅ No-date reminders in collapsible section
- ✅ Reminder display range selector (today / 7 days / all incomplete)

#### Cache and performance
- ✅ ±6 month preload via EventKit date predicate
- ✅ Disk cache in `data.json` (`_eventsCache`, `_remindersCache`) for instant cold start
- ✅ Cache freshness check (2× refresh interval, minimum 15 minutes)
- ✅ Two-phase init: cache-first render, background refresh only when stale
- ✅ Configurable auto-refresh (default 5 minutes)
- ✅ Manual refresh button (`↻`) in date header
- ✅ Last refresh time + duration in panel footer
- ✅ Anti-concurrent guard (`_refreshRunning`) prevents stacked queries
- ✅ Timer cleanup on plugin unload

#### Source filtering
- ✅ Calendar source toggle by stable UUID (EventKit `calendarIdentifier`)
- ✅ Reminder list source toggle by stable UUID
- ✅ In-memory instant filter apply (no reload needed)
- ✅ Account name disambiguation ("日历 — iCloud", "日历 — outlook@email.com")
- ✅ Empty selection = show all

#### User interface
- ✅ Date selection (click selects, shows events/reminders from cache)
- ✅ Cmd/Ctrl-click preserves daily-note open/create behavior
- ✅ Events panel: title, time range, calendar badge (colored), location, recurrence indicator
- ✅ Reminders panel: title, due time, list badge, priority indicator
- ✅ UI states: loading, empty, error, permission-denied, partial-permission, cache-miss
- ✅ Refresh footer with last refresh time and duration
- ✅ Month-cell event dots with calendar colors, hollow reminder dots, multi-day spans
- ✅ Diagnostic panel with permission/source/error overview and export with consent-based redaction

#### Write operations (v0.3)
- ✅ Event creation via `EventCreateModal` with title, calendar, date/time, all-day, location, URL, notes
- ✅ Reminder creation via `ReminderCreateModal` with title, list, due date/time, priority, notes
- ✅ Client-side validation (title required, calendar/list required, date format check)
- ✅ Post-write refresh (`init(true)`) confirms write success from EventKit source
- ✅ Write error display with specific failure reason
- ✅ Non-recurring events only (`.thisEvent` span, REQ-WRITE-005)
- ✅ Default calendar/list preference stored in settings (`defaultCalendarId`, `defaultReminderListId`)
- ✅ Sidebar "+Event" and "+Remind" buttons (shown only when source enabled + permission granted)
- ✅ EventCreateModal and ReminderCreateModal accept optional `prefill` parameter from NL parsing
- ✅ Positional arg placeholders in create command builders prevent field misalignment

#### Natural language event creation (v0.3)
- ✅ `parseNaturalLanguage()` regex parser with English + expanded Chinese locale
- ✅ Chinese: 明早/明晚/今早/今晚, 周末/下周周末, 下下周, X天后/周后/月后, 下个月/明年
- ✅ Chinese: X月Y日/号, 凌晨X点, X点一刻/三刻, YYMMDD compact, Chinese numeral hours/thousands
- ✅ Chinese duration: X小时Y分钟, 一个半小时; period hint cleanup
- ✅ `QuickEventModal` (⚡ button) with live regex preview (300ms debounce)
- ✅ Dual-path: "→ Event" pre-fills EventCreateModal, "→ Reminder" pre-fills ReminderCreateModal
- ✅ Optional AI-powered parsing via `callAIForParsing()` with configurable OpenAI-compatible backend
- ✅ AI: Enter-key trigger only (no auto-fire), 10s timeout, cancelled on new keystroke, 256 max_tokens
- ✅ AI: `response_format: json_object`, dual-strategy JSON extraction (fences + bare braces)
- ✅ AI settings: `aiParsingEnabled`, `aiEndpoint`, `aiApiKey`, `aiModel` in Settings tab with privacy note
- ✅ Preview shows `📋 Regex` / `🤖 AI` source badge + confidence level + collapsible raw AI JSON
- ✅ Two-tier result model: `_aiResult` (locked after Enter, cleared on new input) + `_parsedResult` (live regex)

### 2.2 Partial and known gaps for v0.2

**What "Partial" means for v0.2**:
- (No Partial items remain in v0.2 scope. The one known gap — REQ-REM-009 subtask display — has been deferred to v0.3 because it requires helper-side changes.

**Deferred to v0.3 (was originally target v0.2)**:
- REQ-UX-010 (today summary panel), REQ-PERF-003 (large-calendar deg), REQ-PERM-005 (permission retry)
- REQ-SYNC-004/005/007 (window focus, EK notification watch, fallback)
- REQ-DATA-003 (display-only marking), REQ-TIME-005 (DST handling)
- REQ-REM-009 (subtask display) — rendering code exists but helper does not yet populate `parentId`

**Other known gaps (not version-specific)**:
- No automated tests; all testing is manual (see `docs/sdd/TESTING.md`)
- Performance targets (cache switch <100ms, init <3s) have not been benchmarked

**Explicitly not yet done (v0.3+)**:
- Code split into multiple JS modules (REQ-ARCH-001, target v0.3) — modules extracted to `src/` but require() wiring blocked by Obsidian plugin loading constraints
- Recurring event safety model (REQ-REC-002/003/007, target v0.3): blocking recurring edits not yet implemented
- Remaining v0.2 deferred items (REQ-UX-010, REQ-PERF-003, REQ-PERM-005, REQ-SYNC-004/005/007, REQ-DATA-003, REQ-TIME-005, REQ-REM-009)

---

## 3. Non-goals and explicit boundaries

### 3.1 v0.1–v0.2 non-goals

The following are explicitly out of scope for v0.1 and v0.2:

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

### 3.2 Future non-goal unless re-specified

Calendian will not send event titles, reminder text, attendees, notes, locations, or URLs to any external service unless a future spec adds an opt-in external integration with a separate privacy model.

---

## 4. Platforms and dependencies

### 4.1 Platform matrix

| Platform | Status | Notes |
|---|---|---|
| macOS desktop | Target | Uses native Swift EventKit helper (`calendian-helper`). |
| Obsidian desktop | Target | Plugin runs inside Obsidian desktop. |
| iOS / iPadOS | Rejected for current architecture | JXA and macOS automation unavailable. |
| Windows / Linux | Deferred | Requires non-JXA architecture. |
| Android | Deferred to v1.x platform track | Requires external API/auth design. |

### 4.2 External apps

- Calendar.app is the source of calendar events.
- Reminders.app is the source of reminders.
- Account support is inherited from what the user has configured in macOS Calendar/Reminders.

### 4.3 Packaging consistency requirement

`manifest.json`, README, SPEC, and release notes must agree on:

- plugin display name: **Calendian**
- plugin id: **calendian**
- version;
- minimum Obsidian version;
- desktop/macOS-only scope.

---

## 5. Domain model

### 5.1 Event model

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

### 5.2 Reminder model

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

### 5.3 Association model

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

### 5.4 Goal and focus model

Goals and focus declarations are stored locally in Obsidian notes/frontmatter, never written to Calendar.app or Reminders.app.

```ts
interface CalendianGoal {
  id: string;
  title: string;
  description?: string;
  steps: CalendianStep[];
  currentFocus?: string;       // single weekly/phase focus
  status: "active" | "paused" | "archived" | "completed";
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

interface CalendianStep {
  id: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  order: number;
}
```

```yaml
---
calendian:
  goals:
    - id: "goal-001"
      title: "Learn TypeScript"
      steps:
        - id: "step-001"
          description: "Complete basic types tutorial"
          completed: true
          completedAt: "2026-06-05"
          order: 1
        - id: "step-002"
          description: "Build a small project"
          completed: false
          order: 2
      currentFocus: "TypeScript generics deep dive"
      status: "active"
---
```

### 5.5 Habit model

Habit tracking data lives entirely in Obsidian. Consistency is measured as appearance rate over a window, not as an unbroken streak.

```ts
interface CalendianHabit {
  id: string;
  title: string;
  description?: string;
  frequency: "daily" | "weekly" | "custom";
  minimumViable?: string;       // reduced version for low-energy days
  completions: CalendianHabitCompletion[];
  restPeriods: CalendianRestPeriod[];
  status: "active" | "paused" | "retired";
  createdAt: string;
  updatedAt: string;
}

interface CalendianHabitCompletion {
  date: string;                 // ISO date
  completed: boolean;
  variant?: "full" | "minimum"; // whether full or minimum-viable version was done
}

interface CalendianRestPeriod {
  start: string;
  end: string;
  reason?: string;              // e.g. "vacation", "recovery"
}
```

```yaml
---
calendian:
  habits:
    - id: "habit-001"
      title: "Morning review"
      frequency: "daily"
      minimumViable: "Open daily note and write one sentence"
      completions:
        - date: "2026-06-07"
          completed: true
          variant: "full"
      restPeriods: []
      status: "active"
---
```

### 5.6 Intention and nudge model

Daily intentions and nudge configuration are stored locally. Nudge tone and frequency are user-configurable.

```ts
interface CalendianIntention {
  date: string;
  text: string;
  progressed?: boolean;         // set during end-of-day check-in
  reflection?: string;
}

interface CalendianNudgeConfig {
  enabled: boolean;
  tone: "gentle" | "neutral" | "firm";
  morningPrompt: boolean;       // daily intention prompt
  eveningCheckin: boolean;      // end-of-day check-in
  reEngagementAfterMissDays: number; // days before re-engagement prompt
  quickStartMinutes: number;    // default N for "start now for N minutes"
}
```

### 5.7 Review model

Reviews are generated from templates and stored as notes with stable metadata links.

```ts
interface CalendianReview {
  id: string;
  type: "daily" | "weekly";
  date: string;
  intention?: string;
  completedItems: string[];     // completed steps, habits
  missedItems: string[];
  nextFocus?: string;
  associatedGoals: string[];    // goal IDs
  associatedHabits: string[];   // habit IDs
  notePath: string;             // path to generated note
}
```

### 5.8 Self-direction data locality

Goal, habit, intention, nudge, and review data SHALL reside exclusively in Obsidian (plugin settings, note frontmatter, or note content). These entities SHALL NOT be written to Calendar.app, Reminders.app, or any external service. This is a hard boundary: self-direction features are private by construction and do not touch the Apple data pipeline.

---

## 6. Requirement status vocabulary

| Status | Meaning |
|---|---|
| Implemented | Behavior exists and passes acceptance. |
| Partial | Behavior exists but lacks edge cases, tests, or documentation. |
| Planned | Approved scope, not implemented. |
| Deferred | Valid idea postponed to later track. |
| Rejected | Explicitly out of scope. |

---

## 7. Requirements

### 7.1 Platform requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-PLAT-001 | THE SYSTEM SHALL run as an Obsidian desktop plugin. | P0 | v0.1 | Implemented |
| REQ-PLAT-002 | THE SYSTEM SHALL clearly communicate macOS-only support for early releases. | P0 | v0.1 | Implemented |
| REQ-PLAT-003 | THE SYSTEM SHALL keep manifest metadata consistent with documentation. | P0 | v0.1 | Implemented |
| REQ-PLAT-004 | IF the platform is unsupported, THE SYSTEM SHALL show an unsupported-platform message instead of crashing. | P0 | v0.1 | Implemented |

### 7.2 Permission requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-PERM-001 | WHEN Calendar permission is unavailable or denied, THE SYSTEM SHALL show actionable recovery guidance. | P0 | v0.1 | Implemented |
| REQ-PERM-002 | WHEN Reminders permission is unavailable or denied, THE SYSTEM SHALL show actionable recovery guidance. | P0 | v0.1 | Implemented |
| REQ-PERM-003 | WHILE only one source is permitted, THE SYSTEM SHALL continue showing available data from the permitted source. | P0 | v0.1 | Implemented |
| REQ-PERM-004 | THE SYSTEM SHALL distinguish permission failure from empty calendar/reminder data. | P0 | v0.1 | Implemented |
| REQ-PERM-005 | THE SYSTEM SHALL provide a retry or refresh path after permission changes. | P1 | v0.3 | Planned |

### 7.3 Calendar read requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-CAL-001 | THE SYSTEM SHALL read events from macOS Calendar.app through EventKit helper. | P0 | v0.1 | Implemented |
| REQ-CAL-002 | THE SYSTEM SHALL display events for the selected date. | P0 | v0.1 | Implemented |
| REQ-CAL-003 | THE SYSTEM SHALL display event title, start time, end time where available, and calendar name. | P0 | v0.1 | Implemented |
| REQ-CAL-004 | THE SYSTEM SHALL display all-day events separately or before timed events. | P0 | v0.1 | Implemented |
| REQ-CAL-005 | THE SYSTEM SHALL sort events by all-day status and start time. | P0 | v0.1 | Implemented |
| REQ-CAL-006 | THE SYSTEM SHALL visually indicate ongoing and soon-starting events. | P1 | v0.1 | Implemented |
| REQ-CAL-007 | THE SYSTEM SHALL display event location, link, notes, calendar source, and recurrence summary where available. | P1 | v0.1 | Implemented |
| REQ-CAL-008 | THE SYSTEM SHALL support an expandable event detail state. | P1 | v0.2 | Implemented |
| REQ-CAL-009 | THE SYSTEM SHALL display multi-day events on every overlapping day. | P1 | v0.2 | Implemented |
| REQ-CAL-010 | THE SYSTEM SHALL visibly mark past events or hide them according to user settings. | P1 | v0.2 | Implemented |
| REQ-CAL-011 | THE SYSTEM SHALL treat recurring events as read-only until recurring mutation is specified. | P0 | v0.1 | Implemented |
| REQ-CAL-012 | THE SYSTEM SHOULD display source calendar colors where available. | P1 | v0.1 | Implemented |

### 7.4 Reminder read requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-REM-001 | THE SYSTEM SHALL read incomplete reminders from macOS Reminders.app through EventKit helper. | P0 | v0.1 | Implemented |
| REQ-REM-002 | THE SYSTEM SHALL display reminders due on the selected date. | P0 | v0.1 | Implemented |
| REQ-REM-003 | THE SYSTEM SHALL display reminder title and reminder list. | P0 | v0.1 | Implemented |
| REQ-REM-004 | THE SYSTEM SHALL hide completed reminders by default. | P0 | v0.1 | Implemented |
| REQ-REM-005 | THE SYSTEM SHALL visually distinguish overdue reminders. | P1 | v0.2 | Implemented |
| REQ-REM-006 | THE SYSTEM SHALL display no-date reminders in a separate configurable section. | P1 | v0.2 | Implemented |
| REQ-REM-007 | THE SYSTEM SHALL support display ranges: selected day, next 7 days, all incomplete. | P1 | v0.2 | Implemented |
| REQ-REM-008 | THE SYSTEM SHOULD display reminder priority where available. | P2 | v0.1 | Implemented |
| REQ-REM-009 | THE SYSTEM SHOULD display reminder subtasks where available. | P2 | v0.3 | Partial |

### 7.5 Source selection requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-SRC-001 | THE SYSTEM SHALL discover available macOS calendars. | P0 | v0.1 | Implemented |
| REQ-SRC-002 | THE SYSTEM SHALL discover available macOS reminder lists. | P0 | v0.1 | Implemented |
| REQ-SRC-003 | THE SYSTEM SHALL let users include or exclude individual calendars. | P0 | v0.1 | Implemented |
| REQ-SRC-004 | THE SYSTEM SHALL let users include or exclude individual reminder lists. | P0 | v0.1 | Implemented |
| REQ-SRC-005 | THE SYSTEM SHALL handle duplicate source names safely. | P1 | v0.1 | Implemented |
| REQ-SRC-006 | THE SYSTEM SHALL show source discovery empty/error states. | P1 | v0.1 | Implemented |

### 7.6 Cache and performance requirements

#### Cache strategy

**Preload range**: 
- Default: ±6 months from current date
- Purpose: Enable fast date switching within typical planning horizon
- Configurability: Fixed for v0.1, may become configurable in later versions

**Cache lifecycle**:
1. **Initial load**: Preload all events/reminders for the cache range when plugin initializes
2. **Date navigation**: Dates within cache range display instantly from memory cache
3. **Cache miss behavior**: When user selects date outside cache range, either:
   - Option A: Show empty state with message to navigate within cached range
   - Option B: Trigger background refresh and show loading state
4. **Refresh**: Auto-refresh at configured interval (default 5 minutes, minimum 1 minute)
5. **Unload**: Clear all timers and cache when plugin unloads

**Cache performance targets**:
- Initial preload: <3 seconds for typical user (≤1000 events in range)
- Date switch from cache: <100ms
- Auto-refresh: Non-blocking, preserve old cache until new data ready

**Large calendar behavior**:
- Degrade gracefully if preload takes >5 seconds
- Consider reducing cache range or lazy loading in future versions

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-CACHE-001 | THE SYSTEM SHALL preload a bounded date range for fast date switching. | P0 | v0.1 | Implemented |
| REQ-CACHE-002 | THE SYSTEM SHALL define behavior when users select dates outside the cached range. | P0 | v0.1 | Implemented |
| REQ-CACHE-003 | THE SYSTEM SHALL refresh source data on a configurable interval. | P0 | v0.1 | Implemented |
| REQ-CACHE-004 | WHILE refreshing, THE SYSTEM SHALL avoid falsely showing an empty state before refresh completes. | P0 | v0.1 | Implemented |
| REQ-CACHE-005 | THE SYSTEM SHALL clear refresh timers when the plugin unloads. | P0 | v0.1 | Implemented |
| REQ-CACHE-006 | THE SYSTEM SHOULD provide manual refresh. | P1 | v0.1 | Implemented |
| REQ-CACHE-007 | THE SYSTEM SHOULD display last refresh time. | P1 | v0.1 | Implemented |
| REQ-CACHE-008 | THE SYSTEM SHOULD measure refresh duration for diagnostics. | P2 | v0.1 | Implemented |
| REQ-PERF-001 | Date switching from cache SHOULD complete in under 100ms for normal datasets. | P1 | v0.1 | Planned |
| REQ-PERF-002 | Initial read SHOULD not block the Obsidian UI. | P0 | v0.1 | Implemented |
| REQ-PERF-003 | Large calendars SHOULD degrade gracefully. | P1 | v0.3 | Planned |
| REQ-PERF-004 | Plugin unload SHALL not leave active intervals or detached DOM. | P0 | v0.1 | Implemented |

### 7.6.1 Sync and refresh strategy

> The plugin uses a **native Swift EventKit helper** (`calendian-helper`) for all macOS data access. Refresh is designed as a multi-path, single-gate system.

#### Refresh architecture

```
External changes            Obsidian writes (v0.3+)     Timer (configurable)
(Calendar.app / iCloud)          │                        │
        │                         │                        │
   Planned: watch      ───────────┼────────────────────────┘
   (EKEventStoreChanged           │
    Notification)                 ▼
                           _refreshRunning gate
                                  │
                            ┌─ is running? ─→ skip
                            │
                            └─→ execHelper() → 72ms
                                       │
                                  save to cache
                                       │
                                  render() → UI
```

#### Refresh triggers (current and planned)

| Trigger | Status | Mechanism |
|---|---|---|
| Configurable timer | Implemented | `setInterval` on `refreshIntervalMinutes` (default 5) |
| Manual refresh | Implemented | `↻` button in date header |
| Cache stale check | Implemented | `isCacheFresh()` — 2× interval, min 15min |
| Permission retry | Implemented | Retry button calls `init()` |
| Source filter toggle | Implemented | `render()` with in-memory filter |
| Window focus | **Planned v0.3** | `window.onfocus` → `init()` if cache stale |
| macOS system notification | **Planned v0.3** | `calendian-helper watch` subscribes `EKEventStoreChangedNotification` → writes signal → JS calls `init()` |
| Post-write refresh | **Planned v0.3** | After create/edit/delete via helper, immediately call `init()` |

#### Concurrency safety

All refresh paths go through `init()`, which has a `_refreshRunning` boolean gate. If a refresh is already in progress, subsequent calls return immediately without starting a second helper process.

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-SYNC-001 | THE SYSTEM SHALL refresh from macOS sources on a configurable timer interval. | P0 | v0.1 | Implemented |
| REQ-SYNC-002 | THE SYSTEM SHALL provide a manual refresh control. | P1 | v0.1 | Implemented |
| REQ-SYNC-003 | THE SYSTEM SHALL prevent concurrent refresh operations. | P0 | v0.1 | Implemented |
| REQ-SYNC-004 | THE SYSTEM SHOULD refresh when the Obsidian window gains focus after being in the background. | P1 | v0.3 | Planned |
| REQ-SYNC-005 | THE SYSTEM SHOULD detect macOS calendar/reminder changes via system notification and refresh automatically. | P1 | v0.3 | Planned |
| REQ-SYNC-006 | AFTER a write operation (create/edit/delete), THE SYSTEM SHALL refresh from source immediately. | P0 | v0.3 | Planned |
| REQ-SYNC-007 | WHEN a system notification watch process terminates unexpectedly, THE SYSTEM SHOULD log the failure and fall back to timer-based refresh. | P1 | v0.3 | Planned |
| REQ-SYNC-008 | THE SYSTEM SHALL NOT lose data due to concurrent refresh and write operations. | P0 | v0.3 | Planned |

### 7.7 UX requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-UX-001 | WHEN a user clicks a date, THE SYSTEM SHALL select that date and update the event/reminder panel. | P0 | v0.1 | Implemented |
| REQ-UX-002 | WHEN a user Cmd/Ctrl-clicks a date, THE SYSTEM SHALL preserve open/create daily-note behavior. | P0 | v0.1 | Implemented |
| REQ-UX-003 | THE SYSTEM SHALL show loading, empty, error, unsupported, and partial-permission states. | P0 | v0.1 | Implemented |
| REQ-UX-004 | THE SYSTEM SHALL use Obsidian theme variables where possible. | P1 | v0.1 | Implemented |
| REQ-UX-005 | THE SYSTEM SHOULD support event/reminder context menus only when actions are implemented safely. | P1 | v0.3 | Planned |
| REQ-UX-006 | THE SYSTEM SHOULD show calendar dots on month cells without harming navigation performance. | P1 | v0.2 | Implemented |
| REQ-UX-007 | THE SYSTEM SHOULD support keyboard navigation and commands. | P2 | v0.6 | Planned |
| REQ-UX-008 | THE SYSTEM SHOULD support a compact and comfortable density option. | P2 | v0.6 | Planned |
| REQ-UX-009 | THE SYSTEM SHOULD provide copy-as-Markdown actions. | P2 | v0.5 | Planned |
| REQ-UX-010 | THE SYSTEM SHOULD support a today summary panel. | P2 | v0.3 | Planned |

| REQ-UX-011 | THE SYSTEM SHOULD persist the user's preferred calendar and reminder list for the create form. | P2 | v0.3 | Implemented — `defaultCalendarId` and `defaultReminderListId` in settings; auto-detect mode prefers Outlook account when unset |
### 7.8 Privacy and diagnostics requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-PRIV-001 | THE SYSTEM SHALL keep Calendar and Reminders data local and NOT send content to third-party services by default. | P0 | v0.1 | Implemented |
| REQ-PRIV-002 | THE SYSTEM SHALL document what data is stored in Obsidian settings/frontmatter. | P0 | v0.1 | Implemented |
| REQ-PRIV-003 | THE SYSTEM SHALL keep note-association, goal, habit, nudge, and review data local and SHALL NOT send self-direction content to external services. | P0 | v0.5 | Planned |
| REQ-DIAG-001 | THE SYSTEM SHALL provide diagnostic panel showing permission status, source counts, last refresh time, and error states WITHOUT exposing private event/reminder content by default. | P1 | v0.1 | Implemented |
| REQ-DIAG-002 | WHEN exporting diagnostics, THE SYSTEM SHALL obtain explicit user consent and redact sensitive fields. | P0 | v0.2 | Implemented |

### 7.9 Error handling requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-ERR-001 | WHEN native helper execution fails, THE SYSTEM SHALL classify the error type (permission denied, timeout, parse failure, or empty data). | P0 | v0.1 | Implemented |
| REQ-ERR-002 | THE SYSTEM SHALL show appropriate error states for each error type with recovery guidance. | P0 | v0.1 | Implemented |
| REQ-ERR-003 | IF a data item fails to parse, THE SYSTEM SHALL skip that item and continue rendering valid items. | P1 | v0.1 | Implemented |
| REQ-ERR-004 | THE SYSTEM SHALL distinguish empty data from failure states in the UI. | P0 | v0.1 | Implemented |
| REQ-ERR-005 | WHEN write operations are implemented, failed writes SHALL NOT display false success and SHALL refresh from source of truth. | P0 | v0.3 | Planned |
| REQ-ERR-006 | DESTRUCTIVE OPERATIONS (delete/edit) SHALL require user confirmation and stable source identity. | P0 | v0.4 | Planned |

### 7.10 Write requirements, future releases

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-WRITE-001 | THE SYSTEM SHALL create simple non-recurring events only after user confirmation or explicit save. | P0 | v0.3 | Implemented — EventCreateModal with field validation and explicit Save button |
| REQ-WRITE-002 | THE SYSTEM SHALL validate event title, calendar, date, and time before creating an event. | P0 | v0.3 | Implemented — client-side validation before helper call |
| REQ-WRITE-003 | THE SYSTEM SHALL refresh from Calendar.app after event creation. | P0 | v0.3 | Implemented — calls init(true) after successful write |
| REQ-WRITE-004 | THE SYSTEM SHOULD support event location and notes during creation. | P1 | v0.3 | Implemented — location, notes, URL fields in modal |
| REQ-WRITE-005 | THE SYSTEM SHALL NOT create recurring events until recurrence creation is specified. | P0 | v0.3 | Implemented — only simple EKEvent with .thisEvent span |
| REQ-WRITE-006 | THE SYSTEM SHALL create simple reminders only after user confirmation or explicit save. | P0 | v0.3 | Implemented — ReminderCreateModal with validation |
| REQ-WRITE-007 | THE SYSTEM SHALL validate reminder title and list before creating a reminder. | P0 | v0.3 | Implemented — client-side validation before helper call |
| REQ-WRITE-008 | THE SYSTEM SHALL refresh from Reminders.app after reminder creation. | P0 | v0.3 | Implemented — calls init(true) after successful write |
| REQ-WRITE-009 | THE SYSTEM SHOULD support due date and due time during reminder creation. | P1 | v0.3 | Implemented — optional due date and time fields |
| REQ-WRITE-010 | THE SYSTEM SHOULD support priority during reminder creation where available. | P2 | v0.3 | Implemented — dropdown with none/low/medium/high |
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

### 7.11 Recurring event safety requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-REC-001 | THE SYSTEM SHALL identify recurring events where possible. | P0 | v0.2 | Implemented |
| REQ-REC-002 | THE SYSTEM SHALL treat recurring event mutation as unsupported until scope UX exists. | P0 | v0.3 | Planned |
| REQ-REC-003 | THE SYSTEM SHALL explain why recurring mutation is blocked. | P0 | v0.3 | Planned |
| REQ-REC-004 | THE SYSTEM SHALL offer explicit scope choices before editing recurring events. | P0 | Future | Planned |
| REQ-REC-005 | THE SYSTEM SHALL offer explicit scope choices before deleting recurring events. | P0 | Future | Planned |
| REQ-REC-006 | THE SYSTEM SHALL distinguish series identity from occurrence identity. | P0 | Future | Planned |
| REQ-REC-007 | THE SYSTEM SHALL document recurrence limitations. | P0 | v0.3 | Planned |
| REQ-REC-008 | THE SYSTEM SHALL test recurring edit/delete before enabling it by default. | P0 | Future | Planned |

### 7.12 Note association requirements

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

### 7.13 Tasks integration requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-TASK-001 | THE SYSTEM SHOULD parse Obsidian Tasks-compatible dates in notes. | P2 | v0.5 | Planned |
| REQ-TASK-002 | THE SYSTEM SHOULD support manual export of selected tasks to Reminders. | P2 | v0.5 | Planned |
| REQ-TASK-003 | THE SYSTEM SHALL NOT enable automatic two-way Tasks/Reminders sync until identity and conflict strategy are specified. | P0 | v0.5 | Planned |
| REQ-TASK-004 | THE SYSTEM SHALL avoid duplicate reminder creation during task export. | P0 | v0.5 | Planned |

### 7.14 Advanced view/search/statistics requirements

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

### 7.15 Cross-platform requirements, deferred

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-XPLAT-001 | Cross-platform support SHALL have a separate architecture proposal before implementation. | P0 | v1.x | Deferred |
| REQ-XPLAT-002 | Direct Microsoft Graph support SHALL define authentication, token storage, privacy, and revoke flows. | P0 | v1.x | Deferred |
| REQ-XPLAT-003 | Android support SHALL not be coupled to macOS JXA code. | P0 | v1.x | Deferred |
| REQ-XPLAT-004 | External API integrations SHALL be opt-in. | P0 | v1.x | Deferred |
| REQ-XPLAT-005 | External API integrations SHALL have separate acceptance and test matrices. | P0 | v1.x | Deferred |

### 7.16 Progress and consistency statistics requirements

> Direction: encouragement-oriented metrics for personal consistency tracking (completion counts, appearance rate, current focus). This replaces the earlier v0.6 "time statistics and reporting" draft that was oriented toward meeting-load analysis for busy professionals. See §7.22–§7.25 for related self-direction features.

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-STATS-001 | THE SYSTEM SHOULD display step/habit completion count over a configurable window (day/week/month). | P1 | v0.5 | Planned |
| REQ-STATS-002 | THE SYSTEM SHOULD display consistency rate as appearance days over total days in the window, NOT as an unbroken streak. | P1 | v0.5 | Planned |
| REQ-STATS-003 | THE SYSTEM SHOULD surface the current declared focus alongside progress metrics in the panel. | P1 | v0.5 | Planned |
| REQ-STATS-004 | THE SYSTEM SHOULD display completed-items count (small wins) before any gap or miss analysis. | P2 | v0.5 | Planned |
| REQ-STATS-005 | THE SYSTEM SHOULD generate progress summaries emphasizing presence and consistency over perfection. | P2 | v0.6 | Planned |
| REQ-STATS-006 | All statistics SHALL be computed locally without external services. | P0 | v0.5 | Planned |

### 7.17 Natural language event creation requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-NL-001 | THE SYSTEM SHOULD support natural language parsing for quick event creation (e.g., "tomorrow 3pm meeting"). | P1 | v0.3 | Implemented |
| REQ-NL-002 | WHEN parsing natural language, THE SYSTEM SHOULD extract title, date, time, and duration. | P1 | v0.3 | Implemented |
| REQ-NL-003 | IF natural language parsing is ambiguous, THE SYSTEM SHOULD show a confirmation dialog with extracted fields. | P1 | v0.3 | Implemented |
| REQ-NL-004 | Natural language parsing SHALL be optional; manual event creation MUST remain available. | P0 | v0.3 | Implemented |
| REQ-NL-005 | THE SYSTEM SHOULD support common date/time expressions in the user's locale. | P2 | v0.3 | Implemented |

> **v0.3 enhancement:** Optional AI-powered NL parsing via configurable OpenAI-compatible API (e.g., DeepSeek). When enabled in settings, the QuickEventModal sends typed text to the configured LLM for parsing, falling back to regex if unavailable. Settings (`aiParsingEnabled`, `aiEndpoint`, `aiApiKey`, `aiModel`) stored in gitignored `data.json`. Only user-typed NL text is sent — no calendar data.

### 7.18 In-app notification requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-NOTIF-001 | THE SYSTEM SHOULD show in-app notifications for events starting soon (configurable lead time). | P1 | v0.5 | Planned |
| REQ-NOTIF-002 | THE SYSTEM SHOULD show notifications for overdue reminders. | P1 | v0.5 | Planned |
| REQ-NOTIF-003 | NOTIFICATIONS SHALL work within Obsidian using available notification APIs. | P0 | v0.5 | Planned |
| REQ-NOTIF-004 | THE SYSTEM SHALL allow users to configure notification lead time and enable/disable notifications. | P1 | v0.5 | Planned |
| REQ-NOTIF-005 | IF Obsidian notification APIs are unavailable, THE SYSTEM SHALL document this limitation gracefully. | P2 | v0.5 | Planned |

### 7.19 Data export and backup requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-EXPORT-001 | THE SYSTEM SHOULD allow users to export selected date range as Markdown. | P1 | v0.6 | Planned |
| REQ-EXPORT-002 | THE SYSTEM SHOULD allow users to export data as JSON for backup purposes. | P2 | v0.6 | Planned |
| REQ-EXPORT-003 | WHEN exporting, THE SYSTEM SHALL include all event fields (title, time, location, notes, etc.). | P1 | v0.6 | Planned |
| REQ-EXPORT-004 | Exported data SHALL NOT be sent to external services; local export only. | P0 | v0.6 | Planned |

### 7.20 User interface customization requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-UI-001 | THE SYSTEM SHOULD support compact and comfortable density options. | P2 | v0.6 | Planned |
| REQ-UI-002 | THE SYSTEM SHOULD allow users to customize which event fields are displayed. | P2 | v0.6 | Planned |
| REQ-UI-003 | THE SYSTEM SHOULD respect Obsidian theme colors and CSS variables. | P1 | v0.1 | Implemented |
| REQ-UI-004 | Advanced customization (custom CSS, themes) SHOULD be documented but not required in core. | P3 | Future | Planned |

### 7.21 Documentation and architecture requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-DOC-001 | README SHALL distinguish current, planned, experimental, and non-goal features. | P0 | v0.1 | Implemented |
| REQ-DOC-002 | Roadmap SHALL reference requirement groups or IDs. | P0 | v0.1 | Implemented |
| REQ-DOC-003 | Target architecture SHALL be labeled as target until code is refactored. | P0 | v0.1 | Implemented |
| REQ-ARCH-001 | THE SYSTEM SHOULD split into maintainable modules (macOS adapter, domain, cache, UI) before complex write features. | P1 | v0.3 | Partial — helper-executor.js, schedule-cache.js, writer.js extracted; settings-tab.js, calendar-panel.js pending |

### 7.22 Goal and focus requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-GOAL-001 | THE SYSTEM SHALL let users define a lightweight goal stored locally in Obsidian (note/frontmatter), not in Calendar.app or Reminders.app. | P1 | v0.5 | Planned |
| REQ-GOAL-002 | THE SYSTEM SHALL support breaking a goal into small, actionable steps. | P1 | v0.5 | Planned |
| REQ-GOAL-003 | THE SYSTEM SHOULD let users declare a single current focus for a week or phase. | P1 | v0.5 | Planned |
| REQ-GOAL-004 | THE SYSTEM SHOULD surface the current focus prominently in the panel. | P2 | v0.5 | Planned |
| REQ-GOAL-005 | THE SYSTEM SHALL let users complete a step with a single action and reflect it in goal progress. | P1 | v0.5 | Planned |
| REQ-GOAL-006 | THE SYSTEM SHOULD link goals to events, reminders, or notes using stable association metadata. | P2 | v0.6 | Planned |
| REQ-GOAL-007 | THE SYSTEM SHALL allow pausing or archiving a goal without deleting its history, so abandoning is not all-or-nothing. | P1 | v0.6 | Planned |
| REQ-GOAL-008 | THE SYSTEM SHALL keep goal content local and SHALL NOT send it to external services. | P0 | v0.5 | Planned |

### 7.23 Habit and consistency requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-HABIT-001 | THE SYSTEM SHALL let users define lightweight recurring habits tracked within Obsidian. | P1 | v0.5 | Planned |
| REQ-HABIT-002 | THE SYSTEM SHALL record habit completion for a given day with a single action. | P1 | v0.5 | Planned |
| REQ-HABIT-003 | THE SYSTEM SHALL represent progress as a consistency/appearance rate over a window, NOT solely as an unbroken streak. | P1 | v0.5 | Planned |
| REQ-HABIT-004 | THE SYSTEM SHALL NOT reset accumulated habit progress to zero after a single missed period. | P0 | v0.5 | Planned |
| REQ-HABIT-005 | WHEN a habit has been missed for a configurable number of periods, THE SYSTEM SHOULD offer a low-friction restart (e.g. a reduced version) rather than marking failure. | P1 | v0.5 | Planned |
| REQ-HABIT-006 | THE SYSTEM SHOULD support a minimum-viable version of a habit (a very small commitment) to lower activation energy. | P2 | v0.6 | Planned |
| REQ-HABIT-007 | THE SYSTEM SHOULD let users mark scheduled rest periods so that rest is not counted as a miss. | P2 | v0.6 | Planned |
| REQ-HABIT-008 | THE SYSTEM SHOULD visualize habit history in a way that emphasizes presence over perfection. | P2 | v0.6 | Planned |
| REQ-HABIT-009 | THE SYSTEM SHALL let users edit or retire a habit without losing its history. | P2 | v0.6 | Planned |
| REQ-HABIT-010 | THE SYSTEM SHALL keep habit data local in Obsidian and SHALL NOT require Reminders.app or external services. | P0 | v0.5 | Planned |

### 7.24 Encouragement and nudge requirements

> Distinct from REQ-NOTIF-* (event-start / overdue alarms). Nudges are motivational, not time-based alarms.

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-NUDGE-001 | THE SYSTEM SHOULD prompt the user once per day to declare a daily intention rather than impose a schedule. | P1 | v0.5 | Planned |
| REQ-NUDGE-002 | THE SYSTEM SHOULD offer an optional gentle end-of-day check-in on whether the day's intention progressed. | P2 | v0.5 | Planned |
| REQ-NUDGE-003 | WHEN a goal or habit has lapsed, THE SYSTEM SHOULD offer a re-engagement prompt framed as a restart, not a failure notice. | P1 | v0.5 | Planned |
| REQ-NUDGE-004 | THE SYSTEM SHOULD offer a "start now for N minutes" quick action to lower the cost of beginning. | P1 | v0.5 | Planned |
| REQ-NUDGE-005 | THE SYSTEM SHALL allow users to configure nudge tone (e.g. gentle / neutral / firm). | P1 | v0.5 | Planned |
| REQ-NUDGE-006 | THE SYSTEM SHALL allow users to configure nudge frequency and to disable nudges entirely. | P0 | v0.5 | Planned |
| REQ-NUDGE-007 | THE SYSTEM SHALL NOT use shaming, punitive, or guilt-inducing language by default. | P0 | v0.5 | Planned |
| REQ-NUDGE-008 | THE SYSTEM SHALL deliver nudges locally within Obsidian and SHALL NOT send nudge or behavioral data to external services. | P0 | v0.5 | Planned |
| REQ-NUDGE-009 | IF Obsidian notification APIs are unavailable, THE SYSTEM SHALL degrade to in-panel nudges and document the limitation. | P2 | v0.5 | Planned |

### 7.25 Reflection and review requirements

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-REVIEW-001 | THE SYSTEM SHALL generate a daily reflection from a template, optionally pre-filled with the day's events, completed items, and declared intention. | P1 | v0.5 | Planned |
| REQ-REVIEW-002 | THE SYSTEM SHALL generate a weekly review summarizing completed steps, habit consistency, and current focus. | P1 | v0.5 | Planned |
| REQ-REVIEW-003 | THE SYSTEM SHOULD support template variables for intention, completed items, missed items, and next focus. | P1 | v0.5 | Planned |
| REQ-REVIEW-004 | THE SYSTEM SHOULD surface completed items (small wins) before missed items in any review output. | P2 | v0.5 | Planned |
| REQ-REVIEW-005 | THE SYSTEM SHOULD let users carry an unfinished focus forward to the next period without penalty. | P2 | v0.6 | Planned |
| REQ-REVIEW-006 | THE SYSTEM SHOULD link review notes to associated goals, habits, or events using stable metadata. | P2 | v0.6 | Planned |
| REQ-REVIEW-007 | THE SYSTEM SHALL compute review content locally and SHALL NOT send reflection content to external services. | P0 | v0.5 | Planned |

### 7.26 Data identity and parsing requirements

> Foundational requirements for stable identity, parse isolation, and display-only fallback. These are cross-cutting across Calendar and Reminder reads, writes, and note association.

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-DATA-001 | THE SYSTEM SHALL assign each Calendar event a stable source identity where available. | P0 | v0.1 | Implemented |
| REQ-DATA-002 | THE SYSTEM SHALL assign each Reminder a stable source identity where available. | P0 | v0.1 | Implemented |
| REQ-DATA-003 | IF stable identity is unavailable for a source item, THE SYSTEM SHALL mark that item as display-only and SHALL NOT permit write, delete, or note-association operations on it. | P0 | v0.3 | Planned |
| REQ-DATA-004 | THE SYSTEM SHALL NOT use fallback display identity (derived from title/time/calendar) for write, delete, or note-association operations. | P0 | v0.3 | Planned |
| REQ-DATA-005 | THE SYSTEM SHALL isolate parse failures to individual records so that one malformed item does not prevent display of valid items. | P0 | v0.1 | Implemented |
| REQ-DATA-006 | THE SYSTEM SHALL distinguish stable series identity from occurrence identity for recurring events where the source provides both. | P0 | Future | Planned |
| REQ-DATA-007 | THE SYSTEM SHALL treat optional fields as optional and SHALL NOT fail when fields are missing, null, or of unexpected type. | P0 | v0.1 | Implemented |

**Identity stability grades** (informative):

| Grade | Meaning | Permitted operations |
|---|---|---|
| Stable | Source-provided persistent ID (e.g., Calendar event UID, Reminder persistent ID). | Read, display, write, delete, note association. |
| Semi-stable | Composite key from source properties that may change on edit. | Display hints only. |
| Display-only fallback | Derived from title/time/calendar; not durable. | Display hints only; MUST NOT be used for mutation or association. |

### 7.27 Time, date, and timezone requirements

> Calendar plugins are prone to bugs around all-day events, DST transitions, multi-day spans, and locale settings. These requirements define the expected behavior.

| ID | Requirement | Priority | Target | Status |
|---|---|---|---|---|
| REQ-TIME-001 | THE SYSTEM SHALL treat all-day event end dates as exclusive (an all-day event on June 7 has start=June 7, end=June 8, and SHALL display on June 7 only). | P0 | v0.1 | Implemented |
| REQ-TIME-002 | THE SYSTEM SHALL display a timed event that spans midnight on both calendar days (e.g., 23:00–01:00 appears on both the start date and the end date). | P0 | v0.2 | Implemented |
| REQ-TIME-003 | THE SYSTEM SHALL display a multi-day event on every calendar day that intersects [start, end). | P0 | v0.2 | Implemented |
| REQ-TIME-004 | THE SYSTEM SHALL use the user's local timezone for all time calculations and display. | P0 | v0.1 | Implemented |
| REQ-TIME-005 | THE SYSTEM SHALL handle DST transition days correctly (23-hour and 25-hour days SHALL NOT cause event misplacement). | P1 | v0.3 | Planned |
| REQ-TIME-006 | THE SYSTEM SHALL respect the Obsidian-configured week start day for calendar grid rendering. | P1 | v0.1 | Implemented |
| REQ-TIME-007 | THE SYSTEM SHALL format times according to the user's system locale (12h/24h). | P1 | v0.1 | Implemented |
| REQ-TIME-008 | THE SYSTEM SHALL store dates internally as ISO 8601 datetime strings. | P0 | v0.1 | Implemented |

---

## 8. Architecture

> **Detailed architecture**: See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full module structure, data flow diagrams, layer descriptions, performance targets, and design decisions. This section provides a summary only.

### Current architecture

The plugin is a single `main.js` file (5866 lines) with a companion native Swift EventKit helper (`helper/Sources/main.swift` → compiled to `calendian-helper`). The helper is the current production data channel; JXA is legacy and no longer used for primary data flows.

Current key classes within `main.js`:
- `CalendarPlugin` (extends `Plugin`) — lifecycle, settings, helper path discovery
- `CalendarSettingsTab` (extends `PluginSettingTab`) — settings UI, source discovery
- `CalendarView` (extends `ItemView`) — sidebar panel, owns calendar grid + `MacOSIntegration`
- `MacOSIntegration` — EventKit helper execution, in-memory cache, render logic

Data flow: `calendian-helper` (EventKit) → JSON stdout → `execHelper()` → `allEvents[]`/`allReminders[]` → `render()` → DOM

### Target modular structure (v0.3+, REQ-ARCH-001)

The code will be split into multiple `.js` files using Node.js `require()`. No TypeScript, no bundler. This is the **target** structure, not a claim that all files already exist:

```text
calendian/
├── main.js                      # plugin entry, view registration, lifecycle
├── helper/
│   ├── Sources/main.swift       # Swift EventKit native helper (IMPLEMENTED)
│   └── calendian-helper         # compiled binary (must be built from source)
├── src/
│   ├── macos/
│   │   ├── calendar-reader.js   # parse helper JSON → CalendianEvent[]
│   │   ├── reminder-reader.js   # parse helper JSON → CalendianReminder[]
│   │   ├── writer.js            # write adapter, safety-gated (v0.3+)
│   │   ├── helper-executor.js   # spawn helper, capture JSON, classify errors
│   │   └── permissions.js       # permission/error classification
│   ├── domain/
│   │   ├── event.js             # CalendianEvent model
│   │   ├── reminder.js          # CalendianReminder model
│   │   ├── association.js       # note association model
│   │   ├── goal.js              # CalendianGoal, CalendianStep (v0.5.5)
│   │   ├── habit.js             # CalendianHabit (v0.5.5)
│   │   └── review.js            # CalendianReview (v0.5.5)
│   ├── cache/
│   │   └── schedule-cache.js    # in-memory cache with range management
│   ├── ui/
│   │   ├── calendar-panel.js    # main sidebar view
│   │   ├── event-list.js
│   │   ├── reminder-list.js
│   │   ├── details-panel.js     # expandable details (v0.2+)
│   │   ├── settings-tab.js
│   │   └── diagnostics.js       # diagnostic panel (v0.2+)
│   ├── notes/                   # v0.5+
│   │   ├── frontmatter.js
│   │   ├── templates.js
│   │   └── note-link-resolver.js
│   └── self-direction/          # v0.5.5
│       ├── goals.js
│       ├── habits.js
│       ├── nudges.js
│       └── reviews.js
├── styles.css
├── manifest.json
└── docs/
```

---

## 9. Release policy

A version may be released only when:

1. all P0 requirements for that version pass acceptance;
2. README reflects the current status;
3. risk register is reviewed;
4. manual test suites for the version pass;
5. known limitations are documented.

---

## 10. Open specification questions

These must be resolved before the related release:

1. ~~What stable identifiers are available from Calendar.app and Reminders.app through JXA?~~ ✅ Resolved — EventKit provides `eventIdentifier` and `calendarItemIdentifier` UUIDs.
2. ~~How should duplicate calendar/list names be represented in settings?~~ ✅ Resolved — Account name disambiguation via `source.title` ("日历 — iCloud", "日历 — outlook@email.com"). Sources persisted by stable UUID.
3. ~~What should happen when selected date is outside the preload cache range?~~ ✅ Resolved — Show cache-miss message with "Go to Today" button. Background refresh not triggered for out-of-range dates.
4. ~~Should source filtering persist by name, id, or compound identity?~~ ✅ Resolved — Persist by stable EventKit UUID (`calendarIdentifier`/`calendarItemIdentifier`). Backward-compat fallback for old name-based entries.
5. ~~Should single-click date behavior be configurable for users migrating from the original Calendar plugin?~~ Deferred — Single-click = select date (Calendian default). `legacyClickBehavior` setting in schema for future consideration.
6. ~~What exact recurrence operations are safe through JXA?~~ ✅ Resolved — EventKit saves are safe by construction; recurrence handled natively.
7. ~~What diagnostic fields can be shown without exposing private data?~~ ✅ Resolved — Safe to show: platform, permission status, source counts, event/reminder counts, refresh timestamp, refresh duration, error class. Redacted by default: titles, notes, locations, URLs, attendee names.
