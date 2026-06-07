# Calendian Settings Schema

> Status: normative settings document
> Last updated: 2026-06-08
> Plugin ID: `calendian`

This document defines the plugin settings data structure, defaults, source identity model, and migration policy. The canonical settings are stored in `<vault>/.obsidian/plugins/calendian/data.json`.

---

## 1. Settings interface

```ts
interface CalendianSettings {
  // ---- Source enablement ----
  enableCalendar: boolean;          // default: true
  enableReminders: boolean;         // default: true

  // ---- Source filtering ----
  selectedCalendarIds: string[];    // default: [] (empty = show all)
  selectedReminderListIds: string[]; // default: [] (empty = show all)

  // ---- Refresh ----
  refreshIntervalMinutes: number;   // default: 5, min: 1, max: 60

  // ---- Cache range ----
  cacheRangeMonthsPast: number;     // default: 1, min: 1, max: 12
  cacheRangeMonthsFuture: number;   // default: 3, min: 1, max: 12

  // ---- Display: events ----
  showPastEvents: "gray" | "hide" | "normal";  // default: "gray"
  eventDensity: "compact" | "comfortable";      // default: "comfortable" (v0.6)
  showEventFields: {                             // v0.6
    time: boolean;        // default: true
    calendarBadge: boolean; // default: true
    location: boolean;    // default: false
    notes: boolean;       // default: false
  };

  // ---- Display: reminders ----
  reminderRange: "selected-day" | "next-7-days" | "all-incomplete"; // default: "selected-day"
  showCompletedReminders: boolean;  // default: false
  noDateReminderSection: "show" | "hide"; // default: "show" (v0.2)

  // ---- Display: general ----
  legacyClickBehavior: boolean;     // default: false
                                    // true = single-click opens daily note (original Calendar plugin behavior)
                                    // false = single-click selects date, Cmd/Ctrl-click opens daily note

  // ---- Write defaults (v0.3) ----
  defaultCalendarId: string;        // default: "" (empty = auto-detect, prefers Outlook)
  defaultReminderListId: string;    // default: "" (empty = auto-detect, prefers Outlook "任务")

  // ---- Notifications (v0.5) ----
  notificationsEnabled: boolean;            // default: true
  eventNotificationLeadMinutes: number;     // default: 5, min: 0, max: 60
  overdueReminderNotifications: boolean;    // default: true

  // ---- Nudges (v0.5.5) ----
  nudgeEnabled: boolean;                    // default: true
  nudgeTone: "gentle" | "neutral" | "firm"; // default: "gentle"
  nudgeMorningPrompt: boolean;              // default: true
  nudgeEveningCheckin: boolean;             // default: false
  nudgeReEngageAfterMissDays: number;       // default: 3, min: 1, max: 30
  nudgeQuickStartMinutes: number;           // default: 5, min: 1, max: 60

  // ---- Source metadata cache ----
  sourceMetadata: CalendianSourceMetadata[]; // Populated by source discovery
}

interface CalendianSourceMetadata {
  source: "macos-calendar" | "macos-reminders";
  id: string;                    // Stable source ID from EventKit (UUID)
  name: string;                  // Display name (e.g. "Work")
  accountHint?: string;          // Account type hint (e.g. "iCloud", "Google", "Local")
  color?: string;                // Calendar color (hex)
  enabled: boolean;              // User toggle state
  lastSeen: string;              // ISO timestamp of last discovery
}
```

---

## 2. Default settings

```json
{
  "enableCalendar": true,
  "enableReminders": true,
  "selectedCalendarIds": [],
  "selectedReminderListIds": [],
  "refreshIntervalMinutes": 5,
  "cacheRangeMonthsPast": 1,
  "cacheRangeMonthsFuture": 3,
  "showPastEvents": "gray",
  "eventDensity": "comfortable",
  "showEventFields": {
    "time": true,
    "calendarBadge": true,
    "location": false,
    "notes": false
  },
  "reminderRange": "selected-day",
  "showCompletedReminders": false,
  "noDateReminderSection": "show",
  "legacyClickBehavior": false,
  "defaultCalendarId": "",
  "defaultReminderListId": "",
  "notificationsEnabled": true,
  "eventNotificationLeadMinutes": 5,
  "overdueReminderNotifications": true,
  "nudgeEnabled": true,
  "nudgeTone": "gentle",
  "nudgeMorningPrompt": true,
  "nudgeEveningCheckin": false,
  "nudgeReEngageAfterMissDays": 3,
  "nudgeQuickStartMinutes": 5,
  "sourceMetadata": []
}
```

---

## 3. Source identity and duplicate name handling

### The problem

A user may have multiple calendars named "Work" (e.g., iCloud Work, Google Work). Settings that persist by name alone would be ambiguous.

