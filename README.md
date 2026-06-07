# Calendian

> 🗓️ macOS Calendar & Reminders inside your Obsidian workflow.

Calendian is an Obsidian desktop plugin that integrates macOS Calendar events and macOS Reminders into the Obsidian sidebar. It is being developed with a Specification-Driven Development process: requirements, roadmap, tasks, tests, and release gates are tracked explicitly before features are claimed as complete.

Current status: **pre-v0.1 / read-only MVP partial**.

---

## What is Calendian?

Calendian helps Obsidian users view their daily schedule and reminders without switching out of their vault. It reads from the Calendar.app and Reminders.app data already configured on the user's Mac, including accounts that macOS Calendar/Reminders can access such as iCloud, Google, Exchange/Outlook, CalDAV, and local calendars.

Calendian is local-first by default. Early versions use macOS automation and do not send calendar or reminder data to third-party services.

---

## Current capabilities

The repository currently contains a partial read-only integration. Treat the following as current or partially implemented behavior:

- Obsidian desktop plugin shell.
- macOS-only Calendar/Reminders integration using local automation.
- Sidebar calendar view with a lower events/reminders panel.
- Basic date selection: click a date to show that day's schedule data.
- Cmd/Ctrl + click behavior for opening or creating daily notes is preserved.
- Basic Calendar event reading.
- Basic Reminders reading.
- Basic event display: title, time range, all-day handling, calendar badge.
- Basic reminder display: title, due time where available, list badge.
- Basic calendar/reminder source discovery from settings.
- Basic refresh/cache behavior.

For the precise truth table, see [`docs/sdd/CURRENT_STATUS.md`](./docs/sdd/CURRENT_STATUS.md).

---

## Planned capabilities

These are planned, but should not be treated as current behavior until their requirements and release gates pass:

- Overdue reminder styling.
- No-date reminders section.
- Reminder display range selector.
- Past event gray-out / hide setting.
- Multi-day event display across all overlapping days.
- Month-cell event dots based on source calendars.
- Expandable event details with location, links, notes, and recurrence summary.
- Manual refresh and diagnostics panel.
- Safe event/reminder creation.
- Natural language event creation ("tomorrow 3pm meeting").
- Safe event/reminder editing and deletion.
- Recurring event safety model.
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

## Explicit non-goals for v0.1

v0.1 is read-only. It does **not** include:

- creating Calendar events;
- editing Calendar events;
- deleting Calendar events;
- creating, editing, deleting, or completing Reminders;
- recurring event mutation;
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
- Node.js and npm (for building from source).

### Build from source

```bash
git clone https://github.com/DreamSki/calendian.git
cd calendian
npm install
npm run build
```

The build produces `main.js` and `styles.css` in the plugin root.

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

When the calendar view first tries to access system data, macOS may ask for automation permission:

- `Obsidian wants to control Calendar.app`
- `Obsidian wants to control Reminders.app`

Click **Allow** if you want Calendian to read those sources.

If permission is denied accidentally, go to:

```text
System Settings → Privacy & Security → Automation
```

Then re-enable Obsidian's access to Calendar and/or Reminders.

---

## Usage: current read-only flow

| Action | Current result |
|---|---|
| Click a date | Selects that date and shows cached events/reminders for that date. |
| Cmd/Ctrl + click a date | Opens or creates the daily note for that date. |
| Click Today / month navigation | Moves the calendar view. |
| Open settings → macOS Integration | Toggle Calendar/Reminders display and discover sources. |

Write actions such as create/edit/delete are planned but should not be expected in v0.1.

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

## Requirements

Current intended target:

- macOS desktop.
- Obsidian desktop.
- Calendar.app configured if Calendar events are desired.
- Reminders.app configured if reminders are desired.

The exact minimum Obsidian version must be aligned between `manifest.json`, `SPEC.md`, and release notes before public release.

---

## Privacy

Calendian's early architecture reads from local macOS apps. Calendar and reminder data is not sent to third-party services by default.

Future external API integrations, if any, must be opt-in and specified separately.

---

## Roadmap summary

| Version | Focus | Status |
|---|---|---|
| v0.1 | Read-only MVP | In progress |
| v0.2 | Read-only polish | Planned |
| v0.3 | Safe create + natural language | Planned |
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
