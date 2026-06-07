// src/macos/writer.js — write adapter for EventKit helper, safety-gated (v0.3+)
// REQ-WRITE-001 to REQ-WRITE-010

var nodeChildProcess = require('child_process');

/**
 * Call the calendian-helper binary with args and return parsed JSON.
 * This is a standalone helper — does not depend on MacOSIntegration instance.
 * @param {string} helperPath - absolute path to calendian-helper binary
 * @param {string[]} args - command + arguments
 * @returns {Promise<object>} parsed JSON stdout
 */
function callHelper(helperPath, args) {
    if (!helperPath) return Promise.reject(new Error('Helper not available'));
    return new Promise((resolve, reject) => {
        var proc = nodeChildProcess.spawn(helperPath, args);
        var stdout = '';
        var stderr = '';
        proc.stdout.on('data', function(d) { stdout += d.toString(); });
        proc.stderr.on('data', function(d) { stderr += d.toString(); });
        proc.on('close', function(code) {
            if (code !== 0) {
                reject({ error: new Error('Helper exited with code ' + code), stderr: stderr, stdout: stdout });
                return;
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch (e) {
                reject({ error: e, stderr: stderr, stdout: stdout });
            }
        });
        proc.on('error', function(err) {
            reject({ error: err, stderr: stderr, stdout: stdout });
        });
    });
}

/**
 * Classify helper errors by type (matches MacOSIntegration.classifyError).
 * @param {object} err - error object with optional stderr, error.message
 * @returns {'permission_denied'|'timeout'|'error'}
 */
function classifyError(err) {
    const msg = ((err.stderr || '') + ' ' + (err.error?.message || '')).toLowerCase();
    if (msg.includes('not allowed') || msg.includes('permission') ||
        msg.includes('automation') || msg.includes('-1743') || msg.includes('-10004')) {
        return 'permission_denied';
    }
    if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('killed')) {
        return 'timeout';
    }
    return 'error';
}

// ── Public API ──────────────────────────────────────────────

module.exports = {
    callHelper,
    classifyError,

    // ── Validation ──────────────────────────────────────────

    /**
     * Validate event creation fields. REQ-WRITE-002.
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validateEvent(title, calendarId, startDate, endDate) {
        var errors = [];
        if (!title || !title.trim()) errors.push("Event title is required.");
        if (!calendarId) errors.push("A calendar must be selected.");
        if (!startDate || isNaN(startDate.getTime())) errors.push("Valid start date is required.");
        if (!endDate || isNaN(endDate.getTime())) errors.push("Valid end date is required.");
        if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
            errors.push("Start date must be before end date.");
        }
        return { valid: errors.length === 0, errors: errors };
    },

    /**
     * Validate reminder creation fields. REQ-WRITE-007.
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validateReminder(title, listId) {
        var errors = [];
        if (!title || !title.trim()) errors.push("Reminder title is required.");
        if (!listId) errors.push("A reminder list must be selected.");
        return { valid: errors.length === 0, errors: errors };
    },

    // ── Create event ────────────────────────────────────────

    /**
     * Create a simple non-recurring event. REQ-WRITE-001, REQ-WRITE-005.
     * @param {string} helperPath - path to calendian-helper binary
     * @param {string} title
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {string} calendarId - EventKit calendarIdentifier
     * @param {object} [opts]
     * @param {boolean} [opts.isAllDay=false]
     * @param {string} [opts.location='']
     * @param {string} [opts.notes='']
     * @param {string} [opts.url='']
     * @returns {Promise<{ok: boolean, id: string}>}
     */
    async createEvent(helperPath, title, startDate, endDate, calendarId, opts) {
        opts = opts || {};
        var validation = this.validateEvent(title, calendarId, startDate, endDate);
        if (!validation.valid) {
            throw new Error('Validation failed: ' + validation.errors.join(' '));
        }

        var isAllDay = opts.isAllDay === true;
        var location = opts.location || '';
        var notes = opts.notes || '';
        var url = opts.url || '';

        var startISO = startDate.toISOString();
        var endISO = endDate.toISOString();

        var args = ['create-event', title, startISO, endISO, calendarId, isAllDay ? 'true' : 'false'];
        if (location) args.push(location);
        if (notes) args.push(notes);
        if (url) args.push(url);

        console.log("[Calendian] Creating event: " + title + " (" + startISO + " to " + endISO + ")");
        return callHelper(helperPath, args);
    },

    // ── Create reminder ─────────────────────────────────────

    /**
     * Create a simple reminder. REQ-WRITE-006, REQ-WRITE-009, REQ-WRITE-010.
     * @param {string} helperPath
     * @param {string} title
     * @param {string} listId - EventKit calendarItemIdentifier for the reminder list
     * @param {object} [opts]
     * @param {Date} [opts.dueDate] - optional due date
     * @param {string} [opts.dueTime=''] - HH:mm format
     * @param {'none'|'low'|'medium'|'high'} [opts.priority='none']
     * @param {string} [opts.notes='']
     * @returns {Promise<{ok: boolean, id: string}>}
     */
    async createReminder(helperPath, title, listId, opts) {
        opts = opts || {};
        var validation = this.validateReminder(title, listId);
        if (!validation.valid) {
            throw new Error('Validation failed: ' + validation.errors.join(' '));
        }

        var dueDateISO = '';
        if (opts.dueDate && !isNaN(opts.dueDate.getTime())) {
            dueDateISO = opts.dueDate.toISOString();
        }
        var dueTime = opts.dueTime || '';
        var priority = opts.priority || 'none';
        var notes = opts.notes || '';

        var args = ['create-reminder', title, listId];
        if (dueDateISO) args.push(dueDateISO);
        if (dueTime) args.push(dueTime);
        if (priority) args.push(priority);
        if (notes) args.push(notes);

        console.log("[Calendian] Creating reminder: " + title + (dueDateISO ? " (due: " + dueDateISO + ")" : ""));
        return callHelper(helperPath, args);
    }
};
