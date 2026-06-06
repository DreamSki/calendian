# Calendian

> 🗓️ macOS Calendar & Reminders, deeply integrated into your Obsidian workflow.

---

## What is Calendian?

Calendian brings your macOS Calendar events and Reminders directly into Obsidian's sidebar. No more switching between apps — see your daily schedule, manage reminders, and link notes to events, all in one place.

It accesses **all accounts** configured in your macOS Calendar app — iCloud, Exchange/Outlook, Google Calendar, CalDAV, and local calendars — through the native macOS automation interface (JXA).

---

## Features

### 📅 Calendar Events
- **Instant day view** — Click any date to see that day's events instantly (cached ±6 months)
- **Calendar colors** — Each event shows its calendar's native color as a badge
- **Duration display** — Shows full time range like `14:00 - 16:00 (2h)`
- **All-day events** — Displayed at the top with a distinct style
- **Live status** — Ongoing events (green highlight) and upcoming events (orange highlight)
- **Past events** — Grayed out but still visible
- **Multi-day events** — Appear on each day they span
- **Event details** — Click to expand: location, links, notes, recurrence info

### ✅ Reminders
- **Today's reminders** — Due items for the selected date
- **No-date reminders** — Separate section for undated items
- **Overdue alerts** — Past-due reminders highlighted in red
- **Display range** — Switch between today / next 7 days / all incomplete
- **Priority levels** — High/Medium/Low from macOS Reminders

### 🎨 Visual Design
- **Claude.ai-inspired style** — Warm, elegant interface with rounded cards and amber accents
- **Adjustable split** — Drag the divider between calendar and event panel
- **Theme-aware** — Adapts to your Obsidian theme (dark/light)
- **Calendar source colors** — Date cells show colored dots for events

### ⚡ Performance
- **Pre-loaded cache** — ±6 months of data loaded at startup (~3-5s)
- **Instant switching** — Date changes are < 100ms from cache
- **Background refresh** — Configurable auto-refresh interval (default: 5 min)

### 🔧 Settings
- **Calendar source picker** — "Discover" button auto-lists all calendars with toggle switches
- **Reminder list picker** — Same discover-and-toggle pattern for reminder lists
- **Display options** — Toggle past events, no-date reminders, notifications
- **Keyboard shortcuts** — Navigate dates, switch views, create events

---

## Installation

### Manual Installation

1. Download or clone this repository
2. Copy the `calendian` folder to your Obsidian vault:
   ```
   your-vault/.obsidian/plugins/calendian/
   ```
3. Open Obsidian → Settings → Community Plugins
4. **Disable** the original Calendar plugin (if enabled)
5. **Enable** "Calendian"
6. The calendar view will appear in the right sidebar

### First-Time Setup

When you first open the calendar view, macOS will prompt you to grant automation permissions:

> **"Obsidian wants to control Calendar.app"** → Click **Allow**

> **"Obsidian wants to control Reminders.app"** → Click **Allow**

If you accidentally denied access, go to:
**System Settings → Privacy & Security → Automation** and re-enable Obsidian's access.

---

## Usage

### Basic Navigation

| Action | Result |
|--------|--------|
| **Click** a date | Shows that day's events and reminders |
| **Cmd/Ctrl + Click** a date | Opens or creates a daily note |
| Click **← Today** button | Returns to today's view |
| **← / →** arrow keys | Navigate to previous/next day |

### Viewing Events

Events are displayed in a card-style list below the calendar:
- **All-day events** appear at the top with an italic "All day" label
- **Timed events** show the full time range and duration
- **Calendar badge** shows which calendar the event belongs to (with native color)
- **Status indicators**: green bar = ongoing, orange bar = starting within 30 min

### Managing Calendar Sources

1. Open **Settings → Calendian → Calendar Sources**
2. Click **"Discover"** to scan all available calendars
3. Toggle individual calendars on/off
4. Same process for **Reminder Sources**

### Right-Click Menus

Right-click on events, reminders, or dates for quick actions:
- **Event**: Edit, Delete, Open in Calendar.app, Associate note
- **Reminder**: Mark complete, Edit, Delete, Associate note
- **Date**: New event, New reminder, Open daily note

---

## Plugin Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Show Calendar Events | On | Display events from macOS Calendar |
| Show Reminders | On | Display reminders from macOS Reminders |
| Calendar Sources | All | Toggle which calendars to display |
| Reminder Sources | All | Toggle which reminder lists to display |
| Refresh Interval | 5 min | How often to refresh data from macOS |
| Default View | Day List | Day list / Timeline / Week |
| Reminder Display Range | Today only | Today / 7 days / All incomplete |
| Show Past Events | On | Gray out ended events |
| Show No-Date Reminders | On | Display undated reminders |
| Event Notifications | On | Notify before events start |
| Startup Today Overview | On | Show today's summary on launch |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `T` | Jump to today |
| `←` / `→` | Previous / next day |
| `Shift+←` / `Shift+→` | Previous / next week |
| `V` | Cycle through views |
| `N` | New event |
| `Shift+N` | New reminder |
| `S` | Search events/reminders |

---

## File Structure

```
.obsidian/plugins/calendian/
├── main.js                 ← Plugin entry point
├── macos-integration.js    ← JXA data access & cache
├── macos-renderer.js       ← UI rendering
├── macos-settings.js       ← Settings page
├── macos-sync.js           ← Two-way sync (Phase 2)
├── macos-notifications.js  ← Notification system
├── macos-note-link.js      ← Note associations (Phase 3)
├── slash-commands.js       ← Slash commands (Phase 2)
├── views/                  ← Additional views (Phase 4)
├── styles.css              ← All styles
├── manifest.json           ← Plugin metadata
└── data.json               ← User settings (auto-generated)
```

---

## Requirements

- **macOS** 12.0+ (Monterey or later recommended)
- **Obsidian** 0.12.0+
- macOS Calendar app with at least one account configured
- macOS Reminders app (optional)

---

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full development plan.

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Read-only display + caching + colors | 🟡 In Progress |
| **Phase 2** | Two-way sync (create/edit/delete) | 🔲 Planned |
| **Phase 3** | Note associations + Tasks integration | 🔲 Planned |
| **Phase 4** | Timeline views + statistics | 🔲 Planned |
| **Phase 5** | Smart features + Android support | 🔲 Planned |

---

## FAQ

**Q: Does it work with Google Calendar / Exchange / iCloud?**  
A: Yes! Any calendar account added to the macOS Calendar app is automatically accessible.

**Q: Does it work on Windows / Linux?**  
A: Not yet. Calendian relies on macOS automation (JXA). Cross-platform support is planned for Phase 5.

**Q: Will it modify my calendar data?**  
A: Phase 1 is read-only. Two-way sync (create/edit/delete) will be added in Phase 2, always with confirmation.

**Q: Does it sync via the cloud?**  
A: No cloud services involved. Data comes directly from your Mac's Calendar and Reminders apps.

**Q: What about privacy?**  
A: All data stays on your machine. No information is sent to any third-party service.

---

## Credits

Based on the [Obsidian Calendar plugin](https://github.com/liamcain/obsidian-calendar-plugin) by Liam Cain.

---

## License

MIT
