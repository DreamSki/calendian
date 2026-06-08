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
    const now = new Date("2026-06-08T09:00:00.000Z");
    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: true,
            reminderNotificationsEnabled: false,
            notificationLeadMinutes: 10,
        },
        events: [
            { id: "early", title: "Early", start: minutesFrom(now, 9), isAllDay: false },
            { id: "late", title: "Late", start: minutesFrom(now, 11), isAllDay: false },
            { id: "past", title: "Past", start: minutesFrom(now, -1), isAllDay: false },
            { id: "all-day", title: "All day", start: minutesFrom(now, 5), isAllDay: true },
        ],
        reminders: [],
        delivered: {},
    });

    assert.deepStrictEqual(candidates.map((item) => item.id), ["event:early"]);
    assert.strictEqual(candidates[0].message, "Early starts in 9 minutes");
}

function testOverdueReminderCandidates() {
    const now = new Date("2026-06-08T09:00:00.000Z");
    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: false,
            reminderNotificationsEnabled: true,
        },
        events: [],
        reminders: [
            { id: "overdue", title: "Overdue", due: minutesFrom(now, -5), completed: false },
            { id: "future", title: "Future", due: minutesFrom(now, 5), completed: false },
            { id: "done", title: "Done", due: minutesFrom(now, -10), completed: true },
            { id: "nodate", title: "No date", due: null, completed: false },
        ],
        delivered: {},
    });

    assert.deepStrictEqual(candidates.map((item) => item.id), ["reminder:overdue"]);
    assert.strictEqual(candidates[0].message, "Overdue is overdue");
}

function testDisabledAndDeliveredSuppression() {
    const now = new Date("2026-06-08T09:00:00.000Z");
    const delivered = {};
    recordNotificationDelivery(delivered, "event:standup", now);

    const candidates = buildNotificationCandidates({
        now,
        options: {
            notificationsEnabled: true,
            eventNotificationsEnabled: true,
            reminderNotificationsEnabled: true,
            notificationLeadMinutes: 15,
        },
        events: [{ id: "standup", title: "Standup", start: minutesFrom(now, 5), isAllDay: false }],
        reminders: [{ id: "task", title: "Task", due: minutesFrom(now, -5), completed: false }],
        delivered,
    });
    assert.deepStrictEqual(candidates.map((item) => item.id), ["reminder:task"]);

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
}

testEventLeadWindow();
testOverdueReminderCandidates();
testDisabledAndDeliveredSuppression();
testDefaultSettingsAreConservative();

console.log("notifications tests passed");
