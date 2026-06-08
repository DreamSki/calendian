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
| Reminder display | Implemented | Title, due date/time, list badge, priority indicator (high/medium/low). Completed reminders hidden by default. Overdue reminders visually distinguished (red border + badge + due date). No-date reminders in collapsible section. **Today view**: shows overdue + today's + upcoming N days' reminders (configurable: 3/7/all, default 7). **Other days**: only reminders due on that exact day. Sort order for today: today → future → overdue → completed. Date-only reminders do not display synthetic `00:00` and edit forms preserve date-only shape. Subtask rendering ready (data-dependent — helper parentId not yet populated). Expandable detail panel (click-to-expand, shows due date, priority, list, notes, linked notes, edit/delete/copy). |
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
- selected-day reminder display with overdue items included;
- today view shows overdue + today + upcoming N days (configurable 3/7/all); other days show only that day's reminders;
- sort order for today: today → future → overdue → completed;
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

- **Doing:** Reminder date filtering & sort refactor (REQ-REM-007).
- **Just completed:** Rewrote `getRemindersForDate()` and sort logic in `renderRemindersSection()`. Added `upcomingReminderDays` setting (3/7/all, default 7). Rebuilt main.js. Updated SDD docs.
- **Completed this session:**
  - **`getRemindersForDate()`** in `src/cache/schedule-cache.js`: Today view now queries from 2000-01-01 to (today + upcomingReminderDays). Other days query only that exact day's date range (midnight to 23:59:59).
  - **Sort order** in `main-head.js:renderRemindersSection()`: Today view sorts as today → future → overdue → completed. Other days sort by due time with completed at bottom.
  - **New setting** `upcomingReminderDays` (default 7): dropdown in "Reminder display settings" section with options 3 days / 7 days / All future. Auto re-renders on change.
  - **`_currentRenderDate`** stored on MacOSIntegration in `render()` so `renderRemindersSection()` can detect isToday without changing its signature.
  - **Docs updated:** SETTINGS_SCHEMA.md, CURRENT_STATUS.md (reminder display row + allowed list + active session).
  - **Build:** `main.js` rebuilt (11703 lines).
- **Decisions:**
  - No-date reminders remain unchanged (shown every day) per user preference.
  - Completed reminders always at very bottom, even below overdue.
  - Settings dropdown uses 0/3/7 numeric values stored as number; UI shows "3 days", "7 days", "All future".
- **Next:** Reload Obsidian and verify: today shows overdue+today+future with correct sort; other day shows only that day's reminders; setting toggle works.
- **Last action:** 2026-06-09 — design parity audit complete, orphaned CSS cleaned, built and verified.
