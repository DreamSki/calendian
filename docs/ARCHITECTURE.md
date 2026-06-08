# Calendian Architecture

> Status: architecture document (up-to-date for v0.3; helper is current; multi-file JS split in progress via `cat` concatenation)
> Last updated: 2026-06-08
> Plugin ID: `calendian`

This document describes the architecture of Calendian. The Swift EventKit helper (`helper/Sources/main.swift` → compiled `calendian-helper`) is the current production data channel. The JS codebase is split across `src/` modules and concatenated into `main.js` via `build-main.sh` (`cat`-based, zero external tools). See `REQ-ARCH-001`.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────┐
│                   Obsidian Plugin                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ main.js  │  │ Settings │  │   View Registry   │  │
│  │ Lifecycle│  │   Tab    │  │ (Calendar Panel)  │  │
│  └────┬─────┘  └──────────┘  └────────┬─────────┘  │
│       │                               │             │
│  ┌────┴───────────────────────────────┴──────────┐  │
│  │                 UI Layer                       │  │
│  │  calendar-panel │ event-list │ reminder-list  │  │
│  │  details-panel  │ settings-tab │ diagnostics  │  │
│  └────┬───────────────────────────────┬──────────┘  │
│       │                               │             │
│  ┌────┴──────────┐  ┌─────────────────┴──────────┐  │
│  │  Cache Layer   │  │      Domain Model          │  │
│  │ schedule-cache │  │ event │ reminder │ assoc   │  │
│  │                │  │ goal  │ habit   │ review   │  │
│  └────┬──────────┘  └─────────────────┬──────────┘  │
│       │                               │             │
│  ┌────┴───────────────────────────────┴──────────┐  │
│  │              macOS Adapter Layer               │  │
│  │  calendar-reader │ reminder-reader │ writer    │  │
│  │  permissions     │ helper-executor             │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────┴──────────────────────────┐  │
│  │              Notes Layer (v0.5+)               │  │
│  │  frontmatter │ templates │ note-link resolver │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────┴────────┐
              │  Swift Helper    │
              │  (calendian-     │
              │   helper)        │
              │  EventKit API    │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   Calendar.app   Reminders.app   EKEventStore
   (via EventKit — native, fast, full access)
```

---

## 2. Layer descriptions

### 2.1 Plugin lifecycle (`main.js`)

- Register custom view (sidebar calendar panel).
- Register settings tab.
- Initialize cache on plugin load.
- Set up auto-refresh interval.
- Clean up timers and cache on unload.
- Handle Obsidian workspace events (layout change, vault close).

### 2.2 UI layer (`src/ui/`)

**Components:**
- `calendar-panel.js` — Top-level Obsidian `ItemView`. Owns the calendar grid, date selection, and hosts event/reminder lists.
- `event-list.js` — Renders events for the selected date. Handles loading, empty, error, partial-permission states.
- `reminder-list.js` — Renders reminders for the selected date. Independent state from event list.
- `details-panel.js` — Expandable detail view for a selected event or reminder (v0.2+).
- `settings-tab.js` — Obsidian `PluginSettingTab`. Source discovery, filtering, refresh interval, display preferences.
- `diagnostics.js` — Diagnostic panel showing permission status, counts, timing, errors (v0.2+).

**State contract:** Each UI component receives a state prop and renders accordingly. Components do not call the helper directly.

```ts
type PanelState =
  | { kind: "unsupported-platform" }
  | { kind: "loading" }
  | { kind: "ready"; events: CalendianEvent[]; reminders: CalendianReminder[] }
  | { kind: "empty"; reason: "no-data" | "all-filtered" }
  | { kind: "partial"; events: CalendianEvent[] | null; reminders: CalendianReminder[] | null; errors: SourceError[] }
  | { kind: "error"; errors: SourceError[] };
