// src/notes/frontmatter.js — note association model (v0.5)
// REQ-NOTE-001: Associate events with notes via stable frontmatter metadata
// REQ-NOTE-002: Associate reminders with notes via stable frontmatter metadata
// REQ-NOTE-003: Show associated note links in event/reminder details
// REQ-NOTE-004: Handle missing or renamed notes safely
//
// Compact frontmatter format (v0.5):
//   calendian:
//     events: ["id1", "id2"]
//     reminders: ["id3"]
//
// Backward-compat: old verbose format (associations array) still parsed.

// ── Module-scoped helpers ──────────────────────────────────────────

/**
 * Extract calendian associations from a parsed frontmatter object.
 * Supports both old verbose format and new compact format.
 *
 * Old (v0.4):
 *   calendian:
 *     associations:
 *       - type: event
 *         id: "..."
 *
 * New (v0.5 compact):
 *   calendian:
 *     events: ["id1", "id2"]
 *     reminders: ["id3"]
 *
 * Also supports the simplest form:
 *   calendian: ["id1", "id2"]   (all treated as events)
 *
 * Returns an array of { type: "event"|"reminder", id: string } or empty array.
 */
function parseCalendianFrontmatter(frontmatter) {
    if (!frontmatter || !frontmatter.calendian) return [];
    var cal = frontmatter.calendian;

    // ── v0.5 compact: { events: [...], reminders: [...] } ──
    if (typeof cal === "object" && !Array.isArray(cal)) {
        var results = [];
        var eventIds = cal.events;
        var reminderIds = cal.reminders;
        if (Array.isArray(eventIds)) {
            for (var i = 0; i < eventIds.length; i++) {
                if (eventIds[i] && typeof eventIds[i] === "string") {
                    results.push({ type: "event", id: eventIds[i] });
                }
            }
        }
        if (Array.isArray(reminderIds)) {
            for (var j = 0; j < reminderIds.length; j++) {
                if (reminderIds[j] && typeof reminderIds[j] === "string") {
                    results.push({ type: "reminder", id: reminderIds[j] });
                }
            }
        }
        return results;
    }

    // ── Simplest: ["id1", "id2"] (legacy, treat all as events) ──
    if (Array.isArray(cal) && cal.length > 0 && typeof cal[0] === "string") {
        var results = [];
        for (var k = 0; k < cal.length; k++) {
            if (cal[k] && typeof cal[k] === "string") {
                results.push({ type: "event", id: cal[k] });
            }
        }
        return results;
    }

    // ── v0.4 verbose: { associations: [...] } or [ { type, id, ... } ] ──
    var blocks = Array.isArray(cal) ? cal : (cal.associations ? [cal] : []);
    var results = [];
    for (var m = 0; m < blocks.length; m++) {
        var block = blocks[m];
        var items = block.associations || (block.type ? [block] : []);
        if (!Array.isArray(items)) items = [items];
        for (var n = 0; n < items.length; n++) {
            var item = items[n];
            if (item && item.id) {
                results.push({
                    type: item.type || "event",
                    id: item.id
                });
            }
        }
    }
    return results;
}

/**
 * Build compact calendian frontmatter YAML for a set of event and reminder IDs.
 * Empty arrays are omitted from output.
 *
 * @param {string[]} eventIds
 * @param {string[]} reminderIds
 * @returns {string} YAML frontmatter block (including --- delimiters)
 */
function buildCompactFrontmatterYAML(eventIds, reminderIds) {
    var lines = [];
    lines.push("---");
    lines.push("calendian:");

    if (eventIds && eventIds.length > 0) {
        lines.push("  events:");
        for (var i = 0; i < eventIds.length; i++) {
            lines.push("    - \"" + eventIds[i] + "\"");
        }
    }
    if (reminderIds && reminderIds.length > 0) {
        lines.push("  reminders:");
        for (var i = 0; i < reminderIds.length; i++) {
            lines.push("    - \"" + reminderIds[i] + "\"");
        }
    }
    lines.push("---");
    lines.push("");
    return lines.join("\n");
}