### The solution

Sources are identified by a compound key:

```ts
interface SourceKey {
  source: "macos-calendar" | "macos-reminders";
  id: string;          // EventKit-provided stable UUID
  name: string;        // Display name
  accountHint: string; // Account type for disambiguation
}
```

### Settings UI display

Duplicate names are disambiguated in the UI:

```text
Work — iCloud
Work — Google
Personal — Local
```

### Persistence

- `selectedCalendarIds` stores the `id` field, not the name.
- `sourceMetadata` stores the full `CalendianSourceMetadata` including `accountHint` and `color`.
- EventKit always provides a stable `calendarIdentifier` UUID, so this risk is resolved.

---

## 4. Settings migration policy

### Version tracking

`data.json` includes a `schemaVersion` field:

```json
{
  "schemaVersion": 1,
  "...other fields..."
}
```

### Migration rules

1. **On plugin load**, check `schemaVersion`.
2. If `schemaVersion < currentSchemaVersion`, run migration functions in order.
3. Migration functions are pure: `(oldSettings: unknown) => CalendianSettings`.
4. After migration, write the updated settings back to `data.json`.
5. If migration fails, keep the old `data.json` as `data.json.backup` and start with defaults.

### Migration history

| From | To | Changes |
|---|---|---|
| — | 1 | Initial schema (v0.1). |
| 1 | 2 | Add `sourceMetadata[]`; migrate `selectedCalendarNames` → `selectedCalendarIds` (v0.2). |
| 2 | 3 | Add notification fields (v0.5). |
| 3 | 4 | Add nudge and self-direction fields (v0.5.5). |
| 4 | 5 | Add `showEventFields` customization (v0.6). |

### Migration testing

See `TESTING.md` → Future automated test targets → Settings migration.

---

## 5. Settings UI layout

### v0.1 — macOS Integration

```
┌────────────────────────────────────────────┐
│ macOS Integration                          │
├────────────────────────────────────────────┤
│ Calendar.app                               │
│   [✓] Enable Calendar display              │
│   Calendar sources: [Discover] [3 found]   │
│   ☑ Work — iCloud                         │
│   ☑ Personal — Local                      │
│   ☐ Holidays — iCloud                     │
│                                            │
│ Reminders.app                              │
│   [✓] Enable Reminder display              │
│   Reminder sources: [Discover] [2 found]   │
│   ☑ Tasks — iCloud                        │
│   ☑ Personal — Local                      │
│                                            │
│ Refresh                                    │
│   Interval (minutes): [5]                  │
│   Last refresh: 2026-06-07 14:30           │
└────────────────────────────────────────────┘
```

### v0.5.5 — Self-Direction

```
┌────────────────────────────────────────────┐
│ Self-Direction                             │
├────────────────────────────────────────────┤
│ Nudges                                     │
│   [✓] Enable nudges                        │
│   Tone: [gentle ▼]                         │
│   [✓] Morning intention prompt             │
│   [ ] Evening check-in                     │
│   Re-engage after [3] missed days          │
│   Quick start duration: [5] minutes        │
└────────────────────────────────────────────┘
```

---

## 6. Settings traceability

| Setting | Related requirements |
|---|---|
| `enableCalendar`, `enableReminders` | `REQ-SRC-001`, `REQ-SRC-002` |
| `selectedCalendarIds`, `selectedReminderListIds` | `REQ-SRC-003`, `REQ-SRC-004`, `REQ-SRC-005` |
| `refreshIntervalMinutes` | `REQ-CACHE-003` |
| `cacheRangeMonthsPast/Future` | `REQ-CACHE-001` |
| `showPastEvents` | `REQ-CAL-010` |
| `reminderRange` | `REQ-REM-007` |
| `showCompletedReminders` | `REQ-REM-004` |
| `noDateReminderSection` | `REQ-REM-006` |
| `legacyClickBehavior` | `REQ-UX-001`, `REQ-UX-002` |
| `notificationsEnabled`, `eventNotificationLeadMinutes` | `REQ-NOTIF-001`, `REQ-NOTIF-004` |
| `overdueReminderNotifications` | `REQ-NOTIF-002` |
| `nudgeEnabled` | `REQ-NUDGE-006` |
| `nudgeTone` | `REQ-NUDGE-005` |
| `nudgeMorningPrompt` | `REQ-NUDGE-001` |
| `nudgeEveningCheckin` | `REQ-NUDGE-002` |
| `nudgeReEngageAfterMissDays` | `REQ-NUDGE-003` |
| `nudgeQuickStartMinutes` | `REQ-NUDGE-004` |
| `sourceMetadata` | `REQ-SRC-005`, `REQ-SRC-006` |
