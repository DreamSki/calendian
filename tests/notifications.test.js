const assert = require("assert");
const {
    buildNotificationCandidates,
    getNotificationSettings,
    recordNotificationDelivery,
} = require("../src/macos/notifications.js");

function minutesFrom(base, minutes) {
    return new Date(base.getTime() + minutes * 60 * 1000);
}

function testEventLeadWindow() {
    const now = new Date(2026, 5, 8, 9, 0, 0);
    const earlyStart = minutesFrom(now, 9);
    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: true,
            reminderNotificationsEnabled: false,
            notificationLeadMinutes: 10,
        },
        events: [
            { id: "early", title: "Early", start: earlyStart, isAllDay: false },
            { id: "late", title: "Late", start: minutesFrom(now, 11), isAllDay: false },
            { id: "past", title: "Past", start: minutesFrom(now, -1), isAllDay: false },
            { id: "all-day", title: "All day", start: minutesFrom(now, 5), isAllDay: true },
        ],
        reminders: [],
        delivered: {},
    });

    assert.deepStrictEqual(candidates.map((item) => item.id), [`event:early:lead:${earlyStart.toISOString()}`]);
    assert.strictEqual(candidates[0].message, "Early starts in 9 minutes");
}

function testOverdueReminderCandidates() {
    const now = new Date(2026, 5, 8, 9, 0, 0);
    const overdueDue = minutesFrom(now, -5);
    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: false,
            reminderNotificationsEnabled: true,
        },
        events: [],
        reminders: [
            { id: "overdue", title: "Overdue", due: overdueDue, dueTime: "08:55", hasDueTime: true, completed: false },
            { id: "future", title: "Future", due: minutesFrom(now, 5), dueTime: "09:05", hasDueTime: true, completed: false },
            { id: "done", title: "Done", due: minutesFrom(now, -10), dueTime: "08:50", hasDueTime: true, completed: true },
            { id: "nodate", title: "No date", due: null, completed: false },
        ],
        delivered: {},
    });

    assert.deepStrictEqual(candidates.map((item) => item.id), [
        "reminder:overdue:overdue:2026-06-08",
        `reminder:future:lead:${minutesFrom(now, 5).toISOString()}`,
    ]);
    assert.strictEqual(candidates[0].message, "Overdue is overdue");
}

function testDisabledAndDeliveredSuppression() {
    const now = new Date(2026, 5, 8, 9, 0, 0);
    const standupStart = minutesFrom(now, 5);
    const taskDue = minutesFrom(now, -5);
    const delivered = {};
    recordNotificationDelivery(delivered, `event:standup:lead:${standupStart.toISOString()}`, now);

    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: true,
            reminderNotificationsEnabled: true,
            notificationLeadMinutes: 15,
        },
        events: [{ id: "standup", title: "Standup", start: standupStart, isAllDay: false }],
        reminders: [{ id: "task", title: "Task", due: taskDue, dueTime: "08:55", hasDueTime: true, completed: false }],
        delivered,
    });
    assert.deepStrictEqual(candidates.map((item) => item.id), ["reminder:task:overdue:2026-06-08"]);

    const disabled = buildNotificationCandidates({
        now,
        options: { notificationsEnabled: false },
        events: [{ id: "standup", title: "Standup", start: minutesFrom(now, 5), isAllDay: false }],
        reminders: [{ id: "task", title: "Task", due: minutesFrom(now, -5), completed: false }],
        delivered: {},
    });
    assert.deepStrictEqual(disabled, []);
}

function testDefaultSettingsAreConservative() {
    const settings = getNotificationSettings({});
    assert.strictEqual(settings.notificationsEnabled, false);
    assert.strictEqual(settings.eventNotificationsEnabled, true);
    assert.strictEqual(settings.reminderNotificationsEnabled, true);
    assert.strictEqual(settings.notificationLeadMinutes, 10);
    assert.strictEqual(settings.previousDayNotificationsEnabled, true);
    assert.strictEqual(settings.previousDayNotificationTime, "18:00");
}

function testPreviousDayCandidates() {
    const now = new Date(2026, 5, 8, 18, 5, 0);
    const tomorrowTimedEvent = new Date(2026, 5, 9, 9, 30, 0);
    const tomorrowAllDayEvent = new Date(2026, 5, 9, 0, 0, 0);
    const tomorrowReminder = new Date(2026, 5, 9, 0, 0, 0);
    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: true,
            reminderNotificationsEnabled: true,
            notificationLeadMinutes: 10,
            previousDayNotificationsEnabled: true,
            previousDayNotificationTime: "18:00",
        },
        events: [
            { id: "meeting", title: "Meeting", start: tomorrowTimedEvent, isAllDay: false },
            { id: "holiday", title: "Holiday", start: tomorrowAllDayEvent, isAllDay: true },
        ],
        reminders: [
            { id: "date-only", title: "Submit form", due: tomorrowReminder, dueDate: tomorrowReminder.toISOString(), dueTime: "", hasDueTime: false, completed: false },
        ],
        delivered: {},
    });

    assert.deepStrictEqual(candidates.map((item) => item.id), [
        "event:meeting:previous-day:2026-06-09",
        "event:holiday:previous-day:2026-06-09",
        "reminder:date-only:previous-day:2026-06-09",
    ]);
}

function testReminderTemporalPhases() {
    const now = new Date(2026, 5, 8, 9, 0, 0);
    const todayDateOnly = new Date(2026, 5, 8, 0, 0, 0);
    const timedDue = minutesFrom(now, 5);
    const overdueDateOnly = new Date(2026, 5, 7, 0, 0, 0);
    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: false,
            reminderNotificationsEnabled: true,
            notificationLeadMinutes: 10,
        },
        events: [],
        reminders: [
            { id: "today", title: "Today date-only", due: todayDateOnly, dueDate: todayDateOnly.toISOString(), dueTime: "", hasDueTime: false, completed: false },
            { id: "timed", title: "Timed", due: timedDue, dueDate: timedDue.toISOString(), dueTime: "09:05", hasDueTime: true, completed: false },
            { id: "old", title: "Old date-only", due: overdueDateOnly, dueDate: overdueDateOnly.toISOString(), dueTime: "", hasDueTime: false, completed: false },
        ],
        delivered: {},
    });

    assert.deepStrictEqual(candidates.map((item) => item.id), [
        "reminder:today:today:2026-06-08",
        `reminder:timed:lead:${timedDue.toISOString()}`,
        "reminder:old:overdue:2026-06-08",
    ]);
}

testEventLeadWindow();
testOverdueReminderCandidates();
testDisabledAndDeliveredSuppression();
testDefaultSettingsAreConservative();
testPreviousDayCandidates();
testReminderTemporalPhases();

console.log("notifications tests passed");
