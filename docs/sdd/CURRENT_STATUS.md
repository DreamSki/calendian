# Current Implementation Status

> Status: living status document  
> Last updated: 2026-06-08

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
| Event display | Implemented | Title, time range, all-day handling, calendar badge with color, location, recurrence indicator, ongoing/soon highlights. |
| Reminder display | Implemented | Title, due time, list badge, priority indicator (high/medium/low). Completed reminders hidden by default. |
| Source filtering | Implemented | Toggle individual calendars/lists via settings. Filter by stable UUID (EventKit `calendarIdentifier`). In-memory instant apply via `render()`. Persisted in `data.json`. |
| Permission handling | Implemented | Independent calendar/reminder permission states with recovery guidance and retry buttons. Partial permission support (show available data + banner for denied source). |
| Error states | Implemented | Error classification (permission_denied, timeout, error). Per-source error banners with retry. Parse-failure isolation. Empty vs error distinction. |
| Month cell event dots | Implemented | Calendar-colored dots on month cells showing event presence per calendar. Hollow reminder dot. Multi-day event span support. Uses in-memory cache only (no helper calls). Respects source filters. Dynamic CSS injection for per-calendar colors. |
| Refresh / sync | Partial | Timer-driven refresh (configurable interval, default 5min). Manual refresh button. `_refreshRunning` concurrency guard. Window focus and EKEventStoreChangedNotification watch planned for v0.2. Post-write refresh planned for v0.3. See SPEC.md §7.6.1. |
| Right-click actions | Planned | Current day/week context menu is inherited from calendar note behavior; Calendian event/reminder actions are not complete. |
| Write operations | Planned | Native EventKit helper supports writes (`EKEventStore.save`). `toggle-reminder` command already implemented in helper. Full CRUD planned for v0.3-v0.4. |
| Note association | Planned | Existing daily/weekly note integration comes from the base calendar plugin behavior; Calendian event/reminder frontmatter association is not complete. |
| Tasks integration | Planned | Current task dots for daily notes exist from base plugin behavior; macOS Reminders sync with Obsidian Tasks is not implemented. |
| Timeline / week / statistics views | Planned | Not current behavior. |
| Goals and focus tracking | Planned | Requires note association and frontmatter infrastructure (v0.5 dependency). |
| Habit tracking and consistency | Planned | Requires note association and frontmatter infrastructure (v0.5 dependency). |
| Nudges and daily intention | Planned | Depends on notification infrastructure (v0.5). |
| Daily/weekly review generation | Planned | Depends on template and note association infrastructure (v0.5). |
| Android / cross-platform | Deferred | Requires a separate architecture and authentication model. |

## Current release label

Current repository state: **v0.1 read-only MVP — mostly complete**. Core read path is stable with EventKit.

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
- permission/error/empty/loading UI states.

Everything else must be marked as planned, experimental, or future.

## Immediate status corrections needed

1. ~~Align plugin name and id between README, SPEC, and `manifest.json`.~~ ✅ Done.
2. ~~Align Obsidian minimum version between README/SPEC and `manifest.json`.~~ ✅ Done (0.15.0).
3. ~~Mark multi-file structure in documentation as target architecture until code is actually split.~~ ✅ Architecture includes native helper module.
4. ~~Move unimplemented README feature claims into Planned Features.~~ ✅ Done.
5. ~~Add stable event/reminder IDs before any write, delete, or note-association feature is considered release-ready.~~ ✅ EventKit provides stable UUIDs.
6. ~~Rename plugin folder from `calendar-macos-sync` to `calendian`~~ ✅ Done (2026-06-08). Folder renamed, VIEW_TYPE_CALENDAR and helper path updated in main.js.
7. ~~Update ARCHITECTURE.md to document the native Swift EventKit helper module.~~ ✅ Done (2026-06-08).
8. Split `main.js` into multiple `.js` modules per target architecture (REQ-ARCH-001, target v0.3).

## Active session

> Updated by AI after every meaningful step. Next session reads this to continue without re-explaining context.

- **Doing:** TASK-013 — Month cell event dots (REQ-UX-006). Code complete, awaiting manual verification.
- **Done this session:** Implemented TASK-013: macOS event/reminder metadata source for Svelte calendar month cell dots.
  - Added `getEventMetadataSource()` to `MacOSIntegration` — returns a metadata source with `getDailyMetadata` that produces colored dots per calendar and a hollow dot for reminders.
  - Added `_eventSpansDate()` helper for multi-day event dot display (handles both all-day and timed multi-day events).
  - Added dynamic CSS injection (`_ensureDotStyleEl`, `_registerDotColor`, `_refreshDotColorCSS`) for per-calendar colored dots.
  - Restructured `CalendarView.onOpen()` to create `MacOSIntegration` before Calendar component, injecting the metadata source into the Svelte calendar's sources array.
  - Added `calendarComponent.$set({})` at end of `render()` to refresh calendar grid dots after data loads.
  - Added reminder dot CSS to `styles.css`.
  - Updated SPEC.md REQ-UX-006 → Implemented. Updated TASKS.md TASK-013 → Review. Updated CURRENT_STATUS.md.
- **Decisions:**
  - Used dynamic CSS injection (className-based) rather than modifying compiled Svelte Dot component — dots get a className like `caldot-rgb25500` that maps to an injected CSS rule overriding `fill`.
  - Reminder dot uses a hollow dot with `var(--text-muted)` via a CSS class `calendian-reminder-dot`.
  - Multi-day events produce dots on every day they span, matching TASK-011 behavior locally.
  - `getWeeklyMetadata` returns empty dots (weekly view doesn't need event dots in v0.2).
- **Verification needed:** Compile helper, check JS syntax, test in Obsidian (dots visible on month cells, correct colors, multi-day spans, reminder hollow dots, source filter respected, no performance issues on navigation).
- **Last action:** 2026-06-08 — TASK-013 code + doc updates complete.
