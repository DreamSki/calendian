# Calendian Privacy Model

> Status: normative privacy document
> Last updated: 2026-06-08
> Plugin ID: `calendian`

Calendian is local-first by construction. This document defines exactly what data is read, stored, displayed, logged, and under what conditions data could leave the user's machine.

---

## 1. Data read from macOS

Calendian reads from Calendar.app and Reminders.app through a native Swift EventKit helper (`calendian-helper`). No remote APIs are called. No data leaves the device. No data is read until the user grants macOS calendar/reminder permission.

### Calendar.app

| Field | Read | Displayed | Stored in cache | Notes |
|---|---|---|---|---|
| Event title | Yes | Yes | Yes (disk cache) | |
| Start date/time | Yes | Yes | Yes | |
| End date/time | Yes | Yes | Yes | |
| All-day flag | Yes | Yes | Yes | |
| Calendar name | Yes | Yes | Yes | |
| Calendar color | Yes | Yes | Yes | |
| Location | Yes | Yes | Yes | |
| URL | Yes | Displayed if present | Yes | |
| Notes | Yes | Displayed if present | Yes | Redact in diagnostics |
| Attendees | Yes | Displayed if present | Yes | Redact in diagnostics |
| Recurrence rule | Yes | Summary only | Yes | |
| Account name | Yes | Yes | Yes | From EKSource.title |
| Stable event ID | Yes | Internal only | Yes | EKEvent.eventIdentifier (UUID) |

### Reminders.app

| Field | Read | Displayed | Stored in cache | Notes |
|---|---|---|---|---|
| Reminder title | Yes | Yes | Yes (disk cache) | |
| Due date | Yes | Yes | Yes | |
| Due time | Yes | Yes | Yes | |
| List name | Yes | Yes | Yes | |
| Priority | Yes | Yes (high/medium/low/none) | Yes | |
| Completed status | Yes | Internal (hide completed) | Yes | |
| Notes | Yes | Displayed if present | Yes | |
| Account name | Yes | Yes | Yes | From EKSource.title |
| Stable reminder ID | Yes | Internal only | Yes | EKReminder.calendarItemIdentifier |
| Subtasks | Rendering ready, data-dependent | Rendering ready, data-dependent | Rendering ready, data-dependent | Helper parentId not yet populated (v0.3) | |

---

## 2. Data stored on disk

### Obsidian plugin settings (`data.json`)

Stored in `<vault>/.obsidian/plugins/calendian/data.json`.

**Current fields (v0.1–v0.2):**

```json
{
  "enableCalendar": true,
  "enableReminders": true,
  "selectedCalendarIds": ["..."],
  "selectedReminderListIds": ["..."],
  "refreshIntervalMinutes": 5,
  "_eventsCache": { "events": [...], "colors": {...}, "cacheStart": "...", "cacheEnd": "...", "savedAt": "..." },
  "_remindersCache": { "reminders": [...], "savedAt": "..." }
}
```

The disk cache (`_eventsCache`, `_remindersCache`) stores event/reminder fields (title, time, calendar name, location, notes, etc.) for fast cold-start — see §1 for the full field list. This cache is stored inside the vault and never leaves the device.

**Fields added in v0.2:** `pastEventDisplay`, `reminderDisplayRange`, `showNoDateReminders`.

**Planned fields (v0.3+):** `cacheRangeMonthsPast`, `cacheRangeMonthsFuture`, `showCompletedReminders`, and self-direction fields (nudge config, etc.) will be added as the corresponding features ship. See [`SETTINGS_SCHEMA.md`](./SETTINGS_SCHEMA.md) for the full target schema.

Event titles, locations, URLs, notes, and calendar/list names are stored in the disk cache inside `data.json` for cold-start performance. This data stays inside the Obsidian vault and is never sent to external services. See §1 for the full per-field storage matrix.

### Note frontmatter

When note association is implemented (v0.5), associations are written to note frontmatter:

```yaml
---
calendian:
  associations:
    - type: event
      source: macos-calendar
      id: "<stable-event-uid>"
      title: "Product review"
      date: 2026-06-07
      calendar: "Work"
---
```

