// src/notes/codeblock.js — ```calendian``` code block + inline reference renderer (v0.5)
// Code block: renders today's events/reminders as a list
// Inline: replaces `cal:ev:ID` / `cal:rem:ID` with clickable event/reminder titles

// ── Code block renderer ────────────────────────────────────────────

/**
 * Render a ```calendian``` code block.
 */
function renderCalendianBlock(plugin, source, el, ctx) {
    var view = plugin.view;
    if (!view || !view.macosIntegration) {
        el.createDiv("calendian-block-empty").textContent =
            "Calendian panel not loaded. Open the calendar sidebar first.";
        return;
    }

    try {
        var targetDate;
        var sourceText = (source || "").trim();
        if (sourceText && sourceText !== "today") {
            var parsed = window.moment(sourceText);
            if (parsed.isValid()) targetDate = parsed;
        }
        if (!targetDate && ctx && ctx.sourcePath) {
            try {
                var basename = ctx.sourcePath.replace(/\.md$/, "").split("/").pop();
                var fromFile = window.moment(basename, "YYYY-MM-DD", true);
                if (fromFile.isValid()) targetDate = fromFile;
            } catch (e) {}
        }
        if (!targetDate) targetDate = window.moment();

        var integ = view.macosIntegration;
        var dayEvents = integ.getEventsForDate(targetDate) || [];
        var dayReminders = integ.getRemindersForDate(targetDate) || [];

        var container = el.createDiv("calendian-block");

        if (dayEvents.length === 0 && dayReminders.length === 0) {
            container.createDiv("calendian-block-empty").textContent = "No events or reminders for this date";
            return;
        }

        if (dayEvents.length > 0) {
            var evtLabel = container.createDiv("calendian-block-label");
            evtLabel.textContent = "Events";
            for (var i = 0; i < dayEvents.length; i++) {
                renderEventItem(container, dayEvents[i], integ, plugin);
            }
        }

        if (dayReminders.length > 0) {
            var remLabel = container.createDiv("calendian-block-label");
            remLabel.textContent = "Reminders";
            for (var j = 0; j < dayReminders.length; j++) {
                renderReminderItem(container, dayReminders[j], integ, plugin);
            }
        }
    } catch (err) {
        console.warn("[Calendian] Failed to render calendian code block:", err.message);
        el.createDiv("calendian-block-empty").textContent =
            "Calendian: unable to render (see console for details)";
    }
}

function renderEventItem(container, evt, integ, plugin) {
    var isAllDay = evt.isAllDay !== undefined ? evt.isAllDay : evt.allday;
    var sm = evt.start ? window.moment(evt.start) : null;
    var em = evt.end ? window.moment(evt.end) : null;

    var dateStr = sm ? sm.format("MM-DD") : "";
    var timeStr = "";
    if (isAllDay) {
        timeStr = "All day";
    } else if (sm) {
        timeStr = sm.format("HH:mm");
        if (em) timeStr += "-" + em.format("HH:mm");
    }

    // Columns: date → title → time → badge → indicator
    var item = container.createDiv("calendian-block-item calendian-block-event");
    item.createDiv("calendian-block-date").textContent = dateStr;
    item.createDiv("calendian-block-title").textContent = evt.title || evt.summary || "";
    var timeEl = item.createDiv("calendian-block-time");
    timeEl.textContent = timeStr;
    if (isAllDay) timeEl.classList.add("calendian-block-time-allday");

    var calName = evt.calendarName || evt.calendar || "";
    var badge = item.createDiv("calendian-block-badge");
    badge.textContent = calName;
    var color = integ.calendarToCSS(integ.calendarColors[calName]);
    if (color) { badge.style.backgroundColor = color; badge.style.color = "#fff"; }

    var ind = item.createDiv("calendian-block-indicator");
    ind.textContent = evt.isRecurring ? "⟳" : "";

    item.addEventListener("click", function() {
        navigateToDate(evt.start || null, plugin, evt.id || null);
    });
}

