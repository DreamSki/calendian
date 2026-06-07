// src/macos/writer.js — write adapter for EventKit helper, safety-gated (v0.3+)
// REQ-WRITE-001 to REQ-WRITE-010, REQ-WRITE-011 to REQ-WRITE-020 (v0.4)

// ── Node.js-only helper functions (not used in Obsidian concatenation) ──
// Guarded: these are only available when loaded via require() in Node.js context.
// The Obsidian-side code uses MacOSIntegration.prototype.execHelper() instead.

(function() {
if (typeof module !== 'undefined' && module.exports) {
    var nodeChildProcess = require('child_process');

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

    module.exports = {
        callHelper,
        classifyError,
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
        validateReminder(title, listId) {
            var errors = [];
            if (!title || !title.trim()) errors.push("Reminder title is required.");
            if (!listId) errors.push("A reminder list must be selected.");
            return { valid: errors.length === 0, errors: errors };
        },
        async createEvent(helperPath, title, startDate, endDate, calendarId, opts) {
            opts = opts || {};
            var validation = this.validateEvent(title, calendarId, startDate, endDate);
            if (!validation.valid) throw new Error('Validation failed: ' + validation.errors.join(' '));
            var isAllDay = opts.isAllDay === true;
            var startISO = startDate.toISOString();
            var endISO = endDate.toISOString();
            var args = ['create-event', title, startISO, endISO, calendarId, isAllDay ? 'true' : 'false'];
            if (opts.location) args.push(opts.location);
            if (opts.notes) args.push(opts.notes);
            if (opts.url) args.push(opts.url);
            console.log("[Calendian] Creating event: " + title);
            return callHelper(helperPath, args);
        },
        async createReminder(helperPath, title, listId, opts) {
            opts = opts || {};
            var validation = this.validateReminder(title, listId);
            if (!validation.valid) throw new Error('Validation failed: ' + validation.errors.join(' '));
            var dueDateISO = opts.dueDate ? opts.dueDate.toISOString() : '';
            var args = ['create-reminder', title, listId];
            if (dueDateISO) args.push(dueDateISO);
            if (opts.dueTime) args.push(opts.dueTime);
            if (opts.priority) args.push(opts.priority);
            if (opts.notes) args.push(opts.notes);
            console.log("[Calendian] Creating reminder: " + title);
            return callHelper(helperPath, args);
        }
    };
}
})(); // end IIFE — Node.js-only code isolated from Obsidian concatenation scope

/**
 * Check if an event can be safely mutated.
 * @param {object} evt - CalendianEvent from cache
 * @returns {{ safe: boolean, reason?: string, canOpenCalendar?: boolean }}
 */
MacOSIntegration.prototype.canMutateEvent = function(evt) {
    // REQ-WRITE-015: stable source identity required
    if (!evt.id || evt.isDisplayOnly) {
        return { safe: false, reason: "This event has no stable Calendar.app identifier and cannot be safely edited.", canOpenCalendar: false };
    }
    // REQ-REC-002: recurring event mutation blocked
    if (evt.isRecurring) {
        return { safe: false, reason: "Recurring event editing requires choosing which occurrences to modify. Please edit in Calendar.app.", canOpenCalendar: true };
    }
    return { safe: true };
};

/**
 * Check if a reminder can be safely mutated.
 * @param {object} rem - CalendianReminder from cache
 * @returns {{ safe: boolean, reason?: string }}
 */
MacOSIntegration.prototype.canMutateReminder = function(rem) {
    // REQ-WRITE-019: stable source identity required
    if (!rem.id || rem.isDisplayOnly) {
        return { safe: false, reason: "This reminder has no stable Reminders.app identifier and cannot be safely edited." };
    }
    return { safe: true };
};

// ── Event edit/delete (v0.4, REQ-WRITE-011 to REQ-WRITE-015) ────────────

/**
 * Edit a simple non-recurring event. REQ-WRITE-011.
 * @param {object} evt - CalendianEvent from cache
 * @param {object} updates - { title, startDate, endDate, calendarId, isAllDay, location, notes, url }
 * @returns {Promise<{ok: boolean, id: string}>}
 */
MacOSIntegration.prototype.editEvent = async function(evt, updates) {
    var guard = this.canMutateEvent(evt);
    if (!guard.safe) {
        throw new Error(guard.reason);
    }

    // Validate
    var errors = [];
    if (!updates.title || !updates.title.trim()) errors.push("Title is required.");
    if (!updates.calendarId) errors.push("A calendar must be selected.");
    if (!updates.startDate || isNaN(updates.startDate.getTime())) errors.push("Valid start date is required.");
    if (!updates.endDate || isNaN(updates.endDate.getTime())) errors.push("Valid end date is required.");
    if (updates.startDate && updates.endDate && updates.startDate.getTime() > updates.endDate.getTime()) {
        errors.push("Start date must be before end date.");
    }
    if (errors.length > 0) {
        throw new Error("Validation failed: " + errors.join(" "));
    }

    var startISO = updates.startDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    var endISO = updates.endDate.toISOString().replace(/\.\d{3}Z$/, 'Z');

    var args = ['edit-event', evt.id, updates.title, startISO, endISO, updates.calendarId,
                updates.isAllDay ? 'true' : 'false',
                updates.location || '', updates.notes || '', updates.url || ''];

    console.log("[Calendian] Editing event (id=" + evt.id + ")");
    return this.execHelper(args);
};