/**
 * Escape double quotes and backslashes in a YAML double-quoted string value.
 */
function escapeYAMLValue(str) {
    return String(str).replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

/**
 * Sanitize a string for use as a cross-platform filename.
 * Uses a whitelist approach: keep only letters, digits, spaces, CJK characters,
 * and safe punctuation (hyphen, underscore, dot, parentheses).
 * Strips leading/trailing dots and spaces (problematic on Windows).
 */
function sanitizeFilename(name) {
    if (!name || typeof name !== "string") return "untitled";
    var cleaned = name
        // Remove characters unsafe on any major filesystem
        .replace(/[\\/:*?"<>|#^\[\]~`$@%&+={}!';\x00-\x1f]/g, "")
        // Collapse multiple spaces
        .replace(/\s+/g, " ")
        .trim()
        // Strip leading/trailing dots (Windows issue)
        .replace(/^\.+|\.+$/g, "")
        .trim();
    if (cleaned.length === 0) return "untitled";
    return cleaned.substring(0, 100);
}

/**
 * Add an entry to the index, avoiding duplicates.
 */
/**
 * Background: scan note bodies for inline cal:ev:ID / cal:rem:ID refs.
 * Updates the index in-place. Capped at 200 files.
 */
async function scanBodiesForInlineRefs(app, files, index) {
    var count = 0, hitCount = 0;
    for (var i = 0; i < files.length; i++) {
        if (count >= 200) break;
        try {
            var content = await app.vault.cachedRead(files[i]);
            var re = /`?cal:(ev|rem):([A-Fa-f0-9:-]{20,})`?/g;
            var m;
            while ((m = re.exec(content)) !== null) {
                addToIndex(index, m[1] === "rem" ? "reminder" : "event", m[2], files[i].path, files[i].basename);
                hitCount++;
            }
            count++;
        } catch (e) { /* skip */ }
    }
    console.log("[Calendian] Body scan: " + count + " files, " + hitCount + " inline refs found");
}

function addToIndex(index, type, id, path, title) {
    var map = type === "reminder" ? index.reminders : index.events;
    var list = map.get(id);
    if (!list) { list = []; map.set(id, list); }
    for (var i = 0; i < list.length; i++) {
        if (list[i].path === path) return;
    }
    list.push({ path: path, title: title });
}

// ── Prototype methods on MacOSIntegration ─────────────────────────

/**
 * Build (or rebuild) the in-memory association index from all vault notes.
 * Called lazily on first access by getAssociatedNotes / hasAssociatedNotes.
 *
 * Maps event/reminder IDs → array of { path, title }.
 * Structure: { events: Map<id → [{path,title}]>, reminders: Map<id → [{path,title}]> }
 */
MacOSIntegration.prototype.ensureAssociationIndex = function() {
    if (this._associationIndex && !this._associationIndexDirty) {
        return this._associationIndex;
    }

    var isRebuild = !!this._associationIndex;
    console.log("[Calendian] Building note association index..." + (isRebuild ? " (rebuild)" : ""));

    // Keep old body scan results across rebuilds so inline refs aren't lost
    var index;
    if (isRebuild && this._bodyScanIndex) {
        // Preserve body scan entries from last scan
        index = this._bodyScanIndex;
    } else {
        index = { events: new Map(), reminders: new Map() };
    }

    try {
        var app = this.plugin.app;
        if (!app || !app.vault || !app.metadataCache) {
            console.warn("[Calendian] Obsidian API not available for association index");
            this._associationIndex = index;
            this._associationIndexDirty = false;
            return index;
        }

        // Synchronous pass: scan frontmatter (fast, no I/O)
        var files = app.vault.getMarkdownFiles();
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            var cache = app.metadataCache.getFileCache(file);
            if (cache && cache.frontmatter) {
                var fmItems = parseCalendianFrontmatter(cache.frontmatter);
                for (var j = 0; j < fmItems.length; j++) {
                    var fmItem = fmItems[j];
                    addToIndex(index, fmItem.type, fmItem.id, file.path, file.basename);
                }
            }
        }

        // Background async pass: scan note bodies for inline refs
        var self = this;
        scanBodiesForInlineRefs(app, files, index).then(function() {
            self._bodyScanIndex = index;
            self._associationIndexDirty = false;
            self.render();
        });
    } catch (err) {
        console.warn("[Calendian] Failed to build association index:", err.message);
    }

    this._associationIndex = index;
    this._associationIndexDirty = false;
    return index;
};

/**
 * Get notes associated with an event or reminder item.
 * @param {object} item — event or reminder from cache
 * @returns {{path: string, title: string}[]}
 */
MacOSIntegration.prototype.getAssociatedNotes = function(item) {
    if (!item || !item.id) return [];

    var index = this.ensureAssociationIndex();
    var isReminder = item.source === "macos-reminders" || item.listId || (item.dueDate !== undefined && !item.calendarName);
    var map = isReminder ? index.reminders : index.events;
    var entries = map.get(item.id);
    if (!entries || entries.length === 0) return [];

    // REQ-NOTE-004: Filter out entries whose files no longer exist
    var valid = [];
    try {
        var app = this.plugin.app;
        for (var i = 0; i < entries.length; i++) {
            var f = app.vault.getAbstractFileByPath(entries[i].path);
            if (f) {
                valid.push(entries[i]);
            }
        }
    } catch (e) {
        return entries;
    }
    return valid;
};

/**
 * Check if an event or reminder has any associated notes.
 */
MacOSIntegration.prototype.hasAssociatedNotes = function(item) {
    return this.getAssociatedNotes(item).length > 0;
};

// ── Frontmatter generation (compact format) ─────────────────────────

/**
 * Generate compact frontmatter YAML for a new event note.
 * Output: calendian: { events: ["id"] }
 */
MacOSIntegration.prototype.generateEventFrontmatter = function(evt) {
    return buildCompactFrontmatterYAML(evt.id ? [evt.id] : [], []);
};

/**
 * Generate compact frontmatter YAML for a new reminder note.
 * Output: calendian: { reminders: ["id"] }
 */
MacOSIntegration.prototype.generateReminderFrontmatter = function(rem) {
    return buildCompactFrontmatterYAML([], rem.id ? [rem.id] : []);
};

/**
 * Manually add an entry to the association index (bypasses metadata cache).
 */
MacOSIntegration.prototype._addToAssociationIndex = function(type, itemId, path, title) {
    if (!this._associationIndex) this.ensureAssociationIndex();
    var map = type === "reminder" ? this._associationIndex.reminders : this._associationIndex.events;
    var list = map.get(itemId);
    if (!list) { list = []; map.set(itemId, list); }
    // Avoid duplicates
    for (var i = 0; i < list.length; i++) {
        if (list[i].path === path) return;
    }
    list.push({ path: path, title: title });
};

// ── Note creation (+ Note button) ───────────────────────────────────

/**
 * Internal: try to create a note file, falling back to a safe filename if Obsidian rejects it.
 */
async function tryCreateNoteFile(app, folderPath, preferredName, fallbackName, content) {
    var filename = preferredName;
    var filepath = (folderPath ? folderPath + "/" : "") + filename + ".md";
    filepath = filepath.replace(/^\//, "");

    var baseFilename = filename;
    var counter = 1;
    while (app.vault.getAbstractFileByPath(filepath)) {
        filename = baseFilename + " (" + (++counter) + ")";
        filepath = (folderPath ? folderPath + "/" : "") + filename + ".md";
    }

    try {
        var file = await app.vault.create(filepath, content);
        return { file: file, filepath: filepath };
    } catch (e) {
        if (e.message && e.message.indexOf("File name") !== -1) {
            console.log("[Calendian] Preferred filename rejected, using fallback:", fallbackName);
            var safePath = (folderPath ? folderPath + "/" : "") + fallbackName + ".md";
            var safeCounter = 1;
            while (app.vault.getAbstractFileByPath(safePath)) {
                safePath = (folderPath ? folderPath + "/" : "") + fallbackName + " (" + (++safeCounter) + ").md";
            }
            var safeFile = await app.vault.create(safePath, content);
            return { file: safeFile, filepath: safePath };
        }
        throw e;
    }
}

/**
 * Create a note file with association frontmatter for an event.
 */
MacOSIntegration.prototype.createNoteForEvent = async function(evt) {
    if (!evt.id || evt.isDisplayOnly) {
        new obsidian.Notice("Cannot create note: event has no stable identifier");
        return;
    }

    var app = this.plugin.app;
    var frontmatter = this.generateEventFrontmatter(evt);
    var dateStr = evt.start ? window.moment(evt.start).format("YYYY-MM-DD") : "";
    var safeTitle = sanitizeFilename(evt.title || evt.summary || "");
    var preferredName = safeTitle ? (dateStr ? dateStr + " " + safeTitle : safeTitle) : (dateStr || "untitled-event");
    var fallbackName = dateStr ? dateStr + " Event" : "calendian-event-" + Date.now();

    try {
        var opts = this.plugin.options || {};
        var folderPath = (opts.noteFolder || "").trim().replace(/\/+$/, "");
        if (folderPath) {
            try {
                if (!app.vault.getAbstractFileByPath(folderPath)) {
                    await app.vault.createFolder(folderPath);
                }
            } catch (e) { folderPath = ""; }
        }

        var template = opts.eventNoteTemplate || "# {{title}}\n";
        var templateVars = this.buildEventTemplateVars(evt);
        var body = expandTemplate(template, templateVars);
        var content = frontmatter + body;
        var result = await tryCreateNoteFile(app, folderPath, preferredName, fallbackName, content);

        console.log("[Calendian] Created note for event:", result.filepath);
        // Add to index immediately — metadata cache may not have updated yet
        this._addToAssociationIndex("event", evt.id, result.filepath, result.file.basename);
        await app.workspace.openLinkText(result.filepath, "", false);
    } catch (err) {
        console.error("[Calendian] Failed to create note for event:", err.message);
        new obsidian.Notice("Failed to create note: " + err.message);
    }
};

/**
 * Create a note file with association frontmatter for a reminder.
 */
MacOSIntegration.prototype.createNoteForReminder = async function(rem) {
    if (!rem.id || rem.isDisplayOnly) {
        new obsidian.Notice("Cannot create note: reminder has no stable identifier");
        return;
    }

    var app = this.plugin.app;
    var frontmatter = this.generateReminderFrontmatter(rem);
    var rawDate = rem.dueDate || rem.due;
    var dateStr = rawDate ? window.moment(rawDate).format("YYYY-MM-DD") : "";
    if (dateStr === "Invalid date") dateStr = "";
    var safeTitle = sanitizeFilename(rem.title || rem.name || "");
    var preferredName = safeTitle ? (dateStr ? dateStr + " " + safeTitle : safeTitle) : (dateStr || "untitled-reminder");
    var fallbackName = dateStr ? dateStr + " Reminder" : "calendian-reminder-" + Date.now();

    try {
        var opts = this.plugin.options || {};
        var folderPath = (opts.noteFolder || "").trim().replace(/\/+$/, "");
        if (folderPath) {
            try {
                if (!app.vault.getAbstractFileByPath(folderPath)) {
                    await app.vault.createFolder(folderPath);
                }
            } catch (e) { folderPath = ""; }
        }

        var template = opts.reminderNoteTemplate || "# {{title}}\n";
        var templateVars = this.buildReminderTemplateVars(rem);
        var body = expandTemplate(template, templateVars);
        var content = frontmatter + body;
        var result = await tryCreateNoteFile(app, folderPath, preferredName, fallbackName, content);

        console.log("[Calendian] Created note for reminder:", result.filepath);
        // Add to index immediately — metadata cache may not have updated yet
        this._addToAssociationIndex("reminder", rem.id, result.filepath, result.file.basename);
        await app.workspace.openLinkText(result.filepath, "", false);
    } catch (err) {
        console.error("[Calendian] Failed to create note for reminder:", err.message);
        new obsidian.Notice("Failed to create note: " + err.message);
    }
};