function renderReminderItem(container, rem, integ, plugin) {
    var dm = (rem.dueDate || rem.due) ? window.moment(rem.dueDate || rem.due) : null;
    var dateStr = dm ? dm.format("MM-DD") : "";
    var dueStr = reminderHasDueTime(rem) && dm ? (rem.dueTime || dm.format("HH:mm")) : "";

    // Unified column order: date → icon → title → time → badge → indicators
    var item = container.createDiv("calendian-block-item calendian-block-reminder");
    item.createDiv("calendian-block-date").textContent = dateStr;
    var chkEl = item.createDiv("calendian-block-icon");
    chkEl.textContent = rem.completed ? "☑" : "○";
    if (rem.completed) chkEl.classList.add("calendian-block-icon-done");

    var titleEl = item.createDiv("calendian-block-title");
    titleEl.textContent = rem.title || rem.name || "";
    if (rem.completed) { titleEl.style.textDecoration = "line-through"; titleEl.style.opacity = "0.6"; }

    var timeEl = item.createDiv("calendian-block-time");
    timeEl.textContent = dueStr;

    var listName = rem.listName || rem.list || "";
    var badge = item.createDiv("calendian-block-badge");
    badge.textContent = listName;

    // Indicators
    if (rem.priority === "high") {
        item.createDiv("calendian-block-indicator").textContent = "!!!";
    } else {
        item.createDiv("calendian-block-indicator").textContent = "";
    }

    item.addEventListener("click", function() {
        navigateToDate(rem.dueDate || rem.due || null, plugin, rem.id || null);
    });
}

// ── Inline reference renderer ──────────────────────────────────────

/**
 * Markdown post-processor: find inline `cal:ev:ID` / `cal:rem:ID` codes
 * and replace them with an aligned table. Multiple refs in the same
 * paragraph share one table so columns align perfectly.
 *
 * Registered as registerMarkdownPostProcessor in CalendarPlugin.onload().
 */
function renderCalendianInline(plugin, el, ctx) {
    var view = plugin.view;
    if (!view || !view.macosIntegration) return;

    var integ = view.macosIntegration;
    var codes = el.querySelectorAll("code");
    var matches = [];

    // Collect all matching codes
    for (var i = 0; i < codes.length; i++) {
        var text = (codes[i].textContent || "").trim();
        var match = text.match(/^cal:(ev|rem):(.+)$/);
        if (!match) continue;
        var item = findItemById(integ, match[1], match[2]);
        if (!item) continue;
        matches.push({ code: codes[i], itemType: match[1], itemId: match[2], item: item });
    }

    if (matches.length === 0) return;

    // Build ONE table for all refs found in this post-processor run.
    // Column alignment is guaranteed within a single table.
    // Create via el so the table inherits Obsidian theme scoping.
    var table = el.createEl("table", {
        cls: "calendian-inline-table",
        attr: { title: "Click to navigate in Calendian" }
    });

    // Fixed column widths via colgroup for guaranteed alignment
    var colgroup = table.createEl("colgroup");
    var cols = ["24px", "68px", "130px", "160px", "90px", "28px"]; // icon, date, time, title, badge, ind
    for (var ci = 0; ci < cols.length; ci++) {
        var col = colgroup.createEl("col");
        if (cols[ci]) col.style.width = cols[ci];
    }

    var tbody = table.createEl("tbody");
    for (var r = 0; r < matches.length; r++) {
        var ref = matches[r];
        var tr = tbody.createEl("tr", {
            cls: "calendian-inline-row" + (ref.itemType === "rem" ? " calendian-inline-reminder" : "")
        });
        buildInlineRow(tr, ref.item, ref.itemType, plugin);
    }

    // Replace the first code element with the table, remove the rest
    matches[0].code.parentNode.replaceChild(table, matches[0].code);
    for (var x = 1; x < matches.length; x++) {
        var c = matches[x].code;
        if (c.parentNode) c.parentNode.removeChild(c);
    }
}

/**
 * Build a <tr> row for an inline reference.
 * Columns: date | time | title | badge | indicators
 * No icon column — reminder ○/☑ merged into title.
 */
