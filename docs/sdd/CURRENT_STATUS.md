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
| Reminder display | Implemented | Title, due time, list badge, priority indicator (high/medium/low). Completed reminders hidden by default. Overdue reminders visually distinguished (red border + badge + due date). No-date reminders in collapsible section. Display range selector (today / 7 days / all incomplete). Subtask rendering ready (data-dependent — helper parentId not yet populated). |
| Source filtering | Implemented | Toggle individual calendars/lists via settings. Filter by stable UUID (EventKit `calendarIdentifier`). In-memory instant apply via `render()`. Persisted in `data.json`. |
| Permission handling | Implemented | Independent calendar/reminder permission states with recovery guidance and retry buttons. Partial permission support (show available data + banner for denied source). |
| Error states | Implemented | Error classification (permission_denied, timeout, error). Per-source error banners with retry. Parse-failure isolation. Empty vs error distinction. |
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

- **Doing:** TASK-012 (reminder polish) — code changes complete, awaiting verification.
- **Done this session:** Implemented REQ-REM-005 (overdue styling with red border + badge), REQ-REM-006 (no-date reminders in collapsible section with setting toggle), REQ-REM-007 (display range selector: today/7days/all, both inline and in settings), REQ-REM-009 (subtask rendering via parentId — partial, helper does not yet populate parentId). Added two new settings: `showNoDateReminders` (boolean), `reminderDisplayRange` ('today'|'7days'|'all'). Updated `getRemindersForDate` to respect display range. Added `getNoDateReminders` helper. Updated SPEC.md status table and CURRENT_STATUS.md.
- **Decisions:** REQ-REM-009 marked Partial because the Swift helper struct has `parentId` field but `mapReminder()` always sets it to `nil`. Subtask rendering code is ready but will only display data once the helper is updated to fetch child reminders via EventKit.
- **Next:** Compile helper (`swiftc -parse-as-library helper/Sources/main.swift -o calendian-helper`), verify in Obsidian. Then update TASKS.md to Done and commit.