```

### 2.3 Domain model (`src/domain/`)

Pure JavaScript modules. No side effects. No EventKit or Obsidian API dependencies.

- `event.js` — `CalendianEvent`
- `reminder.js` — `CalendianReminder`
- `association.js` — `CalendianAssociation`
- `goal.js` — `CalendianGoal`, `CalendianStep` (v0.5.5)
- `habit.js` — `CalendianHabit`, `CalendianHabitCompletion` (v0.5.5)
- `review.js` — `CalendianReview` (v0.5.5)

### 2.4 Cache layer (`src/cache/`)

- `schedule-cache.js` — In-memory cache of events and reminders for the configured date range.
- Cache is populated on plugin load via the macOS adapter layer.
- Date switches within cache range are instant (<100ms target).
- Auto-refresh re-populates cache on a timer. Old data is retained until new data is ready.
- Cache miss behavior: if selected date is outside range, trigger background load.

### 2.5 macOS adapter layer (`src/macos/` + `helper/`)

The adapter has two tiers:

**Native Swift helper (current)** (`helper/Sources/main.swift` → `calendian-helper`):
- Uses Apple EventKit framework for direct, native database access.
- Significantly faster than JXA for all operations.
- Commands output JSON to stdout: `calendars`, `lists`, `events`, `reminders`, `permissions`, `toggle-reminder`.
- Provides stable UUID IDs (`calendarIdentifier`, `eventIdentifier`, `calendarItemIdentifier`), account names (`source.title`), and colors (`cgColor`).
- Future commands: `create-event`, `edit-event`, `delete-event`, `create-reminder`, `edit-reminder`, `delete-reminder`.

**JS executor layer** (`src/macos/`):
- `helper-executor.js` — Spawn `calendian-helper`, capture JSON stdout, classify errors.
- `calendar-reader.js` — Parses helper JSON into `CalendianEvent[]`.
- `reminder-reader.js` — Parses helper JSON into `CalendianReminder[]`.
- `writer.js` — (v0.3+) Create/edit/delete via helper commands. Gated: confirmation + stable ID + refresh verification.
- `permissions.js` — Checks `EKEventStore.authorizationStatus` via helper `permissions` command.

**Safety boundary:** The writer module is the only code path that mutates source data. It MUST NOT be called without:
1. Stable source identity (`REQ-DATA-004`) — EventKit provides this natively.
2. User confirmation for destructive operations (`REQ-ERR-006`)
3. Write verification via source refresh (`REQ-WRITE-003`, `REQ-WRITE-008`)

### 2.6 Notes layer (`src/notes/`) — v0.5+

- `frontmatter.js` — Read/write `calendian:` frontmatter blocks. Merge with existing frontmatter (do not clobber). Body scan for inline `cal:ev:ID`/`cal:rem:ID` refs. Create note with collision-safe filenames.
- `templates.js` — Template variable substitution with `{{var}}` + `{{#key}}...{{/key}}` conditional blocks. Build event/reminder variable maps. Copy inline ref to clipboard.
- `note-link-resolver.js` — Resolve and repair note links when notes are renamed or moved.
- `codeblock.js` — Register `` ```calendian `` code block processor (renders events/reminders for target date). Markdown post-processor for inline `cal:ev:ID`/`cal:rem:ID` references (renders styled mini-table). Click-to-navigate from note to Calendian panel with highlight.

---

## 3. Data flow

### Read flow (current)

```
User clicks date
  → UI layer selects date
  → Cache layer checks if date is in range
  → Cache hit: return cached data (<100ms)
  → Cache miss: trigger macOS adapter read
  → macOS adapter spawns calendian-helper
  → Helper queries EventKit (EKEventStore)
  → Helper returns JSON to stdout
  → Adapter parses JSON into domain model
  → Cache stores parsed records
  → UI renders from cache
```

### Write flow (v0.3+)

```
User submits create/edit/delete form
  → UI validates required fields
  → UI requests confirmation (for destructive ops)
  → Writer checks stable identity (EventKit UUID)
  → Writer spawns calendian-helper write command
  → Helper saves via EKEventStore.save()
  → macOS syncs to iCloud/Google/Exchange automatically
  → Writer refreshes from source for verification
  → Cache reloads
  → UI re-renders from cache
```

### Refresh flow

All refresh paths converge on `MacOSIntegration.init()`, which is gated by `_refreshRunning` to prevent concurrent helper invocations.

#### Current triggers (all implemented v0.3)

```
Timer fires (refreshIntervalMinutes, default 5)
 Manual refresh button (↻ in date header)
  Permission retry button
   Window focus (window.addEventListener('focus'))
    macOS system notification (calendian-helper watch → EKEventStoreChanged → signal file poll)
     Post-write refresh (after create-event / create-reminder)
      Cache freshness check on startup (2× interval, min 15min)
       Source filter toggle in settings
            │
            ▼
       MacOSIntegration.init()
            │
       _refreshRunning? ── true ──→ skip (or pass-through for force=true, REQ-SYNC-008)
            │ false/force
            ▼
       execHelper(['events'/'reminders', fromISO, toISO, ...])
            │
       calendian-helper → EventKit → JSON stdout
            │
       JSON.parse() → domain model (CalendianEvent[] / CalendianReminder[])
            │
       this.allEvents / this.allReminders updated
            │
       saveEventsToCache() / saveRemindersToCache() → data.json
            │
       render() → DOM update
            │
       _refreshRunning = false
```

| Trigger | Status | Mechanism |
|---|---|---|
| Configurable timer | Implemented | `setInterval` on `refreshIntervalMinutes` (default 5) |
| Manual refresh | Implemented | ↻ button in date header |
| Cache stale check | Implemented | `isCacheFresh()` — 2× interval, min 15min |
| Permission retry | Implemented | Retry button calls `init()` |
| Source filter toggle | Implemented | `render()` with in-memory filter |
| Window focus | Implemented | `window.addEventListener('focus')` → `refreshInBackground()` always |
| macOS system notification | Implemented | `calendian-helper watch` subscribes `EKEventStoreChanged` → writes timestamp to signal file → JS polls every 2s → `refreshInBackground()` |
| Post-write refresh | Implemented | After `create-event`/`create-reminder` → `init(true)` |
| Watch process failure | Implemented | Watch exit logs warning → timer-based refresh remains active as fallback |

---

## 4. Source file layout (current v0.5 + target)

```
calendian/
├── main.js                      # Concatenated output (build-main.sh → cat)
├── main-head.js                 # Plugin entry, upstream calendar code, Calendian class skeletons
├── build-main.sh                # Concatenation script (cat src/ modules into main.js)
├── helper/
│   ├── Sources/main.swift       # Native Swift EventKit helper
│   └── calendian-helper         # Compiled binary (swiftc -parse-as-library)
├── src/
│   ├── macos/
│   │   ├── helper-executor.js   # Spawn helper, capture JSON, classify errors, refresh lifecycle [IMPLEMENTED]
│   │   ├── writer.js            # Write adapter (create-event, create-reminder), validation [IMPLEMENTED]
│   │   ├── calendar-reader.js   # Parses helper JSON → CalendianEvent[]
│   │   ├── reminder-reader.js   # Parses helper JSON → CalendianReminder[]
│   │   └── permissions.js       # Permission/error classification
│   ├── domain/
│   │   ├── event.js             # CalendianEvent interface
│   │   ├── reminder.js          # CalendianReminder interface
│   │   ├── association.js       # CalendianAssociation interface
│   │   ├── goal.js              # CalendianGoal, CalendianStep (v0.5.5)
│   │   ├── habit.js             # CalendianHabit (v0.5.5)
│   │   └── review.js            # CalendianReview (v0.5.5)
│   ├── cache/
│   │   └── schedule-cache.js    # In-memory cache + preload + date queries [IMPLEMENTED]
│   ├── ui/
│   │   ├── calendar-panel.js    # Main sidebar view (CalendarView)
│   │   ├── event-list.js        # Event rendering
│   │   ├── reminder-list.js     # Reminder rendering
│   │   ├── details-panel.js     # Expandable details
│   │   ├── settings-tab.js      # Plugin settings
│   │   └── diagnostics.js       # Diagnostic panel
│   ├── notes/                   # v0.5+ [4 of 4 files IMPLEMENTED]
│   │   ├── frontmatter.js        # Association index, body scan, create note
│   │   ├── templates.js          # Template engine, copy inline ref
│   │   ├── note-link-resolver.js # Resolve/repair renamed note paths
│   │   └── codeblock.js          # ```calendian code block + inline ref renderer
│   └── self-direction/          # v0.5.5
│       ├── goals.js
│       ├── habits.js
│       ├── nudges.js
│       └── reviews.js
├── styles.css
├── manifest.json
└── docs/
    ├── PRIVACY.md
    ├── ARCHITECTURE.md
    ├── SETTINGS_SCHEMA.md
    ├── RELEASE_CHECKLIST.md
    └── sdd/
        ├── README.md
        ├── CURRENT_STATUS.md
        ├── ACCEPTANCE.md
        ├── TESTING.md
        ├── TRACEABILITY.md
        ├── TASKS.md
        └── RISKS.md
```

**Module concatenation** (REQ-ARCH-001): `src/` modules use `MacOSIntegration.prototype.xxx = function() {...}` format. `build-main.sh` runs `cat` to concatenate them into `main.js`. No npm, no bundler. Edit in `src/`, run `./build-main.sh`, reload Obsidian.

---

## 5. Key design decisions

### 5.1 EventKit via native Swift helper

All Calendar/Reminders data flows through Apple's EventKit framework via the native Swift helper (`calendian-helper`). EventKit provides:
- Direct database access (no Apple Event overhead)
- Date-range predicates for server-side filtering
- Stable UUID-based identifiers
- Account/source metadata
- Automatic iCloud/Google/Exchange sync

There is no direct CalDAV, Google API, or Microsoft Graph client in the current architecture. Calendian sees only what macOS has configured. If a calendar account is removed from System Settings, its data disappears from Calendian automatically.

### 5.2 Memory + disk cache

Events and reminders are held in-memory for instant date switching (<100ms). A disk cache in `data.json` (`_eventsCache`, `_remindersCache`) enables near-instant cold start. Cache freshness is checked against a configurable interval (2× refresh interval, minimum 15 minutes). Stale cache triggers background refresh; fresh cache is shown immediately and background refresh is skipped.

Plugin settings (source filters, refresh interval, API keys) are also persisted to `data.json`. No external services.

### 5.3 Independent Calendar and Reminders state

Calendar and Reminders permissions, reads, and errors are tracked independently. A Reminders permission failure does not block Calendar display, and vice versa (`REQ-PERM-003`).

### 5.4 Self-direction data stays in Obsidian

Goals, habits, nudges, and reviews (§5.4–5.8 of SPEC) are stored exclusively in Obsidian (plugin settings, note frontmatter, or note content). They never pass through the macOS adapter layer. This is a hard architectural boundary.

### 5.5 Stable identity before mutation

No write, delete, or note-association operation is permitted without a stable source identity. Fallback display IDs (derived from title/time/calendar) may be used for UI hints only (`REQ-DATA-003`, `REQ-DATA-004`).

---

## 6. Performance targets

| Operation | Target | Measurement |
|---|---|---|
| Plugin initialization (cold) | < 3s for ≤1000 events | Wall clock |
| Date switch (cache hit) | < 100ms | Wall clock |
| Auto-refresh (background) | Non-blocking | Old cache retained |
| Cache memory | < 50MB for typical user | Approximate |
| Plugin unload | Timers cleared, no detached DOM | Manual inspection |

---

## 7. Architecture review cadence

- Review before any refactor that changes module boundaries.
- Review before write operations are implemented (`REQ-ARCH-001`).
- Review before cross-platform work begins.
- Review when a new domain entity is added.