function buildInlineRow(tr, item, itemType, plugin) {
    // Type icon
    var tdIcon = tr.createEl("td", { cls: "calendian-inline-type" });
    if (itemType === "rem") {
        tdIcon.textContent = item.completed ? "✅" : "🔔";
    } else {
        tdIcon.textContent = "📅";
    }

    // Date
    var tdDate = tr.createEl("td", { cls: "calendian-inline-date" });
    if (itemType === "ev") {
        tdDate.textContent = item.start ? window.moment(item.start).format("MM-DD") : "";
    } else {
        var d2 = item.dueDate || item.due;
        tdDate.textContent = d2 ? window.moment(d2).format("MM-DD") : "";
    }

    // Title — with ○/☑ prefix for reminders
    var prefix = "";
    if (itemType === "rem" && item.completed) {
        prefix = "☑ ";
    } else if (itemType === "rem") {
        prefix = "○ ";
    }
    var tdTitle = tr.createEl("td", { cls: "calendian-inline-title" });
    tdTitle.textContent = prefix + (item.title || item.summary || item.name || "");

    // Time
    var tdTime = tr.createEl("td", { cls: "calendian-inline-time" });
    if (itemType === "ev") {
        var isAllDay = item.isAllDay !== undefined ? item.isAllDay : item.allday;
        if (isAllDay) {
            tdTime.textContent = "All day";
            tdTime.classList.add("calendian-inline-time-allday");
        } else if (item.start) {
            var t = window.moment(item.start).format("HH:mm");
            if (item.end) t += "-" + window.moment(item.end).format("HH:mm");
            tdTime.textContent = t;
        }
    } else {
        var d = item.due || item.dueDate;
        tdTime.textContent = d && reminderHasDueTime(item) ? (item.dueTime || window.moment(d).format("HH:mm")) : "";
    }

    // Badge
    var tdBadge = tr.createEl("td", { cls: "calendian-inline-badge" });
    tdBadge.textContent = itemType === "ev" ? (item.calendarName || item.calendar || "") : (item.listName || item.list || "");

    // Indicators
    var inds = [];
    if (itemType === "rem" && item.priority === "high") inds.push("!!!");
    if (itemType === "ev" && item.isRecurring) inds.push("⟳");
    var tdInd = tr.createEl("td", { cls: "calendian-inline-indicators" });
    tdInd.textContent = inds.join(" ");

    tr.addEventListener("click", function() {
        var eventDate = itemType === "ev" ? item.start : (item.dueDate || item.due);
        navigateToDate(eventDate || null, plugin, item.id || null);
    });
}

/**
 * Build (or return cached) reverse lookup maps: event/reminder ID → item.
 * Stored on the integration object as _itemLookupCache.
 */
function getItemLookup(integ) {
    if (!integ._itemLookupCache) {
        var events = integ.allEvents || [];
        var reminders = integ.allReminders || [];
        var evtMap = new Map();
        var remMap = new Map();
        for (var i = 0; i < events.length; i++) {
            if (events[i].id) evtMap.set(events[i].id, events[i]);
        }
        for (var j = 0; j < reminders.length; j++) {
            if (reminders[j].id) remMap.set(reminders[j].id, reminders[j]);
        }
        integ._itemLookupCache = { events: evtMap, reminders: remMap };
    }
    return integ._itemLookupCache;
}

/**
 * Find an event or reminder by ID in the cache.
 * Uses O(1) reverse index when available, falls back to linear scan.
 */
function findItemById(integ, type, id) {
    var lookup = getItemLookup(integ);
    var map = type === "ev" ? lookup.events : lookup.reminders;
    var item = map.get(id);
    if (item) return item;

    // Fallback: linear scan (item may have been added after cache was built)
    if (type === "ev") {
        var events = integ.allEvents || [];
        for (var i = 0; i < events.length; i++) {
            if (events[i].id === id) return events[i];
        }
    } else if (type === "rem") {
        var reminders = integ.allReminders || [];
        for (var i = 0; i < reminders.length; i++) {
            if (reminders[i].id === id) return reminders[i];
        }
    }
    return null;
}

// ── Navigation ─────────────────────────────────────────────────────

