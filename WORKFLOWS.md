# Calendian User Workflows

> This document provides practical examples of how to use Calendian in your daily Obsidian workflow.

> **Status**: Current capabilities only (v0.1 read-only MVP)

---

## Quick Start

1. Install Calendian plugin in your Obsidian desktop app
2. Grant automation permissions when prompted (Calendar.app and Reminders.app)
3. Open Calendian from the right sidebar or command palette
4. Click any date to see that day's events and reminders

---

## Workflow 1: Daily Meeting Preparation

**Goal**: Quickly review your day before starting work

### Steps

1. **Open Calendian**
   - Press `Cmd/Ctrl + P` to open command palette
   - Type "Calendar" and select "Open calendar"

2. **Review Today's Schedule**
   - Today's date is automatically selected
   - Events panel shows all calendar events for today
   - Reminders panel shows incomplete reminders due today

3. **View Event Details** (Planned - not yet available)
   - Click an event to see location, attendees, notes
   - Currently limited to title, time, and calendar source

4. **Navigate to Other Days**
   - Click any date to see that day's schedule
   - Use month navigation arrows to move between months

### What You'll See

```
┌─────────────────────────────────┐
│  June 2026                      │
│  ┌───┬───┬───┬───┬───┬───┬───┐│
│  │  │  │  │  │  │  │  ││
│  │  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 ││
│  ... calendar grid ...
│  └───┴───┴───┴───┴───┴───┴───┘│
├─────────────────────────────────┤
│ 📅 Events for June 7, 2026     │
│─────────────────────────────────│
│ ┃ 9:00-10:00  Team Standup      │
│ ┃   Work                        │
│ ┃ 14:00-15:00 Product Review    │
│ ┃   Work                        │
├─────────────────────────────────┤
│ ✅ Reminders                    │
│─────────────────────────────────│
│ ┃ Review PRs                    │
│ ┃ Tasks                        │
│ ┃ Send weekly email             │
│ ┃ Personal                     │
└─────────────────────────────────┘
```

---

## Workflow 2: Weekly Planning

**Goal**: See your week at a glance and plan accordingly

### Steps

1. **Navigate to Your Week**
   - Start from today
   - Click through each day of the week
   - Review events and reminders for each day

2. **Identify Busy Days** (Visual - currently manual)
   - Days with many events appear longer in the events panel
   - Note: Week view and statistics are planned for future versions

3. **Create Daily Notes for the Week**
   - `Cmd/Ctrl + click` each date to create/open daily notes
   - Use your daily note template to plan each day

### Current Limitations

- No week view available yet (planned for v0.6)
- No encouragement statistics yet (planned for v0.5.5)
- Manual date-by-date navigation required

---

## Workflow 3: Source Filter Management

**Goal**: Focus on specific calendars or reminder lists

### Steps

1. **Open Settings**
   - Go to Settings → Community Plugins → Calendian → Options

2. **Discover Available Sources**
   - Under "macOS Integration"
   - Click "Discover" button next to "Calendar sources"
   - Click "Discover" button next to "Reminder sources"

3. **Select Sources to Display**
   - Toggle calendars on/off
   - Toggle reminder lists on/off
   - Empty selection = show all

### Use Cases

- **Work mode**: Show only work calendar, hide personal events
- **Personal planning**: Show only personal calendar and reminders
- **Focus**: Reduce visual clutter by hiding inactive sources

---

## Workflow 4: Permission Recovery

**Goal**: Fix permissions if Calendian can't access Calendar or Reminders

### Symptoms

- Events panel shows "No events or reminders" but you know you have data
- Error message about permissions in console

### Steps

1. **Check macOS Privacy Settings**
   ```
   System Settings → Privacy & Security → Automation
   ```

2. **Enable Obsidian Automation**
   - Find "Obsidian" in the list
   - Enable checkbox for "Calendar" if you want events
   - Enable checkbox for "Reminders" if you want reminders

3. **Restart Obsidian**
   - Fully quit and restart Obsidian
   - Open Calendian again

4. **Verify It Works**
   - You should now see events/reminders in the panel

### Current Recovery Features

- Permission status banners with actionable guidance
- Retry buttons that refresh after permission changes
- Error/denied/timeout states with recovery UI

---

## Workflow 5: Daily Note Integration

**Goal**: Use Calendian alongside your daily notes workflow

### Steps

1. **Navigate to Today**
   - Click today's date in the calendar

2. **Review Your Schedule**
   - See today's events in the events panel
   - See today's reminders in the reminders panel

3. **Open Your Daily Note**
   - `Cmd/Ctrl + click` on today's date
   - This opens or creates your daily note

4. **Manually Add Meeting Notes** (Currently manual)
   - In your daily note, type out your meeting notes
   - Future versions will support automatic meeting note templates (v0.5)

### Future Integration (Planned)

- One-click meeting note creation from event (v0.5)
- Meeting note templates with event variables (v0.5)
- Frontmatter association between notes and events (v0.5)

---

## Workflow 6: Reminder Management

**Goal**: Keep track of tasks without leaving Obsidian

### Current Capabilities (Read-Only)

1. **View Today's Reminders**
   - Reminders panel shows incomplete reminders due today
   - Each reminder shows title and list source

2. **View Overdue Reminders**
   - Reminders past their due date appear in the panel
   - Overdue visual distinction planned for v0.2

