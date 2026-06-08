# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Before anything else

If resuming from a previous session: read `docs/sdd/CURRENT_STATUS.md#active-session` first. It tells you what was in progress, what was completed, and what decisions were made. Never assume you know the current state from code alone — the session note is the handoff signal.

## Quick start

```bash
# Compile native helper (required — plugin is a shell without it)
swiftc -parse-as-library helper/Sources/main.swift -o calendian-helper

# Concatenate src/ modules into main.js (one-time after editing src/ files)
./build-main.sh

# Then reload Obsidian.
```

## Architecture

All code in `main.js` (concatenated from `main-head.js` + `src/*.js` modules). The first ~4400 lines are upstream Calendar plugin code (Svelte calendar grid, daily/weekly notes). Calendian code starts at line 4444. Edit in `src/` modules, run `./build-main.sh` to rebuild `main.js`.

| Lines (in main-head.js / src/) | Class | Role |
|-------|-------|------|
| main-head.js | `MacOSIntegration` (skeleton) | Constructor, state init, constants |
| src/macos/helper-executor.js | `MacOSIntegration` (prototype) | Spawns native Swift helper (`execHelper`), caches events/reminders, renders sidebar panel. Contains legacy `execJXA`/`parseEvents` — not used by primary data paths. |
| src/cache/schedule-cache.js | `MacOSIntegration` (prototype) | Cache save/load, preload, date queries |
| src/macos/writer.js | `MacOSIntegration` (prototype) | Event/reminder create, edit, delete via helper. Mutation safety guards (`canMutateEvent`, `canMutateReminder`). Completion toggle. Node.js-only code guarded with `typeof module` check. |
| src/notes/frontmatter.js | `MacOSIntegration` (prototype) | Frontmatter read/write for `calendian:` YAML. Association index (frontmatter scan + body scan for inline refs). `createNoteForEvent()`/`createNoteForReminder()`. Filename sanitization. |
| src/notes/templates.js | `MacOSIntegration` (prototype) | `expandTemplate()` with `{{var}}` + `{{#key}}...{{/key}}` conditional blocks. `buildEventTemplateVars()`/`buildReminderTemplateVars()`. `copyItemText()` for inline ref copy. |
| src/notes/note-link-resolver.js | `MacOSIntegration` (prototype) | `resolveNotePath()` — resolve/repair note links when files are renamed or moved. |
| src/notes/codeblock.js | (module-scoped) | `` ```calendian `` code block processor (`renderCalendianBlock`). Inline `cal:ev:ID`/`cal:rem:ID` post-processor (`renderCalendianInline`). Click-to-navigate + panel highlight. |
| main-head.js (end) | `CalendarView` | Obsidian `ItemView`. Bridges Svelte calendar to `MacOSIntegration`. Owns cache read/write helpers. 60s association index rebuild. Window focus refresh. |
| main-head.js (end) | `CalendarPlugin` | Lifecycle, settings, discovers helper binary path, view registration. Registers code block + markdown post-processor. Settings tab with note template fields. |

Data flow: `calendian-helper` (EventKit) → JSON stdout → `execHelper()` → in-memory cache → `render()` → DOM. Disk cache written to `data.json` on each successful load.

### Refresh & sync

**All refresh paths converge on `init()`**, gated by `_refreshRunning` to prevent concurrent helper spawns:

- **Configurable timer** (`refreshIntervalMinutes`, default 5) — calls `init()`
- **Manual refresh** (`↻` button) — calls `init()`
- **Permission retry** — calls `init()`
- **Source filter toggle** — calls `render()` only (in-memory filter, no helper call)
- **Implemented (v0.3+)**: Window focus refresh (`window.onfocus` → `init()`)
- **Implemented (v0.3+)**: `calendian-helper watch` — subscribes `EKEventStoreChangedNotification`, writes signal file on change, JS polls signal → calls `init()`
- **Implemented (v0.3+)**: Post-write refresh — after create/edit/delete → `init(true)` immediately
- **Implemented (v0.5)**: Note association index rebuild (every 60s in CalendarView + on window focus)

See SPEC.md §7.6.1 and ARCHITECTURE.md §3 for full refresh architecture.

## What NOT to do

- **Do not introduce npm or external package dependencies.** The project is plain JS with zero `node_modules`.
- **Do not implement write operations** (create/edit/delete events or reminders) beyond what v0.4 already supports (safe create, edit, delete for simple non-recurring events and reminders). Recurring event mutation is blocked — scope selection is deferred.
- **Do not implement auto-modification of note files.** The plugin never auto-modifies note content. All note association is user-initiated (frontmatter or inline refs placed by the user).
- **Do not change code without updating docs.** See SDD workflow below — this is the #1 cause of project drift.
- **Do not remove legacy JXA code** (`execJXA`, `parseEvents`, `parseReminders`). It's unused but kept as fallback reference.
- **Do not log event titles, notes, locations, or reminder text.** Use `console.log("[Calendian] ...")` prefix for all logging.

### Module split (REQ-ARCH-001): `cat`-based concatenation

The code is split across `src/` modules for maintainability and concatenated into `main.js` for Obsidian. This is the only "build step" allowed — zero external tools, just Unix `cat`.

**Module format**: Each `src/` file exports methods via `MacOSIntegration.prototype.xxx = function() {...}`. The concatenation inserts them after the `MacOSIntegration` class skeleton.

**Concatenation order** (build-main.sh):
```bash
#!/bin/bash
# Concatenate Calendian modules into main.js
# main.js = upstream calendar code + Calendian skeleton + src modules in order