function navigateToDate(date, plugin, itemId) {
    if (!date) return;
    try {
        var targetMoment = window.moment(date);
        var leaves = plugin.app.workspace.getLeavesOfType("calendian");
        if (leaves.length === 0) plugin.initLeaf();
        leaves = plugin.app.workspace.getLeavesOfType("calendian");
        if (leaves.length > 0) {
            var leaf = leaves[0];
            var view = leaf.view;
            plugin.app.workspace.revealLeaf(leaf);
            if (view.calendar) view.calendar.$set({ displayedMonth: targetMoment });
            if (view.macosIntegration) {
                // Set highlight item ID before selectDate so render() picks it up
                view.macosIntegration._highlightedItemId = itemId || null;
                view.macosIntegration.selectDate(targetMoment);
            }
        }
    } catch (e) {
        console.warn("[Calendian] Failed to navigate:", e.message);
    }
}

// ── calendian-create code block ────────────────────────────────────

/**
 * Parse key:value fields from a calendian-create code block.
 * Returns { type, title, date, startTime, endTime, isAllDay, calendar,
 *           list, location, notes, priority, url, errors[] }.
 */
function parseCreateFields(source) {
    var fields = {
        type: "",
        title: "",
        date: "",
        startTime: "",
        endTime: "",
        isAllDay: false,
        calendar: "",
        list: "",
        location: "",
        notes: "",
        priority: "",
        url: "",
        errors: []
    };

    var lines = (source || "").split("\n");
    var currentKey = null;

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];

        // Multi-line notes: indented continuation lines after a notes: line
        if (currentKey === "notes" && /^\s/.test(line) && fields.notes.length > 0) {
            fields.notes += "\n" + line.trim();
            continue;
        }
        currentKey = null;

        // Skip empty and comment lines
        var trimmed = line.trim();
        if (!trimmed || trimmed.charAt(0) === "#") continue;

        // Match key: value
        var m = trimmed.match(/^(\w+)\s*:\s*(.*)/);
        if (!m) continue;

        var key = m[1].toLowerCase();
        var val = m[2].trim();

        switch (key) {
            case "type":
                fields.type = val.toLowerCase();
                break;
            case "title":
                fields.title = val;
                currentKey = "title";
                break;
            case "date":
                fields.date = val;
                break;
            case "time":
                // Parse time variants: "14:00-15:30", "allday", "HH:mm"
                var tl = val.toLowerCase();
                if (tl === "allday" || tl === "all day") {
                    fields.isAllDay = true;
                } else {
                    var tr = tl.match(/^(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/);
                    if (tr) {
                        fields.startTime = tr[1];
                        fields.endTime = tr[2];
                    } else if (/^\d{1,2}:\d{2}$/.test(tl)) {
                        fields.startTime = tl;
                    }
                }
                break;
            case "starttime":
                fields.startTime = val;
                break;
            case "endtime":
                fields.endTime = val;
                break;
            case "allday":
                fields.isAllDay = val.toLowerCase() === "true" || val === "1";
                break;
            case "calendar":
                fields.calendar = val;
                break;
            case "list":
                fields.list = val;
                break;
            case "location":
                fields.location = val;
                break;
            case "notes":
                fields.notes = val;
                currentKey = "notes";
                break;
            case "priority":
                var p = val.toLowerCase();
                if (p === "none" || p === "low" || p === "medium" || p === "high") {
                    fields.priority = p;
                } else {
                    fields.errors.push("Unknown priority: " + val + " (use none/low/medium/high)");
                }
                break;
            case "url":
                fields.url = val;
                break;
            default:
                // Unknown field — ignore silently (forward-compatible)
                break;
        }
    }

    // Type inference when not specified
    if (!fields.type) {
        if (fields.list || fields.priority) {
            fields.type = "reminder";
        } else {
            fields.type = "event";
        }
    }

    // Validation
    if (!fields.title) {
        fields.errors.push("title is required");
    }
    if (fields.type === "event" && !fields.date) {
        // Date may be inferred from note filename later
        fields._needsDateInference = true;
    }
    if (fields.type === "reminder" && fields.priority && ["none", "low", "medium", "high"].indexOf(fields.priority) === -1) {
        fields.errors.push("Invalid priority: " + fields.priority);
    }

    return fields;
}