3. **No-Date Reminders**
   - Reminders without due dates show on today's panel
   - Dedicated section planned for v0.2

### Limitations

- ❌ Cannot create reminders from Obsidian (planned v0.3)
- ❌ Cannot mark reminders complete (planned v0.4)
- ❌ Cannot edit reminders (planned v0.4)
- ❌ No overdue styling (planned v0.2)

### Workaround

For now, use Reminders.app to create/edit reminders, and use Calendian to view them.

---

## Workflow 7: Refresh Data

**Goal**: Ensure you're seeing the latest calendar/reminder data

### Automatic Refresh

- Calendian auto-refreshes every 5 minutes (configurable in settings)
- No action required; data updates automatically

### Manual Refresh

- Click the `↻` button in the date header to refresh immediately
- Last refresh time and duration are displayed in the panel footer

### Settings

To change refresh interval:
```
Settings → Community Plugins → Calendian → Options
→ Refresh interval (minutes): [5]
```

Minimum: 1 minute

---

## Common Use Cases

### Use Case 1: Before a Meeting

1. Check Calendian to see meeting time and location (when details view is available)
2. Open daily note with `Cmd/Ctrl + click`
3. Add meeting notes to your daily note

### Use Case 2: Weekly Review

1. Navigate through each day of the upcoming week
2. Review events and reminders for each day
3. Identify busy days and prepare accordingly
4. Create daily notes for the week

### Use Case 3: Task Planning

1. Check reminders panel to see upcoming tasks
2. Open daily note
3. Plan your day around both events and reminders

---

## Tips and Tricks

### Keyboard Navigation (Future)

- Week view: `W` key (planned v0.6)
- Today: `T` key (planned v0.6)
- Previous/Next day: Arrow keys (planned v0.6)

### Customization (Future)

- Event display density (compact/comfortable) - v0.6
- Custom themes and colors - v0.6
- Which event fields to show - v0.6

### Performance Tips

- Reduce number of visible calendars if performance is slow
- Increase refresh interval to reduce background activity
- Calendar loads ±6 months of data by default for fast navigation

---

## Workflow 8: Self-Direction (Planned — v0.5.5)

> **Status**: All features in this workflow are planned for v0.5.5. None are currently implemented.

**Goal**: Build consistency through lightweight goals, habits, and reflection without shame or external services.

### Goal Tracking

1. **Define a Goal**
   - Open Calendian settings → Goals
   - Create a goal (e.g., "Learn TypeScript") stored locally in your vault
   - Break it into small actionable steps
   - Declare a single focus for the current week

2. **Track Progress**
   - Complete a step with a single click
   - See progress (e.g., "3/5 steps completed")
   - Pause or archive goals without losing history — abandoning is not all-or-nothing

### Habit Building

1. **Create a Habit**
   - Define a recurring habit (e.g., "Morning review", "Write 100 words")
   - Optionally set a minimum-viable version for low-energy days
   - Mark scheduled rest periods so they don't count as misses

2. **Build Consistency**
   - Mark completion with a single click each day
   - See progress as consistency rate (e.g., "present 18/21 days = 86%")
   - A missed day does NOT reset progress to zero
   - If you've missed several days, the system offers a low-friction restart, not a failure notice

### Daily Intention and Reflection

1. **Morning Prompt**
   - Once per day, Calendian prompts: "What's your intention for today?"
   - Type a brief intention — it's not a schedule, it's a direction

2. **End-of-Day Check-in** (optional)
   - Gentle prompt: "Did your intention progress today?"
   - Optional reflection to close the day

3. **Daily and Weekly Reviews**
   - Daily reflection generated from a template, pre-filled with events, completed items, and intention
   - Weekly review summarizing completed steps, habit consistency, and current focus
   - Completed items (small wins) are surfaced before missed items
   - Carry unfinished focus forward without penalty

### Nudge Philosophy

Calendian's nudges are designed to encourage, not shame:

- **Configurable tone**: gentle, neutral, or firm — you choose
- **Fully optional**: nudges can be disabled entirely
- **No guilt by default**: the system SHALL NOT use shaming or punitive language
- **Restart framing**: after a lapse, prompts are framed as restarts, not failures
- **Local only**: nudge and behavioral data never leaves your vault

---

## Troubleshooting

### Problem: No events showing

**Possible causes:**
1. Permissions not granted → See Workflow 4
2. No events in selected date range → Try a different date
3. All calendars filtered out → Check source filters in settings

### Problem: No reminders showing

**Possible causes:**
1. Reminders permission not granted → See Workflow 4
2. No incomplete reminders due on selected date
3. All reminder lists filtered out → Check source filters

### Problem: Stale data

**Solution:**
- Wait for auto-refresh (default 5 minutes)
- Check that refresh interval is not set too high
- Restart Obsidian if data is very old

---

## Next Steps

Want to help shape Calendian's future? Check out:

- [ROADMAP.md](./ROADMAP.md) - What's coming next
- [SPEC.md](./SPEC.md) - Detailed specification
- [docs/sdd/TASKS.md](./docs/sdd/TASKS.md) - Implementation tasks
- GitHub Issues - Report bugs or request features

---

## Version Notes

This document describes **v0.1 read-only MVP** capabilities.

Features marked as "Planned" or "Future" are not yet implemented and may change.
