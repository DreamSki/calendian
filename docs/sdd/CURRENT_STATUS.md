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
| Event display | Implemented | Title, time range, all-day handling, calendar badge with color, location, recurrence indicator, ongoing/soon highlights. Expandable detail panel (click to show location, URL, notes, attendees, calendar source, recurrence summary). Multi-day events shown on all overlapping days. Past events dimmed/hidden per setting. Recurring events marked with read-only indicator. |
| Reminder display | Implemented | Title, due time, list badge, priority indicator (high/medium/low). Completed reminders hidden by default. Overdue reminders visually distinguished (red border + badge + due date). No-date reminders in collapsible section. Display range selector (today / 7 days / all incomplete). Subtask rendering ready (data-dependent — helper parentId not yet populated). |
| Source filtering | Implemented | Toggle individual calendars/lists via settings. Filter by stable UUID (EventKit `calendarIdentifier`). In-memory instant apply via `render()`. Persisted in `data.json`. |
| Permission handling | Implemented | Independent calendar/reminder permission states with recovery guidance and retry buttons. Partial permission support (show available data + banner for denied source). |
| Error states | Implemented | Error classification (permission_denied, timeout, error). Per-source error banners with retry. Parse-failure isolation. Empty vs error distinction. |
| Month cell event dots | Implemented | Calendar-colored dots on month cells showing event presence per calendar. Hollow reminder dot. Multi-day event span support. Uses in-memory cache only (no helper calls). Respects source filters. Dynamic CSS injection for per-calendar colors. |
| Refresh / sync | Partial | Timer-driven refresh (configurable interval, default 5min). Manual refresh button. `_refreshRunning` concurrency guard. Window focus and EKEventStoreChangedNotification watch deferred beyond v0.2. Post-write refresh planned for v0.3. See SPEC.md §7.6.1. |
| Right-click actions | Planned | Current day/week context menu is inherited from calendar note behavior; Calendian event/reminder actions are not complete. |
| Write operations | **Partial (v0.3)** | Event and reminder creation implemented via Swift helper `create-event`/`create-reminder` commands + `EventCreateModal`/`ReminderCreateModal`. Edit/delete planned for v0.4. Natural language parsing (TASK-023) pending. Default calendar/list settings implemented. |
| Note association | Planned | Existing daily/weekly note integration comes from the base calendar plugin behavior; Calendian event/reminder frontmatter association is not complete. |
| Tasks integration | Planned | Current task dots for daily notes exist from base plugin behavior; macOS Reminders sync with Obsidian Tasks is not implemented. |
| Timeline / week / statistics views | Planned | Not current behavior. |
| Goals and focus tracking | Planned | Requires note association and frontmatter infrastructure (v0.5 dependency). |
| Habit tracking and consistency | Planned | Requires note association and frontmatter infrastructure (v0.5 dependency). |
| Nudges and daily intention | Planned | Depends on notification infrastructure (v0.5). |
| Daily/weekly review generation | Planned | Depends on template and note association infrastructure (v0.5). |
| Android / cross-platform | Deferred | Requires a separate architecture and authentication model. |

## Current release label

Current repository state: **v0.3 safe create — partial**. Event and reminder creation complete (10/10 REQ-WRITE requirements). Natural language parsing (TASK-023) and deferred v0.2 items pending.

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
- diagnostic export with consent modal and field redaction.

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

- **Doing:** Documentation alignment for v0.3 progress.
- **Done this session (v0.3):**
  - **Swift helper**: `create-event` and `create-reminder` commands. Tested with real EventKit data.
  - **EventCreateModal**: Full event creation form with validation + error display + post-create refresh.
  - **ReminderCreateModal**: Full reminder creation form with validation + error display + post-create refresh.
  - **Sidebar buttons**: "+Event" and "+Remind" in header row.
  - **Default calendar/list settings**: `defaultCalendarId`/`defaultReminderListId` in settings tab, auto-detect fallback (Outlook).
  - **Bug fixes**: ISO date millisecond stripping, date parsing when no time entered, async dropdown loading, error message display.
  - **Code split attempt**: require() blocked; reverted. Module files preserved.
- **Decisions:**
  - require() to local files does NOT work in Obsidian plugin context.
  - Settings stored in `data.json` (gitignored) — no personal data in git.
  - Auto-detect mode uses "outlook" substring matching (generic, not personal).
- **Next:** Natural language event parsing (TASK-023). Deferred v0.2 items.
- **Bug fixes**: Reminder priority always defaulted to "none" due to positional arg mismatch (JS conditional push vs Swift positional parse). Fixed by always pushing placeholders for all optional args in both create-event and create-reminder.
- **Last action:** 2026-06-08 — fixed reminder priority + event optional-field positional arg bugs.
