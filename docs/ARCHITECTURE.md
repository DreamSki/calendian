# Calendian Architecture

> Status: target architecture document (code may not yet reflect this structure)
> Last updated: 2026-06-07
> Plugin ID: `calendian`

This document describes the target architecture for Calendian. The current implementation is bundled in `main.js`; this target structure is the direction for refactoring before complex write features ship (see `REQ-ARCH-001`).

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────────────┐
│                   Obsidian Plugin                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ main.ts  │  │ Settings │  │   View Registry   │  │
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
│  │  permissions     │ JXA executor               │  │
│  └────────────────────┬──────────────────────────┘  │
│                       │                             │
│  ┌────────────────────┴──────────────────────────┐  │
│  │              Notes Layer (v0.5+)               │  │
│  │  frontmatter │ templates │ note-link resolver │  │
│  └───────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────┴────────┐
              │  macOS Automation │
              │  /usr/bin/osascript│
              │  (JXA)            │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   Calendar.app   Reminders.app   System Events
```

---

## 2. Layer descriptions

### 2.1 Plugin lifecycle (`main.ts`)

- Register custom view (sidebar calendar panel).
- Register settings tab.
- Initialize cache on plugin load.
- Set up auto-refresh interval.
- Clean up timers and cache on unload.
- Handle Obsidian workspace events (layout change, vault close).

### 2.2 UI layer (`src/ui/`)

**Components:**
- `calendar-panel.ts` — Top-level Obsidian `ItemView`. Owns the calendar grid, date selection, and hosts event/reminder lists.
- `event-list.ts` — Renders events for the selected date. Handles loading, empty, error, partial-permission states.
- `reminder-list.ts` — Renders reminders for the selected date. Independent state from event list.
- `details-panel.ts` — Expandable detail view for a selected event or reminder (v0.2+).
- `settings-tab.ts` — Obsidian `PluginSettingTab`. Source discovery, filtering, refresh interval, display preferences.
- `diagnostics.ts` — Diagnostic panel showing permission status, counts, timing, errors (v0.2+).

**State contract:** Each UI component receives a state prop and renders accordingly. Components do not call JXA directly.

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

Pure TypeScript interfaces. No side effects. No JXA or Obsidian API dependencies.

- `event.ts` — `CalendianEvent`
- `reminder.ts` — `CalendianReminder`
- `association.ts` — `CalendianAssociation`
- `goal.ts` — `CalendianGoal`, `CalendianStep` (v0.5.5)
- `habit.ts` — `CalendianHabit`, `CalendianHabitCompletion` (v0.5.5)
- `review.ts` — `CalendianReview` (v0.5.5)

### 2.4 Cache layer (`src/cache/`)

- `schedule-cache.ts` — In-memory cache of events and reminders for the configured date range.
- Cache is populated on plugin load via the macOS adapter layer.
- Date switches within cache range are instant (<100ms target).
- Auto-refresh re-populates cache on a timer. Old data is retained until new data is ready.
- Cache miss behavior: if selected date is outside range, trigger background load.

### 2.5 macOS adapter layer (`src/macos/`)

This is the only layer that calls `/usr/bin/osascript` or uses JXA.

- `calendar-reader.ts` — Executes JXA to read Calendar.app events. Returns typed `CalendianEvent[]`. Handles timeout, permission denied, parse errors.
- `reminder-reader.ts` — Executes JXA to read Reminders.app reminders. Returns typed `CalendianReminder[]`.
- `writer.ts` — (v0.3+) Creates, edits, deletes Calendar events and Reminders. All write operations are gated: confirmation required, stable ID required, refresh-after-write required.
- `permissions.ts` — Checks and classifies macOS Automation permission state for Calendar and Reminders independently.

**Safety boundary:** The writer module is the only code path that mutates source data. It MUST NOT be called without:
1. Stable source identity (`REQ-DATA-004`)
2. User confirmation for destructive operations (`REQ-ERR-006`)
3. Write verification via source refresh (`REQ-WRITE-003`, `REQ-WRITE-008`)

### 2.6 Notes layer (`src/notes/`) — v0.5+

- `frontmatter.ts` — Read/write `calendian:` frontmatter blocks. Merge with existing frontmatter (do not clobber).
- `templates.ts` — Template variable substitution for meeting notes, daily reflections, weekly reviews.
- `note-link-resolver.ts` — Resolve and repair note links when notes are renamed or moved.

---

## 3. Data flow

### Read flow (current)

```
User clicks date
  → UI layer requests date
  → Cache layer checks if date is in range
  → Cache hit: return cached data (<100ms)
  → Cache miss: trigger macOS adapter read
  → macOS adapter executes JXA
  → JXA returns raw records
  → Adapter parses into domain model
  → Cache stores parsed records
  → UI renders from cache
```

### Write flow (v0.3+)

```
User submits create/edit/delete form
  → UI validates required fields
  → UI requests confirmation (for destructive ops)
  → Writer checks stable identity
  → Writer executes JXA write
  → Writer refreshes from source
  → Writer verifies write result
  → Cache invalidates and reloads
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
├── main.ts                      # Plugin entry, view registration, lifecycle
├── src/
│   ├── macos/
│   │   ├── calendar-reader.ts   # Calendar.app JXA read adapter
│   │   ├── reminder-reader.ts   # Reminders.app JXA read adapter
│   │   ├── writer.ts            # Write adapter, safety-gated (v0.3+)
│   │   ├── jxa-executor.ts      # Shared JXA execution, timeout, error handling
│   │   └── permissions.ts       # Permission/error classification
│   ├── domain/
│   │   ├── event.ts             # CalendianEvent interface
│   │   ├── reminder.ts          # CalendianReminder interface
│   │   ├── association.ts       # CalendianAssociation interface
│   │   ├── goal.ts              # CalendianGoal, CalendianStep (v0.5.5)
│   │   ├── habit.ts             # CalendianHabit (v0.5.5)
│   │   └── review.ts            # CalendianReview (v0.5.5)
│   ├── cache/
│   │   └── schedule-cache.ts    # In-memory cache with range management
│   ├── ui/
│   │   ├── calendar-panel.ts    # Main sidebar view
│   │   ├── event-list.ts        # Event rendering
│   │   ├── reminder-list.ts     # Reminder rendering
│   │   ├── details-panel.ts     # Expandable details (v0.2+)
│   │   ├── settings-tab.ts      # Plugin settings
│   │   └── diagnostics.ts       # Diagnostic panel (v0.2+)
│   ├── notes/                   # v0.5+
│   │   ├── frontmatter.ts
│   │   ├── templates.ts
│   │   └── note-link-resolver.ts
│   └── self-direction/          # v0.5.5
│       ├── goals.ts
│       ├── habits.ts
│       ├── nudges.ts
│       └── reviews.ts
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

### 5.1 JXA as the only source adapter

All Calendar/Reminders data flows through JXA. There is no direct CalDAV, Google API, or Microsoft Graph client in the current architecture. This keeps the privacy model simple: if macOS doesn't have the data, Calendian doesn't either.

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
