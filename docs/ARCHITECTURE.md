# Calendian Architecture

> Status: architecture document (partially implemented; helper is current; multi-file JS split is target)
> Last updated: 2026-06-08
> Plugin ID: `calendian`

This document describes the architecture of Calendian. The Swift EventKit helper (`helper/Sources/main.swift` → compiled `calendian-helper`) is the current production data channel. The JS code is bundled in `main.js`; the target structure splits it into multiple `.js` modules before complex write features ship (see `REQ-ARCH-001`).

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

- `frontmatter.js` — Read/write `calendian:` frontmatter blocks. Merge with existing frontmatter (do not clobber).
- `templates.js` — Template variable substitution for meeting notes, daily reflections, weekly reviews.
- `note-link-resolver.js` — Resolve and repair note links when notes are renamed or moved.

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

```
Timer fires (configurable interval)
  → macOS adapter reads all sources
  → Old cache retained
  → New data parsed
  → Cache atomically replaced
  → UI re-renders if selected date data changed
  → If read fails: retain old cache, show stale-data indicator
```

---

## 4. Source file layout (target)

```text
calendian/
├── main.js                      # Plugin entry, view registration, lifecycle
├── helper/
│   ├── Sources/main.swift       # Native Swift EventKit helper
│   └── calendian-helper         # Compiled binary
├── src/
│   ├── macos/
│   │   ├── calendar-reader.js   # Parses helper JSON → CalendianEvent[]
│   │   ├── reminder-reader.js   # Parses helper JSON → CalendianReminder[]
│   │   ├── writer.js            # Write adapter, safety-gated (v0.3+)
│   │   ├── helper-executor.js   # Spawn helper, capture JSON, classify errors
│   │   └── permissions.js       # Permission/error classification
│   ├── domain/
│   │   ├── event.js             # CalendianEvent interface
│   │   ├── reminder.js          # CalendianReminder interface
│   │   ├── association.js       # CalendianAssociation interface
│   │   ├── goal.js              # CalendianGoal, CalendianStep (v0.5.5)
│   │   ├── habit.js             # CalendianHabit (v0.5.5)
│   │   └── review.js            # CalendianReview (v0.5.5)
│   ├── cache/
│   │   └── schedule-cache.js    # In-memory cache with range management
│   ├── ui/
│   │   ├── calendar-panel.js    # Main sidebar view
│   │   ├── event-list.js        # Event rendering
│   │   ├── reminder-list.js     # Reminder rendering
│   │   ├── details-panel.js     # Expandable details (v0.2+)
│   │   ├── settings-tab.js      # Plugin settings
│   │   └── diagnostics.js       # Diagnostic panel (v0.2+)
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

### 5.2 In-memory cache, not persistent

Calendar data changes outside Obsidian (user adds event in Calendar.app). Persistent cache would create staleness problems. In-memory cache with auto-refresh is simpler and more correct.

Exception: plugin settings (source filters, refresh interval) ARE persisted to `data.json`.

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
