// src/notes/codeblock.js — ```calendian``` code block + inline reference renderer (v0.5)
// Code block: renders today's events/reminders as a list
// Inline: replaces `cal:ev:ID` / `cal:rem:ID` with clickable event/reminder titles

// ── Code block renderer ────────────────────────────────────────────

/**
 * Render a ```calendian``` code block.
 */
function renderCalendianBlock(plugin, source, el, ctx) {
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

    var view = plugin.view;
    if (!view || !view.macosIntegration) {
        el.createDiv("calendian-block-empty").textContent =
            "Calendian panel not loaded. Open the calendar sidebar first.";
        return;
    }

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
    var dueStr = dm ? dm.format("HH:mm") : "";

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
    var table = document.createElement("table");
    table.className = "calendian-inline-table";
    table.setAttribute("title", "Click to navigate in Calendian");

    // Fixed column widths via colgroup for guaranteed alignment
    var colgroup = document.createElement("colgroup");
    var cols = ["24px", "68px", "130px", "160px", "90px", "28px"]; // icon, date, time, title, badge, ind
    for (var ci = 0; ci < cols.length; ci++) {
        var col = document.createElement("col");
        if (cols[ci]) col.style.width = cols[ci];
        colgroup.appendChild(col);
    }
    table.appendChild(colgroup);

    var tbody = document.createElement("tbody");
    for (var r = 0; r < matches.length; r++) {
        var ref = matches[r];
        var tr = document.createElement("tr");
        tr.className = "calendian-inline-row";
        if (ref.itemType === "rem") tr.classList.add("calendian-inline-reminder");
        buildInlineRow(tr, ref.item, ref.itemType, plugin);
        tbody.appendChild(tr);
    }
    table.appendChild(tbody);

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
    var tdIcon = document.createElement("td");
    tdIcon.className = "calendian-inline-type";
    if (itemType === "rem") {
        tdIcon.textContent = item.completed ? "✅" : "🔔";
    } else {
        tdIcon.textContent = "📅";
    }
    tr.appendChild(tdIcon);

    // Date
    var tdDate = document.createElement("td");
    tdDate.className = "calendian-inline-date";
    if (itemType === "ev") {
        tdDate.textContent = item.start ? window.moment(item.start).format("MM-DD") : "";
    } else {
        var d2 = item.dueDate || item.due;
        tdDate.textContent = d2 ? window.moment(d2).format("MM-DD") : "";
    }
    tr.appendChild(tdDate);

    // Title — with ○/☑ prefix for reminders
    var tdTitle = document.createElement("td");
    tdTitle.className = "calendian-inline-title";
    var prefix = "";
    if (itemType === "rem" && item.completed) {
        prefix = "☑ ";
    } else if (itemType === "rem") {
        prefix = "○ ";
    }
    tdTitle.textContent = prefix + (item.title || item.summary || item.name || "");
    tr.appendChild(tdTitle);

    // Time
    var tdTime = document.createElement("td");
    tdTime.className = "calendian-inline-time";
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
        tdTime.textContent = d ? window.moment(d).format("HH:mm") : "";
    }
    tr.appendChild(tdTime);

    // Badge
    var tdBadge = document.createElement("td");
    tdBadge.className = "calendian-inline-badge";
    tdBadge.textContent = itemType === "ev" ? (item.calendarName || item.calendar || "") : (item.listName || item.list || "");
    tr.appendChild(tdBadge);

    // Indicators
    var tdInd = document.createElement("td");
    tdInd.className = "calendian-inline-indicators";
    var inds = [];
    if (itemType === "rem" && item.priority === "high") inds.push("!!!");
    if (itemType === "ev" && item.isRecurring) inds.push("⟳");
    tdInd.textContent = inds.join(" ");
    tr.appendChild(tdInd);

    tr.addEventListener("click", function() {
        var eventDate = itemType === "ev" ? item.start : (item.dueDate || item.due);
        navigateToDate(eventDate || null, plugin, item.id || null);
    });
}

/**
 * Find an event or reminder by ID in the cache.
 */
function findItemById(integ, type, id) {
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
