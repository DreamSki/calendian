# Calendian

> 🗓️ macOS Calendar & Reminders inside your Obsidian workflow.

Calendian is an Obsidian desktop plugin that integrates macOS Calendar events and macOS Reminders into the Obsidian sidebar. It is being developed with a Specification-Driven Development process: requirements, roadmap, tasks, tests, and release gates are tracked explicitly before features are claimed as complete.

Current status: **v0.3 safe create — complete** (8/8 acceptance gates passed; all 11 deferred v0.2 items resolved; code split done via `cat` concatenation).

---

## What is Calendian?

Calendian helps Obsidian users view their daily schedule and reminders without switching out of their vault. It reads from the Calendar.app and Reminders.app data already configured on the user's Mac, including accounts that macOS Calendar/Reminders can access such as iCloud, Google, Exchange/Outlook, CalDAV, and local calendars.

Calendian is local-first by default. Early versions use macOS automation and do not send calendar or reminder data to third-party services.

---

## Current capabilities (v0.1–v0.3)

The repository contains the following implemented features:

- Obsidian desktop plugin shell (macOS-only).
- Native Swift EventKit helper for fast Calendar/Reminders access.
- Sidebar calendar view with events/reminders panel below.
- Date selection: click to show that day's events and reminders from cache.
- Cmd/Ctrl-click preserved for daily note open/create.
- Event display: title, time range, all-day handling, colored calendar badge, location, recurrence indicator.
- Expandable event details: location, URL, notes, attendees, calendar source, recurrence summary.
- Multi-day events shown on all overlapping days.
- Past event display (normal/dimmed/hidden) configurable in settings.
- Recurring event read-only indicator (⟳).
- Reminder display: title, due time, list badge, priority indicator (high/medium/low).
- Overdue reminders visually distinguished (red border + badge + due date).
- No-date reminders in collapsible section.
- Reminder display range selector (today / 7 days / all incomplete).
- Calendar/reminder source discovery with account name disambiguation.
- Source filtering by individual calendar/list with instant apply.
- Configurable auto-refresh with disk cache and two-phase instant startup.
- Permission denied, error, timeout, cache-miss, and empty UI states.
- Manual refresh button and last refresh time display.
- Month-cell event dots with calendar colors, hollow reminder dots, multi-day spans.
- Diagnostic panel with permission status, source counts, cache stats, refresh timing.
- Diagnostic export with consent modal and field redaction.
- **Event creation** via form (`EventCreateModal`) with title, calendar, date/time, all-day, location, URL, notes, and post-create refresh.
- **Reminder creation** via form (`ReminderCreateModal`) with title, list, due date/time, priority, notes, and post-create refresh.
- **Natural language quick-create** (`QuickEventModal`, ⚡): English + Chinese regex parser (compact dates, numerals, duration, relative dates).
- **AI-powered NL parsing** (optional): OpenAI-compatible backend, Enter-triggered, never auto-fires; configurable in settings; privacy-controlled.
- Default calendar/list preference for create forms.

