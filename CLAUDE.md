# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before anything else

If resuming from a previous session: read `docs/sdd/CURRENT_STATUS.md#active-session` first. It tells you what was in progress, what was completed, and what decisions were made. Never assume you know the current state from code alone — the session note is the handoff signal.

## Quick start

```bash
# Compile native helper (required — plugin is a shell without it)
swiftc helper/Sources/main.swift -o calendian-helper

# Then reload Obsidian. No npm, no build step, no TypeScript.
```

## Architecture

All code in `main.js` (5866 lines). The first ~4400 lines are upstream Calendar plugin code (Svelte calendar grid, daily/weekly notes). Calendian code starts at line 4444:

| Lines | Class | Role |
|-------|-------|------|
| 4444–5481 | `MacOSIntegration` | Spawns native Swift helper (`execHelper`), caches events/reminders, renders sidebar panel. Contains legacy `execJXA`/`parseEvents` — not used by primary data paths. |
| 5483–5743 | `CalendarView` | Obsidian `ItemView`. Bridges Svelte calendar to `MacOSIntegration`. Owns cache read/write helpers. |
| 5746–5864 | `CalendarPlugin` | Lifecycle, settings, discovers helper binary path, view registration. |

Data flow: `calendian-helper` (EventKit) → JSON stdout → `execHelper()` → in-memory cache → `render()` → DOM. Disk cache written to `data.json` on each successful load.

## What NOT to do

- **Do not introduce npm, TypeScript, esbuild, or any build toolchain.** The project is plain JS loaded directly by Obsidian. Target multi-file split (v0.3) uses `require()` only.
- **Do not implement write operations** (create/edit/delete events or reminders). v0.1 is read-only. REQ-ARCH-001 gates writes behind safety requirements that don't exist yet.
- **Do not change code without updating docs.** See SDD workflow below — this is the #1 cause of project drift.
- **Do not remove legacy JXA code** (`execJXA`, `parseEvents`, `parseReminders`). It's unused but kept as fallback reference.
- **Do not log event titles, notes, locations, or reminder text.** Use `console.log("[Calendian] ...")` prefix for all logging.

## SDD workflow (mandatory after every code change)

This project uses Specification-Driven Development. `SPEC.md` is the single source of truth. **The most common failure mode: code gets changed, SPEC.md §7 status table and TASKS.md don't get updated, next session starts with wrong assumptions.**

After any code change:
1. Update `SPEC.md` §7 requirement status if the change affects any REQ-* item
2. Update `docs/sdd/TASKS.md` task status
3. Update `docs/sdd/CURRENT_STATUS.md` if user-visible behavior changed
4. Check that README doesn't claim unimplemented features as current
5. **Update `docs/sdd/CURRENT_STATUS.md` → `## Active session`** with what you just did, what's next, and any decisions made. This is how the next session knows where to continue without re-explaining context.
6. Commit with message: `<area>: <what changed> (REQ-XXX)` — e.g. `macos: add helper binary timeout handling (REQ-ERR-001)`. Commit doc-only changes separately from code changes.

## Key conventions

**Document map** — when you need to find something:
- `SPEC.md` §2,§7 → what's implemented vs planned. `SPEC.md` §5 → domain model. `SPEC.md` §8 → target file layout.
- `docs/sdd/TASKS.md` → implementation progress per task
- `docs/sdd/CURRENT_STATUS.md` → overview truth table
- `docs/ARCHITECTURE.md` → module boundaries and data flow (helper layer is current, `src/` split is target)
- `docs/SETTINGS_SCHEMA.md` → data.json shape and migration rules
- `docs/PRIVACY.md` → what data is stored/logged/exposed
- `ROADMAP.md` → what ships in which version

**Settings field names** (old → new, migration in `loadOptions()`):
`showMacOSCalendar→enableCalendar`, `showMacOSReminders→enableReminders`, `macOSCalendarNames→selectedCalendarIds`, `macOSReminderListNames→selectedReminderListIds`, `macOSRefreshInterval→refreshIntervalMinutes`. Always use new names in code.

**Field backward compat** — cache files may use old names, so always check both:
```js
evt.isAllDay !== undefined ? evt.isAllDay : evt.allday
evt.title || evt.summary || ""
evt.calendarName || evt.calendar || ""
```

**Permission/error state** — independent per-source objects, never a single boolean:
```js
this.permissionState = { calendar: 'unknown', reminders: 'unknown' };
// values: 'unknown' | 'granted' | 'denied' | 'timeout' | 'error'
this.lastError = { calendar: null, reminders: null };
// { type, message, timestamp }
```

**Calendar colors** — EventKit CGColor components in 0–1 range, parsed as `"r,g,b"` string. Convert via `calendarToCSS()` to CSS `rgb()`.

## Git

- **Commit format:** `<area>: <description> (REQ-XXX)` — area is `docs`, `macos`, `ui`, `cache`, `settings`, or `spec`.
- **Separate doc commits from code commits.** If a change touches both `main.js` and spec docs, make two commits.
- **Never run destructive commands without confirmation.** `git reset --hard`, `git checkout -- .`, `git clean -fd` wipe data irreversibly. When user asks to "undo" or "roll back", first identify the specific scope: a single file edit, all uncommitted changes, or a specific commit. Always show what will be lost (`git diff`, `git log`) before acting. Prefer `git stash` for uncommitted work (recoverable) and `git revert` for committed work (creates a new commit rather than rewriting history).

## Known issues

- **Folder name** is `calendar-macos-sync`, plugin ID is `calendian`. Should be renamed to `calendian` before public release.
- **Helper binary** must be compiled from `helper/Sources/main.swift`. Plugin silently produces no data without it — no warning in UI beyond empty panels.
- **No automated tests.** All verification is manual: reload Obsidian, check console, check panel.
- **`execJXA` and `parseEvents`/`parseReminders`** are legacy JXA-format parsers. Current data comes from `execHelper` (JSON). These remain as reference but should not be used for new features.

## When suggesting changes

- Explain what behavior changes and why it helps, in plain language
- If a change touches data flow (helper, cache, render), trace it end-to-end before proposing
- Prefer minimal changes that solve the problem without restructuring unrelated code