Goal, habit, intention, and review data (v0.5.5) is stored similarly in frontmatter or plugin settings. See [`SPEC.md` §5.4–5.8](../SPEC.md#5-domain-model).

### In-memory cache

Event and reminder data is cached in memory during the plugin session. The cache is cleared when the plugin unloads or Obsidian restarts. Cache data includes all fields listed in §1 above.

---

## 3. Data that never leaves the machine

The following data is **never** sent to any external service by Calendian:

- Event titles, notes, locations, URLs
- Reminder titles, notes
- Attendee names or email addresses
- Calendar or reminder list names
- Goal, habit, intention, or reflection content
- Nudge or behavioral data

This is a hard boundary enforced by design: Calendian's architecture has no network client for calendar/reminder/self-direction data.

---

## 4. Diagnostics and logging

### Default behavior

Diagnostic information available in the diagnostic panel is **redacted by default**:

**Always safe to show:**
- Platform supported (yes/no)
- Calendar permission status (allowed/denied/unknown)
- Reminders permission status (allowed/denied/unknown)
- Number of calendars discovered
- Number of reminder lists discovered
- Event count in cache range
- Reminder count in cache range
- Last refresh timestamp
- Last refresh duration (ms)
- Last error class (e.g. "permission-denied", "timeout")
- Plugin version
- Obsidian version
- macOS version

**Always redacted by default:**
- Event titles
- Reminder titles
- Event notes, locations, URLs
- Reminder notes
- Attendee names or emails
- Calendar or list names

### Diagnostic export

When a user explicitly exports diagnostics (e.g., for a bug report):

1. The user MUST give explicit consent before export.
2. Redacted fields remain redacted unless the user chooses to include them.
3. A preview of what will be exported is shown before confirmation.
4. The export is saved as a local file; it is not automatically uploaded.

See `REQ-PRIV-001`, `REQ-PRIV-002`, `REQ-DIAG-001`, `REQ-DIAG-002`.

---

## 5. Data deletion

### Plugin uninstall

When the user removes the Calendian plugin from their vault:

1. Delete `<vault>/.obsidian/plugins/calendian/` — this removes `data.json` and all plugin code.
2. Note frontmatter written by Calendian (`calendian:` blocks) remains in notes unless manually removed.
3. No data exists outside the vault — there is no cloud account to delete.

### Resetting plugin data

To reset Calendian settings without uninstalling:

1. Delete `<vault>/.obsidian/plugins/calendian/data.json`.
2. Restart Obsidian.
3. Plugin will initialize with defaults.

---

## 6. Future external API integrations

Any future integration with external APIs (Google Calendar API, Microsoft Graph API, CalDAV, etc.):

- MUST be opt-in (disabled by default).
- MUST have a separate privacy section documenting data flow, authentication, token storage, and revocation.
- MUST NOT share data between external integrations and local Calendar.app/Reminders.app reads without explicit user configuration.
- MUST have separate acceptance gates and risk review.

See `REQ-XPLAT-004`, `REQ-XPLAT-005`, `RISK-010`.

---

## 7. Privacy requirements traceability

| Requirement | Summary |
|---|---|
| `REQ-PRIV-001` | Calendar/Reminders data kept local; no third-party sharing by default. |
| `REQ-PRIV-002` | Document what data is stored in Obsidian settings/frontmatter. |
| `REQ-PRIV-003` | Self-direction data (goals, habits, nudges, reviews) kept local. |
| `REQ-DIAG-001` | Diagnostic panel redacts private fields by default. |
| `REQ-DIAG-002` | Diagnostic export requires user consent and redacts sensitive fields. |
| `REQ-GOAL-008` | Goal content local; not sent to external services. |
| `REQ-HABIT-010` | Habit data local; no Reminders.app or external dependency. |
| `REQ-NUDGE-008` | Nudges delivered locally; no behavioral data sent externally. |
| `REQ-REVIEW-007` | Review content computed locally; not sent externally. |
| `REQ-STATS-006` | Statistics computed locally; no external services. |
| `REQ-SEARCH-004` | Search does not query external services. |
| `REQ-EXPORT-004` | Export is local only; not sent externally. |

---

## 8. Privacy review cadence

- Review before any release that adds a new data field to read or store.
- Review before any external API integration.
- Review when diagnostics or logging behavior changes.
- Review when note frontmatter schema changes.