/**
 * Resolve a calendar name (or UUID) to a calendar ID.
 * Returns the ID string, or null if not found.
 */
async function resolveCalendarByName(integ, nameOrId) {
    if (!nameOrId) return null;
    // UUID-like: pass through
    if (/^[A-F0-9-]{20,}$/i.test(nameOrId)) return nameOrId;

    try {
        var cals = await integ.discoverCalendars();
        for (var i = 0; i < cals.length; i++) {
            if (cals[i].rawName.toLowerCase() === nameOrId.toLowerCase()) return cals[i].id;
            // Also match display name (includes account suffix)
            if (cals[i].name.toLowerCase().indexOf(nameOrId.toLowerCase()) !== -1) return cals[i].id;
        }
    } catch (e) {
        console.warn("[Calendian] Calendar discovery failed:", e.message);
    }
    return null;
}

/**
 * Resolve a reminder list name (or UUID) to a list ID.
 * Returns the ID string, or null if not found.
 */
async function resolveListByName(integ, nameOrId) {
    if (!nameOrId) return null;
    if (/^[A-F0-9-]{20,}$/i.test(nameOrId)) return nameOrId;

    try {
        var lists = await integ.discoverReminderLists();
        for (var i = 0; i < lists.length; i++) {
            if (lists[i].rawName.toLowerCase() === nameOrId.toLowerCase()) return lists[i].id;
            if (lists[i].name.toLowerCase().indexOf(nameOrId.toLowerCase()) !== -1) return lists[i].id;
        }
    } catch (e) {
        console.warn("[Calendian] List discovery failed:", e.message);
    }
    return null;
}

/**
 * Replace the calendian-create code block in the note with an inline ref.
 * Uses ctx.getSectionInfo(el) for exact line range.
 */
async function replaceBlockWithInlineRef(plugin, ctx, el, itemId, itemType) {
    var ref = itemType === "event" ? "cal:ev:" + itemId : "cal:rem:" + itemId;
    var inlineRef = "`" + ref + "`";

    // Try section-info based replacement
    var sectionInfo = ctx && ctx.getSectionInfo ? ctx.getSectionInfo(el) : null;
    if (sectionInfo) {
        try {
            var file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
            if (!file) throw new Error("File not found: " + ctx.sourcePath);
            var content = await plugin.app.vault.cachedRead(file);
            var lines = content.split("\n");
            var start = sectionInfo.lineStart;
            var end = sectionInfo.lineEnd;

            // Replace the code block lines (including the ``` fences) with the inline ref
            var newLines = lines.slice(0, start).concat([inlineRef]).concat(lines.slice(end + 1));
            await plugin.app.vault.modify(file, newLines.join("\n"));

            console.log("[Calendian] Replaced calendian-create block with " + ref);
            return;
        } catch (err) {
            console.warn("[Calendian] Failed to replace block in note:", err.message);
            // Fall through to clipboard fallback
        }
    }

    // Fallback: copy to clipboard + notice
    try {
        await navigator.clipboard.writeText(inlineRef);
        new obsidian.Notice("Created! Inline ref copied to clipboard — paste it in your note:\n" + ref);
    } catch (e) {
        new obsidian.Notice("Created! Add this ref to your note: " + ref);
    }
}

/**
 * Render a ```calendian-create``` code block.
 * Shows a preview of the parsed fields with a Create button.
 */
