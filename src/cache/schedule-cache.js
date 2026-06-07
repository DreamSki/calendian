// src/cache/schedule-cache.js — in-memory cache, preload, date queries (REQ-ARCH-001)
// Extracted from main.js MacOSIntegration class
'use strict';

module.exports = {
    loadEventsFromCache: async function() {
        try {
            var raw = await this.plugin.readCacheFile('_eventsCache');
            if (raw && raw.events && raw.events.length > 0) {
                var events = [];
                for (var i = 0; i < raw.events.length; i++) {
                    var e = raw.events[i];
                    e.start = e._start ? new Date(e._start) : null;
                    e.end = e._end ? new Date(e._end) : null;
                    // Backward compat: migrate old field names to SPEC model
                    if (!e.title && e.summary) e.title = e.summary;
                    if (!e.calendarName && e.calendar) e.calendarName = e.calendar;
                    if (e.isAllDay === undefined && e.allday !== undefined) e.isAllDay = e.allday;
                    events.push(e);
                }
                this.allEvents = events;
                if (raw.colors) this.calendarColors = raw.colors;
                if (raw.cacheStart) this.cacheStart = window.moment(raw.cacheStart);
                if (raw.cacheEnd) this.cacheEnd = window.moment(raw.cacheEnd);
                this._cacheSavedAt = raw.savedAt || null;
                this.permissionState.calendar = 'granted';
                console.log("[Calendian] Loaded " + events.length + " events from disk cache (saved at " + (raw.savedAt || "unknown") + ")");
                return true;
            }
        } catch (e) {
            console.warn("[Calendian] Failed to load events from cache:", e.message);
        }
        return false;
    },

    // --- Check if cache is fresh enough to skip background refresh ---
    isCacheFresh: function() {
        if (!this._cacheSavedAt) return false;
        // If JXA is already running, consider cache "fresh enough" — don't stack calls
        if (this._refreshRunning) return true;
        try {
            var savedTime = new Date(this._cacheSavedAt).getTime();
            var ageMs = Date.now() - savedTime;
            // Use 2x the refresh interval, minimum 15 minutes, to avoid hammering Calendar.app
            var intervalMin = Math.max(15, (this.plugin.options?.refreshIntervalMinutes || 5) * 2);
            return ageMs < (intervalMin * 60 * 1000);
        } catch (e) { return false; }
    },

    // --- Save events to persistent disk cache ---
    saveEventsToCache: async function() {
        try {
            var events = [];
            for (var i = 0; i < this.allEvents.length; i++) {
                var e = this.allEvents[i];
                events.push({
                    id: e.id, source: e.source,
                    title: e.title || e.summary || "",
                    _start: e.start ? e.start.toISOString() : null,
                    _end: e.end ? e.end.toISOString() : null,
                    calendarName: e.calendarName || e.calendar || "",
                    calendarId: e.calendarId || "",
                    isAllDay: e.isAllDay !== undefined ? e.isAllDay : (e.allday || false),
                    location: e.location || "", url: e.url || "",
                    notes: e.notes || "", isRecurring: e.isRecurring || false,
                    recurrenceSummary: e.recurrenceSummary || ""
                });
            }
            var cache = {
                events: events,
                colors: this.calendarColors,
                cacheStart: this.cacheStart ? this.cacheStart.format() : null,
                cacheEnd: this.cacheEnd ? this.cacheEnd.format() : null,
                savedAt: new Date().toISOString()
            };
            await this.plugin.writeCacheFile('_eventsCache', cache);
        } catch (e) {
            console.warn("[Calendian] Failed to save events to cache:", e.message);
        }
    },

    // --- Save reminders to persistent disk cache ---
    saveRemindersToCache: async function() {
        try {
            var reminders = [];
            for (var i = 0; i < this.allReminders.length; i++) {
                var r = this.allReminders[i];
                reminders.push({
                    id: r.id, source: r.source,
                    title: r.title || r.name || "",
                    _due: r.due ? r.due.toISOString() : null,
                    dueDate: r.dueDate || "",
                    listName: r.listName || r.list || "",
                    listId: r.listId || "",
                    priority: r.priority || "none",
                    completed: r.completed || false,
                    notes: r.notes || ""
                });
            }
            var cache = {
                reminders: reminders,
                savedAt: new Date().toISOString()
            };
            await this.plugin.writeCacheFile('_remindersCache', cache);
        } catch (e) {
            console.warn("[Calendian] Failed to save reminders to cache:", e.message);
        }
    },

    // --- Load reminders from persistent disk cache (instant) ---
    loadRemindersFromCache: async function() {
        try {
            var raw = await this.plugin.readCacheFile('_remindersCache');
            if (raw && raw.reminders && raw.reminders.length > 0) {
                var reminders = [];
                for (var i = 0; i < raw.reminders.length; i++) {
                    var r = raw.reminders[i];
                    r.due = r._due ? new Date(r._due) : null;
                    // Backward compat: migrate old field names
                    if (!r.title && r.name) r.title = r.name;
                    if (!r.listName && r.list) r.listName = r.list;
                    reminders.push(r);
                }
                this.allReminders = reminders;
                this.permissionState.reminders = 'granted';
                console.log("[Calendian] Loaded " + reminders.length + " reminders from disk cache");
                return true;
            }
        } catch (e) {
            console.warn("[Calendian] Failed to load reminders from cache:", e.message);
        }
        return false;
    },

    // --- Preload all events for ±6 months ---
    // --- Preload events via EventKit helper (fast) ---
    preloadAll: async function() {
        this.isLoading.calendar = true;
        var now = window.moment();
        this.cacheStart = now.clone().subtract(6, 'months').startOf('month');
        this.cacheEnd = now.clone().add(6, 'months').endOf('month');
        var fromISO = this.cacheStart.toISOString().replace(/\.\d{3}Z$/, 'Z');
        var toISO = this.cacheEnd.toISOString().replace(/\.\d{3}Z$/, 'Z');

        var opts = this.plugin.options || {};
        var filterIds = opts.selectedCalendarIds || [];

        try {
            var startMs = Date.now();
            var args = ['events', fromISO, toISO];
            if (filterIds.length > 0) { args = args.concat(filterIds); }
            var rawEvents = await this.execHelper(args);
            console.log("[Calendian] EventKit events completed in " + (Date.now() - startMs) + "ms, " + rawEvents.length + " events");

            // Map to internal model + collect colors
            var colors = {};
            var events = [];
            for (var i = 0; i < rawEvents.length; i++) {
                var e = rawEvents[i];
                if (e.calendarColor) { colors[e.calendarName] = e.calendarColor; }
                events.push({
                    id: e.id,
                    source: "macos-calendar",
                    title: e.title || "",
                    start: e.start ? new Date(e.start) : null,
                    end: e.end ? new Date(e.end) : null,
                    calendarName: e.calendarName || "",
                    calendarId: e.calendarId || "",
                    calendarColor: e.calendarColor || "",
                    isAllDay: e.isAllDay || false,
                    isRecurring: e.isRecurring || false,
                    recurrenceSummary: e.recurrenceSummary || "",
                    location: e.location || "",
                    url: e.url || "",
                    notes: e.notes || "",
                    attendees: e.attendees || [],
                    accountName: e.accountName || ""
                });
            }
            this.calendarColors = colors;
            this.allEvents = events;
            this.permissionState.calendar = 'granted';
            this.lastError.calendar = null;
            this.sourceCounts.calendars = Object.keys(colors).length;
            this.saveEventsToCache();
        } catch (err) {
            console.error("[Calendian] Failed to preload events:", err.error?.message || err.stderr, "stderr:", err.stderr);
            var errorType = this.classifyError(err);
            this.permissionState.calendar = errorType;
            this.lastError.calendar = { type: errorType, message: (err.stderr || err.error?.message || 'Unknown error'), timestamp: new Date().toISOString() };
            if (errorType === 'permission_denied') { this.allEvents = []; }
        }
        this.isLoading.calendar = false;
    },

    // --- Preload reminders via EventKit helper (fast) ---
    preloadReminders: async function() {
        this.isLoading.reminders = true;
        var now = window.moment();
        var fromISO = now.clone().subtract(6, 'months').startOf('month').toISOString().replace(/\.\d{3}Z$/, 'Z');
        var toISO = now.clone().add(6, 'months').endOf('month').toISOString().replace(/\.\d{3}Z$/, 'Z');

        var opts = this.plugin.options || {};
        var filterIds = opts.selectedReminderListIds || [];

        try {
            var args = ['reminders', fromISO, toISO];
            if (filterIds.length > 0) { args = args.concat(filterIds); }
            var rawReminders = await this.execHelper(args);

            var reminders = [];
            for (var i = 0; i < rawReminders.length; i++) {
                var r = rawReminders[i];
                reminders.push({
                    id: r.id || "",
                    source: "macos-reminders",
                    title: r.title || "",
                    dueDate: r.dueDate || "",
                    due: r.dueDate ? new Date(r.dueDate) : null,
                    listName: r.listName || "",
                    listId: r.listId || "",
                    priority: r.priority || "none",
                    completed: r.completed || false,
                    notes: r.notes || "",
                    parentId: r.parentId || ""
                });
            }
            // Fetch no-due-date reminders and merge
            try {
                var nodateArgs = ['reminders-nodate'];
                if (filterIds.length > 0) { nodateArgs = nodateArgs.concat(filterIds); }
                var rawNoDate = await this.execHelper(nodateArgs);
                for (var j = 0; j < rawNoDate.length; j++) {
                    var nd = rawNoDate[j];
                    reminders.push({
                        id: nd.id || "",
                        source: "macos-reminders",
                        title: nd.title || "",
                        dueDate: "",
                        due: null,
                        listName: nd.listName || "",
                        listId: nd.listId || "",
                        priority: nd.priority || "none",
                        completed: false,
                        notes: nd.notes || "",
                        parentId: nd.parentId || ""
                    });
                }
            } catch (nodateErr) {
                console.warn("[Calendian] No-date reminders fetch failed:", nodateErr.stderr || nodateErr.message);
            }
            this.allReminders = reminders;
            this.permissionState.reminders = 'granted';
            this.lastError.reminders = null;
            this.sourceCounts.reminderLists = this.countReminderLists(reminders);
            this.saveRemindersToCache();
        } catch (err) {
            console.error("[Calendian] Failed to preload reminders:", err.error?.message || err.stderr);
            var errorType = this.classifyError(err);
            this.permissionState.reminders = errorType;
            this.lastError.reminders = { type: errorType, message: (err.stderr || err.error?.message || 'Unknown error'), timestamp: new Date().toISOString() };
            if (errorType === 'permission_denied') { this.allReminders = []; }
        }
        this.isLoading.reminders = false;
    },

    // --- Get events for a specific date from cache ---
    // REQ-CAL-009: Multi-day events appear on every overlapping day
    getEventsForDate: function(date) {
        var d = date.toDate();
        var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        var dayStart = new Date(y, m, day, 0, 0, 0);
        var dayEnd = new Date(y, m, day, 23, 59, 59);
        var filterIds = (this.plugin.options && this.plugin.options.selectedCalendarIds) || [];
        var calColors = this.calendarColors || {};
        return this.allEvents.filter(function(e) {
            if (!e.start) return false;
            // Apply calendar source filter by compound ID (name|||color) or plain ID
            if (filterIds.length > 0) {
                var eName = e.calendarName || e.calendar || "";
                var eColor = calColors[eName] || "";
                var eCompoundId = eName + "|||" + eColor;
                var eId = e.calendarId || e.id || "";
                var matched = filterIds.includes(eCompoundId) || filterIds.includes(eId) || filterIds.includes(eName);
                if (!matched) return false;
            }
            // Check if event overlaps with this day [dayStart, dayEnd]
            var evtStart = e.start;
            var evtEnd = e.end || e.start;
            // Event overlaps day if evtStart <= dayEnd AND evtEnd >= dayStart
            return evtStart <= dayEnd && evtEnd >= dayStart;
        }).sort(function(a, b) {
            var aAllDay = a.isAllDay !== undefined ? a.isAllDay : a.allday;
            var bAllDay = b.isAllDay !== undefined ? b.isAllDay : b.allday;
            if (aAllDay && !bAllDay) return -1;
            if (!aAllDay && bAllDay) return 1;
            if (!a.start || !b.start) return 0;
            return a.start.getTime() - b.start.getTime();
        });
    },

    // --- Get reminders for a specific date from cache ---
    // REQ-REM-007: displayRange controls the date window — 'today', '7days', or 'all'
    getRemindersForDate: function(date) {
        var opts = this.plugin.options || {};
        var displayRange = opts.reminderDisplayRange || 'today';
        var filterIds = opts.selectedReminderListIds || [];

        var d = date.toDate();
        var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        // Start far in the past so overdue reminders are always included;
        // the range controls how far into the future we look.
        var start = new Date(2000, 0, 1, 0, 0, 0);
        var end;

        if (displayRange === '7days') {
            end = new Date(y, m, day + 7, 23, 59, 59);
        } else if (displayRange === 'all') {
            // Show all incomplete reminders (full cache range)
            end = new Date(y + 10, m, day, 23, 59, 59);
        } else {
            // 'today' — overdue + today only
            end = new Date(y, m, day, 23, 59, 59);
        }

        return this.allReminders.filter(function(r) {
            // Apply reminder list filter by ID (primary) or name (fallback)
            if (filterIds.length > 0) {
                var rId = r.listId || r.id || "";
                var rName = r.listName || r.list || "";
                var matched = filterIds.includes(rId) || filterIds.includes(rName);
                if (!matched) return false;
            }
            // Reminders with no due date are handled separately (see renderRemindersSection)
            if (!r.due) return false;
            return r.due >= start && r.due <= end;
        });
    },

    // --- Get reminders without a due date (REQ-REM-006) ---
    getNoDateReminders: function() {
        var opts = this.plugin.options || {};
        var filterIds = opts.selectedReminderListIds || [];
        return this.allReminders.filter(function(r) {
            if (filterIds.length > 0) {
                var rId = r.listId || r.id || "";
                var rName = r.listName || r.list || "";
                var matched = filterIds.includes(rId) || filterIds.includes(rName);
                if (!matched) return false;
            }
            return !r.due;
        });
    },

    // --- Parse event data ---
    // v0.1 fields per SPEC §5.1: id, source, calendarId, calendarName, calendarColor,
    //   title, start, end, isAllDay, isRecurring, recurrenceSummary,
    //   location, url, notes, attendees, alarms
    // v0.2 fields (REQ-CAL-007): location, url, notes populated from JXA
    parseEvents: function(raw) {
        if (!raw) return [];
        return raw.split("\n").filter(Boolean).reduce(function(acc, line) {
            try {
                const parts = line.split("|||");
                // JXA output format: summary|startDate|endDate|calendarName|allday|uid
                var evt = {
                    id: parts[5] || ("evt-" + encodeURIComponent(parts[0] || "untitled") + "-" + (parts[1] || "0")),
                    source: "macos-calendar",
                    title: parts[0] || "",
                    start: parts[1] ? new Date(parts[1]) : null,
                    end: parts[2] ? new Date(parts[2]) : null,
                    calendarName: parts[3] || "",
                    calendarId: parts[3] || "",
                    calendarColor: "",
                    isAllDay: parts[4] === "1",
                    isRecurring: false,
                    recurrenceSummary: "",
                    location: "",
                    url: "",
                    notes: "",
                    attendees: [],
                    alarms: []
                };
                if (evt.title || evt.start) {
                    acc.push(evt);
                }
            } catch (e) {
                console.warn("[Calendian] Skipped unparseable event record:", line.substring(0, 80));
            }
            return acc;
        }, []);
    },

    // --- Parse reminder data ---
    // REQ-DATA-007: Treat optional JXA fields as optional
    parseReminders: function(raw) {
        if (!raw) return [];
        // REQ-DATA-005: Isolate parse failures to individual records
        var listNames = {};
        return raw.split("\n").filter(Boolean).reduce(function(acc, line) {
            try {
                const parts = line.split("|||");
                var listName = parts[2] || "";
                if (listName && !listNames[listName]) listNames[listName] = true;
                var priority = "none";
                if (parts[4] && parts[4] !== "none") {
                    var p = parseInt(parts[4], 10);
                    if (!isNaN(p)) {
                        if (p <= 500) priority = "high";
                        else if (p <= 700) priority = "medium";
                        else priority = "low";
                    }
                }
                var rem = {
                    id: parts[3] || ("rem-" + (parts[0] || "unknown") + "-" + (parts[2] || "n/a")),
                    source: "macos-reminders",
                    title: parts[0] || "",
                    dueDate: parts[1] || "",
                    due: parts[1] ? new Date(parts[1]) : null,
                    listName: listName,
                    listId: listName,
                    priority: priority,
                    completed: parts[5] === "1",
                    notes: parts[6] || "",
                    parentId: ""
                };
                if (rem.title) {
                    acc.push(rem);
                }
            } catch (e) {
                // REQ-DATA-005: Skip malformed record
                console.warn("[Calendian] Skipped unparseable reminder record:", line.substring(0, 80));
            }
            return acc;
        }, []);
    },

    // --- Count unique reminder lists ---
    countReminderLists: function(reminders) {
        var lists = {};
        for (var i = 0; i < reminders.length; i++) {
            var ln = reminders[i].listName || reminders[i].list || "";
            if (ln) lists[ln] = true;
        }
        return Object.keys(lists).length;
    }

};
