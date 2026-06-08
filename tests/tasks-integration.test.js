const assert = require("assert");
const tasks = require("../src/notes/tasks-integration.js");

function testParseDueDateAndPriority() {
  const parsed = tasks.parseObsidianTaskLine("- [ ] Call Alex about launch #work 📅 2026-06-12 ⏫");
  assert.strictEqual(parsed.isTask, true);
  assert.strictEqual(parsed.completed, false);
  assert.strictEqual(parsed.title, "Call Alex about launch #work");
  assert.strictEqual(parsed.dueDate, "2026-06-12");
  assert.strictEqual(parsed.dateSource, "due");
  assert.strictEqual(parsed.priority, "high");
}

function testParseScheduledFallback() {
  const parsed = tasks.parseObsidianTaskLine("- [ ] Prepare agenda ⏳ 2026-06-13 🔼");
  assert.strictEqual(parsed.title, "Prepare agenda");
  assert.strictEqual(parsed.dueDate, "2026-06-13");
  assert.strictEqual(parsed.dateSource, "scheduled");
  assert.strictEqual(parsed.priority, "medium");
}

function testExportPlanSkipsDuplicatesAndCompletedTasks() {
  const lines = [
    "- [ ] Fresh task 📅 2026-06-14",
    "- [ ] Already exported 📅 2026-06-14 `cal:rem:abc123`",
    "- [x] Completed task 📅 2026-06-14",
    "plain text",
  ];
  const plan = tasks.buildTaskExportPlan(lines, "list-1");
  assert.strictEqual(plan.exportable.length, 1);
  assert.strictEqual(plan.exportable[0].index, 0);
  assert.deepStrictEqual(
    plan.skipped.map((item) => item.reason),
    ["already-exported", "completed", "not-task"],
  );
}

function testBuildReminderArgs() {
  const task = tasks.parseObsidianTaskLine("- [ ] Renew passport 📅 2026-07-01 🔽");
  assert.deepStrictEqual(tasks.buildCreateReminderArgs(task, "personal"), [
    "create-reminder",
    "Renew passport",
    "personal",
    "2026-07-01T12:00:00Z",
    "",
    "low",
    "Imported from Obsidian task.",
  ]);
}

function testAppendReminderRef() {
  assert.strictEqual(
    tasks.appendReminderRefToTaskLine("- [ ] Fresh task", "rem-1"),
    "- [ ] Fresh task `cal:rem:rem-1`",
  );
  assert.strictEqual(
    tasks.appendReminderRefToTaskLine("- [ ] Fresh task `cal:rem:rem-1`", "rem-2"),
    "- [ ] Fresh task `cal:rem:rem-1`",
  );
}

testParseDueDateAndPriority();
testParseScheduledFallback();
testExportPlanSkipsDuplicatesAndCompletedTasks();
testBuildReminderArgs();
testAppendReminderRef();

console.log("tasks integration tests passed");