function renderCalendianCreateBlock(plugin, source, el, ctx) {
    var view = plugin.view;
    if (!view || !view.macosIntegration) {
        el.createDiv("calendian-block-empty").textContent =
            "Calendian panel not loaded. Open the calendar sidebar first.";
        return;
    }

    var sourceText = (source || "").trim();
    if (!sourceText) {
        var help = el.createDiv("calendian-create-block calendian-create-empty");
        help.createDiv("calendian-create-help").innerHTML =
            "输入事件描述即可创建，例如：<br>" +
            "<code>明天下午3点开会</code> 或 <code>提醒我周五买菜</code><br>" +
            "<br>或使用结构化字段：<br>" +
            "<code>title: 标题</code> · <code>date: 2024-03-15</code> · <code>time: 14:00-15:00</code><br>" +
            "<code>calendar: 日历名</code> · <code>list: 列表名</code> · <code>location: 地点</code>";
        return;
    }

    // Detect natural language: single line without any "key:" pattern
    var isNaturalLanguage = sourceText.indexOf("\n") === -1 && !/^\w+\s*:/.test(sourceText);
    var fields;
    if (isNaturalLanguage && typeof parseNaturalLanguage === "function") {
        try {
            // Build refDate: prefer note filename date, fall back to selected date, then today
            var refDate = null;
            if (ctx && ctx.sourcePath) {
                try {
                    var bn = ctx.sourcePath.replace(/\.md$/, "").split("/").pop();
                    var fromFn = window.moment(bn, "YYYY-MM-DD", true);
                    if (fromFn.isValid()) refDate = fromFn;
                } catch (e) {}
            }
            if (!refDate) {
                var integ0 = view.macosIntegration;
                if (integ0.selectedDate) refDate = integ0.selectedDate.clone();
            }

            // Strip type-indicating keywords before parsing, keep for type inference
            var isReminder = /^(提醒我?|提醒|remind\s*(me)?|todo:?)\s*/i.test(sourceText);
            var cleanText = sourceText
                .replace(/^(提醒我?|提醒|remind\s*(me)?|todo:?)\s*/i, '')
                .trim();
            if (!cleanText) cleanText = sourceText; // fallback if stripping ate everything

            var nlResult = parseNaturalLanguage(cleanText, refDate);
            if (nlResult && nlResult.title) {
                fields = {
                    type: isReminder ? "reminder" : "event",
                    title: nlResult.title || "",
                    date: nlResult.date ? nlResult.date.format("YYYY-MM-DD") : "",
                    startTime: nlResult.time || "",
                    endTime: nlResult.endTime || "",
                    isAllDay: nlResult.allDay || false,
                    calendar: "",
                    list: "",
                    location: "",
                    notes: "",
                    priority: isReminder ? "none" : "",
                    url: "",
                    errors: []
                };
            }
        } catch (e) {
            console.warn("[Calendian] NL parse in code block failed:", e.message);
        }
    }

    if (!fields) {
        fields = parseCreateFields(sourceText);
    }
    var integ = view.macosIntegration;

    // Date inference from note filename (for events)
    if (fields._needsDateInference && ctx && ctx.sourcePath) {
        try {
            var basename = ctx.sourcePath.replace(/\.md$/, "").split("/").pop();
            var fromFile = window.moment(basename, "YYYY-MM-DD", true);
            if (fromFile.isValid()) {
                fields.date = fromFile.format("YYYY-MM-DD");
                fields._needsDateInference = false;
            }
        } catch (e) {}
    }
    // Clear the flag — if still true, it's a real error
    delete fields._needsDateInference;
    if (fields.type === "event" && !fields.date) {
        fields.errors.push("date is required for events (or use a YYYY-MM-DD dated note)");
    }

    // Build preview container
    var container = el.createDiv("calendian-create-block");

    // Header
    var header = container.createDiv("calendian-create-header");
    var icon = fields.type === "reminder" ? "🔔" : "📅";
    var label = fields.type === "reminder" ? "Reminder" : "Event";
    header.textContent = icon + " New " + label;

    // Field preview rows
    var preview = container.createDiv("calendian-create-preview");

    function renderFieldRows(f) {
        preview.empty();
        function addFieldRow(key, value, cls) {
            if (!value && value !== false) return;
            var row = preview.createDiv("calendian-create-field");
            row.createDiv("calendian-create-field-key").textContent = key;
            row.createDiv("calendian-create-field-val" + (cls ? " " + cls : "")).textContent =
                (typeof value === "boolean") ? (value ? "Yes" : "No") : String(value);
        }
        addFieldRow("Title", f.title, "calendian-create-title");
        if (f.type === "event") {
            addFieldRow("Date", f.date);
            if (f.isAllDay) {
                addFieldRow("Time", "All day", "calendian-create-time-allday");
            } else if (f.startTime) {
                var td = f.startTime;
                if (f.endTime) td += " – " + f.endTime;
                addFieldRow("Time", td);
            }
            addFieldRow("Calendar", f.calendar || "(default)");
        } else {
            addFieldRow("Due", f.date || "(no date)");
            if (f.startTime) addFieldRow("Time", f.startTime);
            addFieldRow("List", f.list || "(default)");
            if (f.priority && f.priority !== "none") addFieldRow("Priority", f.priority);
        }
        if (f.location) addFieldRow("Location", f.location);
        if (f.notes) {
            var np = f.notes.split("\n")[0];
            if (np.length > 60) np = np.substring(0, 57) + "...";
            addFieldRow("Notes", np);
        }
    }

    renderFieldRows(fields);

    // Error display area (hidden initially)
    var errorEl = container.createDiv("calendian-create-error");
    errorEl.style.display = "none";

    // If validation errors exist, show them without a Create button
    if (fields.errors.length > 0) {
        errorEl.textContent = fields.errors.join("; ");
        errorEl.style.display = "block";
        return;
    }

    // AI badge (shown when AI result is used)
    var aiBadge = container.createDiv("calendian-create-ai-badge");
    aiBadge.textContent = "";
    aiBadge.style.display = "none";

    // Create button
    var btn = container.createEl("button", {
        cls: "calendian-create-btn",
        text: fields.type === "reminder" ? "Create Reminder" : "Create Event"
    });

    // If NL input and AI is configured, try AI parsing in background
    if (isNaturalLanguage && typeof callAIForParsing === "function") {
        var opts = (integ.plugin && integ.plugin.options) || {};
        if (opts.aiParsingEnabled && opts.aiEndpoint && opts.aiApiKey) {
            // Build refDate for AI (same as above)
            var aiRefDate = null;
            if (ctx && ctx.sourcePath) {
                try {
                    var bn2 = ctx.sourcePath.replace(/\.md$/, "").split("/").pop();
                    var ff2 = window.moment(bn2, "YYYY-MM-DD", true);
                    if (ff2.isValid()) aiRefDate = ff2;
                } catch (e) {}
            }
            if (!aiRefDate && integ.selectedDate) aiRefDate = integ.selectedDate.clone();

            var cleanText2 = sourceText.replace(/^(提醒我?|提醒|remind\s*(me)?|todo:?)\s*/i, '').trim();
            if (!cleanText2) cleanText2 = sourceText;

            callAIForParsing(cleanText2, opts, aiRefDate).then(function(aiResult) {
                if (aiResult && aiResult.title && !btn.disabled) {
                    // Update fields with AI result
                    fields.title = aiResult.title;
                    if (aiResult.date && aiResult.date.isValid()) {
                        fields.date = aiResult.date.format("YYYY-MM-DD");
                    }
                    if (aiResult.time) fields.startTime = aiResult.time;
                    if (aiResult.endTime) fields.endTime = aiResult.endTime;
                    if (aiResult.allDay) { fields.isAllDay = true; fields.startTime = ""; fields.endTime = ""; }

                    // Update header and preview
                    header.textContent = (isReminder ? "🔔" : "📅") + " New " + (isReminder ? "Reminder" : "Event");
                    renderFieldRows(fields);

                    // Show AI badge
                    aiBadge.textContent = "✨ AI";
                    aiBadge.style.display = "inline-block";
                }
            }).catch(function() { /* silent — regex result already shown */ });
        }
    }

    btn.addEventListener("click", async function() {
        btn.disabled = true;
        btn.textContent = "Creating...";
        errorEl.style.display = "none";

        try {
            if (fields.type === "event") {
                await createEventFromFields(integ, plugin, fields, ctx, el, btn, errorEl);
            } else {
                await createReminderFromFields(integ, plugin, fields, ctx, el, btn, errorEl);
            }
        } catch (err) {
            var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
            console.error("[Calendian] Create-from-block failed:", errMsg);
            errorEl.textContent = "Error: " + errMsg;
            errorEl.style.display = "block";
            btn.disabled = false;
            btn.textContent = fields.type === "reminder" ? "Create Reminder" : "Create Event";
        }
    });
}