/**
 * Delete a simple non-recurring event. REQ-WRITE-012.
 * @param {object} evt - CalendianEvent from cache
 * @returns {Promise<{ok: boolean, id: string}>}
 */
MacOSIntegration.prototype.deleteEvent = async function(evt) {
    var guard = this.canMutateEvent(evt);
    if (!guard.safe) {
        throw new Error(guard.reason);
    }
    console.log("[Calendian] Deleting event (id=" + evt.id + ")");
    return this.execHelper(['delete-event', evt.id]);
};

/**
 * Show delete confirmation for an event. REQ-ERR-006.
 * @param {object} evt - CalendianEvent from cache
 */
MacOSIntegration.prototype.confirmDeleteEvent = function(evt) {
    var self = this;
    new ConfirmActionModal(this.plugin.app, {
        title: "Delete Event",
        message: "Are you sure you want to delete this event? This cannot be undone.",
        ctaLabel: "Delete",
        isDangerous: true,
        onConfirm: async function() {
            try {
                var result = await self.deleteEvent(evt);
                if (result && result.ok) {
                    new obsidian.Notice("Event deleted");
                    console.log("[Calendian] Deleted event (id=" + evt.id + ")");
                    self.init(true);
                } else {
                    new obsidian.Notice("Failed to delete event");
                }
            } catch (err) {
                var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                console.error("[Calendian] Event deletion failed:", errMsg);
                new obsidian.Notice("Error: " + errMsg);
            }
        }
    }).open();
};

// ── Reminder edit/delete/complete (v0.4, REQ-WRITE-016 to REQ-WRITE-020) ─

/**
 * Toggle reminder completion. REQ-WRITE-016.
 * @param {object} rem - CalendianReminder from cache
 * @returns {Promise<{ok: boolean, id: string, completed: boolean}>}
 */
MacOSIntegration.prototype.toggleReminder = async function(rem) {
    var guard = this.canMutateReminder(rem);
    if (!guard.safe) {
        throw new Error(guard.reason);
    }
    console.log("[Calendian] Toggling reminder (id=" + rem.id + ")");
    return this.execHelper(['toggle-reminder', rem.id]);
};

/**
 * Edit a reminder. REQ-WRITE-017.
 * @param {object} rem - CalendianReminder from cache
 * @param {object} updates - { title, listId, dueDate, dueTime, priority, notes }
 * @returns {Promise<{ok: boolean, id: string}>}
 */
MacOSIntegration.prototype.editReminder = async function(rem, updates) {
    var guard = this.canMutateReminder(rem);
    if (!guard.safe) {
        throw new Error(guard.reason);
    }

    var errors = [];
    if (!updates.title || !updates.title.trim()) errors.push("Title is required.");
    if (!updates.listId) errors.push("A list must be selected.");
    if (errors.length > 0) {
        throw new Error("Validation failed: " + errors.join(" "));
    }

    var dueDateISO = '';
    if (updates.dueDate && !isNaN(updates.dueDate.getTime())) {
        dueDateISO = updates.dueDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
    }

    var args = ['edit-reminder', rem.id, updates.title, updates.listId,
                dueDateISO, updates.dueTime || '', updates.priority || 'none',
                updates.notes || ''];

    console.log("[Calendian] Editing reminder (id=" + rem.id + ")");
    return this.execHelper(args);
};

/**
 * Delete a reminder. REQ-WRITE-018.
 * @param {object} rem - CalendianReminder from cache
 * @returns {Promise<{ok: boolean, id: string}>}
 */
MacOSIntegration.prototype.deleteReminder = async function(rem) {
    var guard = this.canMutateReminder(rem);
    if (!guard.safe) {
        throw new Error(guard.reason);
    }
    console.log("[Calendian] Deleting reminder (id=" + rem.id + ")");
    return this.execHelper(['delete-reminder', rem.id]);
};

/**
 * Show delete confirmation for a reminder. REQ-ERR-006.
 * @param {object} rem - CalendianReminder from cache
 */
MacOSIntegration.prototype.confirmDeleteReminder = function(rem) {
    var self = this;
    new ConfirmActionModal(this.plugin.app, {
        title: "Delete Reminder",
        message: "Are you sure you want to delete this reminder? This cannot be undone.",
        ctaLabel: "Delete",
        isDangerous: true,
        onConfirm: async function() {
            try {
                var result = await self.deleteReminder(rem);
                if (result && result.ok) {
                    new obsidian.Notice("Reminder deleted");
                    console.log("[Calendian] Deleted reminder (id=" + rem.id + ")");
                    self.init(true);
                } else {
                    new obsidian.Notice("Failed to delete reminder");
                }
            } catch (err) {
                var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                console.error("[Calendian] Reminder deletion failed:", errMsg);
                new obsidian.Notice("Error: " + errMsg);
            }
        }
    }).open();
};
