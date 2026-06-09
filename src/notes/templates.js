// src/notes/templates.js — template engine and daily-note insertion (v0.5)
// REQ-NOTE-005: Create note from event/reminder using a template
// REQ-NOTE-006: Template variables for title, date, time, calendar/list, location
// REQ-NOTE-007: Insert associated event/reminder links into daily notes

// ── Module-scoped helpers ──────────────────────────────────────────

/**
 * Expand a template string by replacing {{variable}} placeholders.
 * Supports conditional blocks: {{#key}}...{{/key}} — included only if vars[key] is truthy.
 * Unmatched placeholders are left as-is (no crash).
 *
 * @param {string} template
 * @param {object} vars — key-value map for variable substitution
 * @returns {string}
 */
function expandTemplate(template, vars) {
    if (!template || typeof template !== "string") return "";

    var result = template;

    // First, handle conditional blocks: {{#key}}...{{/key}}
    result = result.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, function(match, key, content) {
        if (vars[key]) {
            // Recursively expand content inside the block
            return expandTemplate(content, vars);
        }
        return "";
    });

    // Then, replace simple placeholders
    result = result.replace(/\{\{(\w+)\}\}/g, function(match, key) {
        if (vars.hasOwnProperty(key) && vars[key] != null) {
            return String(vars[key]);
        }
        return match; // leave unmatched as-is
    });

    return result;
}

/**
 * Format a date as YYYY-MM-DD, safely handling various input types.
 */
function formatDate(d) {
    if (!d) return "";
    var m = window.moment(d);
    if (!m || !m.isValid()) return "";
    return m.format("YYYY-MM-DD");
}

/**
 * Format a time as HH:mm, safely handling various input types.
 */
function formatTime(d) {
    if (!d) return "";
    var m = window.moment(d);
    if (!m || !m.isValid()) return "";
    return m.format("HH:mm");
}

// ── Template variable builders ─────────────────────────────────────

/**
 * Build template variable map for an event.
 * @param {object} evt — CalendianEvent from cache
 * @returns {object}
 */
MacOSIntegration.prototype.buildEventTemplateVars = function(evt) {
    var startMoment = evt.start ? window.moment(evt.start) : null;
    var endMoment = evt.end ? window.moment(evt.end) : null;
    var isAllDay = evt.isAllDay !== undefined ? evt.isAllDay : evt.allday;

    var timeStr = "";
    if (isAllDay) {
        timeStr = "All day";
    } else if (startMoment) {
        timeStr = startMoment.format("HH:mm");
        if (endMoment) {
            timeStr += " - " + endMoment.format("HH:mm");
        }
    }

    return {
        title: evt.title || evt.summary || "",
        date: formatDate(startMoment),
        startTime: startMoment ? startMoment.format("HH:mm") : "",
        endTime: endMoment ? endMoment.format("HH:mm") : "",
        time: timeStr,
        calendar: evt.calendarName || evt.calendar || "",
        location: evt.location || "",
        url: evt.url || "",
        notes: evt.notes || "",
        isAllDay: isAllDay ? "Yes" : "No",
        recurrence: evt.recurrenceSummary || (evt.isRecurring ? "Recurring" : "")
    };
};

/**
 * Build template variable map for a reminder.
 * @param {object} rem — CalendianReminder from cache
 * @returns {object}
 */
MacOSIntegration.prototype.buildReminderTemplateVars = function(rem) {
    var dueMoment = (rem.dueDate || rem.due) ? window.moment(rem.dueDate || rem.due) : null;
    var dueTime = reminderHasDueTime(rem) && dueMoment ? (rem.dueTime || dueMoment.format("HH:mm")) : "";

    var priorityLabel = "None";
    if (rem.priority === "high") priorityLabel = "High";
    else if (rem.priority === "medium") priorityLabel = "Medium";
    else if (rem.priority === "low") priorityLabel = "Low";

    return {
        title: rem.title || rem.name || "",
        date: formatDate(dueMoment),
        dueTime: dueTime,
        time: dueTime,
        list: rem.listName || rem.list || "",
        priority: priorityLabel,
        notes: rem.notes || ""
    };
};

// ── Copy text (REQ-NOTE-009) ────────────────────────────────────────

/**
 * Copy item info to clipboard.
 * If a linked note exists, copies [[path|title]] wikilink.
 * Otherwise, copies plain text summary (no note creation).
 *
 * @param {object} item — CalendianEvent or CalendianReminder
 * @param {string} itemType — "event" or "reminder"
 * @returns {Promise<void>}
 */
MacOSIntegration.prototype.copyItemText = async function(item, itemType) {
    try {
        var itemId = item.id || "";
        var opts = this.plugin && this.plugin.options ? this.plugin.options : {};
        var refFormat = opts.refFormat || "inline";
        var prefix = itemType === "event" ? "ev" : "rem";
        var code;

        if (refFormat === "block") {
            code = "```cal\n" + prefix + ":" + itemId + "\n```";
        } else {
            code = "`cal:" + prefix + ":" + itemId + "`";
        }

        await navigator.clipboard.writeText(code);
        new obsidian.Notice("Copied: " + (code.length > 50 ? code.substring(0, 50) + "..." : code));
    } catch (err) {
        console.error("[Calendian] Failed to copy:", err.message);
        new obsidian.Notice("Failed to copy: " + err.message);
    }
};