For the precise truth table, see [`docs/sdd/CURRENT_STATUS.md`](./docs/sdd/CURRENT_STATUS.md) and [SPEC.md §2](./SPEC.md#2-current-implementation-status).

---

## Planned capabilities

These are planned, but should not be treated as current behavior until their requirements and release gates pass:

- Safe event/reminder editing and deletion (v0.4).
- Recurring event safety model and scope selection UX.
- Event/reminder note association through frontmatter.
- Meeting-note templates.
- In-app notifications for upcoming events and overdue reminders.
- Copy-as-Markdown.
- Goals and focus tracking (define goals, break into steps, declare weekly focus).
- Habit tracking with consistency rate (not streaks), minimum-viable versions, and rest periods.
- Encouragement nudges (daily intention prompt, re-engagement prompts, configurable tone).
- Daily and weekly reflection notes from templates.
- Encouragement statistics (completion count, consistency rate, small-wins focus).
- Timeline view, week view, local search, and data export.

See [`ROADMAP.md`](./ROADMAP.md) for the requirement-driven plan.

---

## Explicit non-goals for v0.1–v0.3

v0.1–v0.3 create events and reminders but do **not** yet include:

- editing or deleting Calendar events;
- editing, deleting, or completing Reminders;
- recurring event creation, editing, or deletion;
- automatic Tasks ↔ Reminders sync;
- Android, Windows, Linux, or web support;
- direct Google Calendar API or Microsoft Graph API integration;
- cloud sync managed by Calendian.

---

## Installation

### Prerequisites

- macOS 12+ (Monterey or later).
- Obsidian desktop ≥ 0.15.0.
- Calendar.app configured if you want events.
- Reminders.app configured if you want reminders.
- Swift compiler (`swiftc`) for building the native EventKit helper.

### Build from source

```bash
git clone https://github.com/DreamSki/calendian.git
cd calendian

# Compile the native EventKit helper (required — plugin produces no data without it)
swiftc helper/Sources/main.swift -o calendian-helper
```

The plugin is plain JavaScript loaded directly by Obsidian. No npm, no bundler. The only build step is compiling the Swift helper binary.

### Manual installation

1. Build from source (see above), or download a release archive.
2. Copy the plugin folder to your Obsidian vault:

   ```text
   your-vault/.obsidian/plugins/calendian/
   ```

   Required files: `main.js`, `styles.css`, `manifest.json`.

3. Open Obsidian → Settings → Community Plugins.
4. If safe mode is on, turn it off.
5. Find "Calendian" in the installed plugins list and enable it.
6. Open the calendar view from the right sidebar or command palette.

### First-time setup

When the calendar view first tries to access system data, macOS requests Calendar and/or Reminders access through the standard EventKit permission prompt:

- `"Obsidian" Would Like to Access Your Calendar`
- `"Obsidian" Would Like to Access Your Reminders`

Click **Allow** if you want Calendian to read those sources.

If permission is denied accidentally, go to:

```text
System Settings → Privacy & Security → Calendars
System Settings → Privacy & Security → Reminders
```

Then re-enable Obsidian's access.

---

## Usage: current read-only flow

| Action | Current result |
|---|---|
| Click a date | Selects that date and shows cached events/reminders for that date. |
| Click an event | Expands event details (location, URL, notes, attendees, recurrence summary). |
| Cmd/Ctrl + click a date | Opens or creates the daily note for that date. |
| Click Today / month navigation | Moves the calendar view. |
| Click ↻ button | Manually refreshes from macOS Calendar/Reminders. |
| Reminder range selector | Filter reminders: selected day / next 7 days / all incomplete. |
| Open settings → macOS Integration | Toggle Calendar/Reminders display, source filtering, past event display, refresh interval, default calendar/list for create form, AI NL parsing config. |
| Open settings → Diagnostics | View permission status, source counts, cache stats. Export via consent modal. |
| Click ⚡ button | Open natural language quick-create for events/reminders. |
| Click +Event / +Remind | Open manual create forms for events/reminders. |

Event/reminder creation is available in v0.3; edit/delete are planned for v0.4.

---

## Specification-Driven Development documents

Calendian uses SDD so that implementation stays aligned with requirements and release gates.

| Document | Purpose |
|---|---|
| [`SPEC.md`](./SPEC.md) | Authoritative product specification and requirement IDs. |
| [`ROADMAP.md`](./ROADMAP.md) | Versioned plan derived from the specification. |
| [`WORKFLOWS.md`](./WORKFLOWS.md) | User workflow examples and how-to guides. |
| [`docs/PRIVACY.md`](./docs/PRIVACY.md) | Privacy model: data read, stored, logged, and deleted. |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Target architecture, module boundaries, and data flow. |
| [`docs/SETTINGS_SCHEMA.md`](./docs/SETTINGS_SCHEMA.md) | Settings data structure, defaults, and migration policy. |
| [`docs/RELEASE_CHECKLIST.md`](./docs/RELEASE_CHECKLIST.md) | Per-release execution checklist and sign-off. |
| [`docs/sdd/README.md`](./docs/sdd/README.md) | SDD process and document hierarchy. |
| [`docs/sdd/CURRENT_STATUS.md`](./docs/sdd/CURRENT_STATUS.md) | Actual implemented / partial / planned status. |
| [`docs/sdd/ACCEPTANCE.md`](./docs/sdd/ACCEPTANCE.md) | Release gates and acceptance rules. |
| [`docs/sdd/TESTING.md`](./docs/sdd/TESTING.md) | Manual and future automated testing strategy. |
| [`docs/sdd/TRACEABILITY.md`](./docs/sdd/TRACEABILITY.md) | Mapping from goals to requirements, tasks, tests, and releases. |
| [`docs/sdd/TASKS.md`](./docs/sdd/TASKS.md) | Requirement-driven implementation backlog. |
| [`docs/sdd/RISKS.md`](./docs/sdd/RISKS.md) | Risk register and mitigations. |

---

## Privacy

Calendian's early architecture reads from local macOS apps. Calendar and reminder data is not sent to third-party services by default.

Future external API integrations, if any, must be opt-in and specified separately.

---

## Roadmap summary

| Version | Focus | Status |
|---|---|---|
| v0.1 | Read-only MVP | Complete |
| v0.2 | Read-only polish | Complete |
| v0.3 | Safe create + natural language | Complete |
| v0.4 | Safe edit/delete | Planned |
| v0.5 | Note association + notifications + Tasks | Planned |
| v0.5.5 | Self-direction (goals, habits, nudges, reviews) | Planned |
| v0.6 | Advanced views, search, export | Planned |
| v1.x | Cross-platform architecture track | Deferred |

---

## Credits

Based on the [Obsidian Calendar plugin](https://github.com/liamcain/obsidian-calendar-plugin) by Liam Cain.

---

## License

MIT
