const assert = require("assert");
const {
    formatReminderDueText,
    normalizeReminderTemporalFields,
    reminderHasDueTime,
} = require("../src/reminders/temporal.js");

function testNormalizeDateOnlyReminder() {
    const due = new Date(2026, 5, 8, 0, 0, 0);
    const rem = normalizeReminderTemporalFields({
        id: "date-only",
        dueDate: due.toISOString(),
        dueTime: "",
        due,
    });

    assert.strictEqual(rem.hasDueTime, false);
    assert.strictEqual(rem.dueTime, "");
    assert.strictEqual(reminderHasDueTime(rem), false);
}

function testNormalizeTimedReminder() {
    const due = new Date(2026, 5, 8, 9, 30, 0);
    const rem = normalizeReminderTemporalFields({
        id: "timed",
        dueDate: due.toISOString(),
        dueTime: "09:30",
        due,
    });

    assert.strictEqual(rem.hasDueTime, true);
    assert.strictEqual(rem.dueTime, "09:30");
    assert.strictEqual(reminderHasDueTime(rem), true);
}

function testFormatDateOnlyReminderWithoutSyntheticTime() {
    const now = new Date(2026, 5, 8, 12, 0, 0);
    const today = new Date(2026, 5, 8, 0, 0, 0);
    const future = new Date(2026, 5, 10, 0, 0, 0);

    assert.strictEqual(formatReminderDueText({ due: today, dueDate: today.toISOString(), dueTime: "", hasDueTime: false }, now), "Today");
    assert.strictEqual(formatReminderDueText({ due: future, dueDate: future.toISOString(), dueTime: "", hasDueTime: false }, now), "6/10");
}

function testFormatTimedReminderKeepsTime() {
    const now = new Date(2026, 5, 8, 12, 0, 0);
    const today = new Date(2026, 5, 8, 9, 30, 0);
    const future = new Date(2026, 5, 10, 14, 5, 0);

    assert.strictEqual(formatReminderDueText({ due: today, dueDate: today.toISOString(), dueTime: "09:30", hasDueTime: true }, now), "09:30");
    assert.strictEqual(formatReminderDueText({ due: future, dueDate: future.toISOString(), dueTime: "14:05", hasDueTime: true }, now), "6/10 14:05");
}

testNormalizeDateOnlyReminder();
testNormalizeTimedReminder();
testFormatDateOnlyReminderWithoutSyntheticTime();
testFormatTimedReminderKeepsTime();

console.log("reminder temporal tests passed");