/**
 * Create an event from parsed fields.
 */
async function createEventFromFields(integ, plugin, fields, ctx, el, btn, errorEl) {
    // Resolve calendar name → ID
    var calendarId = null;
    if (fields.calendar) {
        calendarId = await resolveCalendarByName(integ, fields.calendar);
        if (!calendarId) {
            errorEl.textContent = "Calendar '" + fields.calendar + "' not found. Check the name in settings.";
            errorEl.style.display = "block";
            btn.disabled = false;
            btn.textContent = "Create Event";
            return;
        }
    }
    if (!calendarId) {
        calendarId = (integ.plugin && integ.plugin.options && integ.plugin.options.defaultCalendarId) || "";
    }

    // Build start/end moments
    var startMoment;
    if (fields.startTime) {
        startMoment = window.moment(fields.date + " " + fields.startTime, "YYYY-MM-DD HH:mm");
    } else {
        startMoment = window.moment(fields.date, "YYYY-MM-DD");
    }

    var endMoment;
    if (fields.endTime) {
        endMoment = window.moment(fields.date + " " + fields.endTime, "YYYY-MM-DD HH:mm");
    } else if (fields.startTime) {
        endMoment = startMoment.clone().add(1, "hour");
    } else {
        endMoment = startMoment.clone().endOf("day");
    }

    if (!startMoment.isValid()) {
        errorEl.textContent = "Invalid date/time: " + fields.date;
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Create Event";
        return;
    }

    var startISO = startMoment.toISOString().replace(/\.\d{3}Z$/, 'Z');
    var endISO = (endMoment.isValid() ? endMoment : startMoment.clone().add(1, "hour")).toISOString().replace(/\.\d{3}Z$/, 'Z');

    var args = [
        "create-event", fields.title, startISO, endISO,
        calendarId, fields.isAllDay ? "true" : "false",
        fields.location || "", fields.notes || "", fields.url || ""
    ];

    var result = await integ.execHelper(args);
    if (result && result.ok) {
        new obsidian.Notice("Event created: " + fields.title);
        console.log("[Calendian] Created event from note block: " + fields.title + " (id=" + result.id + ")");
        integ._itemLookupCache = null;
        integ._associationIndexDirty = true;
        await replaceBlockWithInlineRef(plugin, ctx, el, result.id, "event");
        integ.init(true);
    } else {
        errorEl.textContent = "Failed to create event.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Create Event";
    }
}

