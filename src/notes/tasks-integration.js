// Calendian v0.5 — manual Obsidian Tasks → Reminders export (REQ-TASK-001..004)
// This module intentionally performs one-way, explicit export only. No file watcher
// or automatic two-way sync is registered here.

function extractReminderRef(line) {
    var match = String(line || "").match(/\bcal:rem:([^\s`)\]]+)/);
    return match ? match[1] : null;
}

function stripTasksMetadata(text) {
    return String(text || "")
        .replace(/[📅⏳🛫]\s*\d{4}-\d{2}-\d{2}/g, "")
        .replace(/\bcal:rem:[^\s`)\]]+/g, "")
        .replace(/`+\s*`*/g, "")
        .replace(/[🔺⏫🔼🔽⏬]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function findTaskDate(body) {
    var markers = [
        { marker: "📅", source: "due" },
        { marker: "⏳", source: "scheduled" },
        { marker: "🛫", source: "start" },
    ];
    for (var i = 0; i < markers.length; i++) {
        var escaped = markers[i].marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        var match = body.match(new RegExp(escaped + "\\s*(\\d{4}-\\d{2}-\\d{2})"));
        if (match) return { date: match[1], source: markers[i].source };
    }
    return { date: "", source: "" };
}

function parseTaskPriority(body) {
    if (body.indexOf("🔺") !== -1 || body.indexOf("⏫") !== -1) return "high";
    if (body.indexOf("🔼") !== -1) return "medium";
    if (body.indexOf("🔽") !== -1 || body.indexOf("⏬") !== -1) return "low";
    return "none";
}

function parseObsidianTaskLine(line) {
    var raw = String(line || "");
    var match = raw.match(/^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/);
    if (!match) {
        return { isTask: false, rawLine: raw };
    }

    var body = match[3] || "";
    var date = findTaskDate(body);
    return {
        isTask: true,
        completed: match[2].toLowerCase() === "x",
        title: stripTasksMetadata(body),
        dueDate: date.date,
        dateSource: date.source,
        priority: parseTaskPriority(body),
        existingReminderId: extractReminderRef(body),
        rawLine: raw,
    };
}

function dateOnlyToISO(dateText) {
    if (!dateText) return "";
    if (typeof window !== "undefined" && window.moment) {
        var dueMoment = window.moment(dateText, "YYYY-MM-DD");
        if (dueMoment.isValid()) {
            return dueMoment.toISOString().replace(/\.\d{3}Z$/, "Z");
        }
    }
    return dateText + "T12:00:00Z";
}

function buildCreateReminderArgs(task, listId) {
    return [
        "create-reminder",
        task.title,
        listId,
        dateOnlyToISO(task.dueDate),
        "",
        task.priority || "none",
        "Imported from Obsidian task.",
    ];
}

function buildTaskExportPlan(lines, listId) {
    var exportable = [];
    var skipped = [];
    (lines || []).forEach(function(line, index) {
        var task = parseObsidianTaskLine(line);
        if (!task.isTask) {
            skipped.push({ index: index, reason: "not-task" });
            return;
        }
        if (task.completed) {
            skipped.push({ index: index, reason: "completed" });
            return;
        }
        if (task.existingReminderId) {
            skipped.push({ index: index, reason: "already-exported", reminderId: task.existingReminderId });
            return;
        }
        if (!listId) {
            skipped.push({ index: index, reason: "no-list" });
            return;
        }
        exportable.push({
            index: index,
            task: task,
            args: buildCreateReminderArgs(task, listId),
        });
    });
    return { exportable: exportable, skipped: skipped };
}

function appendReminderRefToTaskLine(line, reminderId) {
    if (!reminderId || extractReminderRef(line)) return line;
    return String(line || "").replace(/\s*$/, " `cal:rem:" + reminderId + "`");
}

async function resolveDefaultReminderListId(integ) {
    var options = (integ && integ.plugin && integ.plugin.options) || {};
    if (options.defaultReminderListId) return options.defaultReminderListId;
    if (typeof integ.discoverReminderLists !== "function") return "";
    var lists = await integ.discoverReminderLists();
    return lists && lists.length ? lists[0].id : "";
}

function getEditorSelectionLines(editor) {
    var selected = editor.getSelection();
    if (selected) {
        return {
            selected: true,
            from: editor.getCursor("from"),
            to: editor.getCursor("to"),
            lines: selected.split(/\r?\n/),
        };
    }
    var cursor = editor.getCursor();
    return {
        selected: false,
        line: cursor.line,
        lines: [editor.getLine(cursor.line)],
    };
}

function replaceEditorSelectionLines(editor, selection, lines) {
    var replacement = lines.join("\n");
    if (selection.selected) {
        editor.replaceRange(replacement, selection.from, selection.to);
    } else {
        editor.setLine(selection.line, replacement);
    }
}

async function exportSelectedTasksToReminders(plugin, editor) {
    var integ = plugin && plugin.view && plugin.view.macosIntegration;
    if (!integ) {
        new Notice("Calendian view is not ready yet.");
        return;
    }

    var listId = await resolveDefaultReminderListId(integ);
    var selection = getEditorSelectionLines(editor);
    var plan = buildTaskExportPlan(selection.lines, listId);
    if (!plan.exportable.length) {
        new Notice("No exportable Tasks found.");
        return;
    }

    var updatedLines = selection.lines.slice();
    var exported = 0;
    for (var i = 0; i < plan.exportable.length; i++) {
        var item = plan.exportable[i];
        var created = await integ.execHelper(item.args);
        var reminderId = created && (created.id || created.reminderId || created.uid);
        if (reminderId) {
            updatedLines[item.index] = appendReminderRefToTaskLine(updatedLines[item.index], reminderId);
            exported++;
        }
    }

    if (exported > 0) {
        replaceEditorSelectionLines(editor, selection, updatedLines);
        console.log("[Calendian] Exported " + exported + " Obsidian task(s) to Reminders");
        new Notice("Exported " + exported + " task(s) to Reminders.");
        if (typeof integ.init === "function") {
            await integ.init(true);
        }
    } else {
        new Notice("No reminders were created.");
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        appendReminderRefToTaskLine: appendReminderRefToTaskLine,
        buildCreateReminderArgs: buildCreateReminderArgs,
        buildTaskExportPlan: buildTaskExportPlan,
        dateOnlyToISO: dateOnlyToISO,
        extractReminderRef: extractReminderRef,
        findTaskDate: findTaskDate,
        parseObsidianTaskLine: parseObsidianTaskLine,
        parseTaskPriority: parseTaskPriority,
        stripTasksMetadata: stripTasksMetadata,
    };
}