cat \
  main-head.js \
  src/macos/helper-executor.js \
  src/cache/schedule-cache.js \
  src/macos/writer.js \
  src/notes/frontmatter.js \
  src/notes/note-link-resolver.js \
  src/notes/templates.js \
  src/notes/codeblock.js \
  > main.js
```

**Editing workflow**: Always edit files in `src/`. Run `./build-main.sh` before reloading Obsidian. Never edit `main.js` directly when its content lives in `src/`.

## SDD workflow (mandatory after every code change)

This project uses Specification-Driven Development. `SPEC.md` is the single source of truth. **The most common failure mode: code gets changed, SPEC.md §7 status table and TASKS.md don't get updated, next session starts with wrong assumptions.**

After any code change:
1. Update `SPEC.md` §7 requirement status if the change affects any REQ-* item
2. Update `docs/sdd/TASKS.md` task status
3. Update `docs/sdd/CURRENT_STATUS.md` if user-visible behavior changed
4. Check that README doesn't claim unimplemented features as current
5. **Update `docs/sdd/CURRENT_STATUS.md` → `## Active session`** with what you just did, what's next, and any decisions made. This is how the next session knows where to continue without re-explaining context.
6. Commit with message: `<area>: <what changed> (REQ-XXX)` — e.g. `macos: add helper binary timeout handling (REQ-ERR-001)`. Commit doc-only changes separately from code changes.

## Verify

Before marking any task Done, verify it actually works. Code-reading is not verification.

1. **Compile the helper** — `swiftc -parse-as-library helper/Sources/main.swift -o calendian-helper`. If it fails, nothing downstream works.
2. **Test the data channel** — `./calendian-helper calendars` and `./calendian-helper events <from> <to>`. Confirm valid JSON, no stderr.
3. **Eye-check in Obsidian** — reload the plugin (disable/re-enable in Community Plugins), open calendar panel. Confirm: events and reminders visible, refresh button works, source toggles render, no blank or broken states.
4. **Walk the version gates** — read `docs/sdd/ACCEPTANCE.md` for the current version's gates. For each gate: test the behavior in the Obsidian panel, not just in the code. A gate verified only by code-reading is not passed.

When verification passes, update `docs/sdd/TASKS.md` and commit.

---

## Parallel sessions

Multiple Claude Code sessions may work on this project simultaneously. Without coordination they will collide.

**Startup (every session, before touching code):**
1. Read `docs/sdd/TASKS.md`.
2. If any task is marked `In progress (branch: <name>)`, it's claimed by another session. Leave it alone.
3. Pick an unclaimed task and immediately mark it `In progress (branch: <your-branch>)` in TASKS.md before doing anything else.

**Worktree for parallel branches:**
```bash
# Worktrees are siblings of the calendian/ plugin directory.
# They share git history but have independent working trees.
git worktree add ../calendian-<task-id> -b <task-id>
cd ../calendian-<task-id>
```

Different sessions edit different worktrees → no file conflicts.

**Testing your branch in Obsidian:** Obsidian loads from `.obsidian/plugins/calendian/`. Only one branch can be active there. To test your worktree branch, `git checkout <branch>` in the main `calendian/` directory.

**Done:**
1. Merge to main: `git checkout main && git merge <task-id>`
2. Mark task `Done` in `docs/sdd/TASKS.md`, remove the branch annotation.
3. `git worktree remove ../calendian-<task-id>`
4. Push main.

---

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

- **Helper binary** must be compiled from `helper/Sources/main.swift`. Plugin silently produces no data without it — no warning in UI beyond empty panels.
- **No automated tests.** All verification is manual: reload Obsidian, check console, check panel.
- **`execJXA` and `parseEvents`/`parseReminders`** are legacy JXA-format parsers. Current data comes from `execHelper` (JSON). These remain as reference but should not be used for new features.

## When suggesting changes

- Explain what behavior changes and why it helps, in plain language
- If a change touches data flow (helper, cache, render), trace it end-to-end before proposing
- Prefer minimal changes that solve the problem without restructuring unrelated code