/**
 * Create a reminder from parsed fields.
 */
async function createReminderFromFields(integ, plugin, fields, ctx, el, btn, errorEl) {
    // Resolve list name → ID
    var listId = null;
    if (fields.list) {
        listId = await resolveListByName(integ, fields.list);
        if (!listId) {
            errorEl.textContent = "List '" + fields.list + "' not found. Check the name in settings.";
            errorEl.style.display = "block";
            btn.disabled = false;
            btn.textContent = "Create Reminder";
            return;
        }
    }
    if (!listId) {
        listId = (integ.plugin && integ.plugin.options && integ.plugin.options.defaultReminderListId) || "";
    }

    // Build due date ISO
    var dueDateISO = "";
    if (fields.date) {
        var dueMoment = window.moment(fields.date, "YYYY-MM-DD");
        if (dueMoment.isValid()) {
            dueDateISO = dueMoment.toISOString().replace(/\.\d{3}Z$/, 'Z');
        }
    }

    var args = [
        "create-reminder", fields.title, listId,
        dueDateISO, fields.startTime || "",
        fields.priority || "none", fields.notes || ""
    ];

    var result = await integ.execHelper(args);
    if (result && result.ok) {
        new obsidian.Notice("Reminder created: " + fields.title);
        console.log("[Calendian] Created reminder from note block: " + fields.title + " (id=" + result.id + ")");
        integ._itemLookupCache = null;
        integ._associationIndexDirty = true;
        await replaceBlockWithInlineRef(plugin, ctx, el, result.id, "reminder");
        integ.init(true);
    } else {
        errorEl.textContent = "Failed to create reminder.";
        errorEl.style.display = "block";
        btn.disabled = false;
        btn.textContent = "Create Reminder";
    }
}
