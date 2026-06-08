# Current Implementation Status

> Status: living status document  
> Last updated: 2026-06-09

This document records the actual repository state. It intentionally separates implemented behavior from planned behavior so that README, roadmap, and release notes do not overpromise.

**For detailed current implementation breakdown, see [Section 2 of SPEC.md](../../SPEC.md#2-current-implementation-status).**

## Repository-level status

| Area | Current status | Evidence / note |
|---|---|---|
| Plugin packaging | Implemented | `manifest.json` id=calendian, name=Calendian. Desktop-only enforced. Platform check with graceful message on non-macOS. |
| Target platform | Implemented | macOS-only with `isMacOS()` check. Non-macOS shows clear unsupported message. |
| macOS Calendar read access | Implemented | Native Swift EventKit helper (`calendian-helper`). 72ms read (~400x faster than JXA). Stable UUID-based event IDs, account info, location, URL, notes, recurrence, attendees all available. |
| macOS Reminders read access | Implemented | Native Swift EventKit helper. Stable reminder IDs, priority, notes, completion state. Reminder list account info available. |
| Cache | Implemented | ±6 month preload via EventKit predicate (date-filtered server-side). Disk cache in data.json (`_eventsCache`, `_remindersCache`). Cache freshness check (2x refresh interval, min 15min). Manual refresh button. No-block background refresh. |
| Calendar source discovery | Implemented | EventKit `calendar.calendarIdentifier` (UUID), account name (`source.title`), color, type. Display name includes account suffix ("日历 — chengbo.sun123@outlook.com"). |
| Reminder list discovery | Implemented | EventKit lists with UUID, account name, color. |
| Event display | Implemented | Title, time range, all-day handling, calendar badge with color, location, recurrence indicator, ongoing/soon highlights. Expandable detail panel (click to show location, URL, notes, attendees, calendar source, recurrence summary). Multi-day events shown on all overlapping days. Past events dimmed/hidden per setting. Recurring events marked with read-only indicator. |
| Reminder display | Implemented | Title, due date/time, list badge, priority indicator (high/medium/low). Completed reminders hidden by default. Overdue reminders visually distinguished (red border + badge + due date). No-date reminders in collapsible section. Display range selector (today / 7 days / all incomplete). Date-only reminders do not display synthetic `00:00` and edit forms preserve date-only shape. Subtask rendering ready (data-dependent — helper parentId not yet populated). Expandable detail panel (click-to-expand, shows due date, priority, list, notes, linked notes, edit/delete/copy). |
| Source filtering | Implemented | Toggle individual calendars/lists via settings. Filter by stable UUID (EventKit `calendarIdentifier`). In-memory instant apply via `render()`. Persisted in `data.json`. |
| Permission handling | Implemented | Independent calendar/reminder permission states with recovery guidance and retry buttons. Partial permission support (show available data + banner for denied source). |
| Error states | Implemented | Error classification (permission_denied, timeout, error). Per-source error banners with retry. Parse-failure isolation. Empty vs error distinction. |
| Month cell event dots | Implemented | Calendar-colored dots on month cells showing event presence per calendar. Hollow reminder dot. Multi-day event span support. Uses in-memory cache only (no helper calls). Respects source filters. Dynamic CSS injection for per-calendar colors. |
| Refresh / sync | Implemented | Timer-driven refresh (configurable interval, default 5min). Manual refresh button. Window focus refresh (REQ-SYNC-004). `_refreshRunning` concurrency guard. EKEventStoreChanged notification watch (REQ-SYNC-005). Post-write refresh (REQ-SYNC-006). Watch fallback to timer (REQ-SYNC-007). See SPEC.md §7.6.1. |
| In-app notifications | Implemented | Optional Obsidian Notice notifications for timed events starting within the configured lead window, previous-day notifications for eligible events/reminders, date-only due-day reminders, timed reminder lead notifications, and incomplete overdue reminders. Disabled by default. Settings expose global/event/reminder toggles, lead time, previous-day toggle, and previous-day local time. Phase-aware session-level de-duplication prevents refresh-loop repeats without suppressing other phases. Unavailable Notice API is reported in settings/diagnostics. |
| Right-click actions | Planned | Current day/week context menu is inherited from calendar note behavior; Calendian event/reminder actions are not complete. |
| Write operations | **Implemented (v0.4)** | Event/reminder creation, edit, and delete. Edit/delete for simple non-recurring events and all reminders. Completion toggle for reminders. Recurring event mutations blocked with Calendar.app redirect. `ConfirmActionModal` for destructive operations. Mutation safety guards (`canMutateEvent`, `canMutateReminder`). Post-write refresh. Write error handling. Default calendar/list. NL quick-create with English + Chinese regex + optional AI backend. |
| Note association | **Implemented (v0.5)** | Frontmatter schema per SPEC §5.3. `ensureAssociationIndex()` scans vault for `calendian.associations` frontmatter + body scan for inline `cal:ev:ID`/`cal:rem:ID` refs. `createNoteForEvent()`/`createNoteForReminder()` with template engine (`expandTemplate()`). Event detail panel shows "Linked Notes" + "+ Note" button. Reminder items show expandable linked notes list + "+📝" create button. Copy inline ref via `copyItemText()`. `calendian-event` code block renders events/reminders in notes. Inline ref renderer (`cal:ev:ID`/`cal:rem:ID`) renders styled mini-table. Highlight navigation from note → panel. Renamed/missing notes handled gracefully. |
| Tasks integration | Planned | Current task dots for daily notes exist from base plugin behavior; macOS Reminders sync with Obsidian Tasks is not implemented. |
| Timeline / week / statistics views | Planned | Not current behavior. |
| Goals and focus tracking | Planned | Requires note association and frontmatter infrastructure (v0.5 dependency). |
| Habit tracking and consistency | Planned | Requires note association and frontmatter infrastructure (v0.5 dependency). |
| Nudges and daily intention | Planned | Depends on notification infrastructure (v0.5). |
| Daily/weekly review generation | Planned | Depends on template and note association infrastructure (v0.5). |
| Android / cross-platform | Deferred | Requires a separate architecture and authentication model. |

## Current release label

Current repository state: **v0.5 complete — note association, rendering, live association sync, baseline notifications, reminder temporal semantics, classified notifications, reminder detail panel, and note→calendar creation done**. TASK-040 (frontmatter schema) done. TASK-041 (create/open notes with templates) done. TASK-042 (template variables) done. TASK-043 (baseline notifications) done. TASK-043a (temporal semantics/classified notifications) done. TASK-044 (reminder detail panel) done. TASK-045 (file-change live sync) done. TASK-046 (note→calendar creation) done. Next: TASK-050 (Tasks plugin integration) or TASK-090+ (self-direction features).

## README policy

README may list the following as current behavior:

- Obsidian desktop plugin (macOS-only);
- macOS Calendar integration via native EventKit helper (fast, stable IDs, account info);
- macOS Reminders integration via native EventKit helper;
- sidebar calendar with event/reminder panel;
- date selection with instant cache display;
- calendar/reminder source discovery with account names;
- source filtering by individual calendar/list;
- configurable auto-refresh with disk cache;
- permission/error/empty/loading UI states;
- expandable event details (location, URL, notes, attendees, recurrence summary);
- multi-day events shown on all overlapping days;
- past event display (normal/dimmed/hidden) setting;
- recurring event read-only indicator;
- overdue reminder styling (red border + badge + due date);
- no-date reminders in collapsible section;
- reminder display range selector (today / 7 days / all incomplete);
- month cell event dots (calendar-colored, hollow reminder dot, multi-day span);
- diagnostic export with consent modal and field redaction;
- event/reminder creation with validation and post-write refresh;
- event/reminder editing with pre-filled forms and post-write refresh;
- event/reminder deletion with confirmation dialog and post-write refresh;
- reminder completion toggle via clickable checkbox;
- recurring event edit/delete blocked with redirect to Calendar.app;
- natural language quick-create (English + Chinese regex parser);
- optional AI-powered NL parsing via configurable API (Enter-triggered, privacy-controlled);
- note association via frontmatter (`calendian: { events: [...], reminders: [...] }`);
- create note from event/reminder with template engine;
- linked notes display in event detail panel and reminder items;
- copy inline reference (`cal:ev:ID` / `cal:rem:ID`) to clipboard;
- `calendian-event` code block renderer;
- inline `cal:ev:ID` / `cal:rem:ID` reference renderer;
- highlight navigation from note → panel item;
- auto-link via body scan for inline refs.
- optional in-app notifications for upcoming timed events, previous-day event/reminder notices, date-only due-day reminders, timed reminder lead notices, and overdue reminders;
- `calendian-create` code block for creating events/reminders from notes with automatic inline ref replacement;

Everything else must be marked as planned, experimental, or future.

## Immediate status corrections needed

1. ~~Align plugin name and id between README, SPEC, and `manifest.json`.~~ ✅ Done.
2. ~~Align Obsidian minimum version between README/SPEC and `manifest.json`.~~ ✅ Done (0.15.0).
3. ~~Mark multi-file structure in documentation as target architecture until code is actually split.~~ ✅ Architecture includes native helper module.
4. ~~Move unimplemented README feature claims into Planned Features.~~ ✅ Done.
5. ~~Add stable event/reminder IDs before any write, delete, or note-association feature is considered release-ready.~~ ✅ EventKit provides stable UUIDs.
6. ~~Rename plugin folder from `calendar-macos-sync` to `calendian`~~ ✅ Done (2026-06-08). Folder renamed, VIEW_TYPE_CALENDAR and helper path updated in main.js.
7. ~~Update ARCHITECTURE.md to document the native Swift EventKit helper module.~~ ✅ Done (2026-06-08).
8. ~~Split `main.js` into multiple `.js` modules per target architecture (REQ-ARCH-001).~~ ✅ Done — `build-main.sh` concatenates `main-head.js` + reminder temporal helpers + macOS/cache/writer/notification modules + notes modules into `main.js`.

## Active session

> Updated by AI after every meaningful step. Next session reads this to continue without re-explaining context.

- **Doing:** Review for remaining items.
- **Just completed:** BUGFIX-007 — widen inline ref body scan regex for opaque EventKit IDs.
- **Completed this session:**
  - **BUGFIX-001 — source filter fallback (helper/Sources/main.swift):** When configured calendar/reminder IDs don't match any available source, helper was falling back to `calendars = nil` (all calendars) — a privacy leak. Fixed 3 locations to return empty `[]` when `filtered.isEmpty`.
  - **BUGFIX-002 — execHelper timeout (src/macos/helper-executor.js):** Added 30s timeout with settled guard, SIGTERM kill, and clearTimeout in all paths.
  - **BUGFIX-003 — manifest version (manifest.json, README, TASKS.md):** Bumped manifest version from 0.1.0 to 0.5.0. Updated README status from "in progress" to "complete" with added notification/note→calendar mentions. Removed duplicate v0.5.5 roadmap row.
  - **BUGFIX-004 — macOS version compatibility (helper/Sources/main.swift):** Added `isFullAccess(for:)` and `requestFullAccess(for:)` version-safe wrappers with `#available(macOS 14.0, *)` guards. On macOS 14+ uses `.fullAccess` / `requestFullAccessTo*`; on macOS 12-13 falls back to `.authorized` / `requestAccess(to:)` completion-handler API.
  - **BUGFIX-005 — error JSON via JSONEncoder (helper/Sources/main.swift):** Replaced all 13 string-interpolated `fputs("{\"error\":\"...\"}\n", stderr)` calls with `printError()` function using `ErrorResponse` Codable struct + `JSONEncoder`. Added manual-escaping fallback for encode failures. Special-character-safe error output verified.
  - **BUGFIX-006 — stale body scan index (src/notes/frontmatter.js):** `ensureAssociationIndex()` was preserving `_bodyScanIndex` on rebuild, carrying stale inline-ref entries forward because `scanBodiesForInlineRefs()` only adds. Now always starts fresh (frontmatter populates sync, body scan populates async). Removed `if (isRebuild && this._bodyScanIndex) { index = this._bodyScanIndex }` carry-over.
  - **UI/UX refresh — CSS overhaul (`styles.css`):** Added design tokens, event color rail via `box-shadow: inset`, priority color dots replacing `!!!` text, skeleton loading animation, inline chip styling, toolbar icon buttons, `<details>` folding for no-date reminders, codeblock `max-width` cap. All through Obsidian theme variables.
  - **`render()` method:** Today summary without emoji + overdue in red. Date header simplified. **Toolbar refactored** into separate icon-button row using `obsidian.setIcon`. **Scroll position preserved** across re-renders (no more jump-to-top).
  - **`renderEventsSection()` rewrite:** Calendar color → left 3px rail via `--cal-event-color`. Badge removed, calendar name as muted subtitle. All-day class + "soon" chip. All detail panel / linked notes / mutation guards preserved.
  - **`renderRemindersSection()` rewrite:** `obsidian.setIcon` checkboxes with loader spinner feedback. Priority color dots replace text. List badge removed. No-date section → `<details>` CSS-only folding. Simplified detail priority labels.
  - **`renderLoading()` upgraded** with skeleton pulse rows.
  - **Inline ref chip mode (`src/notes/codeblock.js`):** Single ref → inline chip with icon. Multiple → table (unchanged). `CalendianInlineChipChild` for live-update.
  - **Build:** `main.js` (11818 lines). Helper compiles OK. Helper data channel → valid JSON.
- **Decisions:**
  - External proposal ~90% correct — adjusted for method signatures, `obsidian.setIcon` fallback, and preserving existing detail panel / linked notes / mutation guard functionality.
  - `<details>` only for no-date section; dated reminder expand/collapse kept JS-based for detail panel rendering.
  - `renderSelf` renamed to avoid collision with inner `self` references.
  - BUGFIX-006: Fresh index on every rebuild. The brief async body scan gap (~seconds, capped 200 files) is acceptable — preserving stale entries indefinitely is the greater evil.
- **Next:** Review for any remaining issues.
- **BUGFIX-007 — inline ref body scan regex (`src/notes/frontmatter.js:161`):** Widened char class from `[A-Fa-f0-9:-]{20,}` (hex+colon+hyphen only) to `[^\s`]{20,}` (any non-whitespace, non-backtick). This ensures opaque EventKit IDs with non-hex characters are matched by the body scan for inline `cal:ev:ID`/`cal:rem:ID` refs. The inline renderer regex in `src/notes/codeblock.js:165` already used `(.+)` and needed no change. Rebuilt `main.js` (11726 lines). Helper compiles OK, `node --check` clean.
- **Last action:** 2026-06-09 — BUGFIX-007: widened inline ref body scan regex char class to `[^\s`]`.

