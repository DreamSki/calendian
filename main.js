'use strict';

var obsidian = require('obsidian');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var obsidian__default = /*#__PURE__*/_interopDefaultLegacy(obsidian);

const DEFAULT_WEEK_FORMAT = "gggg-[W]ww";
const DEFAULT_WORDS_PER_DOT = 250;
const VIEW_TYPE_CALENDAR = "calendian";
const TRIGGER_ON_OPEN = "calendar:open";

const DEFAULT_DAILY_NOTE_FORMAT = "YYYY-MM-DD";
const DEFAULT_WEEKLY_NOTE_FORMAT = "gggg-[W]ww";
const DEFAULT_MONTHLY_NOTE_FORMAT = "YYYY-MM";

function shouldUsePeriodicNotesSettings(periodicity) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = window.app.plugins.getPlugin("periodic-notes");
    return periodicNotes && periodicNotes.settings?.[periodicity]?.enabled;
}
/**
 * Read the user settings for the `daily-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getDailyNoteSettings() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { internalPlugins, plugins } = window.app;
        if (shouldUsePeriodicNotesSettings("daily")) {
            const { format, folder, template } = plugins.getPlugin("periodic-notes")?.settings?.daily || {};
            return {
                format: format || DEFAULT_DAILY_NOTE_FORMAT,
                folder: folder?.trim() || "",
                template: template?.trim() || "",
            };
        }
        const { folder, format, template } = internalPlugins.getPluginById("daily-notes")?.instance?.options || {};
        return {
            format: format || DEFAULT_DAILY_NOTE_FORMAT,
            folder: folder?.trim() || "",
            template: template?.trim() || "",
        };
    }
    catch (err) {
        console.info("No custom daily note settings found!", err);
    }
}
/**
 * Read the user settings for the `weekly-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getWeeklyNoteSettings() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pluginManager = window.app.plugins;
        const calendarSettings = pluginManager.getPlugin("calendar")?.options;
        const periodicNotesSettings = pluginManager.getPlugin("periodic-notes")
            ?.settings?.weekly;
        if (shouldUsePeriodicNotesSettings("weekly")) {
            return {
                format: periodicNotesSettings.format || DEFAULT_WEEKLY_NOTE_FORMAT,
                folder: periodicNotesSettings.folder?.trim() || "",
                template: periodicNotesSettings.template?.trim() || "",
            };
        }
        const settings = calendarSettings || {};
        return {
            format: settings.weeklyNoteFormat || DEFAULT_WEEKLY_NOTE_FORMAT,
            folder: settings.weeklyNoteFolder?.trim() || "",
            template: settings.weeklyNoteTemplate?.trim() || "",
        };
    }
    catch (err) {
        console.info("No custom weekly note settings found!", err);
    }
}
/**
 * Read the user settings for the `periodic-notes` plugin
 * to keep behavior of creating a new note in-sync.
 */
function getMonthlyNoteSettings() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginManager = window.app.plugins;
    try {
        const settings = (shouldUsePeriodicNotesSettings("monthly") &&
            pluginManager.getPlugin("periodic-notes")?.settings?.monthly) ||
            {};
        return {
            format: settings.format || DEFAULT_MONTHLY_NOTE_FORMAT,
            folder: settings.folder?.trim() || "",
            template: settings.template?.trim() || "",
        };
    }
    catch (err) {
        console.info("No custom monthly note settings found!", err);
    }
}

/**
 * dateUID is a way of weekly identifying daily/weekly/monthly notes.
 * They are prefixed with the granularity to avoid ambiguity.
 */
function getDateUID$1(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
function removeEscapedCharacters(format) {
    return format.replace(/\[[^\]]*\]/g, ""); // remove everything within brackets
}
/**
 * XXX: When parsing dates that contain both week numbers and months,
 * Moment choses to ignore the week numbers. For the week dateUID, we
 * want the opposite behavior. Strip the MMM from the format to patch.
 */
function isFormatAmbiguous(format, granularity) {
    if (granularity === "week") {
        const cleanFormat = removeEscapedCharacters(format);
        return (/w{1,2}/i.test(cleanFormat) &&
            (/M{1,4}/.test(cleanFormat) || /D{1,4}/.test(cleanFormat)));
    }
    return false;
}
function getDateFromFile(file, granularity) {
    const getSettings = {
        day: getDailyNoteSettings,
        week: getWeeklyNoteSettings,
        month: getMonthlyNoteSettings,
    };
    const format = getSettings[granularity]().format.split("/").pop();
    const noteDate = window.moment(file.basename, format, true);
    if (!noteDate.isValid()) {
        return null;
    }
    if (isFormatAmbiguous(format, granularity)) {
        if (granularity === "week") {
            const cleanFormat = removeEscapedCharacters(format);
            if (/w{1,2}/i.test(cleanFormat)) {
                return window.moment(file.basename, 
                // If format contains week, remove day & month formatting
                format.replace(/M{1,4}/g, "").replace(/D{1,4}/g, ""), false);
            }
        }
    }
    return noteDate;
}

// Credit: @creationix/path.js
function join(...partSegments) {
    // Split the inputs into a list of path commands.
    let parts = [];
    for (let i = 0, l = partSegments.length; i < l; i++) {
        parts = parts.concat(partSegments[i].split("/"));
    }
    // Interpret the path commands to get the new resolved path.
    const newParts = [];
    for (let i = 0, l = parts.length; i < l; i++) {
        const part = parts[i];
        // Remove leading and trailing slashes
        // Also remove "." segments
        if (!part || part === ".")
            continue;
        // Push new path segments.
        else
            newParts.push(part);
    }
    // Preserve the initial slash if there was one.
    if (parts[0] === "")
        newParts.unshift("");
    // Turn back into a single string path.
    return newParts.join("/");
}
async function ensureFolderExists(path) {
    const dirs = path.replace(/\\/g, "/").split("/");
    dirs.pop(); // remove basename
    if (dirs.length) {
        const dir = join(...dirs);
        if (!window.app.vault.getAbstractFileByPath(dir)) {
            await window.app.vault.createFolder(dir);
        }
    }
}
async function getNotePath(directory, filename) {
    if (!filename.endsWith(".md")) {
        filename += ".md";
    }
    const path = obsidian__default['default'].normalizePath(join(directory, filename));
    await ensureFolderExists(path);
    return path;
}
async function getTemplateInfo(template) {
    const { metadataCache, vault } = window.app;
    const templatePath = obsidian__default['default'].normalizePath(template);
    if (templatePath === "/") {
        return Promise.resolve(["", null]);
    }
    try {
        const templateFile = metadataCache.getFirstLinkpathDest(templatePath, "");
        const contents = await vault.cachedRead(templateFile);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const IFoldInfo = window.app.foldManager.load(templateFile);
        return [contents, IFoldInfo];
    }
    catch (err) {
        console.error(`Failed to read the daily note template '${templatePath}'`, err);
        new obsidian__default['default'].Notice("Failed to read the daily note template");
        return ["", null];
    }
}

class DailyNotesFolderMissingError extends Error {
}
/**
 * This function mimics the behavior of the daily-notes plugin
 * so it will replace {{date}}, {{title}}, and {{time}} with the
 * formatted timestamp.
 *
 * Note: it has an added bonus that it's not 'today' specific.
 */
async function createDailyNote(date) {
    const app = window.app;
    const { vault } = app;
    const moment = window.moment;
    const { template, format, folder } = getDailyNoteSettings();
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    try {
        const createdFile = await vault.create(normalizedPath, templateContents
            .replace(/{{\s*date\s*}}/gi, filename)
            .replace(/{{\s*time\s*}}/gi, moment().format("HH:mm"))
            .replace(/{{\s*title\s*}}/gi, filename)
            .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
            const now = moment();
            const currentDate = date.clone().set({
                hour: now.get("hour"),
                minute: now.get("minute"),
                second: now.get("second"),
            });
            if (calc) {
                currentDate.add(parseInt(timeDelta, 10), unit);
            }
            if (momentFormat) {
                return currentDate.format(momentFormat.substring(1).trim());
            }
            return currentDate.format(format);
        })
            .replace(/{{\s*yesterday\s*}}/gi, date.clone().subtract(1, "day").format(format))
            .replace(/{{\s*tomorrow\s*}}/gi, date.clone().add(1, "d").format(format)));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.foldManager.save(createdFile, IFoldInfo);
        return createdFile;
    }
    catch (err) {
        console.error(`Failed to create file: '${normalizedPath}'`, err);
        new obsidian__default['default'].Notice("Unable to create new file.");
    }
}
function getDailyNote(date, dailyNotes) {
    return dailyNotes[getDateUID$1(date, "day")] ?? null;
}
function getAllDailyNotes() {
    /**
     * Find all daily notes in the daily note folder
     */
    const { vault } = window.app;
    const { folder } = getDailyNoteSettings();
    const dailyNotesFolder = vault.getAbstractFileByPath(obsidian__default['default'].normalizePath(folder));
    if (!dailyNotesFolder) {
        throw new DailyNotesFolderMissingError("Failed to find daily notes folder");
    }
    const dailyNotes = {};
    obsidian__default['default'].Vault.recurseChildren(dailyNotesFolder, (note) => {
        if (note instanceof obsidian__default['default'].TFile) {
            const date = getDateFromFile(note, "day");
            if (date) {
                const dateString = getDateUID$1(date, "day");
                dailyNotes[dateString] = note;
            }
        }
    });
    return dailyNotes;
}

class WeeklyNotesFolderMissingError extends Error {
}
function getDaysOfWeek$1() {
    const { moment } = window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let weekStart = moment.localeData()._week.dow;
    const daysOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
    ];
    while (weekStart) {
        daysOfWeek.push(daysOfWeek.shift());
        weekStart--;
    }
    return daysOfWeek;
}
function getDayOfWeekNumericalValue(dayOfWeekName) {
    return getDaysOfWeek$1().indexOf(dayOfWeekName.toLowerCase());
}
async function createWeeklyNote(date) {
    const { vault } = window.app;
    const { template, format, folder } = getWeeklyNoteSettings();
    const [templateContents, IFoldInfo] = await getTemplateInfo(template);
    const filename = date.format(format);
    const normalizedPath = await getNotePath(folder, filename);
    try {
        const createdFile = await vault.create(normalizedPath, templateContents
            .replace(/{{\s*(date|time)\s*(([+-]\d+)([yqmwdhs]))?\s*(:.+?)?}}/gi, (_, _timeOrDate, calc, timeDelta, unit, momentFormat) => {
            const now = window.moment();
            const currentDate = date.clone().set({
                hour: now.get("hour"),
                minute: now.get("minute"),
                second: now.get("second"),
            });
            if (calc) {
                currentDate.add(parseInt(timeDelta, 10), unit);
            }
            if (momentFormat) {
                return currentDate.format(momentFormat.substring(1).trim());
            }
            return currentDate.format(format);
        })
            .replace(/{{\s*title\s*}}/gi, filename)
            .replace(/{{\s*time\s*}}/gi, window.moment().format("HH:mm"))
            .replace(/{{\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*:(.*?)}}/gi, (_, dayOfWeek, momentFormat) => {
            const day = getDayOfWeekNumericalValue(dayOfWeek);
            return date.weekday(day).format(momentFormat.trim());
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window.app.foldManager.save(createdFile, IFoldInfo);
        return createdFile;
    }
    catch (err) {
        console.error(`Failed to create file: '${normalizedPath}'`, err);
        new obsidian__default['default'].Notice("Unable to create new file.");
    }
}
function getWeeklyNote(date, weeklyNotes) {
    return weeklyNotes[getDateUID$1(date, "week")] ?? null;
}
function getAllWeeklyNotes() {
    const { vault } = window.app;
    const { folder } = getWeeklyNoteSettings();
    const weeklyNotesFolder = vault.getAbstractFileByPath(obsidian__default['default'].normalizePath(folder));
    if (!weeklyNotesFolder) {
        throw new WeeklyNotesFolderMissingError("Failed to find weekly notes folder");
    }
    const weeklyNotes = {};
    obsidian__default['default'].Vault.recurseChildren(weeklyNotesFolder, (note) => {
        if (note instanceof obsidian__default['default'].TFile) {
            const date = getDateFromFile(note, "week");
            if (date) {
                const dateString = getDateUID$1(date, "week");
                weeklyNotes[dateString] = note;
            }
        }
    });
    return weeklyNotes;
}

function appHasDailyNotesPluginLoaded() {
    const { app } = window;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dailyNotesPlugin = app.internalPlugins.plugins["daily-notes"];
    if (dailyNotesPlugin && dailyNotesPlugin.enabled) {
        return true;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = app.plugins.getPlugin("periodic-notes");
    return periodicNotes && periodicNotes.settings?.daily?.enabled;
}
var appHasDailyNotesPluginLoaded_1 = appHasDailyNotesPluginLoaded;
var createDailyNote_1 = createDailyNote;
var createWeeklyNote_1 = createWeeklyNote;
var getAllDailyNotes_1 = getAllDailyNotes;
var getAllWeeklyNotes_1 = getAllWeeklyNotes;
var getDailyNote_1 = getDailyNote;
var getDailyNoteSettings_1 = getDailyNoteSettings;
var getDateFromFile_1 = getDateFromFile;
var getDateUID_1$1 = getDateUID$1;
var getWeeklyNote_1 = getWeeklyNote;
var getWeeklyNoteSettings_1 = getWeeklyNoteSettings;

function noop$1() { }
function run$1(fn) {
    return fn();
}
function blank_object$1() {
    return Object.create(null);
}
function run_all$1(fns) {
    fns.forEach(run$1);
}
function is_function$1(thing) {
    return typeof thing === 'function';
}
function safe_not_equal$1(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function not_equal$1(a, b) {
    return a != a ? b == b : a !== b;
}
function is_empty$1(obj) {
    return Object.keys(obj).length === 0;
}
function subscribe(store, ...callbacks) {
    if (store == null) {
        return noop$1;
    }
    const unsub = store.subscribe(...callbacks);
    return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
}
function get_store_value(store) {
    let value;
    subscribe(store, _ => value = _)();
    return value;
}
function component_subscribe(component, store, callback) {
    component.$$.on_destroy.push(subscribe(store, callback));
}
function detach$1(node) {
    node.parentNode.removeChild(node);
}
function children$1(element) {
    return Array.from(element.childNodes);
}

let current_component$1;
function set_current_component$1(component) {
    current_component$1 = component;
}
function get_current_component$1() {
    if (!current_component$1)
        throw new Error('Function called outside component initialization');
    return current_component$1;
}
function onDestroy(fn) {
    get_current_component$1().$$.on_destroy.push(fn);
}

const dirty_components$1 = [];
const binding_callbacks$1 = [];
const render_callbacks$1 = [];
const flush_callbacks$1 = [];
const resolved_promise$1 = Promise.resolve();
let update_scheduled$1 = false;
function schedule_update$1() {
    if (!update_scheduled$1) {
        update_scheduled$1 = true;
        resolved_promise$1.then(flush$1);
    }
}
function add_render_callback$1(fn) {
    render_callbacks$1.push(fn);
}
function add_flush_callback(fn) {
    flush_callbacks$1.push(fn);
}
let flushing$1 = false;
const seen_callbacks$1 = new Set();
function flush$1() {
    if (flushing$1)
        return;
    flushing$1 = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components$1.length; i += 1) {
            const component = dirty_components$1[i];
            set_current_component$1(component);
            update$1(component.$$);
        }
        set_current_component$1(null);
        dirty_components$1.length = 0;
        while (binding_callbacks$1.length)
            binding_callbacks$1.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks$1.length; i += 1) {
            const callback = render_callbacks$1[i];
            if (!seen_callbacks$1.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks$1.add(callback);
                callback();
            }
        }
        render_callbacks$1.length = 0;
    } while (dirty_components$1.length);
    while (flush_callbacks$1.length) {
        flush_callbacks$1.pop()();
    }
    update_scheduled$1 = false;
    flushing$1 = false;
    seen_callbacks$1.clear();
}
function update$1($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all$1($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback$1);
    }
}
const outroing$1 = new Set();
let outros$1;
function transition_in$1(block, local) {
    if (block && block.i) {
        outroing$1.delete(block);
        block.i(local);
    }
}
function transition_out$1(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing$1.has(block))
            return;
        outroing$1.add(block);
        outros$1.c.push(() => {
            outroing$1.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

function bind(component, name, callback) {
    const index = component.$$.props[name];
    if (index !== undefined) {
        component.$$.bound[index] = callback;
        callback(component.$$.ctx[index]);
    }
}
function create_component$1(block) {
    block && block.c();
}
function mount_component$1(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback$1(() => {
            const new_on_destroy = on_mount.map(run$1).filter(is_function$1);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all$1(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback$1);
}
function destroy_component$1(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all$1($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty$1(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components$1.push(component);
        schedule_update$1();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init$1(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component$1;
    set_current_component$1(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop$1,
        not_equal,
        bound: blank_object$1(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object$1(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty$1(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all$1($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children$1(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach$1);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in$1(component.$$.fragment);
        mount_component$1(component, options.target, options.anchor, options.customElement);
        flush$1();
    }
    set_current_component$1(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent$1 {
    $destroy() {
        destroy_component$1(this, 1);
        this.$destroy = noop$1;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty$1($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop$1) {
    let stop;
    const subscribers = [];
    function set(new_value) {
        if (safe_not_equal$1(value, new_value)) {
            value = new_value;
            if (stop) { // store is ready
                const run_queue = !subscriber_queue.length;
                for (let i = 0; i < subscribers.length; i += 1) {
                    const s = subscribers[i];
                    s[1]();
                    subscriber_queue.push(s, value);
                }
                if (run_queue) {
                    for (let i = 0; i < subscriber_queue.length; i += 2) {
                        subscriber_queue[i][0](subscriber_queue[i + 1]);
                    }
                    subscriber_queue.length = 0;
                }
            }
        }
    }
    function update(fn) {
        set(fn(value));
    }
    function subscribe(run, invalidate = noop$1) {
        const subscriber = [run, invalidate];
        subscribers.push(subscriber);
        if (subscribers.length === 1) {
            stop = start(set) || noop$1;
        }
        run(value);
        return () => {
            const index = subscribers.indexOf(subscriber);
            if (index !== -1) {
                subscribers.splice(index, 1);
            }
            if (subscribers.length === 0) {
                stop();
                stop = null;
            }
        };
    }
    return { set, update, subscribe };
}

const weekdays$1 = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
const defaultSettings = Object.freeze({
    shouldConfirmBeforeCreate: true,
    weekStart: "locale",
    wordsPerDot: DEFAULT_WORDS_PER_DOT,
    showWeeklyNote: false,
    weeklyNoteFormat: "",
    weeklyNoteTemplate: "",
    weeklyNoteFolder: "",
    localeOverride: "system-default",
    // macOS Calendar & Reminders integration (v0.1 schema)
    enableCalendar: true,
    enableReminders: true,
    selectedCalendarIds: [],
    selectedReminderListIds: [],
    refreshIntervalMinutes: 5,
    pastEventDisplay: 'dimmed',
    // Reminder display settings (v0.2 schema)
    showNoDateReminders: true,
    reminderDisplayRange: 'today',
    // Default calendar/reminder list for create modals (v0.3 schema)
    defaultCalendarId: '',
    defaultReminderListId: '',
    // AI-powered NL parsing (v0.3 — optional, off by default)
    aiParsingEnabled: false,
    aiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    aiApiKey: '',
    aiModel: 'deepseek-chat',
});
function appHasPeriodicNotesPluginLoaded() {
    var _a, _b;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodicNotes = window.app.plugins.getPlugin("periodic-notes");
    return periodicNotes && ((_b = (_a = periodicNotes.settings) === null || _a === void 0 ? void 0 : _a.weekly) === null || _b === void 0 ? void 0 : _b.enabled);
}
class CalendarSettingsTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        this.containerEl.empty();
        if (!appHasDailyNotesPluginLoaded_1()) {
            this.containerEl.createDiv("settings-banner", (banner) => {
                banner.createEl("h3", {
                    text: "⚠️ Daily Notes plugin not enabled",
                });
                banner.createEl("p", {
                    cls: "setting-item-description",
                    text: "The calendar is best used in conjunction with either the Daily Notes plugin or the Periodic Notes plugin (available in the Community Plugins catalog).",
                });
            });
        }
        this.containerEl.createEl("h3", {
            text: "General Settings",
        });
        this.addDotThresholdSetting();
        this.addWeekStartSetting();
        this.addConfirmCreateSetting();
        this.addShowWeeklyNoteSetting();
        if (this.plugin.options.showWeeklyNote &&
            !appHasPeriodicNotesPluginLoaded()) {
            this.containerEl.createEl("h3", {
                text: "Weekly Note Settings",
            });
            this.containerEl.createEl("p", {
                cls: "setting-item-description",
                text: "Note: Weekly Note settings are moving. You are encouraged to install the 'Periodic Notes' plugin to keep the functionality in the future.",
            });
            this.addWeeklyNoteFormatSetting();
            this.addWeeklyNoteTemplateSetting();
            this.addWeeklyNoteFolderSetting();
        }
        this.containerEl.createEl("h3", {
            text: "Advanced Settings",
        });
        this.addLocaleOverrideSetting();

        // === macOS Integration Settings ===
        this.containerEl.createEl("h3", {
            text: "macOS Integration",
        });
        this.containerEl.createEl("p", {
            cls: "setting-item-description",
            text: "Sync with macOS Calendar and Reminders. Requires macOS and automation permissions.",
        });
        this.addMacOSCalendarToggle();
        this.addMacOSRemindersToggle();
        this.addMacOSCalendarNamesSetting();
        this.addMacOSReminderListNamesSetting();
        this.addReminderDisplaySettings();
        this.addMacOSRefreshIntervalSetting();
        this.addMacOSPastEventDisplaySetting();
        this.addDefaultCalendarSetting();
        this.addDefaultReminderListSetting();

        // === AI-Powered NL Parsing (v0.3) ===
        this.containerEl.createEl("h3", {
            text: "AI Natural Language Parsing (optional)",
        });
        this.addAISettings();

        // === Privacy & Diagnostics Section ===
        this.containerEl.createEl("h3", {
            text: "Privacy & Diagnostics",
        });
        this.addPrivacyInfo();
        this.addDiagnosticInfo();
    }

    // REQ-PRIV-001, REQ-PRIV-002: Privacy information
    addPrivacyInfo() {
        const privacyDiv = this.containerEl.createDiv("macos-privacy-section");
        privacyDiv.createEl("p", { cls: "setting-item-description" }).textContent =
            "Calendian reads data from your local macOS Calendar.app and Reminders.app using system automation. All data processing happens on your device. No calendar events, reminders, notes, or personal data are sent to third-party services.";
        privacyDiv.createEl("p", { cls: "setting-item-description" }).textContent =
            "Settings are stored locally in your Obsidian vault under .obsidian/plugins/calendian/data.json. No account credentials are stored by this plugin.";
    }

    // REQ-DIAG-001, REQ-DIAG-002: Diagnostic panel — safe, non-private info only
    addDiagnosticInfo() {
        const diagDiv = this.containerEl.createDiv("macos-diagnostics-section");

        const integ = this.plugin.view && this.plugin.view.macosIntegration;
        const manifest = this.plugin.manifest || {};
        const osModule = require("os");

        const permLabel = function(state) {
            if (state === 'granted') return '✓ granted';
            if (state === 'denied') return '✗ denied';
            if (state === 'timeout') return '⚠ timeout';
            if (state === 'error') return '⚠ error';
            return '? unknown';
        };
        const errorLabel = function(err) {
            if (!err) return '—';
            return err.type + ': ' + (err.message || '').substring(0, 80) + ' (' + err.timestamp + ')';
        };
        const fmtDate = function(m) {
            return m ? m.format('YYYY-MM-DD') : '—';
        };

        const lines = [
            'Plugin: ' + (manifest.name || 'Calendian') + ' v' + (manifest.version || '?'),
            'Platform: ' + osModule.platform() + ' (' + osModule.type() + ')',
            'Helper binary: ' + (integ && integ.helperPath ? '✓ found' : '✗ not found'),
            'Calendar permission: ' + permLabel(integ ? integ.permissionState.calendar : 'unknown'),
            'Reminders permission: ' + permLabel(integ ? integ.permissionState.reminders : 'unknown'),
            'Calendars discovered: ' + (integ ? integ.sourceCounts.calendars : 0),
            'Reminder lists discovered: ' + (integ ? integ.sourceCounts.reminderLists : 0),
            'Events in cache: ' + (integ ? integ.allEvents.length : 0),
            'Reminders in cache: ' + (integ ? integ.allReminders.length : 0),
            'Cache range: ' + (integ ? fmtDate(integ.cacheStart) + ' → ' + fmtDate(integ.cacheEnd) : '—'),
            'Last refresh: ' + (integ && integ.lastRefreshTime
                ? integ.lastRefreshTime + ' (' + (integ.lastRefreshDurationMs != null ? integ.lastRefreshDurationMs + 'ms' : '?') + ')'
                : 'never'),
            'Last error (calendar): ' + (integ ? errorLabel(integ.lastError.calendar) : '—'),
            'Last error (reminders): ' + (integ ? errorLabel(integ.lastError.reminders) : '—'),
        ];

        const pre = diagDiv.createEl("pre", {
            cls: "setting-item-description",
            attr: { style: "font-size:11px; line-height:1.5; padding:8px; background:var(--background-secondary); border-radius:4px; overflow-x:auto; white-space:pre-wrap;" }
        });
        pre.textContent = lines.join('\n');

        // REQ-DIAG-002: Export button with consent dialog
        new obsidian.Setting(diagDiv)
            .setName("Export diagnostics")
            .setDesc("Copy diagnostic information to clipboard. Sensitive data (event titles, notes, locations, URLs, attendee names) will be redacted.")
            .addButton((btn) => {
                btn.setButtonText("Export Diagnostics");
                btn.onClick(() => {
                    new ExportConsentModal(this.plugin.app, integ, manifest).open();
                });
            });
    }
    addDotThresholdSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Words per dot")
            .setDesc("How many words should be represented by a single dot?")
            .addText((textfield) => {
            textfield.setPlaceholder(String(DEFAULT_WORDS_PER_DOT));
            textfield.inputEl.type = "number";
            textfield.setValue(String(this.plugin.options.wordsPerDot));
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    wordsPerDot: value !== "" ? Number(value) : undefined,
                }));
            });
        });
    }
    addWeekStartSetting() {
        const { moment } = window;
        const localizedWeekdays = moment.weekdays();
        const localeWeekStartNum = window._bundledLocaleWeekSpec.dow;
        const localeWeekStart = moment.weekdays()[localeWeekStartNum];
        new obsidian.Setting(this.containerEl)
            .setName("Start week on:")
            .setDesc("Choose what day of the week to start. Select 'Locale default' to use the default specified by moment.js")
            .addDropdown((dropdown) => {
            dropdown.addOption("locale", `Locale default (${localeWeekStart})`);
            localizedWeekdays.forEach((day, i) => {
                dropdown.addOption(weekdays$1[i], day);
            });
            dropdown.setValue(this.plugin.options.weekStart);
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    weekStart: value,
                }));
            });
        });
    }
    addConfirmCreateSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Confirm before creating new note")
            .setDesc("Show a confirmation modal before creating a new note")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.shouldConfirmBeforeCreate);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    shouldConfirmBeforeCreate: value,
                }));
            });
        });
    }
    addShowWeeklyNoteSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Show week number")
            .setDesc("Enable this to add a column with the week number")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.showWeeklyNote);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ showWeeklyNote: value }));
                this.display(); // show/hide weekly settings
            });
        });
    }
    addWeeklyNoteFormatSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Weekly note format")
            .setDesc("For more syntax help, refer to format reference")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteFormat);
            textfield.setPlaceholder(DEFAULT_WEEK_FORMAT);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteFormat: value }));
            });
        });
    }
    addWeeklyNoteTemplateSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Weekly note template")
            .setDesc("Choose the file you want to use as the template for your weekly notes")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteTemplate);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteTemplate: value }));
            });
        });
    }
    addWeeklyNoteFolderSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Weekly note folder")
            .setDesc("New weekly notes will be placed here")
            .addText((textfield) => {
            textfield.setValue(this.plugin.options.weeklyNoteFolder);
            textfield.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ weeklyNoteFolder: value }));
            });
        });
    }
    addLocaleOverrideSetting() {
        var _a;
        const { moment } = window;
        const sysLocale = (_a = navigator.language) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        new obsidian.Setting(this.containerEl)
            .setName("Override locale:")
            .setDesc("Set this if you want to use a locale different from the default")
            .addDropdown((dropdown) => {
            dropdown.addOption("system-default", `Same as system (${sysLocale})`);
            moment.locales().forEach((locale) => {
                dropdown.addOption(locale, locale);
            });
            dropdown.setValue(this.plugin.options.localeOverride);
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({
                    localeOverride: value,
                }));
            });
        });
    }
    // ========== macOS Integration Settings ==========
    addMacOSCalendarToggle() {
        new obsidian.Setting(this.containerEl)
            .setName("Show macOS Calendar events")
            .setDesc("Display Calendar events below the calendar widget")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.enableCalendar !== false);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ enableCalendar: value }));
            });
        });
    }
    addMacOSRemindersToggle() {
        new obsidian.Setting(this.containerEl)
            .setName("Show macOS Reminders")
            .setDesc("Display Reminders below the calendar widget")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.enableReminders !== false);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ enableReminders: value }));
            });
        });
    }
    addMacOSCalendarNamesSetting() {
        const self = this;
        const container = this.containerEl.createDiv();

        // Auto-discover button
        new obsidian.Setting(container)
            .setName("Calendar sources")
            .setDesc("Toggle which calendars to show. Changes apply immediately.")
            .addButton((btn) => {
                btn.setButtonText("Discover");
                btn.setClass("mod-cta");
                btn.onClick(async () => {
                    btn.setButtonText("Loading...");
                    btn.setDisabled(true);
                    const view = self.plugin.view;
                    if (view && view.macosIntegration) {
                        const sources = await view.macosIntegration.discoverCalendars();
                        self.renderCalendarToggles(container, sources);
                        // Persist metadata
                        var meta = sources.map(function(s) {
                            return { name: s.rawName, id: s.id, color: s.color, typeHint: s.typeHint, accountHint: s.accountHint };
                        });
                        await self.plugin.writeOptions(function() { return { _calendarMeta: meta }; });
                    }
                    btn.setButtonText("Refresh");
                    btn.setDisabled(false);
                });
            });

        // Show toggles from saved metadata if available, otherwise from current selection
        const savedMeta = this.plugin.options._calendarMeta || [];
        const currentNames = this.plugin.options.selectedCalendarIds || [];
        if (savedMeta.length > 0) {
            this.renderCalendarToggles(container, savedMeta);
        } else if (currentNames.length > 0) {
            this.renderCalendarToggles(container, currentNames);
        }
    }
    renderCalendarToggles(container, sources) {
        // Remove old toggles
        container.querySelectorAll(".macos-cal-toggle").forEach((el) => el.remove());
        const self = this;
        const enabled = this.plugin.options.selectedCalendarIds || [];
        const showAll = enabled.length === 0;
        if (!sources || sources.length === 0) {
            var emptyEl = container.createDiv("macos-cal-toggle");
            emptyEl.createEl("p", { cls: "setting-item-description" }).textContent = "No calendars found. Check that Calendar.app has calendars configured.";
            return;
        }
        sources.forEach((source) => {
            // Use unique ID as the filter key; fall back to rawName if no ID available
            const sourceId = typeof source === 'string' ? source : (source.id || source.rawName || source.name);
            const sourceDisplay = typeof source === 'string' ? source : (source.name || source.rawName);
            var desc = "Calendar";
            if (source.accountHint) {
                desc = "Calendar · " + source.accountHint;
            } else if (source.typeHint) {
                desc = "Calendar · " + source.typeHint;
            }
            // Check if this source is enabled: match by ID, or by name (backward compat)
            var isEnabled = showAll;
            if (!isEnabled) {
                isEnabled = enabled.includes(sourceId) ||
                    enabled.includes(source.rawName || source.name) ||
                    enabled.includes(source.name || source.rawName);
            }
            new obsidian.Setting(container.createDiv("macos-cal-toggle"))
                .setName(sourceDisplay)
                .setDesc(desc)
                .addToggle((toggle) => {
                    toggle.setValue(isEnabled);
                    toggle.onChange(async (value) => {
                        let current = (self.plugin.options.selectedCalendarIds || []).slice();
                        if (value) {
                            // Turning this source ON — add its unique ID
                            if (!current.includes(sourceId)) current.push(sourceId);
                        } else {
                            if (current.length === 0) {
                                // Was showing all; now exclude just this one source
                                var allIds = [];
                                sources.forEach(function(s) {
                                    allIds.push(typeof s === 'string' ? s : (s.id || s.rawName || s.name));
                                });
                                current = allIds.filter(function(id) { return id !== sourceId; });
                            } else {
                                // Remove by ID and by name (clean up any old-format entries)
                                current = current.filter(function(id) {
                                    return id !== sourceId && id !== (source.rawName || source.name) && id !== (source.name || source.rawName);
                                });
                            }
                        }
                        await self.plugin.writeOptions(function() { return { selectedCalendarIds: current }; });
                        // Apply filter instantly from cache — no JXA reload needed
                        var view = self.plugin.view;
                        if (view && view.macosIntegration) {
                            view.macosIntegration.render();
                        }
                    });
                });
        });
    }
    addMacOSReminderListNamesSetting() {
        const self = this;
        const container = this.containerEl.createDiv();

        new obsidian.Setting(container)
            .setName("Reminder sources")
            .setDesc("Toggle which reminder lists to show. Changes apply immediately.")
            .addButton((btn) => {
                btn.setButtonText("Discover");
                btn.setClass("mod-cta");
                btn.onClick(async () => {
                    btn.setButtonText("Loading...");
                    btn.setDisabled(true);
                    const view = self.plugin.view;
                    if (view && view.macosIntegration) {
                        const sources = await view.macosIntegration.discoverReminderLists();
                        self.renderReminderToggles(container, sources);
                        var meta = sources.map(function(s) { return { name: s.rawName, id: s.id }; });
                        await self.plugin.writeOptions(function() { return { _reminderMeta: meta }; });
                    }
                    btn.setButtonText("Refresh");
                    btn.setDisabled(false);
                });
            });

        const savedMeta = this.plugin.options._reminderMeta || [];
        if (savedMeta.length > 0) {
            this.renderReminderToggles(container, savedMeta);
        }
        const currentNames = this.plugin.options.selectedReminderListIds || [];
        if (savedMeta.length === 0 && currentNames.length > 0) {
            this.renderReminderToggles(container, currentNames);
        }
    }
    renderReminderToggles(container, sources) {
        container.querySelectorAll(".macos-rem-toggle").forEach((el) => el.remove());
        const self = this;
        const enabled = this.plugin.options.selectedReminderListIds || [];
        const showAll = enabled.length === 0;
        if (!sources || sources.length === 0) {
            var emptyEl = container.createDiv("macos-rem-toggle");
            emptyEl.createEl("p", { cls: "setting-item-description" }).textContent = "No reminder lists found. Check that Reminders.app has lists configured.";
            return;
        }
        sources.forEach((source) => {
            const sourceId = typeof source === 'string' ? source : (source.id || source.rawName || source.name);
            const sourceDisplay = typeof source === 'string' ? source : (source.name || source.rawName);
            var isEnabled = showAll;
            if (!isEnabled) {
                isEnabled = enabled.includes(sourceId) ||
                    enabled.includes(source.rawName || source.name) ||
                    enabled.includes(source.name || source.rawName);
            }
            new obsidian.Setting(container.createDiv("macos-rem-toggle"))
                .setName(sourceDisplay)
                .setDesc("Reminder list")
                .addToggle((toggle) => {
                    toggle.setValue(isEnabled);
                    toggle.onChange(async (value) => {
                        let current = (self.plugin.options.selectedReminderListIds || []).slice();
                        if (value) {
                            if (!current.includes(sourceId)) current.push(sourceId);
                        } else {
                            if (current.length === 0) {
                                var allIds = [];
                                sources.forEach(function(s) {
                                    allIds.push(typeof s === 'string' ? s : (s.id || s.rawName || s.name));
                                });
                                current = allIds.filter(function(id) { return id !== sourceId; });
                            } else {
                                current = current.filter(function(id) {
                                    return id !== sourceId && id !== (source.rawName || source.name) && id !== (source.name || source.rawName);
                                });
                            }
                        }
                        await self.plugin.writeOptions(function() { return { selectedReminderListIds: current }; });
                        var view = self.plugin.view;
                        if (view && view.macosIntegration) {
                            view.macosIntegration.render();
                        }
                    });
                });
        });
    }
    // REQ-REM-006, REQ-REM-007: Reminder display settings
    addReminderDisplaySettings() {
        // No-date reminders toggle
        new obsidian.Setting(this.containerEl)
            .setName("Show reminders without due dates")
            .setDesc("Display reminders that have no due date in a separate collapsible section")
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.options.showNoDateReminders !== false);
            toggle.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ showNoDateReminders: value }));
            });
        });

        // Default display range
        new obsidian.Setting(this.containerEl)
            .setName("Default reminder display range")
            .setDesc("Choose how many days of reminders to show. You can also change this inline in the reminder panel.")
            .addDropdown((dropdown) => {
            dropdown.addOption("today", "Selected day only");
            dropdown.addOption("7days", "Next 7 days");
            dropdown.addOption("all", "All incomplete");
            dropdown.setValue(this.plugin.options.reminderDisplayRange || "today");
            dropdown.onChange(async (value) => {
                this.plugin.writeOptions(() => ({ reminderDisplayRange: value }));
            });
        });
    }
    addMacOSRefreshIntervalSetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Refresh interval (minutes)")
            .setDesc("How often to refresh Calendar and Reminders data")
            .addText((textfield) => {
            textfield.setPlaceholder("5");
            textfield.inputEl.type = "number";
            textfield.setValue(String(this.plugin.options.refreshIntervalMinutes || 5));
            textfield.onChange(async (value) => {
                const num = Math.max(1, Number(value) || 5);
                this.plugin.writeOptions(() => ({ refreshIntervalMinutes: num }));
            });
        });
    }
    // REQ-CAL-010: Past event display setting
    addMacOSPastEventDisplaySetting() {
        new obsidian.Setting(this.containerEl)
            .setName("Past events")
            .setDesc("How to display events that have already ended")
            .addDropdown((dropdown) => {
            dropdown.addOption("normal", "Show normally");
            dropdown.addOption("dimmed", "Dim past events");
            dropdown.addOption("hidden", "Hide past events");
            dropdown.setValue(this.plugin.options.pastEventDisplay || 'dimmed');
            dropdown.onChange(async (value) => {
                await this.plugin.writeOptions(() => ({ pastEventDisplay: value }));
                var view = this.plugin.view;
                if (view && view.macosIntegration) {
                    view.macosIntegration.render();
                }
            });
        });
    }

    // v0.3: Default calendar for event creation
    addDefaultCalendarSetting() {
        var self = this;
        var setting = new obsidian.Setting(this.containerEl)
            .setName("Default calendar for new events")
            .setDesc("Pre-selected when creating an event. Leave empty for auto-detect (prefers Outlook).");
        var dropdown;
        setting.addDropdown(function(cmp) {
            dropdown = cmp;
            cmp.addOption("", "Auto-detect");
        });
        // Populate from discovered calendars
        var view = this.plugin.view;
        if (view && view.macosIntegration) {
            view.macosIntegration.discoverCalendars().then(function(cals) {
                for (var i = 0; i < cals.length; i++) {
                    dropdown.addOption(cals[i].id, cals[i].name);
                }
                var current = self.plugin.options.defaultCalendarId || '';
                if (current) dropdown.setValue(current);
            }).catch(function() {});
        }
        dropdown.onChange(async function(value) {
            await self.plugin.writeOptions(function() { return { defaultCalendarId: value }; });
        });
    }

    // v0.3: Default reminder list for reminder creation
    addDefaultReminderListSetting() {
        var self = this;
        var setting = new obsidian.Setting(this.containerEl)
            .setName("Default list for new reminders")
            .setDesc("Pre-selected when creating a reminder. Leave empty for auto-detect (prefers Outlook).");
        var dropdown;
        setting.addDropdown(function(cmp) {
            dropdown = cmp;
            cmp.addOption("", "Auto-detect");
        });
        var view = this.plugin.view;
        if (view && view.macosIntegration) {
            view.macosIntegration.discoverReminderLists().then(function(lists) {
                for (var i = 0; i < lists.length; i++) {
                    dropdown.addOption(lists[i].id, lists[i].name);
                }
                var current = self.plugin.options.defaultReminderListId || '';
                if (current) dropdown.setValue(current);
            }).catch(function() {});
        }
        dropdown.onChange(async function(value) {
            await self.plugin.writeOptions(function() { return { defaultReminderListId: value }; });
        });
    }

    // v0.3 AI-powered NL parsing settings
    addAISettings() {
        var self = this;
        var opts = this.plugin.options || {};

        var descEl = this.containerEl.createDiv("setting-item-description");
        descEl.textContent = "Optionally use an AI model (e.g., DeepSeek, OpenAI-compatible) to parse natural language event text. When enabled, the AI will extract title, date, time, and duration with higher accuracy than the built-in regex parser. The built-in parser is always available as a fallback.";

        // Enable toggle
        new obsidian.Setting(this.containerEl)
            .setName("Enable AI parsing")
            .setDesc("Send quick-create text to AI for structured parsing. Text content is sent to the configured endpoint only when you use the quick-create feature.")
            .addToggle(function(cmp) {
                cmp.setValue(!!opts.aiParsingEnabled);
                cmp.onChange(async function(value) {
                    await self.plugin.writeOptions(function() { return { aiParsingEnabled: value }; });
                });
            });

        // Endpoint
        new obsidian.Setting(this.containerEl)
            .setName("API endpoint")
            .setDesc("OpenAI-compatible chat completions endpoint.")
            .addText(function(cmp) {
                cmp.setPlaceholder("https://api.deepseek.com/v1/chat/completions");
                cmp.setValue(opts.aiEndpoint || '');
                cmp.onChange(async function(value) {
                    await self.plugin.writeOptions(function() { return { aiEndpoint: value }; });
                });
            });

        // API key
        new obsidian.Setting(this.containerEl)
            .setName("API key")
            .setDesc("Your API key. Stored locally in data.json (gitignored). Never logged.")
            .addText(function(cmp) {
                cmp.inputEl.type = "password";
                cmp.setPlaceholder("sk-...");
                cmp.setValue(opts.aiApiKey || '');
                cmp.onChange(async function(value) {
                    await self.plugin.writeOptions(function() { return { aiApiKey: value }; });
                });
            });

        // Model
        new obsidian.Setting(this.containerEl)
            .setName("Model")
            .setDesc("Model name for the chat completions API.")
            .addText(function(cmp) {
                cmp.setPlaceholder("deepseek-chat");
                cmp.setValue(opts.aiModel || 'deepseek-chat');
                cmp.onChange(async function(value) {
                    await self.plugin.writeOptions(function() { return { aiModel: value }; });
                });
            });

        // Privacy note
        var privacyNote = this.containerEl.createDiv("setting-item-description");
        privacyNote.style.marginTop = "8px";
        privacyNote.style.color = "var(--text-muted)";
        privacyNote.style.fontSize = "0.85em";
        privacyNote.textContent = "⚠️ Privacy: When enabled, the text you type in quick-create is sent to the configured AI API endpoint. No calendar data, reminder data, or personal information is sent — only the natural language text you explicitly type for parsing. The API key is stored in your local vault's data.json (which is gitignored).";
    }
}

const classList = (obj) => {
    return Object.entries(obj)
        .filter(([_k, v]) => !!v)
        .map(([k, _k]) => k);
};
function clamp(num, lowerBound, upperBound) {
    return Math.min(Math.max(lowerBound, num), upperBound);
}
function partition(arr, predicate) {
    const pass = [];
    const fail = [];
    arr.forEach((elem) => {
        if (predicate(elem)) {
            pass.push(elem);
        }
        else {
            fail.push(elem);
        }
    });
    return [pass, fail];
}
/**
 * Lookup the dateUID for a given file. It compares the filename
 * to the daily and weekly note formats to find a match.
 *
 * @param file
 */
function getDateUIDFromFile(file) {
    if (!file) {
        return null;
    }
    // TODO: I'm not checking the path!
    let date = getDateFromFile_1(file, "day");
    if (date) {
        return getDateUID_1$1(date, "day");
    }
    date = getDateFromFile_1(file, "week");
    if (date) {
        return getDateUID_1$1(date, "week");
    }
    return null;
}
function getWordCount(text) {
    const spaceDelimitedChars = /A-Za-z\u00AA\u00B5\u00BA\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC/
        .source;
    const nonSpaceDelimitedWords = /\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u4E00-\u9FD5/
        .source;
    const pattern = new RegExp([
        `(?:[0-9]+(?:(?:,|\\.)[0-9]+)*|[\\-${spaceDelimitedChars}])+`,
        nonSpaceDelimitedWords,
    ].join("|"), "g");
    return (text.match(pattern) || []).length;
}

function createDailyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const dailyNotes = getAllDailyNotes_1();
                store.set(dailyNotes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    // Avoid error being shown multiple times
                    console.log("[Calendar] Failed to find daily notes folder", err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
function createWeeklyNotesStore() {
    let hasError = false;
    const store = writable(null);
    return Object.assign({ reindex: () => {
            try {
                const weeklyNotes = getAllWeeklyNotes_1();
                store.set(weeklyNotes);
                hasError = false;
            }
            catch (err) {
                if (!hasError) {
                    // Avoid error being shown multiple times
                    console.log("[Calendar] Failed to find weekly notes folder", err);
                }
                store.set({});
                hasError = true;
            }
        } }, store);
}
const settings = writable(defaultSettings);
const dailyNotes = createDailyNotesStore();
const weeklyNotes = createWeeklyNotesStore();
function createSelectedFileStore() {
    const store = writable(null);
    return Object.assign({ setFile: (file) => {
            const id = getDateUIDFromFile(file);
            store.set(id);
        } }, store);
}
const activeFile = createSelectedFileStore();

class ConfirmationModal extends obsidian.Modal {
    constructor(app, config) {
        super(app);
        const { cta, onAccept, text, title } = config;
        this.contentEl.createEl("h2", { text: title });
        this.contentEl.createEl("p", { text });
        this.contentEl.createDiv("modal-button-container", (buttonsEl) => {
            buttonsEl
                .createEl("button", { text: "Never mind" })
                .addEventListener("click", () => this.close());
            buttonsEl
                .createEl("button", {
                cls: "mod-cta",
                text: cta,
            })
                .addEventListener("click", async (e) => {
                await onAccept(e);
                this.close();
            });
        });
    }
}
function createConfirmationDialog({ cta, onAccept, text, title, }) {
    new ConfirmationModal(window.app, { cta, onAccept, text, title }).open();
}

// REQ-DIAG-002: Consent modal for diagnostic export with redaction
class ExportConsentModal extends obsidian.Modal {
    constructor(app, integ, manifest) {
        super(app);
        this.integ = integ;
        this.manifest = manifest || {};
    }
    onOpen() {
        var self = this;
        this.titleEl.setText("Export Diagnostics");
        this.contentEl.createEl("p", {
            text: "This will copy diagnostic information to your clipboard. Sensitive data (event titles, notes, locations, URLs, attendee names, and calendar UUIDs) will be redacted."
        });
        this.contentEl.createEl("p", {
            text: "The export includes: plugin version, platform info, helper binary status, permission states, source counts, cache statistics, refresh timing, and error classifications.",
            cls: "setting-item-description"
        });
        this.contentEl.createDiv("modal-button-container", function(buttonsEl) {
            buttonsEl.createEl("button", { text: "Cancel" })
                .addEventListener("click", function() { self.close(); });
            buttonsEl.createEl("button", {
                cls: "mod-cta",
                text: "Export (Redacted)"
            }).addEventListener("click", function() {
                self.doExport();
                self.close();
            });
        });
    }
    doExport() {
        var payload = this.buildRedactedPayload();
        var json = JSON.stringify(payload, null, 2);
        navigator.clipboard.writeText(json).then(function() {
            new obsidian.Notice("Diagnostics copied to clipboard (sensitive data redacted)");
            console.log("[Calendian] Diagnostic export copied to clipboard (" + json.length + " chars)");
        }).catch(function(err) {
            new obsidian.Notice("Failed to copy diagnostics to clipboard");
            console.error("[Calendian] Clipboard write failed:", err);
        });
    }
    buildRedactedPayload() {
        var integ = this.integ;
        var manifest = this.manifest;
        var opts = integ && integ.plugin ? integ.plugin.options : {};
        var fmtDate = function(m) { return m ? m.format('YYYY-MM-DD') : null; };

        // Build event counts by calendar name (safe: names only, counts only)
        var eventCountsBySource = {};
        if (integ && integ.allEvents) {
            for (var i = 0; i < integ.allEvents.length; i++) {
                var e = integ.allEvents[i];
                var calName = e.calendarName || e.calendar || '[REDACTED]';
                eventCountsBySource[calName] = (eventCountsBySource[calName] || 0) + 1;
            }
        }

        // Build reminder counts by list name (safe: names only, counts only)
        var reminderCountsBySource = {};
        if (integ && integ.allReminders) {
            for (var j = 0; j < integ.allReminders.length; j++) {
                var r = integ.allReminders[j];
                var listName = r.listName || r.list || '[REDACTED]';
                reminderCountsBySource[listName] = (reminderCountsBySource[listName] || 0) + 1;
            }
        }

        // Redacted error: include type and timestamp only, redact message (may contain titles/paths)
        var redactError = function(err) {
            if (!err) return null;
            return { type: err.type || 'unknown', timestamp: err.timestamp || null };
        };

        return {
            exportDate: new Date().toISOString(),
            pluginVersion: manifest.version || 'unknown',
            pluginName: manifest.name || 'Calendian',
            platform: navigator.platform,
            helperStatus: {
                available: !!(integ && integ.helperPath),
                // Path redacted — could leak filesystem structure
            },
            permissions: {
                calendar: integ ? integ.permissionState.calendar : 'unknown',
                reminders: integ ? integ.permissionState.reminders : 'unknown',
            },
            sources: {
                calendarsDiscovered: integ ? integ.sourceCounts.calendars : 0,
                reminderListsDiscovered: integ ? integ.sourceCounts.reminderLists : 0,
                eventCountsByCalendar: eventCountsBySource,
                reminderCountsByList: reminderCountsBySource,
            },
            cache: {
                eventsCount: integ ? integ.allEvents.length : 0,
                remindersCount: integ ? integ.allReminders.length : 0,
                cacheStart: integ ? fmtDate(integ.cacheStart) : null,
                cacheEnd: integ ? fmtDate(integ.cacheEnd) : null,
            },
            refresh: {
                lastRefresh: integ ? integ.lastRefreshTime : null,
                lastRefreshDurationMs: integ ? integ.lastRefreshDurationMs : null,
                refreshIntervalMinutes: opts.refreshIntervalMinutes || 5,
            },
            errors: {
                calendar: integ ? redactError(integ.lastError.calendar) : null,
                reminders: integ ? redactError(integ.lastError.reminders) : null,
            },
        };
    }
}

/**
 * Create a Daily Note for a given date.
 */
async function tryToCreateDailyNote(date, inNewSplit, settings, cb) {
    const { workspace } = window.app;
    const { format } = getDailyNoteSettings_1();
    const filename = date.format(format);
    const createFile = async () => {
        const dailyNote = await createDailyNote_1(date);
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(dailyNote);
        cb === null || cb === void 0 ? void 0 : cb(dailyNote);
    };
    if (settings.shouldConfirmBeforeCreate) {
        createConfirmationDialog({
            cta: "Create",
            onAccept: createFile,
            text: `File ${filename} does not exist. Would you like to create it?`,
            title: "New Daily Note",
        });
    }
    else {
        await createFile();
    }
}

// ═══════════════════════════════════════════════════════════════
// v0.3 Event & Reminder creation modals (REQ-WRITE-001..010)
// ═══════════════════════════════════════════════════════════════

// ── Natural Language Parser (REQ-NL-001, REQ-NL-002, REQ-NL-005) ─

/**
 * Parse a natural language event expression and extract structured fields.
 *
 * Supported patterns (English):
 *   "tomorrow 3pm meeting with Sarah"
 *   "next Monday 10am dentist"
 *   "today meeting" / "meeting today"
 *   "Friday 2pm lunch" / "lunch Friday at 2pm"
 *   "in 3 days 4pm call"
 *   "from 3pm to 5pm deep work"
 *   "meeting at noon" / "morning yoga" / "evening run"
 *   "3pm team sync for 1 hour"
 *   "on 2026-12-25 Christmas dinner"
 *
 * Supported patterns (Chinese — REQ-NL-005):
 *   "明天下午3点开会" / "明天3点开会"
 *   "周五上午10点看牙医" / "下周三下午2点评审"
 *   "今天中午吃饭" / "晚上8点跑步" / "凌晨3点出发"
 *   "下周一早上9点评审" / "下下周五晚8点"
 *   "6月15日下午3点看牙医" / "12月25号聚餐"
 *   "3天后下午4点call" / "一周后开会"
 *   "明早9点跑步" / "明晚聚餐" / "今早8点会议"
 *   "周末下午3点逛街" / "下周周末爬山"
 *   "下个月5号复查" / "明年3月体检"
 *   "3点到5点开会" / "下午2点开2小时"
 *   "3点半下午茶" / "2点一刻出发" / "5点三刻收工"
 *   "下午3点1小时30分钟" / "一个半小时讨论"
 *
 * @param {string} text - Natural language input
 * @param {moment} refDate - Reference date (defaults to today)
 * @returns {{ title: string, date: moment|null, time: string|null, endTime: string|null, allDay: boolean, confidence: string }}
 */
function parseNaturalLanguage(text, refDate) {
    if (!text || typeof text !== 'string') return null;
    var input = text.trim();
    if (!input) return null;

    refDate = (refDate && refDate.clone()) || window.moment();
    // Start from the beginning of the reference day for clean comparisons
    refDate = refDate.clone().startOf('day');

    var working = input;
    var date = null;
    var time = null;
    var endTime = null;
    var allDay = false;
    var confidenceScore = 0;
    var titleRemaining = '';

    // ── Chinese date detection ──────────────────────────────

    // Combined day+period shorthands (before absolute dates so they're consumed whole)
    var cnShortcuts = [
        { re: /明早/, add: 1, time: '09:00' },
        { re: /明晚/, add: 1, time: '19:00' },
        { re: /今早/, add: 0, time: '09:00' },
        { re: /今晚/, add: 0, time: '19:00' },
        { re: /后天早上/, add: 2, time: '09:00' },
        { re: /后天晚上/, add: 2, time: '19:00' },
        { re: /后天中午/, add: 2, time: '12:00' },
    ];
    for (var si = 0; si < cnShortcuts.length; si++) {
        var sc = cnShortcuts[si];
        if (sc.re.test(working)) {
            date = refDate.clone().add(sc.add, 'days');
            if (!time) time = sc.time;
            working = working.replace(sc.re, ' ');
            confidenceScore += 4;
            break;
        }
    }

    var cnAbsDate = { '今天': 0, '明天': 1, '后天': 2, '大后天': 3, '昨天': -1, '前天': -2 };
    if (!date) {
        for (var cnKey in cnAbsDate) {
            if (working.indexOf(cnKey) !== -1) {
                date = refDate.clone().add(cnAbsDate[cnKey], 'days');
                working = working.split(cnKey).join(' ');
                confidenceScore += 3;
                break;
            }
        }
    }

    // Chinese weekday: 下周一, 周一, 星期一, 下星期一, 下下周一
    if (!date) {
        var cnDayNum = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
        var cnWdRe = /(下下|下)?(?:周|星期|礼拜)\s*([一二三四五六日天])|星期\s*([一二三四五六日天])/;
        var cnWdMatch = working.match(cnWdRe);
        if (cnWdMatch) {
            var targetDow = cnDayNum[cnWdMatch[2] || cnWdMatch[3]];
            var weekOffset = cnWdMatch[1] === '下下' ? 14 : (cnWdMatch[1] === '下' ? 7 : 0);
            date = refDate.clone().day(targetDow + weekOffset);
            if (date.isBefore(refDate, 'day') && weekOffset === 0) date.add(7, 'days');
            if (date.isSame(refDate, 'day') && weekOffset === 0) date.add(7, 'days');
            working = working.replace(cnWdMatch[0], ' ');
            confidenceScore += 3;
        }
    }

    // Chinese: "周末", "下周周末"
    if (!date) {
        if (/下周(的)?(周末|末)/.test(working)) {
            date = refDate.clone().day(6 + 7); // next Saturday
            working = working.replace(/下周(的)?(周末|末)/, ' ');
            confidenceScore += 3;
        } else if (/(这(个)?)?(周末|周木|週末)/.test(working)) {
            // "这周末" or "周末" → this coming Saturday
            date = refDate.clone().day(6);
            if (date.isSame(refDate, 'day') || date.isBefore(refDate, 'day')) {
                date.add(7, 'days');
            }
            working = working.replace(/(这(个)?)?(周末|周木|週末)/, ' ');
            confidenceScore += 3;
        }
    }

    // ── English absolute dates ──────────────────────────────

    if (!date && /\btonight\b/i.test(working)) {
        date = refDate.clone();
        if (!time) time = '20:00';
        working = working.replace(/\btonight\b/gi, ' ');
        confidenceScore += 3;
    }
    if (!date && /\btoday\b/i.test(working)) {
        date = refDate.clone();
        working = working.replace(/\btoday\b/gi, ' ');
        confidenceScore += 3;
    }
    if (!date && /\btomorrow\b/i.test(working)) {
        date = refDate.clone().add(1, 'days');
        working = working.replace(/\btomorrow\b/gi, ' ');
        confidenceScore += 3;
    }

    // English: "next Monday/Tuesday/..."
    if (!date) {
        var enDaysFull = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
        var enDaysAbbr = ['mon','tue','wed','thu','fri','sat','sun'];
        var nextRe = /\bnext\s+(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
        var nextMatch = working.match(nextRe);
        if (nextMatch) {
            var target = nextMatch[1].toLowerCase();
            for (var di = 0; di < enDaysFull.length; di++) {
                if (target === enDaysFull[di] || target === enDaysAbbr[di]) {
                    var targetDow2 = di < 6 ? di + 1 : 0; // Sun=0, Mon=1..Sat=6
                    date = refDate.clone().day(targetDow2 + 7);
                    break;
                }
            }
            working = working.replace(nextMatch[0], ' ');
            confidenceScore += 3;
        }
    }

    // English: bare weekday names (next occurrence, not today)
    if (!date) {
        var bareWdRe = /\b(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i;
        var bareMatch = working.match(bareWdRe);
        if (bareMatch) {
            var bareTarget = bareMatch[1].toLowerCase();
            for (var dj = 0; dj < enDaysFull.length; dj++) {
                if (bareTarget === enDaysFull[dj] || bareTarget === enDaysAbbr[dj]) {
                    var targetDow3 = dj < 6 ? dj + 1 : 0;
                    date = refDate.clone().day(targetDow3);
                    // Next occurrence (skip today)
                    if (date.isSame(refDate, 'day') || date.isBefore(refDate, 'day')) {
                        date.add(7, 'days');
                    }
                    break;
                }
            }
            if (date) {
                working = working.replace(bareMatch[0], ' ');
                confidenceScore += 2;
            }
        }
    }

    // "in N days/weeks"
    if (!date) {
        var inRe = /\bin\s+(\d+)\s*(day|week|month)s?\b/i;
        var inMatch = working.match(inRe);
        if (inMatch) {
            var inNum = parseInt(inMatch[1], 10);
            var inUnit = inMatch[2].toLowerCase();
            date = refDate.clone();
            if (inUnit === 'day') date.add(inNum, 'days');
            else if (inUnit === 'week') date.add(inNum * 7, 'days');
            else if (inUnit === 'month') date.add(inNum, 'months');
            working = working.replace(inMatch[0], ' ');
            confidenceScore += 2;
        }
    }

    // Chinese: "X天后", "X周后", "X个月后", "X星期后" (REQ-NL-005)
    if (!date) {
        var cnRelRe = /(\d+|一|二|三|四|五|六|七|八|九|十|半|两)\s*(天|周|个?月|个?(?:星期)|年)后/;
        var cnRelMatch = working.match(cnRelRe);
        if (cnRelMatch) {
            var cnNumStr = cnRelMatch[1];
            var cnUnit = cnRelMatch[2];
            var cnNum = mapCnNumber(cnNumStr);
            if (cnNum > 0) {
                date = refDate.clone();
                if (cnUnit === '天') date.add(cnNum, 'days');
                else if (cnUnit === '周' || cnUnit.indexOf('星期') !== -1) date.add(cnNum * 7, 'days');
                else if (cnUnit === '个月' || cnUnit === '月') date.add(cnNum, 'months');
                else if (cnUnit === '年') date.add(cnNum, 'years');
                working = working.replace(cnRelMatch[0], ' ');
                confidenceScore += 3;
            }
        }
    }

    // Chinese: "下个月", "下下个月", "上个月", "明年", "后年", "去年"
    if (!date) {
        var cnMacroDate = [
            { re: /下下个?月/, addMonths: 2 },
            { re: /下个?月/, addMonths: 1 },
            { re: /上个?月/, addMonths: -1 },
            { re: /后年/, addYears: 2 },
            { re: /明年/, addYears: 1 },
            { re: /去年/, addYears: -1 },
        ];
        for (var mdi = 0; mdi < cnMacroDate.length; mdi++) {
            var md = cnMacroDate[mdi];
            if (md.re.test(working)) {
                date = refDate.clone();
                if (md.addMonths) date.add(md.addMonths, 'months');
                if (md.addYears) date.add(md.addYears, 'years');
                working = working.replace(md.re, ' ');
                confidenceScore += 3;
                break;
            }
        }
    }

    // Chinese: "X月Y日" or "X月Y号" — supports both digits and Chinese numerals (REQ-NL-005)
    if (!date) {
        // Match: "6月15日", "12月25号", "六月十五日", "六月中" (mid-month)
        var cnMDRe = /(?:(\d{1,2})|(一|二|三|四|五|六|七|八|九|十|十一|十二|冬|腊))\s*月\s*(?:(\d{1,2})|(一|二|三|四|五|六|七|八|九|十|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一|廿一|廿二|廿三|廿四|廿五|廿六|廿七|廿八|廿九|三十|三十一|初一|初二|初三|初四|初五|初六|初七|初八|初九|初十|十一|十二|十三|十四|十五|十六|十七|十八|十九|二十|廿|廿一|廿二|廿三|廿四|廿五|廿六|廿七|廿八|廿九|三十))?\s*(?:日|号)?/;
        var cnMDMatch = working.match(cnMDRe);
        if (cnMDMatch) {
            var cnMonth = cnMDMatch[1] ? parseInt(cnMDMatch[1], 10) : mapCnNumber(cnMDMatch[2]);
            var cnDay = cnMDMatch[3] ? parseInt(cnMDMatch[3], 10) : (cnMDMatch[4] ? mapCnNumber(cnMDMatch[4]) : 1);
            if (cnMonth >= 1 && cnMonth <= 12 && cnDay >= 1 && cnDay <= 31) {
                var now = refDate.clone();
                date = window.moment([now.year(), cnMonth - 1, cnDay]);
                if (date.isBefore(refDate, 'day')) {
                    date.add(1, 'years');
                }
                if (date.isValid()) {
                    working = working.replace(cnMDMatch[0], ' ');
                    confidenceScore += 4;
                } else {
                    date = null;
                }
            }
        }
    }

    // Chinese: bare "X号" or "X日" — day of current month
    if (!date) {
        var cnDayOnlyRe = /(?:(\d{1,2})|(一|二|三|四|五|六|七|八|九|十|二十|二十一|二十二|二十三|二十四|二十五|二十六|二十七|二十八|二十九|三十|三十一))\s*(?:号|日)\b/;
        var cnDayMatch = working.match(cnDayOnlyRe);
        if (cnDayMatch) {
            var cnDay2 = cnDayMatch[1] ? parseInt(cnDayMatch[1], 10) : mapCnNumber(cnDayMatch[2]);
            if (cnDay2 >= 1 && cnDay2 <= 31) {
                date = window.moment([refDate.year(), refDate.month(), cnDay2]);
                if (date.isBefore(refDate, 'day')) {
                    date.add(1, 'months');
                }
                if (date.isValid()) {
                    working = working.replace(cnDayMatch[0], ' ');
                    confidenceScore += 3;
                } else {
                    date = null;
                }
            }
        }
    }

    // YYMMDD compact: "260608" → 2026-06-08
    if (!date) {
        var yymmddRe = /\b(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/;
        var yymmddMatch = working.match(yymmddRe);
        if (yymmddMatch) {
            var yy = parseInt(yymmddMatch[1], 10);
            var mm = parseInt(yymmddMatch[2], 10);
            var dd = parseInt(yymmddMatch[3], 10);
            // Treat 00-99 as 2000-2099
            var fullYear = 2000 + yy;
            var yymmddParsed = window.moment([fullYear, mm - 1, dd]);
            if (yymmddParsed.isValid()) {
                date = yymmddParsed;
                working = working.replace(yymmddMatch[0], ' ');
                confidenceScore += 4;
            }
        }
    }

    // "on YYYY-MM-DD" or "on MM/DD"
    if (!date) {
        var isoDateRe = /\b(on\s+)?(\d{4})-(\d{2})-(\d{2})\b/;
        var isoMatch = working.match(isoDateRe);
        if (isoMatch) {
            var parsedDate = window.moment(isoMatch[0].replace(/^on\s+/i, ''), 'YYYY-MM-DD');
            if (parsedDate.isValid()) {
                date = parsedDate;
                working = working.replace(isoMatch[0], ' ');
                confidenceScore += 3;
            }
        }
    }
    if (!date) {
        var slashDateRe = /\b(on\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
        var slashMatch = working.match(slashDateRe);
        if (slashMatch) {
            var fmt = slashMatch[4] ? 'MM/DD/YYYY' : 'MM/DD';
            var parsedSlash = window.moment(slashMatch[0].replace(/^on\s+/i, ''), fmt);
            if (parsedSlash.isValid()) {
                date = parsedSlash;
                working = working.replace(slashMatch[0], ' ');
                confidenceScore += 3;
            }
        }
    }

    // ── Time range detection (range first, before single time) ─

    // English: "from X to/until Y" (where X,Y are times)
    var fromToRe = /\bfrom\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|until|till|–|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;
    var ftMatch = working.match(fromToRe);
    if (ftMatch) {
        var t1 = parseTimeExpression(ftMatch[1]);
        var t2 = parseTimeExpression(ftMatch[2]);
        if (t1) { time = t1; confidenceScore += 2; }
        if (t2) { endTime = t2; confidenceScore += 1; }
        working = working.replace(ftMatch[0], ' ');
    }

    // Chinese: "X点到Y点" (range detection, supports both digits and Chinese numerals)
    if (!time || !endTime) {
        var cnRangeRe = /(凌晨|早上|上午|中午|下午|晚上|傍晚|夜里)?(?:(\d{1,2})|(一|二|三|四|五|六|七|八|九|十|十一|十二))点(?:一刻|三刻|半)?(?:(\d{1,2})分?)?\s*(?:到|至|~|～|-)\s*(凌晨|早上|上午|中午|下午|晚上|傍晚|夜里)?(?:(\d{1,2})|(一|二|三|四|五|六|七|八|九|十|十一|十二))点(?:一刻|三刻|半)?(?:(\d{1,2})分?)?/;
        var cnRangeMatch = working.match(cnRangeRe);
        if (cnRangeMatch) {
            var p1 = cnRangeMatch[1] || getChinesePeriodHint(working);
            // hour1: either digit (group 2) or Chinese numeral (group 3)
            var cnT1 = cnRangeMatch[2] ? parseInt(cnRangeMatch[2], 10) : (cnRangeMatch[3] ? mapCnNumber(cnRangeMatch[3]) : 0);
            var p2 = cnRangeMatch[5] || p1;
            // hour2: either digit (group 6) or Chinese numeral (group 7)
            var cnT2 = cnRangeMatch[6] ? parseInt(cnRangeMatch[6], 10) : (cnRangeMatch[7] ? mapCnNumber(cnRangeMatch[7]) : 0);
            if (cnT1 > 0 && cnT2 > 0) {
                time = cnHourTo24(cnT1, p1);
                endTime = cnHourTo24(cnT2, p2);
            }
            working = working.replace(cnRangeMatch[0], ' ');
            // Also strip orphaned period hints left adjacent to where the match was
            working = stripOrphanPeriodHints(working);
            confidenceScore += 2;
        }
    }

    // ── Duration detection ──────────────────────────────────

    // "for X hours/minutes", "Xh", "Xm"
    if (time && !endTime) {
        var durRe = /\bfor\s+(\d+(?:\.\d+)?)\s*(hour|hr|minute|min)s?\b|\b(\d+(?:\.\d+)?)\s*(h|m)\b/i;
        var durMatch = working.match(durRe);
        if (durMatch) {
            var durNum = parseFloat(durMatch[1] || durMatch[3]);
            var durUnitFull = (durMatch[2] || '').toLowerCase();
            var durUnitShort = (durMatch[4] || '').toLowerCase();
            var durMinutes = 0;
            if (durUnitFull === 'hour' || durUnitFull === 'hr' || durUnitShort === 'h') {
                durMinutes = Math.round(durNum * 60);
            } else if (durUnitFull === 'minute' || durUnitFull === 'min' || durUnitShort === 'm') {
                durMinutes = Math.round(durNum);
            }
            if (durMinutes > 0) {
                endTime = addMinutesToTime(time, durMinutes);
                confidenceScore += 1;
            }
            working = working.replace(durMatch[0], ' ');
        }
    }

    // Chinese duration: "X小时", "X个小时", "X分钟", "X小时Y分钟", "X个半小时"
    if (time && !endTime) {
        var cnDurRe = /(?:约|大约|大概)?\s*(\d+|一|二|三|四|五|六|七|八|九|十|半|两)\s*(?:个(?:半|多)?)?\s*(小时|钟头|分钟|刻钟?)(?:\s*(\d+)\s*(分钟))?/;
        var cnDurMatch = working.match(cnDurRe);
        if (cnDurMatch) {
            var cnDurNum = mapCnNumber(cnDurMatch[1]);
            var cnDurUnit = cnDurMatch[2];
            var cnDurMin2 = cnDurMatch[3] ? parseInt(cnDurMatch[3], 10) : 0;
            var durMinutesTotal = 0;
            if (cnDurUnit === '小时' || cnDurUnit === '钟头') {
                durMinutesTotal = Math.round(cnDurNum * 60);
            } else if (cnDurUnit === '分钟') {
                durMinutesTotal = Math.round(cnDurNum);
            } else if (cnDurUnit === '刻' || cnDurUnit === '刻钟') {
                durMinutesTotal = Math.round(cnDurNum * 15);
            }
            durMinutesTotal += cnDurMin2;
            if (durMinutesTotal > 0) {
                endTime = addMinutesToTime(time, durMinutesTotal);
                confidenceScore += 1;
            }
            working = working.replace(cnDurMatch[0], ' ');
        }
    }

    // "一个半小时" / "1个半小时" — special case: 1.5 hours
    if (time && !endTime) {
        var cnHalfHourRe = /(\d+|一|两)?个半(?:小时|钟头)/;
        var cnHHMatch = working.match(cnHalfHourRe);
        if (cnHHMatch) {
            var hhNum = cnHHMatch[1] ? mapCnNumber(cnHHMatch[1]) : 1;
            var hhMinutes = Math.round(hhNum * 60 + 30); // X.5 hours
            endTime = addMinutesToTime(time, hhMinutes);
            working = working.replace(cnHHMatch[0], ' ');
            confidenceScore += 1;
        }
    }

    // ── Single time detection ───────────────────────────────

    // Chinese time: 凌晨/早上/上午/中午/下午/晚上/傍晚/夜里 + N点/N点半/N点一刻/N点三刻
    // Supports both digits (3点) and Chinese numerals (三点)
    if (!time) {
        var cnTimeRe = /(凌晨|早上|上午|中午|下午|晚上|傍晚|夜里)?(?:(\d{1,2})|(一|二|三|四|五|六|七|八|九|十|十一|十二))点(?:(一刻|三刻|半)|(\d{1,2})分?)?/;
        var cnTimeMatch = working.match(cnTimeRe);
        if (cnTimeMatch) {
            var cnPeriod = cnTimeMatch[1] || '';
            var cnHour = cnTimeMatch[2] ? parseInt(cnTimeMatch[2], 10) : (cnTimeMatch[3] ? mapCnNumber(cnTimeMatch[3]) : 0);
            var cnQuarter = cnTimeMatch[4]; // '一刻', '三刻', '半'
            var cnMin = cnTimeMatch[5] ? parseInt(cnTimeMatch[5], 10) : 0;
            if (cnQuarter === '半') cnMin = 30;
            else if (cnQuarter === '一刻') cnMin = 15;
            else if (cnQuarter === '三刻') cnMin = 45;
            time = cnHourTo24(cnHour, cnPeriod);
            if (!cnPeriod) {
                var fullPeriod = getChinesePeriodHint(working);
                if (fullPeriod) {
                    time = cnHourTo24(cnHour, fullPeriod);
                } else if (cnHour <= 7) {
                    // Heuristic: bare hour <= 7, assume PM
                    time = cnHourTo24(cnHour, '下午');
                }
            }
            if (time) {
                if (cnMin > 0) {
                    var tp = time.split(':');
                    time = tp[0] + ':' + ('0' + cnMin).slice(-2);
                }
                confidenceScore += 2;
            }
            working = working.replace(cnTimeMatch[0], ' ');
            // Strip orphan period hints near the match
            working = stripOrphanPeriodHints(working);
        }
    }

    // Chinese standalone period words (vague time without hour)
    if (!time && !date) {
        var cnPeriodAlone = { '中午': '12:00', '早上': '09:00', '上午': '09:00', '白天': '09:00', '下午': '14:00', '晚上': '19:00', '傍晚': '18:00', '凌晨': '03:00', '夜里': '22:00' };
        for (var cp in cnPeriodAlone) {
            if (working.indexOf(cp) !== -1) {
                time = cnPeriodAlone[cp];
                working = working.split(cp).join(' ');
                confidenceScore += 1;
                break;
            }
        }
    }

    // English time patterns
    if (!time) {
        // "at 3pm", "at 3:00pm", "at 15:00"
        var atTimeRe = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i;
        var atMatch = working.match(atTimeRe);
        if (atMatch) {
            var parsed = parseTimeExpression(atMatch[1]);
            if (parsed) { time = parsed; confidenceScore += 2; }
            working = working.replace(atMatch[0], ' ');
        }
    }

    if (!time) {
        // Bare time: "3pm", "3:00pm", "15:00", "3:00"
        var bareTimeRe = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i;
        var bareTimeMatch = working.match(bareTimeRe);
        if (bareTimeMatch) {
            var btParsed = parseTimeExpression(bareTimeMatch[1]);
            if (btParsed) { time = btParsed; confidenceScore += 2; }
            working = working.replace(bareTimeMatch[0], ' ');
        }
    }

    // English standalone period words
    if (!time) {
        var enPeriod = { 'noon': '12:00', 'midday': '12:00', 'midnight': '00:00' };
        for (var ep in enPeriod) {
            var epRe = new RegExp('\\b' + ep + '\\b', 'i');
            if (epRe.test(working)) {
                time = enPeriod[ep];
                working = working.replace(epRe, ' ');
                confidenceScore += 1;
                break;
            }
        }
    }
    if (!time) {
        var enVagueRe = /\b(morning)\b/i;  var vm = working.match(enVagueRe);
        if (vm) { time = '09:00'; working = working.replace(vm[0], ' '); confidenceScore += 1; }
    }
    if (!time) {
        var afterRe = /\b(afternoon)\b/i;  var am2 = working.match(afterRe);
        if (am2) { time = '14:00'; working = working.replace(am2[0], ' '); confidenceScore += 1; }
    }
    if (!time) {
        var eveRe = /\b(evening)\b/i;  var em = working.match(eveRe);
        if (em) { time = '18:00'; working = working.replace(em[0], ' '); confidenceScore += 1; }
    }

    // ── All-day detection ───────────────────────────────────

    if (!time && !endTime) {
        var allDayRe = /\b(all[- ]?day|全天|whole[- ]?day)\b/i;
        if (allDayRe.test(working)) {
            allDay = true;
            working = working.replace(allDayRe, ' ');
            confidenceScore += 1;
        }
    }

    // ── Title extraction ────────────────────────────────────

    // Strip any remaining Chinese period hints (leftover from complex expressions)
    working = stripOrphanPeriodHints(working);

    // Remove Chinese connecting/measure words that aren't part of the title
    working = working.replace(/\b(一个|一次|一下|某个|的|去|做|要|想|打算|准备|安排|计划)\b/g, ' ');

    // Remove connecting words
    var connectors = /\b(at|on|for|about|from|to|until|till|in|the|a|an|with|every|each|our|my)\b/gi;
    working = working.replace(connectors, ' ');

    // Collapse whitespace and trim
    titleRemaining = working.replace(/\s+/g, ' ').trim();

    // Remove leading/trailing punctuation
    titleRemaining = titleRemaining.replace(/^[^\w一-鿿]+/, '').replace(/[^\w一-鿿]+$/, '');

    // If nothing meaningful remains, use original input as title
    if (!titleRemaining || titleRemaining.length < 2) {
        titleRemaining = input;
        // But strip the date/time we already parsed to make a cleaner title
        if (date) {
            // Re-extract: just use original title pattern more loosely
            titleRemaining = input;
        }
    }

    // ── Confidence ──────────────────────────────────────────

    var confidence;
    if (confidenceScore >= 4) confidence = 'high';
    else if (confidenceScore >= 2) confidence = 'medium';
    else confidence = 'low';

    // Only return if we found something useful
    if (!date && !time && !endTime && !allDay && confidenceScore === 0) {
        // No structured data found — just a bare title
        return { title: titleRemaining || input, date: null, time: null, endTime: null, allDay: false, confidence: 'low' };
    }

    return {
        title: titleRemaining || input,
        date: date,
        time: time,
        endTime: endTime,
        allDay: allDay,
        confidence: confidence
    };
}

/**
 * Map Chinese number word or digit string to integer.
 * Handles: "一"→1, "两"→2, "十"→10, "二十"→20, "半"→0.5, plain digits
 */
function mapCnNumber(str) {
    if (!str) return 0;
    if (/^\d+$/.test(str)) return parseInt(str, 10);
    // Special traditional month names
    if (str === '冬') return 11;
    if (str === '腊') return 12;
    // "初X" prefix → strip and parse
    if (/^初/.test(str)) str = str.replace('初', '');
    // "廿" = 20
    if (str === '廿') return 20;
    if (/^廿/.test(str)) return 20 + mapCnNumber(str.replace('廿', ''));
    var cnDigits = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '两': 2, '半': 0.5 };
    if (str === '十') return 10;
    if (str.length === 1) return cnDigits[str] || 0;
    // "二十" → 20, "十二" → 12, "三十五" → 35
    var total = 0;
    var i = 0;
    while (i < str.length) {
        var ch = str[i];
        if (ch === '十') {
            total = (total === 0 ? 1 : total) * 10;
        } else if (cnDigits[ch]) {
            if (i + 1 < str.length && str[i + 1] === '十') {
                total += cnDigits[ch] * 10;
                i++; // skip '十' on next iteration
            } else {
                total += cnDigits[ch];
            }
        }
        i++;
    }
    return total;
}

/**
 * Parse a time expression like "3pm", "3:00pm", "15:00", "3:00" → "HH:MM"
 */
function parseTimeExpression(str) {
    if (!str) return null;
    str = str.trim().toLowerCase();
    var isPM = str.indexOf('pm') !== -1;
    var isAM = str.indexOf('am') !== -1;
    str = str.replace(/\s*(am|pm)\s*/i, '').trim();

    var parts = str.split(':');
    var hour = parseInt(parts[0], 10);
    var min = parts.length > 1 ? parseInt(parts[1], 10) : 0;

    if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(min) || min < 0 || min > 59) return null;

    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;

    return ('0' + hour).slice(-2) + ':' + ('0' + min).slice(-2);
}

/**
 * Convert Chinese hour (1-12) + period hint to 24-hour "HH:MM".
 */
function cnHourTo24(hour, period) {
    if (hour < 1 || hour > 12) return null;
    var h = hour;
    if (period === '凌晨' || period === '夜里' || period === '深夜') {
        // 凌晨/夜里: 0-6 AM range. 凌晨12点 = midnight (0:00)
        if (h === 12) h = 0;
        // h is already in 0-6 range, keep as-is
    } else if (period === '早上' || period === '上午') {
        if (h === 12) h = 0; // 上午12点 = midnight
    } else if (period === '下午' || period === '晚上' || period === '傍晚') {
        if (h < 12) h += 12;
    } else if (period === '中午') {
        if (h >= 11 && h <= 13) h = 12;
        else if (h < 11) h += 12;
    }
    return ('0' + h).slice(-2) + ':00';
}

/**
 * Scan working text for a Chinese period hint.
 */
function getChinesePeriodHint(text) {
    if (/凌晨|夜里|深夜/.test(text)) return '凌晨';
    if (/早上|上午|白天/.test(text)) return '上午';
    if (/下午/.test(text)) return '下午';
    if (/晚上|傍晚/.test(text)) return '晚上';
    if (/中午/.test(text)) return '中午';
    return '';
}

/**
 * Strip orphan Chinese period hint words left behind after range/time extraction.
 * e.g., "下午 开会" → "开会"
 */
function stripOrphanPeriodHints(text) {
    // \b doesn't work with Chinese chars, so match the words directly
    return text.replace(/(凌晨|早上|上午|白天|中午|下午|晚上|傍晚|夜里|深夜)\s*/g, ' ');
}

/**
 * Add minutes to a "HH:MM" time string, returning a new "HH:MM" string.
 */
function addMinutesToTime(t, mins) {
    var parts = t.split(':');
    var total = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10) + mins;
    var h = Math.floor(total / 60) % 24;
    var m = total % 60;
    return ('0' + h).slice(-2) + ':' + ('0' + m).slice(-2);
}

/** Escape HTML entities for safe preview rendering. */
// ── AI-Powered NL Parsing (REQ-NL-001, optional) ────────────

/**
 * Call an OpenAI-compatible chat completions API to parse natural language
 * event text into structured fields. Returns the same format as
 * parseNaturalLanguage(), or null on failure.
 *
 * The API key and endpoint are read from plugin settings (data.json, gitignored).
 * Only the user-typed quick-create text is sent — no calendar data.
 */
async function callAIForParsing(text, settings, refDate, signal) {
    if (!settings || !settings.aiEndpoint || !settings.aiApiKey) return null;

    var todayStr = (refDate || window.moment()).format('YYYY-MM-DD');

    // Compact system prompt — every token costs time
    var systemPrompt = [
        'Parse event text to JSON. Today=' + todayStr + '.',
        'Fields: title(string), date(string|null YYYY-MM-DD), time(string|null HH:MM), endTime(string|null HH:MM), allDay(boolean), confidence("high"|"medium"|"low").',
        'EN: morning=09:00 afternoon=14:00 evening=18:00 noon=12:00.',
        'ZH: 早上/上午=09:00 中午=12:00 下午=14:00 晚上=19:00 凌晨=03:00.',
        'ZH: 明天=' + todayStr + '+1day. If duration→compute endTime. No time→null.',
        'Output ONLY JSON.',
    ].join(' ');

    // Timeout: 10s for the whole request
    var timeoutMs = 10000;
    var controller = new AbortController();
    var timeoutId = setTimeout(function() { controller.abort(); }, timeoutMs);

    // If caller provided a signal, link it
    if (signal) {
        signal.addEventListener('abort', function() { controller.abort(); });
    }

    try {
        var t0 = Date.now();
        var resp = await fetch(settings.aiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + settings.aiApiKey,
            },
            body: JSON.stringify({
                model: settings.aiModel || 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text },
                ],
                temperature: 0,
                max_tokens: 256,
                response_format: { type: "json_object" },
            }),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        var elapsed = Date.now() - t0;
        console.log('[Calendian] AI responded in ' + elapsed + 'ms');

        var respText = await resp.text();
        if (!resp.ok) {
            console.log('[Calendian] AI HTTP ' + resp.status + ': ' + respText.substring(0, 300));
            return null;
        }

        var data;
        try {
            data = JSON.parse(respText);
        } catch (jsonErr) {
            console.log('[Calendian] AI response is not valid JSON: ' + respText.substring(0, 500));
            return null;
        }

        var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (!content) {
            console.log('[Calendian] AI empty content. Response:', JSON.stringify(data).substring(0, 500));
            return null;
        }

        // Extract JSON object from content
        var jsonStr = content.trim();
        // Strip markdown fences
        var fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fenceMatch && fenceMatch[1].trim()) jsonStr = fenceMatch[1].trim();
        // Fallback: find first { ... }
        if (!/^\s*\{/.test(jsonStr)) {
            var braceMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (braceMatch) jsonStr = braceMatch[0];
        }

        if (!jsonStr) {
            console.log('[Calendian] AI no JSON in content:', content.substring(0, 200));
            return null;
        }

        var parsed = JSON.parse(jsonStr);
        console.log('[Calendian] AI OK (' + elapsed + 'ms):', jsonStr.substring(0, 200));

        var result = {
            title: parsed.title || text,
            date: parsed.date ? window.moment(parsed.date, 'YYYY-MM-DD') : null,
            time: parsed.time || null,
            endTime: parsed.endTime || null,
            allDay: !!parsed.allDay,
            confidence: parsed.confidence || 'high',
            _aiParsed: true,
            _aiRawJson: jsonStr,
        };

        if (result.date && !result.date.isValid()) result.date = null;
        return result;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            console.log('[Calendian] AI request aborted (timeout or cancelled)');
        } else {
            console.log('[Calendian] AI parsing failed:', err.message || err);
        }
        return null;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Format "HH:MM" string for display in preview. */
function formatTimeHM(t) {
    if (!t) return '';
    var parts = t.split(':');
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12 || 12;
    return h12 + ':' + ('0' + m).slice(-2) + ' ' + ampm;
}

// ═══════════════════════════════════════════════════════════════

class EventCreateModal extends obsidian.Modal {
    constructor(app, macosIntegration, prefill) {
        super(app);
        this.integ = macosIntegration;
        this.prefill = prefill || null;
    }

    onOpen() {
        var self = this;
        var integ = this.integ;
        var selDate = integ.selectedDate ? integ.selectedDate.clone() : window.moment();
        var pf = this.prefill;

        // Determine prefill values
        var pfTitle = (pf && pf.title) ? pf.title : '';
        var pfDate = (pf && pf.date) ? pf.date.clone() : selDate.clone();
        var pfTime = (pf && pf.time) ? pf.time : '';
        var pfEndTime = (pf && pf.endTime) ? pf.endTime : '';
        var pfAllDay = (pf && pf.allDay) ? true : false;

        this.titleEl.setText(pfTitle ? "Create Event — " + pfTitle : "Create Event");

        // ── Title ──────────────────────────────────────────
        var titleSetting = new obsidian.Setting(this.contentEl)
            .setName("Title")
            .setDesc("Event name (required)");
        var titleInput;
        titleSetting.addText(function(cmp) {
            titleInput = cmp.inputEl;
            cmp.setPlaceholder("e.g. Meeting with team");
            if (pfTitle) cmp.setValue(pfTitle);
        });

        // ── All-day toggle ────────────────────────────────
        var allDayToggle;
        new obsidian.Setting(this.contentEl)
            .setName("All-day event")
            .addToggle(function(cmp) {
                allDayToggle = cmp;
                if (pfAllDay) cmp.setValue(true);
            });

        // ── Start date ────────────────────────────────────
        var startDateInput;
        new obsidian.Setting(this.contentEl)
            .setName("Start date")
            .setDesc("YYYY-MM-DD")
            .addText(function(cmp) {
                startDateInput = cmp.inputEl;
                cmp.setValue(pfDate.format("YYYY-MM-DD"));
            });

        // ── Start time ────────────────────────────────────
        var startTimeInput;
        new obsidian.Setting(this.contentEl)
            .setName("Start time")
            .setDesc("HH:MM (ignored if all-day)")
            .addText(function(cmp) {
                startTimeInput = cmp.inputEl;
                if (pfTime) cmp.setValue(pfTime);
                else cmp.setPlaceholder("e.g. 14:00");
            });

        // ── End date ──────────────────────────────────────
        var endDateInput;
        new obsidian.Setting(this.contentEl)
            .setName("End date")
            .setDesc("YYYY-MM-DD")
            .addText(function(cmp) {
                endDateInput = cmp.inputEl;
                cmp.setValue(pfDate.format("YYYY-MM-DD"));
            });

        // ── End time ──────────────────────────────────────
        var endTimeInput;
        new obsidian.Setting(this.contentEl)
            .setName("End time")
            .setDesc("HH:MM (ignored if all-day)")
            .addText(function(cmp) {
                endTimeInput = cmp.inputEl;
                if (pfEndTime) cmp.setValue(pfEndTime);
                else cmp.setPlaceholder("e.g. 15:00");
            });

        // ── Calendar ──────────────────────────────────────
        var calendarSelect = null;
        var calendarsReady = false;
        var calendarSetting = new obsidian.Setting(this.contentEl)
            .setName("Calendar")
            .setDesc("Loading calendars...");
        integ.discoverCalendars().then(function(cals) {
            calendarSetting.addDropdown(function(cmp) {
                calendarSelect = cmp;
                for (var i = 0; i < cals.length; i++) {
                    cmp.addOption(cals[i].id, cals[i].name);
                }
                // Default calendar: use setting if set, otherwise prefer Outlook
                if (cals.length > 0) {
                    var defaultId = cals[0].id;
                    var prefId = (integ.plugin.options && integ.plugin.options.defaultCalendarId) || '';
                    if (prefId) {
                        // Use user's saved preference if it still exists
                        for (var j = 0; j < cals.length; j++) {
                            if (cals[j].id === prefId) { defaultId = prefId; break; }
                        }
                    } else {
                        // Auto-detect: prefer Outlook account calendars
                        for (var j = 0; j < cals.length; j++) {
                            if (cals[j].accountHint && cals[j].accountHint.toLowerCase().indexOf('outlook') !== -1) {
                                defaultId = cals[j].id;
                                break;
                            }
                        }
                    }
                    cmp.setValue(defaultId);
                }
            });
            calendarSetting.setDesc(cals.length > 0 ? "Choose a calendar" : "No calendars found");
            calendarsReady = true;
        }).catch(function() {
            calendarSetting.setDesc("Failed to load calendars");
            calendarsReady = true;
        });

        // ── Location (optional) ───────────────────────────
        var locationInput;
        new obsidian.Setting(this.contentEl)
            .setName("Location")
            .addText(function(cmp) {
                locationInput = cmp.inputEl;
                cmp.setPlaceholder("Optional");
            });

        // ── URL (optional) ────────────────────────────────
        var urlInput;
        new obsidian.Setting(this.contentEl)
            .setName("URL")
            .addText(function(cmp) {
                urlInput = cmp.inputEl;
                cmp.setPlaceholder("Optional");
            });

        // ── Notes (optional) ──────────────────────────────
        var notesInput;
        new obsidian.Setting(this.contentEl)
            .setName("Notes")
            .addTextArea(function(cmp) {
                notesInput = cmp.inputEl;
                cmp.setPlaceholder("Optional");
            });

        // ── Buttons ───────────────────────────────────────
        var errorEl = this.contentEl.createDiv("calendian-form-error");
        errorEl.style.display = "none";

        new obsidian.Setting(this.contentEl)
            .addButton(function(btn) {
                btn.setButtonText("Create")
                    .setCta()
                    .onClick(async function() {
                        var title = (titleInput.value || "").trim();
                        var startDateStr = (startDateInput.value || "").trim();
                        var endDateStr = (endDateInput.value || "").trim();
                        var startTimeStr = (startTimeInput.value || "").trim();
                        var endTimeStr = (endTimeInput.value || "").trim();
                        var isAllDay = allDayToggle.getValue();
                        var calendarId = calendarSelect ? calendarSelect.getValue() : "";
                        var location = (locationInput.value || "").trim();
                        var url = (urlInput.value || "").trim();
                        var notes = (notesInput.value || "").trim();

                        // Validate
                        if (!title) {
                            errorEl.textContent = "Title is required.";
                            errorEl.style.display = "block";
                            return;
                        }
                        if (!calendarId) {
                            errorEl.textContent = "Please select a calendar.";
                            errorEl.style.display = "block";
                            return;
                        }

                        // Build ISO dates
                        var startMoment;
                        var endMoment;
                        if (startTimeStr) {
                            startMoment = window.moment(startDateStr + " " + startTimeStr, "YYYY-MM-DD HH:mm");
                        } else {
                            startMoment = window.moment(startDateStr, "YYYY-MM-DD");
                        }
                        if (endTimeStr) {
                            endMoment = window.moment(endDateStr + " " + endTimeStr, "YYYY-MM-DD HH:mm");
                        } else {
                            endMoment = window.moment(endDateStr, "YYYY-MM-DD").endOf("day");
                        }

                        if (!startMoment.isValid()) {
                            errorEl.textContent = "Invalid start date/time.";
                            errorEl.style.display = "block";
                            return;
                        }
                        if (!endMoment.isValid()) {
                            errorEl.textContent = "Invalid end date/time.";
                            errorEl.style.display = "block";
                            return;
                        }
                        // Strip fractional seconds — ISO8601DateFormatter in Swift
                        // does not parse .000Z by default (see preloadAll pattern)
                        var startISO = startMoment.toISOString().replace(/\.\d{3}Z$/, 'Z');
                        var endISO = endMoment.toISOString().replace(/\.\d{3}Z$/, 'Z');

                        var args = ["create-event", title, startISO, endISO, calendarId, isAllDay ? "true" : "false"];
                        args.push(location || "");  // always push to preserve position
                        args.push(notes || "");     // always push to preserve position
                        args.push(url || "");       // always push to preserve position

                        try {
                            var result = await integ.execHelper(args);
                            if (result && result.ok) {
                                new obsidian.Notice("Event created: " + title);
                                console.log("[Calendian] Created event: " + title + " (id=" + result.id + ")");
                                integ.init(true);
                                self.close();
                            } else {
                                errorEl.textContent = "Failed to create event.";
                                errorEl.style.display = "block";
                            }
                        } catch (err) {
                            var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                            console.error("[Calendian] Event creation failed:", errMsg);
                            errorEl.textContent = "Error: " + errMsg;
                            errorEl.style.display = "block";
                        }
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("Cancel")
                    .onClick(function() { self.close(); });
            });
    }
}

// ── Event Edit Modal (v0.4, REQ-WRITE-011) ────────────────────────────────

class EventEditModal extends obsidian.Modal {
    constructor(app, macosIntegration, event) {
        super(app);
        this.integ = macosIntegration;
        this.event = event; // CalendianEvent from cache
    }

    onOpen() {
        var self = this;
        var integ = this.integ;
        var evt = this.event;

        this.titleEl.setText("Edit Event");

        // ── Title (pre-filled) ─────────────────────────
        var titleInput;
        new obsidian.Setting(this.contentEl)
            .setName("Title")
            .setDesc("Event name (required)")
            .addText(function(cmp) {
                titleInput = cmp.inputEl;
                cmp.setValue(evt.title || "");
            });

        // ── All-day toggle (pre-filled) ────────────────
        var allDayToggle;
        new obsidian.Setting(this.contentEl)
            .setName("All-day event")
            .addToggle(function(cmp) {
                allDayToggle = cmp;
                cmp.setValue(evt.isAllDay || false);
            });

        // ── Start date/time (pre-filled) ───────────────
        var startDateInput, startTimeInput, endDateInput, endTimeInput;
        var startMoment = evt.start ? window.moment(evt.start) : window.moment();
        var endMoment = evt.end ? window.moment(evt.end) : window.moment();

        new obsidian.Setting(this.contentEl)
            .setName("Start date").setDesc("YYYY-MM-DD")
            .addText(function(cmp) {
                startDateInput = cmp.inputEl;
                cmp.setValue(startMoment.format("YYYY-MM-DD"));
            });
        new obsidian.Setting(this.contentEl)
            .setName("Start time").setDesc("HH:MM (ignored if all-day)")
            .addText(function(cmp) {
                startTimeInput = cmp.inputEl;
                cmp.setValue(evt.isAllDay ? "" : startMoment.format("HH:mm"));
            });
        new obsidian.Setting(this.contentEl)
            .setName("End date").setDesc("YYYY-MM-DD")
            .addText(function(cmp) {
                endDateInput = cmp.inputEl;
                cmp.setValue(endMoment.format("YYYY-MM-DD"));
            });
        new obsidian.Setting(this.contentEl)
            .setName("End time").setDesc("HH:MM (ignored if all-day)")
            .addText(function(cmp) {
                endTimeInput = cmp.inputEl;
                cmp.setValue(evt.isAllDay ? "" : endMoment.format("HH:mm"));
            });

        // ── Calendar dropdown (pre-selected) ───────────
        var calendarSelect = null;
        var calendarSetting = new obsidian.Setting(this.contentEl)
            .setName("Calendar")
            .setDesc("Loading calendars...");
        integ.discoverCalendars().then(function(cals) {
            calendarSetting.addDropdown(function(cmp) {
                calendarSelect = cmp;
                for (var i = 0; i < cals.length; i++) {
                    cmp.addOption(cals[i].id, cals[i].name);
                }
                // Pre-select the event's current calendar
                if (evt.calendarId) {
                    cmp.setValue(evt.calendarId);
                } else if (cals.length > 0) {
                    cmp.setValue(cals[0].id);
                }
            });
            calendarSetting.setDesc(cals.length > 0 ? "Choose a calendar" : "No calendars found");
        }).catch(function() {
            calendarSetting.setDesc("Failed to load calendars");
        });

        // ── Location, URL, Notes (pre-filled) ──────────
        var locationInput, urlInput, notesInput;
        new obsidian.Setting(this.contentEl)
            .setName("Location")
            .addText(function(cmp) {
                locationInput = cmp.inputEl;
                cmp.setValue(evt.location || "");
            });
        new obsidian.Setting(this.contentEl)
            .setName("URL")
            .addText(function(cmp) {
                urlInput = cmp.inputEl;
                cmp.setValue(evt.url || "");
            });
        new obsidian.Setting(this.contentEl)
            .setName("Notes")
            .addTextArea(function(cmp) {
                notesInput = cmp.inputEl;
                cmp.setValue(evt.notes || "");
            });

        // ── Buttons: Save / Cancel ──────────────────────
        var errorEl = this.contentEl.createDiv("calendian-form-error");
        errorEl.style.display = "none";

        new obsidian.Setting(this.contentEl)
            .addButton(function(btn) {
                btn.setButtonText("Save")
                    .setCta()
                    .onClick(async function() {
                        var title = (titleInput.value || "").trim();
                        var startDateStr = (startDateInput.value || "").trim();
                        var endDateStr = (endDateInput.value || "").trim();
                        var startTimeStr = (startTimeInput.value || "").trim();
                        var endTimeStr = (endTimeInput.value || "").trim();
                        var isAllDay = allDayToggle.getValue();
                        var calendarId = calendarSelect ? calendarSelect.getValue() : "";
                        var location = (locationInput.value || "").trim();
                        var url = (urlInput.value || "").trim();
                        var notes = (notesInput.value || "").trim();

                        // Validate
                        if (!title) {
                            errorEl.textContent = "Title is required.";
                            errorEl.style.display = "block";
                            return;
                        }
                        if (!calendarId) {
                            errorEl.textContent = "Please select a calendar.";
                            errorEl.style.display = "block";
                            return;
                        }

                        // Build dates (same pattern as EventCreateModal)
                        var startMoment2, endMoment2;
                        if (startTimeStr) {
                            startMoment2 = window.moment(startDateStr + " " + startTimeStr, "YYYY-MM-DD HH:mm");
                        } else {
                            startMoment2 = window.moment(startDateStr, "YYYY-MM-DD");
                        }
                        if (endTimeStr) {
                            endMoment2 = window.moment(endDateStr + " " + endTimeStr, "YYYY-MM-DD HH:mm");
                        } else {
                            endMoment2 = window.moment(endDateStr, "YYYY-MM-DD").endOf("day");
                        }

                        if (!startMoment2.isValid()) {
                            errorEl.textContent = "Invalid start date/time.";
                            errorEl.style.display = "block";
                            return;
                        }
                        if (!endMoment2.isValid()) {
                            errorEl.textContent = "Invalid end date/time.";
                            errorEl.style.display = "block";
                            return;
                        }

                        try {
                            var result = await integ.editEvent(evt, {
                                title: title,
                                startDate: startMoment2.toDate(),
                                endDate: endMoment2.toDate(),
                                calendarId: calendarId,
                                isAllDay: isAllDay,
                                location: location,
                                notes: notes,
                                url: url
                            });
                            if (result && result.ok) {
                                new obsidian.Notice("Event updated");
                                console.log("[Calendian] Updated event (id=" + evt.id + ")");
                                integ.init(true);
                                self.close();
                            } else {
                                errorEl.textContent = "Failed to update event.";
                                errorEl.style.display = "block";
                            }
                        } catch (err) {
                            var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                            console.error("[Calendian] Event update failed:", errMsg);
                            errorEl.textContent = "Error: " + errMsg;
                            errorEl.style.display = "block";
                        }
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("Cancel")
                    .onClick(function() { self.close(); });
            });
    }
}

// ── Quick Event Modal (NL parsing, REQ-NL-001..005) ─────────

class QuickEventModal extends obsidian.Modal {
    constructor(app, macosIntegration) {
        super(app);
        this.integ = macosIntegration;
        this._parsedResult = null;
    }

    onOpen() {
        var self = this;
        var integ = this.integ;
        var refDate = integ.selectedDate ? integ.selectedDate.clone() : window.moment();

        var aiEnabled = !!(integ.plugin.options && integ.plugin.options.aiParsingEnabled && integ.plugin.options.aiEndpoint && integ.plugin.options.aiApiKey);
        this.titleEl.setText("Quick Create");
        this.titleEl.createEl("span", {
            text: aiEnabled ? " — type + Enter for AI ✨" : " — e.g. \"tomorrow 3pm meeting\"",
            cls: "calendian-quick-hint"
        });

        // ── NL text input ───────────────────────────────────
        var inputEl = this.contentEl.createEl("input", {
            type: "text",
            placeholder: "e.g. tomorrow 3pm meeting with Sarah",
            cls: "calendian-quick-input"
        });
        inputEl.style.width = "100%";
        inputEl.style.padding = "8px";
        inputEl.style.fontSize = "14px";
        inputEl.style.marginBottom = "8px";
        inputEl.style.borderRadius = "4px";
        inputEl.style.border = "1px solid var(--background-modifier-border)";
        inputEl.style.backgroundColor = "var(--background-primary)";
        inputEl.style.color = "var(--text-normal)";

        // ── Preview area ────────────────────────────────────
        var previewEl = this.contentEl.createDiv("calendian-quick-preview");
        previewEl.style.minHeight = "60px";
        previewEl.style.padding = "10px";
        previewEl.style.marginBottom = "8px";
        previewEl.style.borderRadius = "4px";
        previewEl.style.backgroundColor = "var(--background-secondary)";
        previewEl.style.fontSize = "13px";
        previewEl.style.display = "none";

        // ── Error / hint area ───────────────────────────────
        var errorEl = this.contentEl.createDiv("calendian-form-error");
        errorEl.style.display = "none";

        // ── Parsing state ─────────────────────────────────────
        // Two-tier: regex runs live (free), AI runs on-demand (Enter key).
        // _parsedResult = latest regex result (always reflects current text).
        // _aiResult = AI result (set by Enter, cleared when text changes).
        // Preview shows _aiResult if available, else _parsedResult.
        // Buttons use _aiResult if available, else _parsedResult.

        var parseTimer = null;
        self._parsedResult = null;
        self._aiResult = null;

        var doRegexParse = function(text) {
            var result = parseNaturalLanguage(text, refDate);
            self._parsedResult = result;
            // Only show regex result if no AI result is active
            if (!self._aiResult) {
                if (result) {
                    self._renderPreview(previewEl, result, integ);
                } else {
                    previewEl.style.display = 'none';
                }
            }
        };

        var showCurrentResult = function() {
            var r = self._aiResult || self._parsedResult;
            if (r) {
                self._renderPreview(previewEl, r, integ);
            } else {
                previewEl.style.display = 'none';
            }
        };

        // ── Cancel in-flight AI request when user types ─────
        var aiAbortController = null;
        var aiRunning = false;

        inputEl.addEventListener('input', function() {
            var text = inputEl.value.trim();
            if (!text) {
                previewEl.style.display = 'none';
                self._parsedResult = null;
                self._aiResult = null;
                return;
            }
            // Cancel any in-flight AI request — text has changed
            if (aiAbortController) {
                aiAbortController.abort();
                aiAbortController = null;
                aiRunning = false;
            }
            // Any new typing invalidates the AI result (it was for old text)
            if (self._aiResult) {
                self._aiResult = null;
            }
            if (parseTimer) clearTimeout(parseTimer);
            parseTimer = setTimeout(function() {
                doRegexParse(text);
            }, 300);
        });

        // ── Enter key → AI parse (only when enabled & configured) ─
        inputEl.addEventListener('keydown', async function(e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (aiRunning) return; // prevent concurrent requests from rapid Enter
            var text = inputEl.value.trim();
            if (!text) return;

            var opts = integ.plugin.options || {};
            var useAI = !!(opts.aiParsingEnabled && opts.aiEndpoint && opts.aiApiKey);
            if (!useAI) return; // no AI configured, Enter does nothing extra

            // Show AI parsing indicator immediately
            previewEl.style.display = 'block';
            previewEl.innerHTML = '<div style="color:var(--text-muted);font-style:italic">🤖 AI parsing...</div>';

            // Create abort controller — cancelled if user types during request
            aiAbortController = new AbortController();
            aiRunning = true;
            var aiSignal = aiAbortController.signal;

            try {
                var aiResult = await callAIForParsing(text, {
                    aiEndpoint: opts.aiEndpoint,
                    aiApiKey: opts.aiApiKey,
                    aiModel: opts.aiModel || 'deepseek-chat',
                }, refDate, aiSignal);
                if (aiResult) {
                    self._aiResult = aiResult;
                    self._parsedResult = aiResult;
                    self._renderPreview(previewEl, aiResult, integ);
                    aiRunning = false;
                    aiAbortController = null;
                    return;
                }
            } catch (err) {
                // Error already logged in callAIForParsing
            }
            aiRunning = false;
            aiAbortController = null;

            // AI failed/aborted — fall back to regex
            self._aiResult = null;
            doRegexParse(text);
        });

        // Focus the input
        setTimeout(function() { inputEl.focus(); }, 50);

        // ── Buttons ─────────────────────────────────────────
        new obsidian.Setting(this.contentEl)
            .addButton(function(btn) {
                btn.setButtonText("→ Event")
                    .setCta()
                    .onClick(function() {
                        var prefill = self._getOrParse(inputEl, refDate);
                        if (!prefill) return;
                        if (!prefill.date) prefill.date = refDate.clone();
                        self.close();
                        new EventCreateModal(integ.plugin.app, integ, prefill).open();
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("→ Reminder")
                    .onClick(function() {
                        var prefill = self._getOrParse(inputEl, refDate);
                        if (!prefill) return;
                        self.close();
                        new ReminderCreateModal(integ.plugin.app, integ, prefill).open();
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("Manual")
                    .onClick(function() {
                        self.close();
                        new EventCreateModal(integ.plugin.app, integ).open();
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("Cancel")
                    .onClick(function() { self.close(); });
            });
    }

    _getOrParse(inputEl, refDate) {
        var prefill = this._parsedResult;
        if (!prefill || !prefill.title) {
            var text = inputEl.value.trim();
            if (text) {
                prefill = parseNaturalLanguage(text, refDate);
                this._parsedResult = prefill;
            }
        }
        if (!prefill || !prefill.title) {
            var errorEl = this.contentEl.querySelector('.calendian-form-error');
            if (errorEl) {
                errorEl.textContent = 'Please enter a description (e.g. "tomorrow 3pm meeting").';
                errorEl.style.display = 'block';
            }
            return null;
        }
        return prefill;
    }

    _renderPreview(el, result, integ) {
        el.empty();
        el.style.display = 'block';

        var rows = [];

        // Title
        if (result.title) {
            rows.push('<span class="calendian-preview-label">Title:</span> ' + escapeHtml(result.title));
        }

        // Date
        if (result.date) {
            rows.push('<span class="calendian-preview-label">Date:</span> ' + result.date.format('dddd, MMM D, YYYY'));
        } else {
            rows.push('<span class="calendian-preview-label">Date:</span> <em>(no date parsed — will use selected date)</em>');
        }

        // Time
        if (result.time) {
            var timeStr = formatTimeHM(result.time);
            if (result.endTime) {
                timeStr += ' → ' + formatTimeHM(result.endTime);
            }
            rows.push('<span class="calendian-preview-label">Time:</span> ' + timeStr);
        } else if (!result.allDay) {
            rows.push('<span class="calendian-preview-label">Time:</span> <em>(no time — will be all-day or start-of-day)</em>');
        }

        // All-day
        if (result.allDay) {
            rows.push('<span class="calendian-preview-label">Type:</span> All-day');
        }

        // Source + Confidence
        var sourceBadge = result._aiParsed ? '🤖 AI · ' : '📋 Regex · ';
        var confBadge = '';
        if (result.confidence === 'high') confBadge = '🟢 high';
        else if (result.confidence === 'medium') confBadge = '🟡 medium';
        else confBadge = '🔴 low';
        rows.push('<span class="calendian-preview-label">Parse:</span> ' + sourceBadge + confBadge);

        el.innerHTML = rows.map(function(r) {
            return '<div style="margin-bottom:3px;line-height:1.5">' + r + '</div>';
        }).join('');

        // ── Raw AI output (collapsible, for debugging) ─────
        if (result._aiRawJson) {
            var rawContainer = el.createDiv();
            rawContainer.style.marginTop = '8px';

            var toggle = rawContainer.createEl('button', {
                text: '🔍 Show AI raw output',
                cls: 'calendian-raw-toggle'
            });
            toggle.style.cssText = 'font-size:0.75em;padding:2px 8px;border:1px solid var(--background-modifier-border);border-radius:3px;background:var(--background-primary);color:var(--text-muted);cursor:pointer;';

            var rawContent = rawContainer.createDiv();
            rawContent.style.cssText = 'display:none;margin-top:4px;padding:6px 8px;background:var(--background-primary-alt);border-radius:3px;font-family:monospace;font-size:0.75em;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow-y:auto;';
            rawContent.textContent = result._aiRawJson;

            toggle.addEventListener('click', function() {
                if (rawContent.style.display === 'none') {
                    rawContent.style.display = 'block';
                    toggle.textContent = '🔍 Hide AI raw output';
                } else {
                    rawContent.style.display = 'none';
                    toggle.textContent = '🔍 Show AI raw output';
                }
            });
        }
    }
}

// ── Reminder Create Modal ──────────────────────────────────

class ReminderCreateModal extends obsidian.Modal {
    constructor(app, macosIntegration, prefill) {
        super(app);
        this.integ = macosIntegration;
        this.prefill = prefill || null;
    }

    onOpen() {
        var self = this;
        var integ = this.integ;
        var selDate = integ.selectedDate ? integ.selectedDate.clone() : window.moment();
        var pf = this.prefill;

        var pfTitle = (pf && pf.title) ? pf.title : '';
        var pfDate = (pf && pf.date) ? pf.date.clone() : null;
        var pfTime = (pf && pf.time) ? pf.time : '';

        this.titleEl.setText(pfTitle ? "Create Reminder — " + pfTitle : "Create Reminder");

        // ── Title ──────────────────────────────────────────
        var titleInput;
        new obsidian.Setting(this.contentEl)
            .setName("Title")
            .setDesc("Reminder text (required)")
            .addText(function(cmp) {
                titleInput = cmp.inputEl;
                if (pfTitle) cmp.setValue(pfTitle);
                cmp.setPlaceholder("e.g. Buy groceries");
            });

        // ── List ───────────────────────────────────────────
        var listSelect = null;
        var listsReady = false;
        var listSetting = new obsidian.Setting(this.contentEl)
            .setName("List")
            .setDesc("Loading lists...");
        integ.discoverReminderLists().then(function(lists) {
            listSetting.addDropdown(function(cmp) {
                listSelect = cmp;
                for (var i = 0; i < lists.length; i++) {
                    cmp.addOption(lists[i].id, lists[i].name);
                }
                // Default list: use setting if set, otherwise prefer Outlook "任务"
                if (lists.length > 0) {
                    var defaultId = lists[0].id;
                    var prefId = (integ.plugin.options && integ.plugin.options.defaultReminderListId) || '';
                    if (prefId) {
                        // Use user's saved preference if it still exists
                        for (var j = 0; j < lists.length; j++) {
                            if (lists[j].id === prefId) { defaultId = prefId; break; }
                        }
                    } else {
                        // Auto-detect: prefer Outlook account's "任务" list
                        for (var j = 0; j < lists.length; j++) {
                            var acc = (lists[j].accountHint || "").toLowerCase();
                            var rName = (lists[j].rawName || lists[j].name || "").toLowerCase();
                            if (acc.indexOf('outlook') !== -1 && rName.indexOf('任务') !== -1) {
                                defaultId = lists[j].id;
                                break;
                            }
                        }
                        // Fallback: any Outlook list
                        if (defaultId === lists[0].id) {
                            for (var k = 0; k < lists.length; k++) {
                                if ((lists[k].accountHint || "").toLowerCase().indexOf('outlook') !== -1) {
                                    defaultId = lists[k].id;
                                    break;
                                }
                            }
                        }
                    }
                    cmp.setValue(defaultId);
                }
            });
            listSetting.setDesc(lists.length > 0 ? "Choose a reminder list" : "No lists found");
            listsReady = true;
        }).catch(function() {
            listSetting.setDesc("Failed to load lists");
            listsReady = true;
        });

        // ── Due date ──────────────────────────────────────
        var dueDateInput;
        new obsidian.Setting(this.contentEl)
            .setName("Due date")
            .setDesc("YYYY-MM-DD (optional — defaults to none)")
            .addText(function(cmp) {
                dueDateInput = cmp.inputEl;
                if (pfDate) cmp.setValue(pfDate.format("YYYY-MM-DD"));
                else cmp.setPlaceholder("e.g. " + selDate.format("YYYY-MM-DD"));
            });

        // ── Due time ──────────────────────────────────────
        var dueTimeInput;
        new obsidian.Setting(this.contentEl)
            .setName("Due time")
            .setDesc("HH:MM (optional)")
            .addText(function(cmp) {
                dueTimeInput = cmp.inputEl;
                if (pfTime) cmp.setValue(pfTime);
                else cmp.setPlaceholder("e.g. 14:00");
            });

        // ── Priority ──────────────────────────────────────
        var prioritySelect;
        new obsidian.Setting(this.contentEl)
            .setName("Priority")
            .addDropdown(function(cmp) {
                prioritySelect = cmp;
                cmp.addOption("none", "None");
                cmp.addOption("low", "Low");
                cmp.addOption("medium", "Medium");
                cmp.addOption("high", "High");
                cmp.setValue("none");
            });

        // ── Notes ──────────────────────────────────────────
        var notesInput;
        new obsidian.Setting(this.contentEl)
            .setName("Notes")
            .addTextArea(function(cmp) {
                notesInput = cmp.inputEl;
                cmp.setPlaceholder("Optional");
            });

        // ── Buttons ───────────────────────────────────────
        var errorEl = this.contentEl.createDiv("calendian-form-error");
        errorEl.style.display = "none";

        new obsidian.Setting(this.contentEl)
            .addButton(function(btn) {
                btn.setButtonText("Create")
                    .setCta()
                    .onClick(async function() {
                        var title = (titleInput.value || "").trim();
                        var listId = listSelect ? listSelect.getValue() : "";
                        var dueDateStr = (dueDateInput.value || "").trim();
                        var dueTimeStr = (dueTimeInput.value || "").trim();
                        var priority = prioritySelect ? prioritySelect.getValue() : "none";
                        var notes = (notesInput.value || "").trim();

                        if (!title) {
                            errorEl.textContent = "Title is required.";
                            errorEl.style.display = "block";
                            return;
                        }
                        if (!listId) {
                            errorEl.textContent = "Please select a reminder list.";
                            errorEl.style.display = "block";
                            return;
                        }

                        // Build args for create-reminder
                        var args = ["create-reminder", title, listId];

                        // Add due date if provided and valid
                        if (dueDateStr) {
                            var dueMoment = window.moment(dueDateStr, "YYYY-MM-DD");
                            if (dueMoment.isValid()) {
                                args.push(dueMoment.toISOString().replace(/\.\d{3}Z$/, 'Z'));
                            } else {
                                errorEl.textContent = "Invalid due date format. Use YYYY-MM-DD.";
                                errorEl.style.display = "block";
                                return;
                            }
                        } else {
                            args.push("");  // no due date
                        }

                        args.push(dueTimeStr || "");     // dueTime  (always push to preserve position)
                        args.push(priority || "none");      // priority (always push to preserve position)
                        args.push(notes || "");             // notes    (always push to preserve position)

                        try {
                            var result = await integ.execHelper(args);
                            if (result && result.ok) {
                                new obsidian.Notice("Reminder created: " + title);
                                console.log("[Calendian] Created reminder: " + title + " (id=" + result.id + ")");
                                integ.init(true);
                                self.close();
                            } else {
                                errorEl.textContent = "Failed to create reminder.";
                                errorEl.style.display = "block";
                            }
                        } catch (err) {
                            var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                            console.error("[Calendian] Reminder creation failed:", errMsg);
                            errorEl.textContent = "Error: " + errMsg;
                            errorEl.style.display = "block";
                        }
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("Cancel")
                    .onClick(function() { self.close(); });
            });
    }
}

// ── Reminder Edit Modal (v0.4, REQ-WRITE-017) ──────────────────────────────

class ReminderEditModal extends obsidian.Modal {
    constructor(app, macosIntegration, reminder) {
        super(app);
        this.integ = macosIntegration;
        this.reminder = reminder; // CalendianReminder from cache
    }

    onOpen() {
        var self = this;
        var integ = this.integ;
        var rem = this.reminder;

        this.titleEl.setText("Edit Reminder");

        // ── Title (pre-filled) ─────────────────────────
        var titleInput;
        new obsidian.Setting(this.contentEl)
            .setName("Title")
            .setDesc("Reminder name (required)")
            .addText(function(cmp) {
                titleInput = cmp.inputEl;
                cmp.setValue(rem.title || "");
            });

        // ── List dropdown (pre-selected) ───────────────
        var listSelect = null;
        var listSetting = new obsidian.Setting(this.contentEl)
            .setName("List")
            .setDesc("Loading lists...");
        integ.discoverReminderLists().then(function(lists) {
            listSetting.addDropdown(function(cmp) {
                listSelect = cmp;
                for (var i = 0; i < lists.length; i++) {
                    cmp.addOption(lists[i].id, lists[i].name);
                }
                // Pre-select the reminder's current list
                if (rem.listId) {
                    cmp.setValue(rem.listId);
                } else if (lists.length > 0) {
                    cmp.setValue(lists[0].id);
                }
            });
            listSetting.setDesc(lists.length > 0 ? "Choose a list" : "No lists found");
        }).catch(function() {
            listSetting.setDesc("Failed to load lists");
        });

        // ── Due date (pre-filled) ──────────────────────
        var dueDateInput, dueTimeInput;
        var dueMoment = rem.due ? window.moment(rem.due) : null;
        new obsidian.Setting(this.contentEl)
            .setName("Due date")
            .setDesc("YYYY-MM-DD (optional)")
            .addText(function(cmp) {
                dueDateInput = cmp.inputEl;
                if (dueMoment && dueMoment.isValid()) {
                    cmp.setValue(dueMoment.format("YYYY-MM-DD"));
                }
            });
        new obsidian.Setting(this.contentEl)
            .setName("Due time")
            .setDesc("HH:MM (optional)")
            .addText(function(cmp) {
                dueTimeInput = cmp.inputEl;
                if (dueMoment && dueMoment.isValid()) {
                    cmp.setValue(dueMoment.format("HH:mm"));
                }
            });

        // ── Priority (pre-selected) ────────────────────
        var prioritySelect;
        new obsidian.Setting(this.contentEl)
            .setName("Priority")
            .addDropdown(function(cmp) {
                prioritySelect = cmp;
                cmp.addOption("none", "None");
                cmp.addOption("low", "Low");
                cmp.addOption("medium", "Medium");
                cmp.addOption("high", "High");
                cmp.setValue(rem.priority || "none");
            });

        // ── Notes (pre-filled) ─────────────────────────
        var notesInput;
        new obsidian.Setting(this.contentEl)
            .setName("Notes")
            .addTextArea(function(cmp) {
                notesInput = cmp.inputEl;
                cmp.setValue(rem.notes || "");
            });

        // ── Buttons: Save / Cancel ──────────────────────
        var errorEl = this.contentEl.createDiv("calendian-form-error");
        errorEl.style.display = "none";

        new obsidian.Setting(this.contentEl)
            .addButton(function(btn) {
                btn.setButtonText("Save")
                    .setCta()
                    .onClick(async function() {
                        var title = (titleInput.value || "").trim();
                        var listId = listSelect ? listSelect.getValue() : "";
                        var dueDateStr = (dueDateInput.value || "").trim();
                        var dueTimeStr = (dueTimeInput.value || "").trim();
                        var priority = prioritySelect ? prioritySelect.getValue() : "none";
                        var notes = (notesInput.value || "").trim();

                        if (!title) {
                            errorEl.textContent = "Title is required.";
                            errorEl.style.display = "block";
                            return;
                        }
                        if (!listId) {
                            errorEl.textContent = "Please select a list.";
                            errorEl.style.display = "block";
                            return;
                        }

                        // Build due date
                        var dueDate = null;
                        if (dueDateStr) {
                            if (dueTimeStr) {
                                dueDate = window.moment(dueDateStr + " " + dueTimeStr, "YYYY-MM-DD HH:mm").toDate();
                            } else {
                                dueDate = window.moment(dueDateStr, "YYYY-MM-DD").toDate();
                            }
                        }

                        try {
                            var result = await integ.editReminder(rem, {
                                title: title,
                                listId: listId,
                                dueDate: dueDate,
                                dueTime: dueTimeStr,
                                priority: priority,
                                notes: notes
                            });
                            if (result && result.ok) {
                                new obsidian.Notice("Reminder updated");
                                console.log("[Calendian] Updated reminder (id=" + rem.id + ")");
                                integ.init(true);
                                self.close();
                            } else {
                                errorEl.textContent = "Failed to update reminder.";
                                errorEl.style.display = "block";
                            }
                        } catch (err) {
                            var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                            console.error("[Calendian] Reminder update failed:", errMsg);
                            errorEl.textContent = "Error: " + errMsg;
                            errorEl.style.display = "block";
                        }
                    });
            })
            .addButton(function(btn) {
                btn.setButtonText("Cancel")
                    .onClick(function() { self.close(); });
            });
    }
}

// ── RecurringBlockModal (v0.4, REQ-REC-002, REQ-REC-003) ─────────────────────

class RecurringBlockModal extends obsidian.Modal {
    constructor(app, eventTitle, eventId) {
        super(app);
        this.eventTitle = eventTitle;
        this.eventId = eventId;
    }

    onOpen() {
        var self = this;
        this.titleEl.setText("Recurring Event");

        this.contentEl.createEl("p", {
            text: "This is a recurring event. Editing recurring events requires choosing which occurrences to modify (this event only, this and future events, or all events). This choice is not yet supported in Calendian."
        });

        this.contentEl.createEl("p", {
            text: "Please edit this event directly in Calendar.app.",
            cls: "setting-item-description"
        });

        this.contentEl.createDiv("modal-button-container", function(buttonsEl) {
            buttonsEl.createEl("button", { text: "Cancel" })
                .addEventListener("click", function() { self.close(); });
            buttonsEl.createEl("button", { cls: "mod-cta", text: "Open in Calendar.app" })
                .addEventListener("click", function() {
                    if (self.eventId) {
                        obsidian.openExternal("x-apple-calevent:" + self.eventId);
                    } else {
                        // Fallback: just open Calendar.app
                        obsidian.openExternal("file:///Applications/Calendar.app");
                    }
                    self.close();
                });
        });
    }
}

// ── ConfirmActionModal (v0.4, REQ-ERR-006) ───────────────────────────────────
// Reusable confirmation dialog for destructive operations.
// Uses the same pattern as createConfirmationDialog() but with danger styling.

class ConfirmActionModal extends obsidian.Modal {
    constructor(app, opts) {
        super(app);
        this.opts = opts || {}; // { title, message, ctaLabel, isDangerous, onConfirm }
    }

    onOpen() {
        var self = this;
        var opts = this.opts;
        this.titleEl.setText(opts.title || "Confirm");

        this.contentEl.createEl("p", {
            text: opts.message || "Are you sure?"
        });

        this.contentEl.createDiv("modal-button-container", function(buttonsEl) {
            buttonsEl.createEl("button", { text: "Cancel" })
                .addEventListener("click", function() { self.close(); });
            var ctaBtn = buttonsEl.createEl("button", {
                cls: opts.isDangerous ? "mod-warning" : "mod-cta",
                text: opts.ctaLabel || "Confirm"
            });
            ctaBtn.addEventListener("click", function() {
                self.close();
                if (opts.onConfirm) opts.onConfirm();
            });
        });
    }
}

/**
 * Create a Weekly Note for a given date.
 */
async function tryToCreateWeeklyNote(date, inNewSplit, settings, cb) {
    const { workspace } = window.app;
    const { format } = getWeeklyNoteSettings_1();
    const filename = date.format(format);
    const createFile = async () => {
        const dailyNote = await createWeeklyNote_1(date);
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(dailyNote);
        cb === null || cb === void 0 ? void 0 : cb(dailyNote);
    };
    if (settings.shouldConfirmBeforeCreate) {
        createConfirmationDialog({
            cta: "Create",
            onAccept: createFile,
            text: `File ${filename} does not exist. Would you like to create it?`,
            title: "New Weekly Note",
        });
    }
    else {
        await createFile();
    }
}

function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
function is_promise(value) {
    return value && typeof value === 'object' && typeof value.then === 'function';
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function not_equal(a, b) {
    return a != a ? b == b : a !== b;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
    const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function null_to_empty(value) {
    return value == null ? '' : value;
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function set_attributes(node, attributes) {
    // @ts-ignore
    const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
    for (const key in attributes) {
        if (attributes[key] == null) {
            node.removeAttribute(key);
        }
        else if (key === 'style') {
            node.style.cssText = attributes[key];
        }
        else if (key === '__value') {
            node.value = node[key] = attributes[key];
        }
        else if (descriptors[key] && descriptors[key].set) {
            node[key] = attributes[key];
        }
        else {
            attr(node, key, attributes[key]);
        }
    }
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_data(text, data) {
    data = '' + data;
    if (text.wholeText !== data)
        text.data = data;
}
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}

function handle_promise(promise, info) {
    const token = info.token = {};
    function update(type, index, key, value) {
        if (info.token !== token)
            return;
        info.resolved = value;
        let child_ctx = info.ctx;
        if (key !== undefined) {
            child_ctx = child_ctx.slice();
            child_ctx[key] = value;
        }
        const block = type && (info.current = type)(child_ctx);
        let needs_flush = false;
        if (info.block) {
            if (info.blocks) {
                info.blocks.forEach((block, i) => {
                    if (i !== index && block) {
                        group_outros();
                        transition_out(block, 1, 1, () => {
                            if (info.blocks[i] === block) {
                                info.blocks[i] = null;
                            }
                        });
                        check_outros();
                    }
                });
            }
            else {
                info.block.d(1);
            }
            block.c();
            transition_in(block, 1);
            block.m(info.mount(), info.anchor);
            needs_flush = true;
        }
        info.block = block;
        if (info.blocks)
            info.blocks[index] = block;
        if (needs_flush) {
            flush();
        }
    }
    if (is_promise(promise)) {
        const current_component = get_current_component();
        promise.then(value => {
            set_current_component(current_component);
            update(info.then, 1, info.value, value);
            set_current_component(null);
        }, error => {
            set_current_component(current_component);
            update(info.catch, 2, info.error, error);
            set_current_component(null);
            if (!info.hasCatch) {
                throw error;
            }
        });
        // if we previously had a then/catch block, destroy it
        if (info.current !== info.pending) {
            update(info.pending, 0);
            return true;
        }
    }
    else {
        if (info.current !== info.then) {
            update(info.then, 1, info.value, promise);
            return true;
        }
        info.resolved = promise;
    }
}
function outro_and_destroy_block(block, lookup) {
    transition_out(block, 1, 1, () => {
        lookup.delete(block.key);
    });
}
function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
    let o = old_blocks.length;
    let n = list.length;
    let i = o;
    const old_indexes = {};
    while (i--)
        old_indexes[old_blocks[i].key] = i;
    const new_blocks = [];
    const new_lookup = new Map();
    const deltas = new Map();
    i = n;
    while (i--) {
        const child_ctx = get_context(ctx, list, i);
        const key = get_key(child_ctx);
        let block = lookup.get(key);
        if (!block) {
            block = create_each_block(key, child_ctx);
            block.c();
        }
        else if (dynamic) {
            block.p(child_ctx, dirty);
        }
        new_lookup.set(key, new_blocks[i] = block);
        if (key in old_indexes)
            deltas.set(key, Math.abs(i - old_indexes[key]));
    }
    const will_move = new Set();
    const did_move = new Set();
    function insert(block) {
        transition_in(block, 1);
        block.m(node, next);
        lookup.set(block.key, block);
        next = block.first;
        n--;
    }
    while (o && n) {
        const new_block = new_blocks[n - 1];
        const old_block = old_blocks[o - 1];
        const new_key = new_block.key;
        const old_key = old_block.key;
        if (new_block === old_block) {
            // do nothing
            next = new_block.first;
            o--;
            n--;
        }
        else if (!new_lookup.has(old_key)) {
            // remove old block
            destroy(old_block, lookup);
            o--;
        }
        else if (!lookup.has(new_key) || will_move.has(new_key)) {
            insert(new_block);
        }
        else if (did_move.has(old_key)) {
            o--;
        }
        else if (deltas.get(new_key) > deltas.get(old_key)) {
            did_move.add(new_key);
            insert(new_block);
        }
        else {
            will_move.add(old_key);
            o--;
        }
    }
    while (o--) {
        const old_block = old_blocks[o];
        if (!new_lookup.has(old_block.key))
            destroy(old_block, lookup);
    }
    while (n)
        insert(new_blocks[n - 1]);
    return new_blocks;
}

function get_spread_update(levels, updates) {
    const update = {};
    const to_null_out = {};
    const accounted_for = { $$scope: 1 };
    let i = levels.length;
    while (i--) {
        const o = levels[i];
        const n = updates[i];
        if (n) {
            for (const key in o) {
                if (!(key in n))
                    to_null_out[key] = 1;
            }
            for (const key in n) {
                if (!accounted_for[key]) {
                    update[key] = n[key];
                    accounted_for[key] = 1;
                }
            }
            levels[i] = n;
        }
        else {
            for (const key in o) {
                accounted_for[key] = 1;
            }
        }
    }
    for (const key in to_null_out) {
        if (!(key in update))
            update[key] = undefined;
    }
    return update;
}
function get_spread_object(spread_props) {
    return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/**
 * dateUID is a way of weekly identifying daily/weekly/monthly notes.
 * They are prefixed with the granularity to avoid ambiguity.
 */
function getDateUID(date, granularity = "day") {
    const ts = date.clone().startOf(granularity).format();
    return `${granularity}-${ts}`;
}
var getDateUID_1 = getDateUID;

/* src/components/Dot.svelte generated by Svelte v3.35.0 */

function add_css$5() {
	var style = element("style");
	style.id = "svelte-1widvzq-style";
	style.textContent = ".dot.svelte-1widvzq,.hollow.svelte-1widvzq{display:inline-block;height:6px;width:6px;margin:0 1px}.filled.svelte-1widvzq{fill:var(--color-dot)}.active.filled.svelte-1widvzq{fill:var(--text-on-accent)}.hollow.svelte-1widvzq{fill:none;stroke:var(--color-dot)}.active.hollow.svelte-1widvzq{fill:none;stroke:var(--text-on-accent)}";
	append(document.head, style);
}

// (14:0) {:else}
function create_else_block$1(ctx) {
	let svg;
	let circle;
	let svg_class_value;

	return {
		c() {
			svg = svg_element("svg");
			circle = svg_element("circle");
			attr(circle, "cx", "3");
			attr(circle, "cy", "3");
			attr(circle, "r", "2");
			attr(svg, "class", svg_class_value = "" + (null_to_empty(`hollow ${/*className*/ ctx[0]}`) + " svelte-1widvzq"));
			attr(svg, "viewBox", "0 0 6 6");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			toggle_class(svg, "active", /*isActive*/ ctx[2]);
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, circle);
		},
		p(ctx, dirty) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(`hollow ${/*className*/ ctx[0]}`) + " svelte-1widvzq"))) {
				attr(svg, "class", svg_class_value);
			}

			if (dirty & /*className, isActive*/ 5) {
				toggle_class(svg, "active", /*isActive*/ ctx[2]);
			}
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (6:0) {#if isFilled}
function create_if_block$2(ctx) {
	let svg;
	let circle;
	let svg_class_value;

	return {
		c() {
			svg = svg_element("svg");
			circle = svg_element("circle");
			attr(circle, "cx", "3");
			attr(circle, "cy", "3");
			attr(circle, "r", "2");
			attr(svg, "class", svg_class_value = "" + (null_to_empty(`dot filled ${/*className*/ ctx[0]}`) + " svelte-1widvzq"));
			attr(svg, "viewBox", "0 0 6 6");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			toggle_class(svg, "active", /*isActive*/ ctx[2]);
		},
		m(target, anchor) {
			insert(target, svg, anchor);
			append(svg, circle);
		},
		p(ctx, dirty) {
			if (dirty & /*className*/ 1 && svg_class_value !== (svg_class_value = "" + (null_to_empty(`dot filled ${/*className*/ ctx[0]}`) + " svelte-1widvzq"))) {
				attr(svg, "class", svg_class_value);
			}

			if (dirty & /*className, isActive*/ 5) {
				toggle_class(svg, "active", /*isActive*/ ctx[2]);
			}
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

function create_fragment$6(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*isFilled*/ ctx[1]) return create_if_block$2;
		return create_else_block$1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_block.m(target, anchor);
			insert(target, if_block_anchor, anchor);
		},
		p(ctx, [dirty]) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$6($$self, $$props, $$invalidate) {
	let { className = "" } = $$props;
	let { isFilled } = $$props;
	let { isActive } = $$props;

	$$self.$$set = $$props => {
		if ("className" in $$props) $$invalidate(0, className = $$props.className);
		if ("isFilled" in $$props) $$invalidate(1, isFilled = $$props.isFilled);
		if ("isActive" in $$props) $$invalidate(2, isActive = $$props.isActive);
	};

	return [className, isFilled, isActive];
}

class Dot extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1widvzq-style")) add_css$5();
		init(this, options, instance$6, create_fragment$6, safe_not_equal, { className: 0, isFilled: 1, isActive: 2 });
	}
}

/* src/components/MetadataResolver.svelte generated by Svelte v3.35.0 */

const get_default_slot_changes_1 = dirty => ({});
const get_default_slot_context_1 = ctx => ({ metadata: null });
const get_default_slot_changes = dirty => ({ metadata: dirty & /*metadata*/ 1 });
const get_default_slot_context = ctx => ({ metadata: /*resolvedMeta*/ ctx[3] });

// (11:0) {:else}
function create_else_block(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context_1);

	return {
		c() {
			if (default_slot) default_slot.c();
		},
		m(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope*/ 2) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, get_default_slot_changes_1, get_default_slot_context_1);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (default_slot) default_slot.d(detaching);
		}
	};
}

// (7:0) {#if metadata}
function create_if_block$1(ctx) {
	let await_block_anchor;
	let promise;
	let current;

	let info = {
		ctx,
		current: null,
		token: null,
		hasCatch: false,
		pending: create_pending_block,
		then: create_then_block,
		catch: create_catch_block,
		value: 3,
		blocks: [,,,]
	};

	handle_promise(promise = /*metadata*/ ctx[0], info);

	return {
		c() {
			await_block_anchor = empty();
			info.block.c();
		},
		m(target, anchor) {
			insert(target, await_block_anchor, anchor);
			info.block.m(target, info.anchor = anchor);
			info.mount = () => await_block_anchor.parentNode;
			info.anchor = await_block_anchor;
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			info.ctx = ctx;

			if (dirty & /*metadata*/ 1 && promise !== (promise = /*metadata*/ ctx[0]) && handle_promise(promise, info)) ; else {
				const child_ctx = ctx.slice();
				child_ctx[3] = info.resolved;
				info.block.p(child_ctx, dirty);
			}
		},
		i(local) {
			if (current) return;
			transition_in(info.block);
			current = true;
		},
		o(local) {
			for (let i = 0; i < 3; i += 1) {
				const block = info.blocks[i];
				transition_out(block);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(await_block_anchor);
			info.block.d(detaching);
			info.token = null;
			info = null;
		}
	};
}

// (1:0) <svelte:options immutable />  <script lang="ts">; export let metadata; </script>  {#if metadata}
function create_catch_block(ctx) {
	return {
		c: noop,
		m: noop,
		p: noop,
		i: noop,
		o: noop,
		d: noop
	};
}

// (8:37)      <slot metadata="{resolvedMeta}
function create_then_block(ctx) {
	let current;
	const default_slot_template = /*#slots*/ ctx[2].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[1], get_default_slot_context);

	return {
		c() {
			if (default_slot) default_slot.c();
		},
		m(target, anchor) {
			if (default_slot) {
				default_slot.m(target, anchor);
			}

			current = true;
		},
		p(ctx, dirty) {
			if (default_slot) {
				if (default_slot.p && dirty & /*$$scope, metadata*/ 3) {
					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[1], dirty, get_default_slot_changes, get_default_slot_context);
				}
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (default_slot) default_slot.d(detaching);
		}
	};
}

// (1:0) <svelte:options immutable />  <script lang="ts">; export let metadata; </script>  {#if metadata}
function create_pending_block(ctx) {
	return {
		c: noop,
		m: noop,
		p: noop,
		i: noop,
		o: noop,
		d: noop
	};
}

function create_fragment$5(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$1, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*metadata*/ ctx[0]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	return {
		c() {
			if_block.c();
			if_block_anchor = empty();
		},
		m(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert(target, if_block_anchor, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				} else {
					if_block.p(ctx, dirty);
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o(local) {
			transition_out(if_block);
			current = false;
		},
		d(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

function instance$5($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	
	let { metadata } = $$props;

	$$self.$$set = $$props => {
		if ("metadata" in $$props) $$invalidate(0, metadata = $$props.metadata);
		if ("$$scope" in $$props) $$invalidate(1, $$scope = $$props.$$scope);
	};

	return [metadata, $$scope, slots];
}

class MetadataResolver extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance$5, create_fragment$5, not_equal, { metadata: 0 });
	}
}

function isMacOS() {
    return navigator.appVersion.indexOf("Mac") !== -1;
}
function isMetaPressed(e) {
    return isMacOS() ? e.metaKey : e.ctrlKey;
}
function getDaysOfWeek(..._args) {
    return window.moment.weekdaysShort(true);
}
function isWeekend(date) {
    return date.isoWeekday() === 6 || date.isoWeekday() === 7;
}
function getStartOfWeek(days) {
    return days[0].weekday(0);
}
/**
 * Generate a 2D array of daily information to power
 * the calendar view.
 */
function getMonth(displayedMonth, ..._args) {
    const locale = window.moment().locale();
    const month = [];
    let week;
    const startOfMonth = displayedMonth.clone().locale(locale).date(1);
    const startOffset = startOfMonth.weekday();
    let date = startOfMonth.clone().subtract(startOffset, "days");
    for (let _day = 0; _day < 42; _day++) {
        if (_day % 7 === 0) {
            week = {
                days: [],
                weekNum: date.week(),
            };
            month.push(week);
        }
        week.days.push(date);
        date = date.clone().add(1, "days");
    }
    return month;
}

/* src/components/Day.svelte generated by Svelte v3.35.0 */

function add_css$4() {
	var style = element("style");
	style.id = "svelte-q3wqg9-style";
	style.textContent = ".day.svelte-q3wqg9{background-color:var(--color-background-day);border-radius:4px;color:var(--color-text-day);cursor:pointer;font-size:0.8em;height:100%;padding:4px;position:relative;text-align:center;transition:background-color 0.1s ease-in, color 0.1s ease-in;vertical-align:baseline}.day.svelte-q3wqg9:hover{background-color:var(--interactive-hover)}.day.active.svelte-q3wqg9:hover{background-color:var(--interactive-accent-hover)}.adjacent-month.svelte-q3wqg9{opacity:0.25}.today.svelte-q3wqg9{color:var(--color-text-today)}.day.svelte-q3wqg9:active,.active.svelte-q3wqg9,.active.today.svelte-q3wqg9{color:var(--text-on-accent);background-color:var(--interactive-accent)}.dot-container.svelte-q3wqg9{display:flex;flex-wrap:wrap;justify-content:center;line-height:6px;min-height:6px}";
	append(document.head, style);
}

function get_each_context$2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

// (36:8) {#each metadata.dots as dot}
function create_each_block$2(ctx) {
	let dot;
	let current;
	const dot_spread_levels = [/*dot*/ ctx[11]];
	let dot_props = {};

	for (let i = 0; i < dot_spread_levels.length; i += 1) {
		dot_props = assign(dot_props, dot_spread_levels[i]);
	}

	dot = new Dot({ props: dot_props });

	return {
		c() {
			create_component(dot.$$.fragment);
		},
		m(target, anchor) {
			mount_component(dot, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const dot_changes = (dirty & /*metadata*/ 128)
			? get_spread_update(dot_spread_levels, [get_spread_object(/*dot*/ ctx[11])])
			: {};

			dot.$set(dot_changes);
		},
		i(local) {
			if (current) return;
			transition_in(dot.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(dot.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(dot, detaching);
		}
	};
}

// (22:2) <MetadataResolver metadata="{metadata}" let:metadata>
function create_default_slot$1(ctx) {
	let div1;
	let t0_value = /*date*/ ctx[0].format("D") + "";
	let t0;
	let t1;
	let div0;
	let div1_class_value;
	let current;
	let mounted;
	let dispose;
	let each_value = /*metadata*/ ctx[7].dots;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	let div1_levels = [
		{
			class: div1_class_value = `day ${/*metadata*/ ctx[7].classes.join(" ")}`
		},
		/*metadata*/ ctx[7].dataAttributes || {}
	];

	let div1_data = {};

	for (let i = 0; i < div1_levels.length; i += 1) {
		div1_data = assign(div1_data, div1_levels[i]);
	}

	return {
		c() {
			div1 = element("div");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "dot-container svelte-q3wqg9");
			set_attributes(div1, div1_data);
			toggle_class(div1, "active", /*selectedId*/ ctx[6] === getDateUID_1(/*date*/ ctx[0], "day"));
			toggle_class(div1, "adjacent-month", !/*date*/ ctx[0].isSame(/*displayedMonth*/ ctx[5], "month"));
			toggle_class(div1, "today", /*date*/ ctx[0].isSame(/*today*/ ctx[4], "day"));
			toggle_class(div1, "svelte-q3wqg9", true);
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, t0);
			append(div1, t1);
			append(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div1, "click", function () {
						if (is_function(/*onClick*/ ctx[2] && /*click_handler*/ ctx[8])) (/*onClick*/ ctx[2] && /*click_handler*/ ctx[8]).apply(this, arguments);
					}),
					listen(div1, "contextmenu", function () {
						if (is_function(/*onContextMenu*/ ctx[3] && /*contextmenu_handler*/ ctx[9])) (/*onContextMenu*/ ctx[3] && /*contextmenu_handler*/ ctx[9]).apply(this, arguments);
					}),
					listen(div1, "pointerover", function () {
						if (is_function(/*onHover*/ ctx[1] && /*pointerover_handler*/ ctx[10])) (/*onHover*/ ctx[1] && /*pointerover_handler*/ ctx[10]).apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if ((!current || dirty & /*date*/ 1) && t0_value !== (t0_value = /*date*/ ctx[0].format("D") + "")) set_data(t0, t0_value);

			if (dirty & /*metadata*/ 128) {
				each_value = /*metadata*/ ctx[7].dots;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$2(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$2(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div0, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			set_attributes(div1, div1_data = get_spread_update(div1_levels, [
				(!current || dirty & /*metadata*/ 128 && div1_class_value !== (div1_class_value = `day ${/*metadata*/ ctx[7].classes.join(" ")}`)) && { class: div1_class_value },
				dirty & /*metadata*/ 128 && (/*metadata*/ ctx[7].dataAttributes || {})
			]));

			toggle_class(div1, "active", /*selectedId*/ ctx[6] === getDateUID_1(/*date*/ ctx[0], "day"));
			toggle_class(div1, "adjacent-month", !/*date*/ ctx[0].isSame(/*displayedMonth*/ ctx[5], "month"));
			toggle_class(div1, "today", /*date*/ ctx[0].isSame(/*today*/ ctx[4], "day"));
			toggle_class(div1, "svelte-q3wqg9", true);
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$4(ctx) {
	let td;
	let metadataresolver;
	let current;

	metadataresolver = new MetadataResolver({
			props: {
				metadata: /*metadata*/ ctx[7],
				$$slots: {
					default: [
						create_default_slot$1,
						({ metadata }) => ({ 7: metadata }),
						({ metadata }) => metadata ? 128 : 0
					]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			td = element("td");
			create_component(metadataresolver.$$.fragment);
		},
		m(target, anchor) {
			insert(target, td, anchor);
			mount_component(metadataresolver, td, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const metadataresolver_changes = {};
			if (dirty & /*metadata*/ 128) metadataresolver_changes.metadata = /*metadata*/ ctx[7];

			if (dirty & /*$$scope, metadata, selectedId, date, displayedMonth, today, onClick, onContextMenu, onHover*/ 16639) {
				metadataresolver_changes.$$scope = { dirty, ctx };
			}

			metadataresolver.$set(metadataresolver_changes);
		},
		i(local) {
			if (current) return;
			transition_in(metadataresolver.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(metadataresolver.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(td);
			destroy_component(metadataresolver);
		}
	};
}

function instance$4($$self, $$props, $$invalidate) {
	
	
	let { date } = $$props;
	let { metadata } = $$props;
	let { onHover } = $$props;
	let { onClick } = $$props;
	let { onContextMenu } = $$props;
	let { today } = $$props;
	let { displayedMonth = null } = $$props;
	let { selectedId = null } = $$props;
	const click_handler = e => onClick(date, isMetaPressed(e));
	const contextmenu_handler = e => onContextMenu(date, e);
	const pointerover_handler = e => onHover(date, e.target, isMetaPressed(e));

	$$self.$$set = $$props => {
		if ("date" in $$props) $$invalidate(0, date = $$props.date);
		if ("metadata" in $$props) $$invalidate(7, metadata = $$props.metadata);
		if ("onHover" in $$props) $$invalidate(1, onHover = $$props.onHover);
		if ("onClick" in $$props) $$invalidate(2, onClick = $$props.onClick);
		if ("onContextMenu" in $$props) $$invalidate(3, onContextMenu = $$props.onContextMenu);
		if ("today" in $$props) $$invalidate(4, today = $$props.today);
		if ("displayedMonth" in $$props) $$invalidate(5, displayedMonth = $$props.displayedMonth);
		if ("selectedId" in $$props) $$invalidate(6, selectedId = $$props.selectedId);
	};

	return [
		date,
		onHover,
		onClick,
		onContextMenu,
		today,
		displayedMonth,
		selectedId,
		metadata,
		click_handler,
		contextmenu_handler,
		pointerover_handler
	];
}

class Day extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-q3wqg9-style")) add_css$4();

		init(this, options, instance$4, create_fragment$4, not_equal, {
			date: 0,
			metadata: 7,
			onHover: 1,
			onClick: 2,
			onContextMenu: 3,
			today: 4,
			displayedMonth: 5,
			selectedId: 6
		});
	}
}

/* src/components/Arrow.svelte generated by Svelte v3.35.0 */

function add_css$3() {
	var style = element("style");
	style.id = "svelte-156w7na-style";
	style.textContent = ".arrow.svelte-156w7na.svelte-156w7na{align-items:center;cursor:pointer;display:flex;justify-content:center;width:24px}.arrow.is-mobile.svelte-156w7na.svelte-156w7na{width:32px}.right.svelte-156w7na.svelte-156w7na{transform:rotate(180deg)}.arrow.svelte-156w7na svg.svelte-156w7na{color:var(--color-arrow);height:16px;width:16px}";
	append(document.head, style);
}

function create_fragment$3(ctx) {
	let div;
	let svg;
	let path;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			svg = svg_element("svg");
			path = svg_element("path");
			attr(path, "fill", "currentColor");
			attr(path, "d", "M34.52 239.03L228.87 44.69c9.37-9.37 24.57-9.37 33.94 0l22.67 22.67c9.36 9.36 9.37 24.52.04 33.9L131.49 256l154.02 154.75c9.34 9.38 9.32 24.54-.04 33.9l-22.67 22.67c-9.37 9.37-24.57 9.37-33.94 0L34.52 272.97c-9.37-9.37-9.37-24.57 0-33.94z");
			attr(svg, "focusable", "false");
			attr(svg, "role", "img");
			attr(svg, "xmlns", "http://www.w3.org/2000/svg");
			attr(svg, "viewBox", "0 0 320 512");
			attr(svg, "class", "svelte-156w7na");
			attr(div, "class", "arrow svelte-156w7na");
			attr(div, "aria-label", /*tooltip*/ ctx[1]);
			toggle_class(div, "is-mobile", /*isMobile*/ ctx[3]);
			toggle_class(div, "right", /*direction*/ ctx[2] === "right");
		},
		m(target, anchor) {
			insert(target, div, anchor);
			append(div, svg);
			append(svg, path);

			if (!mounted) {
				dispose = listen(div, "click", function () {
					if (is_function(/*onClick*/ ctx[0])) /*onClick*/ ctx[0].apply(this, arguments);
				});

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;

			if (dirty & /*tooltip*/ 2) {
				attr(div, "aria-label", /*tooltip*/ ctx[1]);
			}

			if (dirty & /*direction*/ 4) {
				toggle_class(div, "right", /*direction*/ ctx[2] === "right");
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

function instance$3($$self, $$props, $$invalidate) {
	let { onClick } = $$props;
	let { tooltip } = $$props;
	let { direction } = $$props;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let isMobile = window.app.isMobile;

	$$self.$$set = $$props => {
		if ("onClick" in $$props) $$invalidate(0, onClick = $$props.onClick);
		if ("tooltip" in $$props) $$invalidate(1, tooltip = $$props.tooltip);
		if ("direction" in $$props) $$invalidate(2, direction = $$props.direction);
	};

	return [onClick, tooltip, direction, isMobile];
}

class Arrow extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-156w7na-style")) add_css$3();
		init(this, options, instance$3, create_fragment$3, safe_not_equal, { onClick: 0, tooltip: 1, direction: 2 });
	}
}

/* src/components/Nav.svelte generated by Svelte v3.35.0 */

function add_css$2() {
	var style = element("style");
	style.id = "svelte-1vwr9dd-style";
	style.textContent = ".nav.svelte-1vwr9dd.svelte-1vwr9dd{align-items:center;display:flex;margin:0.6em 0 1em;padding:0 8px;width:100%}.nav.is-mobile.svelte-1vwr9dd.svelte-1vwr9dd{padding:0}.title.svelte-1vwr9dd.svelte-1vwr9dd{color:var(--color-text-title);font-size:1.5em;margin:0}.is-mobile.svelte-1vwr9dd .title.svelte-1vwr9dd{font-size:1.3em}.month.svelte-1vwr9dd.svelte-1vwr9dd{font-weight:500;text-transform:capitalize}.year.svelte-1vwr9dd.svelte-1vwr9dd{color:var(--interactive-accent)}.right-nav.svelte-1vwr9dd.svelte-1vwr9dd{display:flex;justify-content:center;margin-left:auto}.reset-button.svelte-1vwr9dd.svelte-1vwr9dd{cursor:pointer;border-radius:4px;color:var(--text-muted);font-size:0.7em;font-weight:600;letter-spacing:1px;margin:0 4px;padding:0px 4px;text-transform:uppercase}.is-mobile.svelte-1vwr9dd .reset-button.svelte-1vwr9dd{display:none}";
	append(document.head, style);
}

function create_fragment$2(ctx) {
	let div2;
	let h3;
	let span0;
	let t0_value = /*displayedMonth*/ ctx[0].format("MMM") + "";
	let t0;
	let t1;
	let span1;
	let t2_value = /*displayedMonth*/ ctx[0].format("YYYY") + "";
	let t2;
	let t3;
	let div1;
	let arrow0;
	let t4;
	let div0;
	let t6;
	let arrow1;
	let current;
	let mounted;
	let dispose;

	arrow0 = new Arrow({
			props: {
				direction: "left",
				onClick: /*decrementDisplayedMonth*/ ctx[3],
				tooltip: "Previous Month"
			}
		});

	arrow1 = new Arrow({
			props: {
				direction: "right",
				onClick: /*incrementDisplayedMonth*/ ctx[2],
				tooltip: "Next Month"
			}
		});

	return {
		c() {
			div2 = element("div");
			h3 = element("h3");
			span0 = element("span");
			t0 = text(t0_value);
			t1 = space();
			span1 = element("span");
			t2 = text(t2_value);
			t3 = space();
			div1 = element("div");
			create_component(arrow0.$$.fragment);
			t4 = space();
			div0 = element("div");
			div0.textContent = `${/*todayDisplayStr*/ ctx[4]}`;
			t6 = space();
			create_component(arrow1.$$.fragment);
			attr(span0, "class", "month svelte-1vwr9dd");
			attr(span1, "class", "year svelte-1vwr9dd");
			attr(h3, "class", "title svelte-1vwr9dd");
			attr(div0, "class", "reset-button svelte-1vwr9dd");
			attr(div1, "class", "right-nav svelte-1vwr9dd");
			attr(div2, "class", "nav svelte-1vwr9dd");
			toggle_class(div2, "is-mobile", /*isMobile*/ ctx[5]);
		},
		m(target, anchor) {
			insert(target, div2, anchor);
			append(div2, h3);
			append(h3, span0);
			append(span0, t0);
			append(h3, t1);
			append(h3, span1);
			append(span1, t2);
			append(div2, t3);
			append(div2, div1);
			mount_component(arrow0, div1, null);
			append(div1, t4);
			append(div1, div0);
			append(div1, t6);
			mount_component(arrow1, div1, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(h3, "click", function () {
						if (is_function(/*resetDisplayedMonth*/ ctx[1])) /*resetDisplayedMonth*/ ctx[1].apply(this, arguments);
					}),
					listen(div0, "click", function () {
						if (is_function(/*resetDisplayedMonth*/ ctx[1])) /*resetDisplayedMonth*/ ctx[1].apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, [dirty]) {
			ctx = new_ctx;
			if ((!current || dirty & /*displayedMonth*/ 1) && t0_value !== (t0_value = /*displayedMonth*/ ctx[0].format("MMM") + "")) set_data(t0, t0_value);
			if ((!current || dirty & /*displayedMonth*/ 1) && t2_value !== (t2_value = /*displayedMonth*/ ctx[0].format("YYYY") + "")) set_data(t2, t2_value);
			const arrow0_changes = {};
			if (dirty & /*decrementDisplayedMonth*/ 8) arrow0_changes.onClick = /*decrementDisplayedMonth*/ ctx[3];
			arrow0.$set(arrow0_changes);
			const arrow1_changes = {};
			if (dirty & /*incrementDisplayedMonth*/ 4) arrow1_changes.onClick = /*incrementDisplayedMonth*/ ctx[2];
			arrow1.$set(arrow1_changes);
		},
		i(local) {
			if (current) return;
			transition_in(arrow0.$$.fragment, local);
			transition_in(arrow1.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(arrow0.$$.fragment, local);
			transition_out(arrow1.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div2);
			destroy_component(arrow0);
			destroy_component(arrow1);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance$2($$self, $$props, $$invalidate) {
	
	let { displayedMonth } = $$props;
	let { today } = $$props;
	let { resetDisplayedMonth } = $$props;
	let { incrementDisplayedMonth } = $$props;
	let { decrementDisplayedMonth } = $$props;

	// Get the word 'Today' but localized to the current language
	const todayDisplayStr = today.calendar().split(/\d|\s/)[0];

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let isMobile = window.app.isMobile;

	$$self.$$set = $$props => {
		if ("displayedMonth" in $$props) $$invalidate(0, displayedMonth = $$props.displayedMonth);
		if ("today" in $$props) $$invalidate(6, today = $$props.today);
		if ("resetDisplayedMonth" in $$props) $$invalidate(1, resetDisplayedMonth = $$props.resetDisplayedMonth);
		if ("incrementDisplayedMonth" in $$props) $$invalidate(2, incrementDisplayedMonth = $$props.incrementDisplayedMonth);
		if ("decrementDisplayedMonth" in $$props) $$invalidate(3, decrementDisplayedMonth = $$props.decrementDisplayedMonth);
	};

	return [
		displayedMonth,
		resetDisplayedMonth,
		incrementDisplayedMonth,
		decrementDisplayedMonth,
		todayDisplayStr,
		isMobile,
		today
	];
}

class Nav extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-1vwr9dd-style")) add_css$2();

		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
			displayedMonth: 0,
			today: 6,
			resetDisplayedMonth: 1,
			incrementDisplayedMonth: 2,
			decrementDisplayedMonth: 3
		});
	}
}

/* src/components/WeekNum.svelte generated by Svelte v3.35.0 */

function add_css$1() {
	var style = element("style");
	style.id = "svelte-egt0yd-style";
	style.textContent = "td.svelte-egt0yd{border-right:1px solid var(--background-modifier-border)}.week-num.svelte-egt0yd{background-color:var(--color-background-weeknum);border-radius:4px;color:var(--color-text-weeknum);cursor:pointer;font-size:0.65em;height:100%;padding:4px;text-align:center;transition:background-color 0.1s ease-in, color 0.1s ease-in;vertical-align:baseline}.week-num.svelte-egt0yd:hover{background-color:var(--interactive-hover)}.week-num.active.svelte-egt0yd:hover{background-color:var(--interactive-accent-hover)}.active.svelte-egt0yd{color:var(--text-on-accent);background-color:var(--interactive-accent)}.dot-container.svelte-egt0yd{display:flex;flex-wrap:wrap;justify-content:center;line-height:6px;min-height:6px}";
	append(document.head, style);
}

function get_each_context$1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[11] = list[i];
	return child_ctx;
}

// (35:8) {#each metadata.dots as dot}
function create_each_block$1(ctx) {
	let dot;
	let current;
	const dot_spread_levels = [/*dot*/ ctx[11]];
	let dot_props = {};

	for (let i = 0; i < dot_spread_levels.length; i += 1) {
		dot_props = assign(dot_props, dot_spread_levels[i]);
	}

	dot = new Dot({ props: dot_props });

	return {
		c() {
			create_component(dot.$$.fragment);
		},
		m(target, anchor) {
			mount_component(dot, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const dot_changes = (dirty & /*metadata*/ 64)
			? get_spread_update(dot_spread_levels, [get_spread_object(/*dot*/ ctx[11])])
			: {};

			dot.$set(dot_changes);
		},
		i(local) {
			if (current) return;
			transition_in(dot.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(dot.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(dot, detaching);
		}
	};
}

// (24:2) <MetadataResolver metadata="{metadata}" let:metadata>
function create_default_slot(ctx) {
	let div1;
	let t0;
	let t1;
	let div0;
	let div1_class_value;
	let current;
	let mounted;
	let dispose;
	let each_value = /*metadata*/ ctx[6].dots;
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
	}

	const out = i => transition_out(each_blocks[i], 1, 1, () => {
		each_blocks[i] = null;
	});

	return {
		c() {
			div1 = element("div");
			t0 = text(/*weekNum*/ ctx[0]);
			t1 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(div0, "class", "dot-container svelte-egt0yd");
			attr(div1, "class", div1_class_value = "" + (null_to_empty(`week-num ${/*metadata*/ ctx[6].classes.join(" ")}`) + " svelte-egt0yd"));
			toggle_class(div1, "active", /*selectedId*/ ctx[5] === getDateUID_1(/*days*/ ctx[1][0], "week"));
		},
		m(target, anchor) {
			insert(target, div1, anchor);
			append(div1, t0);
			append(div1, t1);
			append(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div0, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div1, "click", function () {
						if (is_function(/*onClick*/ ctx[3] && /*click_handler*/ ctx[8])) (/*onClick*/ ctx[3] && /*click_handler*/ ctx[8]).apply(this, arguments);
					}),
					listen(div1, "contextmenu", function () {
						if (is_function(/*onContextMenu*/ ctx[4] && /*contextmenu_handler*/ ctx[9])) (/*onContextMenu*/ ctx[4] && /*contextmenu_handler*/ ctx[9]).apply(this, arguments);
					}),
					listen(div1, "pointerover", function () {
						if (is_function(/*onHover*/ ctx[2] && /*pointerover_handler*/ ctx[10])) (/*onHover*/ ctx[2] && /*pointerover_handler*/ ctx[10]).apply(this, arguments);
					})
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (!current || dirty & /*weekNum*/ 1) set_data(t0, /*weekNum*/ ctx[0]);

			if (dirty & /*metadata*/ 64) {
				each_value = /*metadata*/ ctx[6].dots;
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context$1(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
						transition_in(each_blocks[i], 1);
					} else {
						each_blocks[i] = create_each_block$1(child_ctx);
						each_blocks[i].c();
						transition_in(each_blocks[i], 1);
						each_blocks[i].m(div0, null);
					}
				}

				group_outros();

				for (i = each_value.length; i < each_blocks.length; i += 1) {
					out(i);
				}

				check_outros();
			}

			if (!current || dirty & /*metadata*/ 64 && div1_class_value !== (div1_class_value = "" + (null_to_empty(`week-num ${/*metadata*/ ctx[6].classes.join(" ")}`) + " svelte-egt0yd"))) {
				attr(div1, "class", div1_class_value);
			}

			if (dirty & /*metadata, selectedId, getDateUID, days*/ 98) {
				toggle_class(div1, "active", /*selectedId*/ ctx[5] === getDateUID_1(/*days*/ ctx[1][0], "week"));
			}
		},
		i(local) {
			if (current) return;

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			each_blocks = each_blocks.filter(Boolean);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment$1(ctx) {
	let td;
	let metadataresolver;
	let current;

	metadataresolver = new MetadataResolver({
			props: {
				metadata: /*metadata*/ ctx[6],
				$$slots: {
					default: [
						create_default_slot,
						({ metadata }) => ({ 6: metadata }),
						({ metadata }) => metadata ? 64 : 0
					]
				},
				$$scope: { ctx }
			}
		});

	return {
		c() {
			td = element("td");
			create_component(metadataresolver.$$.fragment);
			attr(td, "class", "svelte-egt0yd");
		},
		m(target, anchor) {
			insert(target, td, anchor);
			mount_component(metadataresolver, td, null);
			current = true;
		},
		p(ctx, [dirty]) {
			const metadataresolver_changes = {};
			if (dirty & /*metadata*/ 64) metadataresolver_changes.metadata = /*metadata*/ ctx[6];

			if (dirty & /*$$scope, metadata, selectedId, days, onClick, startOfWeek, onContextMenu, onHover, weekNum*/ 16639) {
				metadataresolver_changes.$$scope = { dirty, ctx };
			}

			metadataresolver.$set(metadataresolver_changes);
		},
		i(local) {
			if (current) return;
			transition_in(metadataresolver.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(metadataresolver.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(td);
			destroy_component(metadataresolver);
		}
	};
}

function instance$1($$self, $$props, $$invalidate) {
	
	
	let { weekNum } = $$props;
	let { days } = $$props;
	let { metadata } = $$props;
	let { onHover } = $$props;
	let { onClick } = $$props;
	let { onContextMenu } = $$props;
	let { selectedId = null } = $$props;
	let startOfWeek;
	const click_handler = e => onClick(startOfWeek, isMetaPressed(e));
	const contextmenu_handler = e => onContextMenu(days[0], e);
	const pointerover_handler = e => onHover(startOfWeek, e.target, isMetaPressed(e));

	$$self.$$set = $$props => {
		if ("weekNum" in $$props) $$invalidate(0, weekNum = $$props.weekNum);
		if ("days" in $$props) $$invalidate(1, days = $$props.days);
		if ("metadata" in $$props) $$invalidate(6, metadata = $$props.metadata);
		if ("onHover" in $$props) $$invalidate(2, onHover = $$props.onHover);
		if ("onClick" in $$props) $$invalidate(3, onClick = $$props.onClick);
		if ("onContextMenu" in $$props) $$invalidate(4, onContextMenu = $$props.onContextMenu);
		if ("selectedId" in $$props) $$invalidate(5, selectedId = $$props.selectedId);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*days*/ 2) {
			$$invalidate(7, startOfWeek = getStartOfWeek(days));
		}
	};

	return [
		weekNum,
		days,
		onHover,
		onClick,
		onContextMenu,
		selectedId,
		metadata,
		startOfWeek,
		click_handler,
		contextmenu_handler,
		pointerover_handler
	];
}

class WeekNum extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-egt0yd-style")) add_css$1();

		init(this, options, instance$1, create_fragment$1, not_equal, {
			weekNum: 0,
			days: 1,
			metadata: 6,
			onHover: 2,
			onClick: 3,
			onContextMenu: 4,
			selectedId: 5
		});
	}
}

async function metadataReducer(promisedMetadata) {
    const meta = {
        dots: [],
        classes: [],
        dataAttributes: {},
    };
    const metas = await Promise.all(promisedMetadata);
    return metas.reduce((acc, meta) => ({
        classes: [...acc.classes, ...(meta.classes || [])],
        dataAttributes: Object.assign(acc.dataAttributes, meta.dataAttributes),
        dots: [...acc.dots, ...(meta.dots || [])],
    }), meta);
}
function getDailyMetadata(sources, date, ..._args) {
    return metadataReducer(sources.map((source) => source.getDailyMetadata(date)));
}
function getWeeklyMetadata(sources, date, ..._args) {
    return metadataReducer(sources.map((source) => source.getWeeklyMetadata(date)));
}

/* src/components/Calendar.svelte generated by Svelte v3.35.0 */

function add_css() {
	var style = element("style");
	style.id = "svelte-pcimu8-style";
	style.textContent = ".container.svelte-pcimu8{--color-background-heading:transparent;--color-background-day:transparent;--color-background-weeknum:transparent;--color-background-weekend:transparent;--color-dot:var(--text-muted);--color-arrow:var(--text-muted);--color-button:var(--text-muted);--color-text-title:var(--text-normal);--color-text-heading:var(--text-muted);--color-text-day:var(--text-normal);--color-text-today:var(--interactive-accent);--color-text-weeknum:var(--text-muted)}.container.svelte-pcimu8{padding:0 8px}.container.is-mobile.svelte-pcimu8{padding:0}th.svelte-pcimu8{text-align:center}.weekend.svelte-pcimu8{background-color:var(--color-background-weekend)}.calendar.svelte-pcimu8{border-collapse:collapse;width:100%}th.svelte-pcimu8{background-color:var(--color-background-heading);color:var(--color-text-heading);font-size:0.6em;letter-spacing:1px;padding:4px;text-transform:uppercase}";
	append(document.head, style);
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[18] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[21] = list[i];
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[24] = list[i];
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[27] = list[i];
	return child_ctx;
}

// (55:6) {#if showWeekNums}
function create_if_block_2(ctx) {
	let col;

	return {
		c() {
			col = element("col");
		},
		m(target, anchor) {
			insert(target, col, anchor);
		},
		d(detaching) {
			if (detaching) detach(col);
		}
	};
}

// (58:6) {#each month[1].days as date}
function create_each_block_3(ctx) {
	let col;

	return {
		c() {
			col = element("col");
			attr(col, "class", "svelte-pcimu8");
			toggle_class(col, "weekend", isWeekend(/*date*/ ctx[27]));
		},
		m(target, anchor) {
			insert(target, col, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*isWeekend, month*/ 16384) {
				toggle_class(col, "weekend", isWeekend(/*date*/ ctx[27]));
			}
		},
		d(detaching) {
			if (detaching) detach(col);
		}
	};
}

// (64:8) {#if showWeekNums}
function create_if_block_1(ctx) {
	let th;

	return {
		c() {
			th = element("th");
			th.textContent = "W";
			attr(th, "class", "svelte-pcimu8");
		},
		m(target, anchor) {
			insert(target, th, anchor);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (67:8) {#each daysOfWeek as dayOfWeek}
function create_each_block_2(ctx) {
	let th;
	let t_value = /*dayOfWeek*/ ctx[24] + "";
	let t;

	return {
		c() {
			th = element("th");
			t = text(t_value);
			attr(th, "class", "svelte-pcimu8");
		},
		m(target, anchor) {
			insert(target, th, anchor);
			append(th, t);
		},
		p(ctx, dirty) {
			if (dirty & /*daysOfWeek*/ 32768 && t_value !== (t_value = /*dayOfWeek*/ ctx[24] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(th);
		}
	};
}

// (75:10) {#if showWeekNums}
function create_if_block(ctx) {
	let weeknum;
	let current;

	const weeknum_spread_levels = [
		/*week*/ ctx[18],
		{
			metadata: getWeeklyMetadata(/*sources*/ ctx[8], /*week*/ ctx[18].days[0], /*today*/ ctx[10])
		},
		{ onClick: /*onClickWeek*/ ctx[7] },
		{
			onContextMenu: /*onContextMenuWeek*/ ctx[5]
		},
		{ onHover: /*onHoverWeek*/ ctx[3] },
		{ selectedId: /*selectedId*/ ctx[9] }
	];

	let weeknum_props = {};

	for (let i = 0; i < weeknum_spread_levels.length; i += 1) {
		weeknum_props = assign(weeknum_props, weeknum_spread_levels[i]);
	}

	weeknum = new WeekNum({ props: weeknum_props });

	return {
		c() {
			create_component(weeknum.$$.fragment);
		},
		m(target, anchor) {
			mount_component(weeknum, target, anchor);
			current = true;
		},
		p(ctx, dirty) {
			const weeknum_changes = (dirty & /*month, getWeeklyMetadata, sources, today, onClickWeek, onContextMenuWeek, onHoverWeek, selectedId*/ 18344)
			? get_spread_update(weeknum_spread_levels, [
					dirty & /*month*/ 16384 && get_spread_object(/*week*/ ctx[18]),
					dirty & /*getWeeklyMetadata, sources, month, today*/ 17664 && {
						metadata: getWeeklyMetadata(/*sources*/ ctx[8], /*week*/ ctx[18].days[0], /*today*/ ctx[10])
					},
					dirty & /*onClickWeek*/ 128 && { onClick: /*onClickWeek*/ ctx[7] },
					dirty & /*onContextMenuWeek*/ 32 && {
						onContextMenu: /*onContextMenuWeek*/ ctx[5]
					},
					dirty & /*onHoverWeek*/ 8 && { onHover: /*onHoverWeek*/ ctx[3] },
					dirty & /*selectedId*/ 512 && { selectedId: /*selectedId*/ ctx[9] }
				])
			: {};

			weeknum.$set(weeknum_changes);
		},
		i(local) {
			if (current) return;
			transition_in(weeknum.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(weeknum.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component(weeknum, detaching);
		}
	};
}

// (85:10) {#each week.days as day (day.format())}
function create_each_block_1(key_1, ctx) {
	let first;
	let day;
	let current;

	day = new Day({
			props: {
				date: /*day*/ ctx[21],
				today: /*today*/ ctx[10],
				displayedMonth: /*displayedMonth*/ ctx[0],
				onClick: /*onClickDay*/ ctx[6],
				onContextMenu: /*onContextMenuDay*/ ctx[4],
				onHover: /*onHoverDay*/ ctx[2],
				metadata: getDailyMetadata(/*sources*/ ctx[8], /*day*/ ctx[21], /*today*/ ctx[10]),
				selectedId: /*selectedId*/ ctx[9]
			}
		});

	return {
		key: key_1,
		first: null,
		c() {
			first = empty();
			create_component(day.$$.fragment);
			this.first = first;
		},
		m(target, anchor) {
			insert(target, first, anchor);
			mount_component(day, target, anchor);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			const day_changes = {};
			if (dirty & /*month*/ 16384) day_changes.date = /*day*/ ctx[21];
			if (dirty & /*today*/ 1024) day_changes.today = /*today*/ ctx[10];
			if (dirty & /*displayedMonth*/ 1) day_changes.displayedMonth = /*displayedMonth*/ ctx[0];
			if (dirty & /*onClickDay*/ 64) day_changes.onClick = /*onClickDay*/ ctx[6];
			if (dirty & /*onContextMenuDay*/ 16) day_changes.onContextMenu = /*onContextMenuDay*/ ctx[4];
			if (dirty & /*onHoverDay*/ 4) day_changes.onHover = /*onHoverDay*/ ctx[2];
			if (dirty & /*sources, month, today*/ 17664) day_changes.metadata = getDailyMetadata(/*sources*/ ctx[8], /*day*/ ctx[21], /*today*/ ctx[10]);
			if (dirty & /*selectedId*/ 512) day_changes.selectedId = /*selectedId*/ ctx[9];
			day.$set(day_changes);
		},
		i(local) {
			if (current) return;
			transition_in(day.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out(day.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(first);
			destroy_component(day, detaching);
		}
	};
}

// (73:6) {#each month as week (week.weekNum)}
function create_each_block(key_1, ctx) {
	let tr;
	let t0;
	let each_blocks = [];
	let each_1_lookup = new Map();
	let t1;
	let current;
	let if_block = /*showWeekNums*/ ctx[1] && create_if_block(ctx);
	let each_value_1 = /*week*/ ctx[18].days;
	const get_key = ctx => /*day*/ ctx[21].format();

	for (let i = 0; i < each_value_1.length; i += 1) {
		let child_ctx = get_each_context_1(ctx, each_value_1, i);
		let key = get_key(child_ctx);
		each_1_lookup.set(key, each_blocks[i] = create_each_block_1(key, child_ctx));
	}

	return {
		key: key_1,
		first: null,
		c() {
			tr = element("tr");
			if (if_block) if_block.c();
			t0 = space();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			this.first = tr;
		},
		m(target, anchor) {
			insert(target, tr, anchor);
			if (if_block) if_block.m(tr, null);
			append(tr, t0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tr, null);
			}

			append(tr, t1);
			current = true;
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (/*showWeekNums*/ ctx[1]) {
				if (if_block) {
					if_block.p(ctx, dirty);

					if (dirty & /*showWeekNums*/ 2) {
						transition_in(if_block, 1);
					}
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(tr, t0);
				}
			} else if (if_block) {
				group_outros();

				transition_out(if_block, 1, 1, () => {
					if_block = null;
				});

				check_outros();
			}

			if (dirty & /*month, today, displayedMonth, onClickDay, onContextMenuDay, onHoverDay, getDailyMetadata, sources, selectedId*/ 18261) {
				each_value_1 = /*week*/ ctx[18].days;
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value_1, each_1_lookup, tr, outro_and_destroy_block, create_each_block_1, t1, get_each_context_1);
				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block);

			for (let i = 0; i < each_value_1.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			transition_out(if_block);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(tr);
			if (if_block) if_block.d();

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function create_fragment$7(ctx) {
	let div;
	let nav;
	let t0;
	let table;
	let colgroup;
	let t1;
	let t2;
	let thead;
	let tr;
	let t3;
	let t4;
	let tbody;
	let each_blocks = [];
	let each2_lookup = new Map();
	let current;

	nav = new Nav({
			props: {
				today: /*today*/ ctx[10],
				displayedMonth: /*displayedMonth*/ ctx[0],
				incrementDisplayedMonth: /*incrementDisplayedMonth*/ ctx[11],
				decrementDisplayedMonth: /*decrementDisplayedMonth*/ ctx[12],
				resetDisplayedMonth: /*resetDisplayedMonth*/ ctx[13]
			}
		});

	let if_block0 = /*showWeekNums*/ ctx[1] && create_if_block_2();
	let each_value_3 = /*month*/ ctx[14][1].days;
	let each_blocks_2 = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks_2[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	let if_block1 = /*showWeekNums*/ ctx[1] && create_if_block_1();
	let each_value_2 = /*daysOfWeek*/ ctx[15];
	let each_blocks_1 = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks_1[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	let each_value = /*month*/ ctx[14];
	const get_key = ctx => /*week*/ ctx[18].weekNum;

	for (let i = 0; i < each_value.length; i += 1) {
		let child_ctx = get_each_context(ctx, each_value, i);
		let key = get_key(child_ctx);
		each2_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
	}

	return {
		c() {
			div = element("div");
			create_component(nav.$$.fragment);
			t0 = space();
			table = element("table");
			colgroup = element("colgroup");
			if (if_block0) if_block0.c();
			t1 = space();

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].c();
			}

			t2 = space();
			thead = element("thead");
			tr = element("tr");
			if (if_block1) if_block1.c();
			t3 = space();

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t4 = space();
			tbody = element("tbody");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr(table, "class", "calendar svelte-pcimu8");
			attr(div, "id", "calendar-container");
			attr(div, "class", "container svelte-pcimu8");
			toggle_class(div, "is-mobile", /*isMobile*/ ctx[16]);
		},
		m(target, anchor) {
			insert(target, div, anchor);
			mount_component(nav, div, null);
			append(div, t0);
			append(div, table);
			append(table, colgroup);
			if (if_block0) if_block0.m(colgroup, null);
			append(colgroup, t1);

			for (let i = 0; i < each_blocks_2.length; i += 1) {
				each_blocks_2[i].m(colgroup, null);
			}

			append(table, t2);
			append(table, thead);
			append(thead, tr);
			if (if_block1) if_block1.m(tr, null);
			append(tr, t3);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].m(tr, null);
			}

			append(table, t4);
			append(table, tbody);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(tbody, null);
			}

			current = true;
		},
		p(ctx, [dirty]) {
			const nav_changes = {};
			if (dirty & /*today*/ 1024) nav_changes.today = /*today*/ ctx[10];
			if (dirty & /*displayedMonth*/ 1) nav_changes.displayedMonth = /*displayedMonth*/ ctx[0];
			nav.$set(nav_changes);

			if (/*showWeekNums*/ ctx[1]) {
				if (if_block0) ; else {
					if_block0 = create_if_block_2();
					if_block0.c();
					if_block0.m(colgroup, t1);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty & /*isWeekend, month*/ 16384) {
				each_value_3 = /*month*/ ctx[14][1].days;
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks_2[i]) {
						each_blocks_2[i].p(child_ctx, dirty);
					} else {
						each_blocks_2[i] = create_each_block_3(child_ctx);
						each_blocks_2[i].c();
						each_blocks_2[i].m(colgroup, null);
					}
				}

				for (; i < each_blocks_2.length; i += 1) {
					each_blocks_2[i].d(1);
				}

				each_blocks_2.length = each_value_3.length;
			}

			if (/*showWeekNums*/ ctx[1]) {
				if (if_block1) ; else {
					if_block1 = create_if_block_1();
					if_block1.c();
					if_block1.m(tr, t3);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (dirty & /*daysOfWeek*/ 32768) {
				each_value_2 = /*daysOfWeek*/ ctx[15];
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_2(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(tr, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_2.length;
			}

			if (dirty & /*month, today, displayedMonth, onClickDay, onContextMenuDay, onHoverDay, getDailyMetadata, sources, selectedId, getWeeklyMetadata, onClickWeek, onContextMenuWeek, onHoverWeek, showWeekNums*/ 18431) {
				each_value = /*month*/ ctx[14];
				group_outros();
				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each2_lookup, tbody, outro_and_destroy_block, create_each_block, null, get_each_context);
				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(nav.$$.fragment, local);

			for (let i = 0; i < each_value.length; i += 1) {
				transition_in(each_blocks[i]);
			}

			current = true;
		},
		o(local) {
			transition_out(nav.$$.fragment, local);

			for (let i = 0; i < each_blocks.length; i += 1) {
				transition_out(each_blocks[i]);
			}

			current = false;
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_component(nav);
			if (if_block0) if_block0.d();
			destroy_each(each_blocks_2, detaching);
			if (if_block1) if_block1.d();
			destroy_each(each_blocks_1, detaching);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].d();
			}
		}
	};
}

function instance$7($$self, $$props, $$invalidate) {
	
	
	let { localeData } = $$props;
	let { showWeekNums = false } = $$props;
	let { onHoverDay } = $$props;
	let { onHoverWeek } = $$props;
	let { onContextMenuDay } = $$props;
	let { onContextMenuWeek } = $$props;
	let { onClickDay } = $$props;
	let { onClickWeek } = $$props;
	let { sources = [] } = $$props;
	let { selectedId } = $$props;
	let { today = window.moment() } = $$props;
	let { displayedMonth = today } = $$props;
	let month;
	let daysOfWeek;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let isMobile = window.app.isMobile;

	function incrementDisplayedMonth() {
		$$invalidate(0, displayedMonth = displayedMonth.clone().add(1, "month"));
	}

	function decrementDisplayedMonth() {
		$$invalidate(0, displayedMonth = displayedMonth.clone().subtract(1, "month"));
	}

	function resetDisplayedMonth() {
		$$invalidate(0, displayedMonth = today.clone());
	}

	$$self.$$set = $$props => {
		if ("localeData" in $$props) $$invalidate(17, localeData = $$props.localeData);
		if ("showWeekNums" in $$props) $$invalidate(1, showWeekNums = $$props.showWeekNums);
		if ("onHoverDay" in $$props) $$invalidate(2, onHoverDay = $$props.onHoverDay);
		if ("onHoverWeek" in $$props) $$invalidate(3, onHoverWeek = $$props.onHoverWeek);
		if ("onContextMenuDay" in $$props) $$invalidate(4, onContextMenuDay = $$props.onContextMenuDay);
		if ("onContextMenuWeek" in $$props) $$invalidate(5, onContextMenuWeek = $$props.onContextMenuWeek);
		if ("onClickDay" in $$props) $$invalidate(6, onClickDay = $$props.onClickDay);
		if ("onClickWeek" in $$props) $$invalidate(7, onClickWeek = $$props.onClickWeek);
		if ("sources" in $$props) $$invalidate(8, sources = $$props.sources);
		if ("selectedId" in $$props) $$invalidate(9, selectedId = $$props.selectedId);
		if ("today" in $$props) $$invalidate(10, today = $$props.today);
		if ("displayedMonth" in $$props) $$invalidate(0, displayedMonth = $$props.displayedMonth);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*displayedMonth, localeData*/ 131073) {
			$$invalidate(14, month = getMonth(displayedMonth, localeData));
		}

		if ($$self.$$.dirty & /*today, localeData*/ 132096) {
			$$invalidate(15, daysOfWeek = getDaysOfWeek(today, localeData));
		}
	};

	return [
		displayedMonth,
		showWeekNums,
		onHoverDay,
		onHoverWeek,
		onContextMenuDay,
		onContextMenuWeek,
		onClickDay,
		onClickWeek,
		sources,
		selectedId,
		today,
		incrementDisplayedMonth,
		decrementDisplayedMonth,
		resetDisplayedMonth,
		month,
		daysOfWeek,
		isMobile,
		localeData
	];
}

class Calendar$1 extends SvelteComponent {
	constructor(options) {
		super();
		if (!document.getElementById("svelte-pcimu8-style")) add_css();

		init(this, options, instance$7, create_fragment$7, not_equal, {
			localeData: 17,
			showWeekNums: 1,
			onHoverDay: 2,
			onHoverWeek: 3,
			onContextMenuDay: 4,
			onContextMenuWeek: 5,
			onClickDay: 6,
			onClickWeek: 7,
			sources: 8,
			selectedId: 9,
			today: 10,
			displayedMonth: 0,
			incrementDisplayedMonth: 11,
			decrementDisplayedMonth: 12,
			resetDisplayedMonth: 13
		});
	}

	get incrementDisplayedMonth() {
		return this.$$.ctx[11];
	}

	get decrementDisplayedMonth() {
		return this.$$.ctx[12];
	}

	get resetDisplayedMonth() {
		return this.$$.ctx[13];
	}
}

const langToMomentLocale = {
    en: "en-gb",
    zh: "zh-cn",
    "zh-TW": "zh-tw",
    ru: "ru",
    ko: "ko",
    it: "it",
    id: "id",
    ro: "ro",
    "pt-BR": "pt-br",
    cz: "cs",
    da: "da",
    de: "de",
    es: "es",
    fr: "fr",
    no: "nn",
    pl: "pl",
    pt: "pt",
    tr: "tr",
    hi: "hi",
    nl: "nl",
    ar: "ar",
    ja: "ja",
};
const weekdays = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
];
function overrideGlobalMomentWeekStart(weekStart) {
    const { moment } = window;
    const currentLocale = moment.locale();
    // Save the initial locale weekspec so that we can restore
    // it when toggling between the different options in settings.
    if (!window._bundledLocaleWeekSpec) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        window._bundledLocaleWeekSpec = moment.localeData()._week;
    }
    if (weekStart === "locale") {
        moment.updateLocale(currentLocale, {
            week: window._bundledLocaleWeekSpec,
        });
    }
    else {
        moment.updateLocale(currentLocale, {
            week: {
                dow: weekdays.indexOf(weekStart) || 0,
            },
        });
    }
}
/**
 * Sets the locale used by the calendar. This allows the calendar to
 * default to the user's locale (e.g. Start Week on Sunday/Monday/Friday)
 *
 * @param localeOverride locale string (e.g. "en-US")
 */
function configureGlobalMomentLocale(localeOverride = "system-default", weekStart = "locale") {
    var _a;
    const obsidianLang = localStorage.getItem("language") || "en";
    const systemLang = (_a = navigator.language) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    let momentLocale = langToMomentLocale[obsidianLang];
    if (localeOverride !== "system-default") {
        momentLocale = localeOverride;
    }
    else if (systemLang.startsWith(obsidianLang)) {
        // If the system locale is more specific (en-gb vs en), use the system locale.
        momentLocale = systemLang;
    }
    const currentLocale = window.moment.locale(momentLocale);
    console.debug(`[Calendar] Trying to switch Moment.js global locale to ${momentLocale}, got ${currentLocale}`);
    overrideGlobalMomentWeekStart(weekStart);
    return currentLocale;
}

/* src/ui/Calendar.svelte generated by Svelte v3.35.0 */

function create_fragment(ctx) {
	let calendarbase;
	let updating_displayedMonth;
	let current;

	function calendarbase_displayedMonth_binding(value) {
		/*calendarbase_displayedMonth_binding*/ ctx[12](value);
	}

	let calendarbase_props = {
		sources: /*sources*/ ctx[1],
		today: /*today*/ ctx[9],
		onHoverDay: /*onHoverDay*/ ctx[2],
		onHoverWeek: /*onHoverWeek*/ ctx[3],
		onContextMenuDay: /*onContextMenuDay*/ ctx[6],
		onContextMenuWeek: /*onContextMenuWeek*/ ctx[7],
		onClickDay: /*onClickDay*/ ctx[4],
		onClickWeek: /*onClickWeek*/ ctx[5],
		localeData: /*today*/ ctx[9].localeData(),
		selectedId: /*$activeFile*/ ctx[10],
		showWeekNums: /*$settings*/ ctx[8].showWeeklyNote
	};

	if (/*displayedMonth*/ ctx[0] !== void 0) {
		calendarbase_props.displayedMonth = /*displayedMonth*/ ctx[0];
	}

	calendarbase = new Calendar$1({ props: calendarbase_props });
	binding_callbacks$1.push(() => bind(calendarbase, "displayedMonth", calendarbase_displayedMonth_binding));

	return {
		c() {
			create_component$1(calendarbase.$$.fragment);
		},
		m(target, anchor) {
			mount_component$1(calendarbase, target, anchor);
			current = true;
		},
		p(ctx, [dirty]) {
			const calendarbase_changes = {};
			if (dirty & /*sources*/ 2) calendarbase_changes.sources = /*sources*/ ctx[1];
			if (dirty & /*today*/ 512) calendarbase_changes.today = /*today*/ ctx[9];
			if (dirty & /*onHoverDay*/ 4) calendarbase_changes.onHoverDay = /*onHoverDay*/ ctx[2];
			if (dirty & /*onHoverWeek*/ 8) calendarbase_changes.onHoverWeek = /*onHoverWeek*/ ctx[3];
			if (dirty & /*onContextMenuDay*/ 64) calendarbase_changes.onContextMenuDay = /*onContextMenuDay*/ ctx[6];
			if (dirty & /*onContextMenuWeek*/ 128) calendarbase_changes.onContextMenuWeek = /*onContextMenuWeek*/ ctx[7];
			if (dirty & /*onClickDay*/ 16) calendarbase_changes.onClickDay = /*onClickDay*/ ctx[4];
			if (dirty & /*onClickWeek*/ 32) calendarbase_changes.onClickWeek = /*onClickWeek*/ ctx[5];
			if (dirty & /*today*/ 512) calendarbase_changes.localeData = /*today*/ ctx[9].localeData();
			if (dirty & /*$activeFile*/ 1024) calendarbase_changes.selectedId = /*$activeFile*/ ctx[10];
			if (dirty & /*$settings*/ 256) calendarbase_changes.showWeekNums = /*$settings*/ ctx[8].showWeeklyNote;

			if (!updating_displayedMonth && dirty & /*displayedMonth*/ 1) {
				updating_displayedMonth = true;
				calendarbase_changes.displayedMonth = /*displayedMonth*/ ctx[0];
				add_flush_callback(() => updating_displayedMonth = false);
			}

			calendarbase.$set(calendarbase_changes);
		},
		i(local) {
			if (current) return;
			transition_in$1(calendarbase.$$.fragment, local);
			current = true;
		},
		o(local) {
			transition_out$1(calendarbase.$$.fragment, local);
			current = false;
		},
		d(detaching) {
			destroy_component$1(calendarbase, detaching);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let $settings;
	let $activeFile;
	component_subscribe($$self, settings, $$value => $$invalidate(8, $settings = $$value));
	component_subscribe($$self, activeFile, $$value => $$invalidate(10, $activeFile = $$value));
	
	
	let today;
	let { displayedMonth = today } = $$props;
	let { sources } = $$props;
	let { onHoverDay } = $$props;
	let { onHoverWeek } = $$props;
	let { onClickDay } = $$props;
	let { onClickWeek } = $$props;
	let { onContextMenuDay } = $$props;
	let { onContextMenuWeek } = $$props;

	function tick() {
		$$invalidate(9, today = window.moment());
	}

	function getToday(settings) {
		configureGlobalMomentLocale(settings.localeOverride, settings.weekStart);
		dailyNotes.reindex();
		weeklyNotes.reindex();
		return window.moment();
	}

	// 1 minute heartbeat to keep `today` reflecting the current day
	let heartbeat = setInterval(
		() => {
			tick();
			const isViewingCurrentMonth = displayedMonth.isSame(today, "day");

			if (isViewingCurrentMonth) {
				// if it's midnight on the last day of the month, this will
				// update the display to show the new month.
				$$invalidate(0, displayedMonth = today);
			}
		},
		1000 * 60
	);

	onDestroy(() => {
		clearInterval(heartbeat);
	});

	function calendarbase_displayedMonth_binding(value) {
		displayedMonth = value;
		$$invalidate(0, displayedMonth);
	}

	$$self.$$set = $$props => {
		if ("displayedMonth" in $$props) $$invalidate(0, displayedMonth = $$props.displayedMonth);
		if ("sources" in $$props) $$invalidate(1, sources = $$props.sources);
		if ("onHoverDay" in $$props) $$invalidate(2, onHoverDay = $$props.onHoverDay);
		if ("onHoverWeek" in $$props) $$invalidate(3, onHoverWeek = $$props.onHoverWeek);
		if ("onClickDay" in $$props) $$invalidate(4, onClickDay = $$props.onClickDay);
		if ("onClickWeek" in $$props) $$invalidate(5, onClickWeek = $$props.onClickWeek);
		if ("onContextMenuDay" in $$props) $$invalidate(6, onContextMenuDay = $$props.onContextMenuDay);
		if ("onContextMenuWeek" in $$props) $$invalidate(7, onContextMenuWeek = $$props.onContextMenuWeek);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*$settings*/ 256) {
			$$invalidate(9, today = getToday($settings));
		}
	};

	return [
		displayedMonth,
		sources,
		onHoverDay,
		onHoverWeek,
		onClickDay,
		onClickWeek,
		onContextMenuDay,
		onContextMenuWeek,
		$settings,
		today,
		$activeFile,
		tick,
		calendarbase_displayedMonth_binding
	];
}

class Calendar extends SvelteComponent$1 {
	constructor(options) {
		super();

		init$1(this, options, instance, create_fragment, not_equal$1, {
			displayedMonth: 0,
			sources: 1,
			onHoverDay: 2,
			onHoverWeek: 3,
			onClickDay: 4,
			onClickWeek: 5,
			onContextMenuDay: 6,
			onContextMenuWeek: 7,
			tick: 11
		});
	}

	get tick() {
		return this.$$.ctx[11];
	}
}

function showFileMenu(app, file, position) {
    const fileMenu = new obsidian.Menu(app);
    fileMenu.addItem((item) => item
        .setTitle("Delete")
        .setIcon("trash")
        .onClick(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.fileManager.promptForFileDeletion(file);
    }));
    app.workspace.trigger("file-menu", fileMenu, file, "calendar-context-menu", null);
    fileMenu.showAtPosition(position);
}

const getStreakClasses = (file) => {
    return classList({
        "has-note": !!file,
    });
};
const streakSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        return {
            classes: getStreakClasses(file),
            dots: [],
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        return {
            classes: getStreakClasses(file),
            dots: [],
        };
    },
};

function getNoteTags(note) {
    var _a;
    if (!note) {
        return [];
    }
    const { metadataCache } = window.app;
    const frontmatter = (_a = metadataCache.getFileCache(note)) === null || _a === void 0 ? void 0 : _a.frontmatter;
    const tags = [];
    if (frontmatter) {
        const frontmatterTags = obsidian.parseFrontMatterTags(frontmatter) || [];
        tags.push(...frontmatterTags);
    }
    // strip the '#' at the beginning
    return tags.map((tag) => tag.substring(1));
}
function getFormattedTagAttributes(note) {
    const attrs = {};
    const tags = getNoteTags(note);
    const [emojiTags, nonEmojiTags] = partition(tags, (tag) => /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff])/.test(tag));
    if (nonEmojiTags) {
        attrs["data-tags"] = nonEmojiTags.join(" ");
    }
    if (emojiTags) {
        attrs["data-emoji-tag"] = emojiTags[0];
    }
    return attrs;
}
const customTagsSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        return {
            dataAttributes: getFormattedTagAttributes(file),
            dots: [],
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        return {
            dataAttributes: getFormattedTagAttributes(file),
            dots: [],
        };
    },
};

async function getNumberOfRemainingTasks(note) {
    if (!note) {
        return 0;
    }
    const { vault } = window.app;
    const fileContents = await vault.cachedRead(note);
    return (fileContents.match(/(-|\*) \[ \]/g) || []).length;
}
async function getDotsForDailyNote$1(dailyNote) {
    if (!dailyNote) {
        return [];
    }
    const numTasks = await getNumberOfRemainingTasks(dailyNote);
    const dots = [];
    if (numTasks) {
        dots.push({
            className: "task",
            color: "default",
            isFilled: false,
        });
    }
    return dots;
}
const tasksSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        const dots = await getDotsForDailyNote$1(file);
        return {
            dots,
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const dots = await getDotsForDailyNote$1(file);
        return {
            dots,
        };
    },
};

const NUM_MAX_DOTS = 5;
async function getWordLengthAsDots(note) {
    const { wordsPerDot = DEFAULT_WORDS_PER_DOT } = get_store_value(settings);
    if (!note || wordsPerDot <= 0) {
        return 0;
    }
    const fileContents = await window.app.vault.cachedRead(note);
    const wordCount = getWordCount(fileContents);
    const numDots = wordCount / wordsPerDot;
    return clamp(Math.floor(numDots), 1, NUM_MAX_DOTS);
}
async function getDotsForDailyNote(dailyNote) {
    if (!dailyNote) {
        return [];
    }
    const numSolidDots = await getWordLengthAsDots(dailyNote);
    const dots = [];
    for (let i = 0; i < numSolidDots; i++) {
        dots.push({
            color: "default",
            isFilled: true,
        });
    }
    return dots;
}
const wordCountSource = {
    getDailyMetadata: async (date) => {
        const file = getDailyNote_1(date, get_store_value(dailyNotes));
        const dots = await getDotsForDailyNote(file);
        return {
            dots,
        };
    },
    getWeeklyMetadata: async (date) => {
        const file = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const dots = await getDotsForDailyNote(file);
        return {
            dots,
        };
    },
};

// ========== macOS Calendar & Reminders Integration ==========
const nodeChildProcess = require("child_process");
const nodeFS = require("fs");
const nodePath = require("path");
const nodeOS = require("os");

class MacOSIntegration {
    constructor(plugin) {
        this.plugin = plugin;
        this.refreshTimer = null;
        this.eventsPanelEl = null;
        this.selectedDate = window.moment();
        // Native helper binary path (EventKit, much faster than JXA)
        this.helperPath = plugin.helperPath || null;
        if (this.helperPath) {
            try { if (!nodeFS.existsSync(this.helperPath)) { this.helperPath = null; } } catch(e) { this.helperPath = null; }
        }
        if (!this.helperPath) {
            console.warn("[Calendian] EventKit helper not found — discovery/preload will fail");
        }
        // REQ-PERM-001..004, REQ-ERR-001: Independent permission/error state per source
        this.permissionState = {
            calendar: 'unknown',   // 'unknown' | 'granted' | 'denied' | 'timeout' | 'error'
            reminders: 'unknown'
        };
        this.lastError = {
            calendar: null,        // { type, message, timestamp }
            reminders: null
        };
        this.isLoading = {
            calendar: false,
            reminders: false
        };
        // Pre-loaded cache: all events/reminders for ±6 months
        this.allEvents = [];
        this.allReminders = [];
        this.calendarColors = {};  // { calendarName: "r,g,b" }
        this.cacheStart = null;    // moment
        this.cacheEnd = null;      // moment
        // Diagnostics
        this.lastRefreshTime = null;
        this.lastRefreshDurationMs = null;
        this.sourceCounts = { calendars: 0, reminderLists: 0 };
        // REQ-CAL-008: Expandable event detail state
        this._expandedEvents = new Set();
        // REQ-UX-006: Dot color CSS management for month cell event dots
        this._dotStyleEl = null;
        this._dotColorClasses = {};
        this._calendarSources = null;  // Reference to sources array passed to Calendar
    }

    // --- Execute native helper (EventKit, fast) ---
        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)

    // REQ-ERR-001: Classify JXA errors by type
        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)

    // --- Execute JXA via spawn + stdin (with 30s timeout) ---
        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)

    // --- Load events from persistent disk cache (instant) ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Check if cache is fresh enough to skip background refresh ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Save events to persistent disk cache ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Save reminders to persistent disk cache ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Load reminders from persistent disk cache (instant) ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Preload all events for ±6 months ---
    // --- Preload events via EventKit helper (fast) ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Preload reminders via EventKit helper (fast) ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Get events for a specific date from cache ---
    // REQ-CAL-009: Multi-day events appear on every overlapping day
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Get reminders for a specific date from cache ---
    // REQ-REM-007: displayRange controls the date window — 'today', '7days', or 'all'
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Get reminders without a due date (REQ-REM-006) ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Check if error is a permission error (delegates to classifyError) ---
        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)

    // --- Parse event data ---
    // v0.1 fields per SPEC §5.1: id, source, calendarId, calendarName, calendarColor,
    //   title, start, end, isAllDay, isRecurring, recurrenceSummary,
    //   location, url, notes, attendees, alarms
    // v0.2 fields (REQ-CAL-007): location, url, notes populated from JXA
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Parse reminder data ---
    // REQ-DATA-007: Treat optional JXA fields as optional
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Count unique reminder lists ---
        // EXTRACTED → src/cache/schedule-cache.js (see src/ modules)

    // --- Initial load: fire-and-forget background sync, render immediately ---
    async init(forceRefresh) {
        // Hard debounce: only allow one init per 2 seconds (skip for manual refresh)
        var now = Date.now();
        if (!forceRefresh && this._lastInitTime && (now - this._lastInitTime) < 2000) {
            return;
        }
        this._lastInitTime = now;
        var initStart = now;
        console.log("[Calendian] init() starting..." + (forceRefresh ? " (forced)" : ""));
        const opts = this.plugin.options || {};

        // Force refresh: skip cache, go directly to helper
        if (forceRefresh) {
            console.log("[Calendian] Force refresh — loading fresh data from helper...");
            this.renderSyncing();
            this.initBackground(initStart, true);
            return;
        }

        // Phase 1: Try disk cache first (near-instant)
        var calCached = false, remCached = false;
        if (opts.enableCalendar !== false) calCached = await this.loadEventsFromCache();
        if (opts.enableReminders !== false) remCached = await this.loadRemindersFromCache();

        if (calCached || remCached) {
            // Show cached data immediately
            console.log("[Calendian] Showing cached data (" + (Date.now() - initStart) + "ms)");
            this.lastRefreshTime = new Date().toISOString();
            this.lastRefreshDurationMs = Date.now() - initStart;
            this.render();

            // Phase 2: Only background refresh if cache is stale
            if (this.isCacheFresh()) {
                console.log("[Calendian] Cache is fresh, skipping background refresh");
                this.lastRefreshTime = new Date().toISOString();
            } else {
                console.log("[Calendian] Cache is stale, starting background refresh...");
                this.refreshInBackground();
            }
        } else {
            // First run: show syncing state and start background load
            console.log("[Calendian] First run, starting background sync...");
            this.renderSyncing();
            this.initBackground(initStart);
        }
    }

    // Background sync without blocking the UI
    // force=true bypasses the _refreshRunning guard for post-write refresh (REQ-SYNC-008)
    async initBackground(initStart, force) {
        if (!force && this._refreshRunning) { console.log("[Calendian] initBackground skipped (refresh already running)"); return; }
        this._refreshRunning = true;
        const opts = this.plugin.options || {};
        const promises = [];
        if (opts.enableCalendar !== false) promises.push(this.preloadAll());
        if (opts.enableReminders !== false) promises.push(this.preloadReminders());
        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
        console.log("[Calendian] Background sync done in " + (Date.now() - initStart) + "ms. cal=" + this.permissionState.calendar + " rem=" + this.permissionState.reminders);
        this._refreshRunning = false;
        this.lastRefreshTime = new Date().toISOString();
        this.lastRefreshDurationMs = Date.now() - initStart;
        this.render();
    }

    // Refresh from JXA in background (used when cache already shown)
    async refreshInBackground() {
        if (this._refreshRunning) { console.log("[Calendian] Background refresh skipped (refresh already running)"); return; }
        this._refreshRunning = true;
        var start = Date.now();
        console.log("[Calendian] Background refresh from macOS...");
        const opts = this.plugin.options || {};
        const promises = [];
        if (opts.enableCalendar !== false) promises.push(this.preloadAll());
        if (opts.enableReminders !== false) promises.push(this.preloadReminders());
        if (promises.length > 0) {
            await Promise.allSettled(promises);
        }
        console.log("[Calendian] Background refresh done in " + (Date.now() - start) + "ms. cal=" + this.permissionState.calendar + " rem=" + this.permissionState.reminders);
        this._refreshRunning = false;
        this.lastRefreshTime = new Date().toISOString();
        this.lastRefreshDurationMs = Date.now() - start;
        this.render();
    }

    // Render syncing state (shown during first-ever load)
    renderSyncing() {
        if (!this.eventsPanelEl) return;
        this.eventsPanelEl.empty();
        var syncEl = this.eventsPanelEl.createDiv("macos-loading");
        syncEl.textContent = "Syncing with macOS Calendar & Reminders...";
        var subEl = this.eventsPanelEl.createDiv("macos-empty");
        subEl.textContent = "This may take a moment on first run. Data is cached for future launches.";
    }

    // --- Select a date and render from cache (instant) ---
    selectDate(date) {
        this.selectedDate = date;
        this.render();
    }

    // --- Render loading state ---
    renderLoading() {
        if (!this.eventsPanelEl) return;
        this.eventsPanelEl.empty();
        const loadingEl = this.eventsPanelEl.createDiv("macos-loading");
        loadingEl.textContent = "Loading events & reminders...";
    }

    // --- Check if event is within cached range ---
    isDateInCacheRange(date) {
        if (!this.cacheStart || !this.cacheEnd) return true;
        return date.isSameOrAfter(this.cacheStart, 'day') && date.isSameOrBefore(this.cacheEnd, 'day');
    }

    // --- Convert RGB string to CSS color ---
    calendarToCSS(rgbStr) {
        if (!rgbStr) return null;
        const parts = rgbStr.split(",").map(Number);
        if (parts.length < 3 || isNaN(parts[0])) return null;
        return `rgb(${Math.round(parts[0]*255)}, ${Math.round(parts[1]*255)}, ${Math.round(parts[2]*255)})`;
    }

    // --- REQ-UX-006: Metadata source for month cell event dots ---
    // Manages dynamic CSS rules for calendar-colored dots

    _ensureDotStyleEl() {
        if (!this._dotStyleEl) {
            this._dotStyleEl = document.createElement("style");
            this._dotStyleEl.id = "calendian-dot-colors";
            document.head.appendChild(this._dotStyleEl);
        }
        return this._dotStyleEl;
    }

    _registerDotColor(cssColor) {
        if (!cssColor || this._dotColorClasses[cssColor]) return this._dotColorClasses[cssColor];
        // Generate a stable class name from the CSS color
        var className = "caldot-" + cssColor.replace(/[^a-zA-Z0-9]/g, "");
        this._dotColorClasses[cssColor] = className;
        // Inject CSS rule: override fill for filled dots, stroke for hollow dots
        var styleEl = this._ensureDotStyleEl();
        styleEl.textContent += "\n." + className + ".filled { fill: " + cssColor + " !important; }\n." + className + ".hollow { stroke: " + cssColor + " !important; }";
        return className;
    }

    // Refresh dot color CSS after data loads (new calendars may have been discovered)
    _refreshDotColorCSS() {
        var colors = this.calendarColors || {};
        for (var calName in colors) {
            var cssColor = this.calendarToCSS(colors[calName]);
            if (cssColor) {
                this._registerDotColor(cssColor);
            }
        }
    }

    // Check if an event spans a given date (for multi-day dot display)
    _eventSpansDate(evt, targetDate) {
        if (!evt.start) return false;
        var d = targetDate.toDate();
        var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
        var dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
        var isAllDay = evt.isAllDay !== undefined ? evt.isAllDay : evt.allday;
        var eStart = evt.start;
        var eEnd = evt.end || eStart;
        if (isAllDay) {
            // All-day: compare date-only
            var es = new Date(eStart.getFullYear(), eStart.getMonth(), eStart.getDate());
            var ee = eEnd ? new Date(eEnd.getFullYear(), eEnd.getMonth(), eEnd.getDate(), 23, 59, 59) : es;
            return es <= dayEnd && ee >= dayStart;
        }
        // Timed events: check if event overlaps with the day
        return eStart <= dayEnd && eEnd >= dayStart;
    }

    getEventMetadataSource() {
        var self = this;
        return {
            getDailyMetadata: function(date) {
                var dots = [];
                // Refresh dot color CSS in case new colors appeared
                self._refreshDotColorCSS();

                // Collect unique calendar colors for events on this date
                var calendarDots = {};  // cssColor -> className
                var filterIds = (self.plugin.options && self.plugin.options.selectedCalendarIds) || [];
                var calColors = self.calendarColors || {};
                var showCal = (self.plugin.options && self.plugin.options.enableCalendar) !== false;

                if (showCal && self.allEvents.length > 0) {
                    for (var i = 0; i < self.allEvents.length; i++) {
                        var evt = self.allEvents[i];
                        if (!self._eventSpansDate(evt, date)) continue;
                        // Apply calendar source filter
                        if (filterIds.length > 0) {
                            var eName = evt.calendarName || evt.calendar || "";
                            var eColor = calColors[eName] || "";
                            var eCompoundId = eName + "|||" + eColor;
                            var eId = evt.calendarId || evt.id || "";
                            var matched = filterIds.includes(eCompoundId) || filterIds.includes(eId) || filterIds.includes(eName);
                            if (!matched) continue;
                        }
                        // Get the calendar color for this event
                        var colorStr = evt.calendarColor || calColors[evt.calendarName] || "";
                        var cssColor = colorStr ? self.calendarToCSS(colorStr) : null;
                        if (!cssColor) {
                            // Fallback: use default dot color for events without calendar color
                            if (!calendarDots["__default__"]) {
                                calendarDots["__default__"] = true;
                                dots.push({ className: "", isFilled: true });
                            }
                        } else if (!calendarDots[cssColor]) {
                            var className = self._registerDotColor(cssColor);
                            calendarDots[cssColor] = className;
                            dots.push({ className: className, isFilled: true });
                        }
                    }
                }

                // Reminder dot (hollow, muted color)
                var showRem = (self.plugin.options && self.plugin.options.enableReminders) !== false;
                if (showRem && self.allReminders.length > 0) {
                    var remFilterIds = (self.plugin.options && self.plugin.options.selectedReminderListIds) || [];
                    var hasReminders = false;
                    var d = date.toDate();
                    var dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
                    var dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
                    for (var j = 0; j < self.allReminders.length; j++) {
                        var rem = self.allReminders[j];
                        // Apply reminder list filter
                        if (remFilterIds.length > 0) {
                            var rId = rem.listId || rem.id || "";
                            var rName = rem.listName || rem.list || "";
                            var rMatched = remFilterIds.includes(rId) || remFilterIds.includes(rName);
                            if (!rMatched) continue;
                        }
                        if (!rem.due) {
                            var today = new Date();
                            if (d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()) {
                                hasReminders = true;
                                break;
                            }
                            continue;
                        }
                        if (rem.due >= dayStart && rem.due <= dayEnd) {
                            hasReminders = true;
                            break;
                        }
                    }
                    if (hasReminders) {
                        dots.push({ className: "calendian-reminder-dot", isFilled: false });
                    }
                }

                return { dots: dots };
            },
            getWeeklyMetadata: function(date) {
                // Weekly view uses same dot logic
                return { dots: [] };
            }
        };
    }

    // --- Check if event is starting soon (within 30 min) ---
    isStartingSoon(evt) {
        var isAllDay = evt.isAllDay !== undefined ? evt.isAllDay : evt.allday;
        if (!evt.start || isAllDay) return false;
        const now = new Date();
        const diff = evt.start.getTime() - now.getTime();
        return diff > 0 && diff <= 30 * 60 * 1000;
    }

    // --- Check if event is currently ongoing ---
    isOngoing(evt) {
        var isAllDay = evt.isAllDay !== undefined ? evt.isAllDay : evt.allday;
        if (!evt.start || !evt.end || isAllDay) return false;
        const now = new Date();
        return now >= evt.start && now <= evt.end;
    }

    // --- Render the panel ---
    render() {
        if (!this.eventsPanelEl) return;
        this.eventsPanelEl.empty();

        const opts = this.plugin.options || {};
        const showCal = opts.enableCalendar !== false;
        const showRem = opts.enableReminders !== false;

        // REQ-PLAT-004: Platform check
        if (!isMacOS()) {
            const errEl = this.eventsPanelEl.createDiv("macos-error");
            errEl.textContent = "Calendian requires macOS. This plugin reads from Calendar.app and Reminders.app.";
            return;
        }

        // REQ-PERM-004: Distinguish permission failure from empty data
        var calPerm = this.permissionState.calendar;
        var remPerm = this.permissionState.reminders;

        // Both permission denied
        if (showCal && showRem && calPerm === 'denied' && remPerm === 'denied') {
            this.renderPermissionBanner(this.eventsPanelEl, 'both');
            return;
        }
        // Only calendar enabled and denied
        if (showCal && !showRem && calPerm === 'denied') {
            this.renderPermissionBanner(this.eventsPanelEl, 'calendar');
            return;
        }
        // Only reminders enabled and denied
        if (!showCal && showRem && remPerm === 'denied') {
            this.renderPermissionBanner(this.eventsPanelEl, 'reminders');
            return;
        }

        // REQ-CACHE-002: Cache miss warning
        if (!this.isDateInCacheRange(this.selectedDate)) {
            const missEl = this.eventsPanelEl.createDiv("macos-cache-miss");
            missEl.createEl("p").textContent = "Selected date is outside the cached range.";
            const todayBtn = missEl.createEl("button", { cls: "macos-today-btn" });
            todayBtn.textContent = "← Go to Today";
            todayBtn.addEventListener("click", () => {
                this.selectedDate = window.moment();
                this.render();
                if (this.calendarComponent) {
                    this.calendarComponent.$set({ displayedMonth: window.moment() });
                }
            });
            return;
        }

        // REQ-UX-010: Today summary bar — quick glance at today's counts
        const today = window.moment();
        const isToday = this.selectedDate.isSame(today, "day");
        const todayEvents = this.getEventsForDate(today);
        // Count all incomplete reminders (with or without due date)
        var todayReminderCount = 0;
        for (var ri = 0; ri < this.allReminders.length; ri++) {
            if (!this.allReminders[ri].completed) todayReminderCount++;
        }
        var overdueCount = 0;
        var nowTs = Date.now();
        for (var oi = 0; oi < this.allReminders.length; oi++) {
            var r = this.allReminders[oi];
            if (!r.completed && r.due && r.due.getTime() < nowTs) overdueCount++;
        }
        const summaryBar = this.eventsPanelEl.createDiv("macos-today-summary");
        const summaryText = summaryBar.createDiv("macos-today-summary-text");
        var parts = [];
        parts.push(todayEvents.length + " events");
        parts.push(todayReminderCount + " reminders");
        if (overdueCount > 0) parts.push(overdueCount + " overdue");
        summaryText.textContent = "📅 Today · " + parts.join(" · ");
        if (!isToday) {
            summaryBar.addClass("macos-clickable");
            summaryBar.setAttribute("title", "Click to go to today");
            summaryBar.addEventListener("click", () => {
                this.selectedDate = window.moment();
                this.render();
                if (this.calendarComponent) {
                    this.calendarComponent.$set({ displayedMonth: window.moment() });
                }
            });
        }

        // Date header row with refresh button
        const headerRow = this.eventsPanelEl.createDiv("macos-date-header-row");
        const dateLabel = headerRow.createDiv("macos-date-label");
        if (isToday) {
            dateLabel.textContent = "Today · " + this.selectedDate.format("YYYY-MM-DD");
        } else {
            dateLabel.textContent = this.selectedDate.format("dddd, MMM D, YYYY");
        }
        if (!isToday) {
            const todayBtn = headerRow.createDiv("macos-today-btn");
            todayBtn.textContent = "← Today";
            todayBtn.addEventListener("click", () => {
                this.selectedDate = window.moment();
                this.render();
                if (this.calendarComponent) {
                    this.calendarComponent.$set({ displayedMonth: window.moment() });
                }
            });
        }
        // REQ-CACHE-006: Manual refresh button
        const refreshBtn = headerRow.createDiv("macos-refresh-btn");
        refreshBtn.textContent = "↻";
        refreshBtn.setAttribute("title", "Refresh calendar data");
        refreshBtn.addEventListener("click", () => { this.init(true); });

        // v0.3: Create buttons (REQ-WRITE-001, REQ-WRITE-006, REQ-NL-001)
        if (showCal && calPerm === 'granted') {
            const addEventBtn = headerRow.createDiv("macos-refresh-btn");
            addEventBtn.textContent = "+Event";
            addEventBtn.setAttribute("title", "Create event on " + this.selectedDate.format("YYYY-MM-DD"));
            addEventBtn.style.marginLeft = "4px";
            addEventBtn.addEventListener("click", () => {
                new EventCreateModal(this.plugin.app, this).open();
            });

            // Quick-create with NL parsing (REQ-NL-001)
            const quickBtn = headerRow.createDiv("macos-refresh-btn");
            quickBtn.textContent = "⚡";
            quickBtn.setAttribute("title", "Quick create with natural language (e.g. \"tomorrow 3pm meeting\")");
            quickBtn.style.marginLeft = "2px";
            quickBtn.addEventListener("click", () => {
                new QuickEventModal(this.plugin.app, this).open();
            });
        }
        if (showRem && remPerm === 'granted') {
            const addRemBtn = headerRow.createDiv("macos-refresh-btn");
            addRemBtn.textContent = "+Remind";
            addRemBtn.setAttribute("title", "Create reminder");
            addRemBtn.style.marginLeft = "4px";
            addRemBtn.addEventListener("click", () => {
                new ReminderCreateModal(this.plugin.app, this).open();
            });
        }

        // REQ-PERM-003: Partial permission banner
        if (showCal && calPerm === 'denied') {
            this.renderPermissionBanner(this.eventsPanelEl, 'calendar');
        }
        if (showRem && remPerm === 'denied') {
            this.renderPermissionBanner(this.eventsPanelEl, 'reminders');
        }

        // REQ-ERR-002: Error state with retry
        if (showCal && (calPerm === 'timeout' || calPerm === 'error')) {
            this.renderErrorBanner(this.eventsPanelEl, 'calendar');
        }
        if (showRem && (remPerm === 'timeout' || remPerm === 'error')) {
            this.renderErrorBanner(this.eventsPanelEl, 'reminders');
        }

        // Get data from cache
        var dayEvents = [];
        var dayReminders = [];
        var noDateReminders = [];
        if (showCal && calPerm === 'granted') {
            dayEvents = this.getEventsForDate(this.selectedDate);
        }
        if (showRem && remPerm === 'granted') {
            dayReminders = this.getRemindersForDate(this.selectedDate);
            noDateReminders = opts.showNoDateReminders !== false ? this.getNoDateReminders() : [];
        }

        // Events section
        if (showCal && calPerm === 'granted') {
            this.renderEventsSection(this.eventsPanelEl, dayEvents);
        }
        // Reminders section
        if (showRem && remPerm === 'granted') {
            this.renderRemindersSection(this.eventsPanelEl, dayReminders, noDateReminders);
        }
        // REQ-ERR-004: Distinguish empty data from failure states
        if (dayEvents.length === 0 && dayReminders.length === 0 && noDateReminders.length === 0) {
            var allGranted = (!showCal || calPerm === 'granted') && (!showRem || remPerm === 'granted');
            if (allGranted) {
                const emptyEl = this.eventsPanelEl.createDiv("macos-empty");
                emptyEl.textContent = "No events or reminders for this day";
            }
        }

        // Last refresh time (REQ-CACHE-007)
        if (this.lastRefreshTime) {
            var refreshFooter = this.eventsPanelEl.createDiv("macos-refresh-footer");
            var timeStr = new Date(this.lastRefreshTime).toLocaleTimeString();
            refreshFooter.textContent = "Last refresh: " + timeStr;
            if (this.lastRefreshDurationMs) {
                refreshFooter.textContent += " (" + this.lastRefreshDurationMs + "ms)";
            }
        }

        // REQ-UX-006: Refresh calendar grid dots after data change
        if (this.calendarComponent && this._calendarSources) {
            // Trigger Svelte re-render by replacing sources with a new array reference
            this.calendarComponent.$set({ sources: [...this._calendarSources] });
        }
    }

    // REQ-PERM-001, REQ-PERM-002: Actionable permission recovery guidance
    renderPermissionBanner(parent, source) {
        const banner = parent.createDiv("macos-permission-banner");
        banner.createEl("strong").textContent = source === 'calendar' ? "Calendar access denied" :
            source === 'reminders' ? "Reminders access denied" : "Calendar & Reminders access denied";
        banner.createEl("p").textContent =
            "Open System Settings → Privacy & Security → Automation, then enable Obsidian for " +
            (source === 'both' ? "Calendar and Reminders" :
             source === 'calendar' ? "Calendar" : "Reminders") + ".";
        var retryBtn = banner.createEl("button", { cls: "macos-retry-btn" });
        retryBtn.textContent = "Retry";
        retryBtn.addEventListener("click", () => { this.init(); });
    }

    // REQ-ERR-002: Error recovery with retry
    renderErrorBanner(parent, source) {
        var lastErr = source === 'calendar' ? this.lastError.calendar : this.lastError.reminders;
        var banner = parent.createDiv("macos-error-banner");
        banner.createEl("strong").textContent = (source === 'calendar' ? "Calendar" : "Reminders") + " data unavailable";
        if (lastErr && lastErr.message) {
            banner.createEl("p", { cls: "macos-error-detail" }).textContent = lastErr.message;
        }
        var retryBtn = banner.createEl("button", { cls: "macos-retry-btn" });
        retryBtn.textContent = "Retry";
        retryBtn.addEventListener("click", () => { this.init(); });
    }

    // --- Render events section ---
    // REQ-CAL-007: Event details (location, link, notes, attendees, recurrence)
    // REQ-CAL-008: Expandable event detail state (click to expand/collapse)
    // REQ-CAL-010: Past event display (normal/dimmed/hidden)
    // REQ-CAL-011: Recurring event read-only indicator
    renderEventsSection(parent, events) {
        const sectionEl = parent.createDiv("macos-section");
        const headerEl = sectionEl.createDiv("macos-section-header");
        headerEl.textContent = "Calendar Events";

        if (events.length === 0) {
            const emptyEl = sectionEl.createDiv("macos-item-empty");
            emptyEl.textContent = "No events for this day";
            return;
        }

        const opts = this.plugin.options || {};
        const pastDisplay = opts.pastEventDisplay || 'dimmed';
        const now = new Date();

        for (let i = 0; i < events.length; i++) {
            const evt = events[i];

            // REQ-CAL-010: Past event treatment
            var evtEnd = evt.end || evt.start;
            var isPast = evtEnd && evtEnd < now;
            // For all-day events on a past day, check against end of selected day
            var isAllDay = evt.isAllDay !== undefined ? evt.isAllDay : evt.allday;
            if (isAllDay && this.selectedDate.isBefore(window.moment(), 'day')) {
                isPast = true;
            }
            if (pastDisplay === 'hidden' && isPast) continue;

            const itemEl = sectionEl.createDiv("macos-item");
            itemEl.addClass("calendian-event-item");

            // REQ-CAL-010: Dim past events
            if (isPast && pastDisplay === 'dimmed') {
                itemEl.addClass("calendian-event-past");
            }

            // Highlight: starting soon or ongoing
            if (this.isStartingSoon(evt)) {
                itemEl.addClass("macos-item-soon");
            } else if (this.isOngoing(evt)) {
                itemEl.addClass("macos-item-ongoing");
            }

            // Time column
            const timeEl = itemEl.createDiv("macos-item-time");
            if (isAllDay) {
                timeEl.textContent = "All day";
                timeEl.addClass("macos-time-allday");
            } else if (evt.start) {
                timeEl.textContent = this.formatTimeRange(evt.start, evt.end);
            }

            // Title + optional details column
            const detailsCol = itemEl.createDiv("macos-item-details");
            const titleRow = detailsCol.createDiv("calendian-event-title-row");
            const titleEl = titleRow.createDiv("macos-item-title");
            titleEl.textContent = evt.title || evt.summary || "";

            // REQ-CAL-011: Recurring event indicator (read-only)
            if (evt.isRecurring) {
                const recEl = titleRow.createDiv("calendian-event-recurring");
                recEl.textContent = "⟳";
                recEl.setAttribute("title", evt.recurrenceSummary || "Recurring event");
            }

            // Inline meta: location and recurrence summary shown inline
            if (evt.location) {
                const locEl = detailsCol.createDiv("macos-item-meta");
                locEl.textContent = "📍 " + evt.location;
                locEl.addClass("macos-meta-location");
            }
            if (evt.isRecurring && evt.recurrenceSummary) {
                const recEl = detailsCol.createDiv("macos-item-meta");
                recEl.textContent = "↻ " + evt.recurrenceSummary;
                recEl.addClass("macos-meta-recurring");
            }

            // Calendar badge with color
            var calName = evt.calendarName || evt.calendar || "";
            const badgeRow = itemEl.createDiv("macos-item-badges");
            if (calName) {
                const badgeEl = badgeRow.createDiv("macos-item-badge");
                badgeEl.textContent = calName;
                const color = this.calendarToCSS(this.calendarColors[calName]);
                if (color) {
                    badgeEl.style.backgroundColor = color;
                    badgeEl.style.color = "#fff";
                }
            }

            // REQ-CAL-008: Click to expand/collapse detail panel
            var evtId = evt.id || (evt.title + "-" + (evt.start ? evt.start.getTime() : i));
            var self = this;
            itemEl.addEventListener("click", function(e) {
                if (self._expandedEvents.has(evtId)) {
                    self._expandedEvents.delete(evtId);
                } else {
                    self._expandedEvents.add(evtId);
                }
                self.render();
            });

            // REQ-CAL-007: Expanded detail panel
            if (this._expandedEvents.has(evtId)) {
                itemEl.addClass("calendian-event-expanded");
                var detailEl = sectionEl.createDiv("calendian-event-detail");

                // Location
                if (evt.location) {
                    var field = detailEl.createDiv("calendian-event-detail-field");
                    field.createEl("strong").textContent = "Location";
                    field.appendText(": " + evt.location);
                }

                // URL
                if (evt.url) {
                    var field = detailEl.createDiv("calendian-event-detail-field");
                    field.createEl("strong").textContent = "Link";
                    var link = field.createEl("a", {
                        attr: { href: evt.url, target: "_blank", rel: "noopener" }
                    });
                    link.textContent = evt.url.length > 60 ? evt.url.substring(0, 57) + "..." : evt.url;
                    link.style.color = "var(--text-accent)";
                }

                // Notes
                if (evt.notes) {
                    var field = detailEl.createDiv("calendian-event-detail-field");
                    field.createEl("strong").textContent = "Notes";
                    var notesText = evt.notes.length > 200 ? evt.notes.substring(0, 197) + "..." : evt.notes;
                    field.createEl("div", { cls: "calendian-event-detail-notes" }).textContent = notesText;
                }

                // Attendees
                if (evt.attendees && evt.attendees.length > 0) {
                    var field = detailEl.createDiv("calendian-event-detail-field");
                    field.createEl("strong").textContent = "Attendees";
                    field.appendText(": " + evt.attendees.join(", "));
                }

                // Calendar source
                if (calName) {
                    var field = detailEl.createDiv("calendian-event-detail-field");
                    field.createEl("strong").textContent = "Calendar";
                    field.appendText(": " + calName);
                    if (evt.accountName) {
                        field.appendText(" (" + evt.accountName + ")");
                    }
                }

                // Recurrence summary
                if (evt.isRecurring && evt.recurrenceSummary) {
                    var field = detailEl.createDiv("calendian-event-detail-field");
                    field.createEl("strong").textContent = "Recurrence";
                    field.appendText(": " + evt.recurrenceSummary);
                }

                // v0.4: Edit/Delete action buttons (REQ-WRITE-011, REQ-WRITE-012)
                if (!evt.isDisplayOnly && evt.id) {
                    var actionsEl = detailEl.createDiv("calendian-detail-actions");

                    // Edit button
                    var editBtn = actionsEl.createDiv("macos-refresh-btn");
                    editBtn.textContent = "Edit";
                    editBtn.addEventListener("click", function(e) {
                        e.stopPropagation();
                        var guard = self.canMutateEvent(evt);
                        if (!guard.safe) {
                            if (guard.canOpenCalendar) {
                                new RecurringBlockModal(self.plugin.app, evt.title, evt.id).open();
                            } else {
                                new obsidian.Notice(guard.reason);
                            }
                            return;
                        }
                        new EventEditModal(self.plugin.app, self, evt).open();
                    });

                    // Delete button
                    var deleteBtn = actionsEl.createDiv("macos-refresh-btn calendian-action-danger");
                    deleteBtn.textContent = "Delete";
                    deleteBtn.addEventListener("click", function(e) {
                        e.stopPropagation();
                        var guard = self.canMutateEvent(evt);
                        if (!guard.safe) {
                            if (guard.canOpenCalendar) {
                                new RecurringBlockModal(self.plugin.app, evt.title, evt.id).open();
                            } else {
                                new obsidian.Notice(guard.reason);
                            }
                            return;
                        }
                        self.confirmDeleteEvent(evt);
                    });
                }
            }
        }
    }

    // --- Render reminders section ---
    // REQ-REM-005: Overdue styling. REQ-REM-006: No-date section. REQ-REM-007: Display range. REQ-REM-009: Subtasks.
    renderRemindersSection(parent, reminders, noDateReminders) {
        const self = this;
        const opts = this.plugin.options || {};
        const sectionEl = parent.createDiv("macos-section");

        // REQ-REM-007: Header with inline range selector
        const headerRow = sectionEl.createDiv("calendian-reminders-header");
        const headerEl = headerRow.createDiv("macos-section-header");
        headerEl.textContent = "Reminders";

        // Inline range selector dropdown
        const rangeSelector = headerRow.createEl("select", { cls: "calendian-reminder-range-selector" });
        rangeSelector.innerHTML =
            '<option value="today">Today</option>' +
            '<option value="7days">Next 7 days</option>' +
            '<option value="all">All incomplete</option>';
        rangeSelector.value = opts.reminderDisplayRange || 'today';
        rangeSelector.addEventListener("change", function() {
            self.plugin.calendarPlugin.writeOptions(function() { return { reminderDisplayRange: rangeSelector.value }; });
            self.render();
        });

        // REQ-REM-005: Sort — overdue reminders first, then by due date
        var todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        var sortedReminders = reminders.slice().sort(function(a, b) {
            var aOverdue = a.due && a.due < todayStart;
            var bOverdue = b.due && b.due < todayStart;
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;
            if (a.due && b.due) return a.due - b.due;
            if (a.due) return -1;
            if (b.due) return 1;
            return 0;
        });

        if (sortedReminders.length === 0 && (!noDateReminders || noDateReminders.length === 0)) {
            const emptyEl = sectionEl.createDiv("macos-item-empty");
            emptyEl.textContent = "No reminders";
            return;
        }

        // Render each dated reminder
        for (let i = 0; i < sortedReminders.length; i++) {
            const rem = sortedReminders[i];
            const itemEl = sectionEl.createDiv("macos-item");

            // REQ-REM-005: Overdue detection and styling
            var isOverdue = rem.due && rem.due < todayStart;
            if (isOverdue) {
                itemEl.addClass("calendian-reminder-overdue");
            }

            // Checkbox + title (v0.4: clickable checkbox for completion toggle, REQ-WRITE-016)
            if (!rem.isDisplayOnly && rem.id) {
                var checkbox = itemEl.createDiv("calendian-reminder-checkbox");
                checkbox.textContent = "○";
                checkbox.setAttribute("title", "Mark complete");
                checkbox.addEventListener("click", function(e) {
                    e.stopPropagation();
                    self.toggleReminder(rem).then(function(result) {
                        if (result && result.ok) {
                            new obsidian.Notice(result.completed ? "Reminder completed" : "Reminder uncompleted");
                            self.init(true);
                        }
                    }).catch(function(err) {
                        var errMsg = err.stderr || (err.error && err.error.message) || err.message || JSON.stringify(err);
                        console.error("[Calendian] Toggle reminder failed:", errMsg);
                        new obsidian.Notice("Failed to update reminder");
                    });
                });
            }
            const titleEl = itemEl.createDiv("macos-item-title");
            titleEl.textContent = (rem.title || rem.name || "");

            // REQ-REM-005: Overdue badge
            if (isOverdue) {
                const overdueBadge = itemEl.createDiv("calendian-reminder-overdue-badge");
                overdueBadge.textContent = "overdue";
            }

            // Priority indicator
            if (rem.priority && rem.priority !== "none") {
                const priorityEl = itemEl.createDiv("macos-priority");
                if (rem.priority === "high") {
                    priorityEl.textContent = "!!!";
                    priorityEl.addClass("macos-priority-high");
                } else if (rem.priority === "medium") {
                    priorityEl.textContent = "!!";
                    priorityEl.addClass("macos-priority-medium");
                } else {
                    priorityEl.textContent = "!";
                    priorityEl.addClass("macos-priority-low");
                }
            }

            // Due time — with overdue date styling
            if (rem.due) {
                const timeEl = itemEl.createDiv("macos-item-time calendian-reminder-due");
                timeEl.textContent = this.formatDueDate(rem.due);
                if (isOverdue) {
                    timeEl.addClass("calendian-reminder-overdue-due");
                }
            }

            // List badge
            var listName = rem.listName || rem.list || "";
            if (listName) {
                const badgeEl = itemEl.createDiv("macos-item-badge");
                badgeEl.textContent = listName;
            }

            // v0.4: Edit/Delete action buttons (REQ-WRITE-017, REQ-WRITE-018)
            if (!rem.isDisplayOnly && rem.id) {
                var remActionsEl = itemEl.createDiv("calendian-item-actions");
                var remEditBtn = remActionsEl.createDiv("macos-refresh-btn");
                remEditBtn.textContent = "Edit";
                remEditBtn.addEventListener("click", function(e) {
                    e.stopPropagation();
                    new ReminderEditModal(self.plugin.app, self, rem).open();
                });
                var remDeleteBtn = remActionsEl.createDiv("macos-refresh-btn calendian-action-danger");
                remDeleteBtn.textContent = "Delete";
                remDeleteBtn.addEventListener("click", function(e) {
                    e.stopPropagation();
                    self.confirmDeleteReminder(rem);
                });
            }

            // REQ-REM-009: Subtasks — render child reminders indented under parent
            // TODO: Subtask display is data-dependent. The helper provides parentId field
            // but does not yet populate it. Once the helper fetches subtasks, this code
            // will find children by parentId and render them.
            var children = this.getSubtasksForReminder(rem);
            for (var j = 0; j < children.length; j++) {
                var child = children[j];
                var subtaskEl = sectionEl.createDiv("calendian-reminder-subtask");
                if (child.completed) {
                    subtaskEl.addClass("completed");
                    subtaskEl.textContent = "☑ " + (child.title || "");
                } else {
                    subtaskEl.textContent = "○ " + (child.title || "");
                }
            }
        }

        // REQ-REM-006: No-date reminders section
        if (noDateReminders && noDateReminders.length > 0) {
            var nodateSection = sectionEl.createDiv("calendian-reminder-nodate-section");

            // Collapsible header
            var nodateHeader = nodateSection.createDiv("calendian-reminder-nodate-header");
            nodateHeader.textContent = "▸ Reminders without due date (" + noDateReminders.length + ")";
            var nodateList = nodateSection.createDiv("calendian-reminder-nodate-list");
            nodateList.style.display = "none"; // collapsed by default

            nodateHeader.addEventListener("click", function() {
                var isHidden = nodateList.style.display === "none";
                nodateList.style.display = isHidden ? "block" : "none";
                nodateHeader.textContent = (isHidden ? "▾" : "▸") + " Reminders without due date (" + noDateReminders.length + ")";
            });

            for (var k = 0; k < noDateReminders.length; k++) {
                (function(nr) {
                var nrItemEl = nodateList.createDiv("macos-item");

                // v0.4: Clickable checkbox for no-date reminders
                if (!nr.isDisplayOnly && nr.id) {
                    var nrCheckbox = nrItemEl.createDiv("calendian-reminder-checkbox");
                    nrCheckbox.textContent = "○";
                    nrCheckbox.setAttribute("title", "Mark complete");
                    nrCheckbox.addEventListener("click", function(e) {
                        e.stopPropagation();
                        self.toggleReminder(nr).then(function(result) {
                            if (result && result.ok) {
                                new obsidian.Notice(result.completed ? "Reminder completed" : "Reminder uncompleted");
                                self.init(true);
                            }
                        }).catch(function(err) {
                            console.error("[Calendian] Toggle reminder failed:", err);
                            new obsidian.Notice("Failed to update reminder");
                        });
                    });
                }
                var nrTitleEl = nrItemEl.createDiv("macos-item-title");
                nrTitleEl.textContent = (nr.title || nr.name || "");

                if (nr.priority && nr.priority !== "none") {
                    const prEl = nrItemEl.createDiv("macos-priority");
                    if (nr.priority === "high") {
                        prEl.textContent = "!!!";
                        prEl.addClass("macos-priority-high");
                    } else if (nr.priority === "medium") {
                        prEl.textContent = "!!";
                        prEl.addClass("macos-priority-medium");
                    } else {
                        prEl.textContent = "!";
                        prEl.addClass("macos-priority-low");
                    }
                }

                var nrListName = nr.listName || nr.list || "";
                if (nrListName) {
                    const nrBadgeEl = nrItemEl.createDiv("macos-item-badge");
                    nrBadgeEl.textContent = nrListName;
                }

                // v0.4: Edit/Delete buttons for no-date reminders
                if (!nr.isDisplayOnly && nr.id) {
                    var nrActionsEl = nrItemEl.createDiv("calendian-item-actions");
                    var nrEditBtn = nrActionsEl.createDiv("macos-refresh-btn");
                    nrEditBtn.textContent = "Edit";
                    nrEditBtn.addEventListener("click", function(e) {
                        e.stopPropagation();
                        new ReminderEditModal(self.plugin.app, self, nr).open();
                    });
                    var nrDeleteBtn = nrActionsEl.createDiv("macos-refresh-btn calendian-action-danger");
                    nrDeleteBtn.textContent = "Delete";
                    nrDeleteBtn.addEventListener("click", function(e) {
                        e.stopPropagation();
                        self.confirmDeleteReminder(nr);
                    });
                }
                })(noDateReminders[k]);
            }
        }
    }

    // REQ-REM-009: Get subtasks (children) for a reminder by parentId
    getSubtasksForReminder(reminder) {
        if (!this.allReminders) return [];
        var parentId = reminder.id;
        return this.allReminders.filter(function(r) {
            return r.parentId && r.parentId === parentId;
        });
    }

    // --- Format time range like "14:00 - 16:00 (2h)" ---
    formatTimeRange(start, end) {
        const s = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        if (!end) return s;
        const e = end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const diffMs = end.getTime() - start.getTime();
        const diffMin = Math.round(diffMs / 60000);
        let duration = "";
        if (diffMin >= 60) {
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            duration = m > 0 ? ` (${h}h${m}m)` : ` (${h}h)`;
        } else if (diffMin > 0) {
            duration = ` (${diffMin}m)`;
        }
        return s + " - " + e + duration;
    }

    // --- Format single time ---
    formatTime(date) {
        if (!date) return "";
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Format due date: show time only for today, date+time for other days
    formatDueDate(date) {
        if (!date) return "";
        var today = new Date();
        var isToday = date.getFullYear() === today.getFullYear() &&
                      date.getMonth() === today.getMonth() &&
                      date.getDate() === today.getDate();
        if (isToday) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        var dateStr = (date.getMonth() + 1) + "/" + date.getDate();
        var timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        return dateStr + " " + timeStr;
    }

    // --- Discover available calendars ---
    // --- Discover available calendars (EventKit helper) ---
    async discoverCalendars() {
        try {
            var raw = await this.execHelper(['calendars']);
            var calendars = [];
            for (var i = 0; i < raw.length; i++) {
                var s = raw[i];
                var displayName = s.name;
                if (s.accountName) {
                    displayName = displayName + " — " + s.accountName;
                }
                calendars.push({
                    name: displayName,
                    rawName: s.name,
                    id: s.id,
                    color: s.color || "",
                    accountHint: s.accountName,
                    typeHint: s.type,
                    source: "macos-calendar"
                });
            }
            this.sourceCounts.calendars = calendars.length;
            return calendars;
        } catch (err) {
            console.error("[Calendian] Failed to discover calendars:", err.error?.message || err.stderr);
            return [];
        }
    }

    // --- Discover available reminder lists (EventKit helper) ---
    async discoverReminderLists() {
        try {
            var raw = await this.execHelper(['lists']);
            var lists = [];
            for (var i = 0; i < raw.length; i++) {
                var s = raw[i];
                var displayName = s.name;
                if (s.accountName) {
                    displayName = displayName + " — " + s.accountName;
                }
                lists.push({
                    name: displayName,
                    rawName: s.name,
                    id: s.id,
                    source: "macos-reminders",
                    color: s.color || "",
                    accountHint: s.accountName || ""
                });
            }
            this.sourceCounts.reminderLists = lists.length;
            return lists;
        } catch (err) {
            console.error("[Calendian] Failed to discover reminder lists:", err.error?.message || err.stderr);
            return [];
        }
    }

    // --- Auto-refresh: reload all data ---
        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)

        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)

    // --- Watch: EKEventStoreChanged notification (REQ-SYNC-005) ---
    startWatch() {
        if (!this.helperPath) return;
        const signalFile = '/tmp/calendian-watch-signal';
        this._watchSignalFile = signalFile;
        this._lastWatchSignal = null;

        // Spawn watch process (long-lived, detached)
        try {
            this._watchProcess = nodeChildProcess.spawn(this.helperPath, ['watch', signalFile], {
                detached: true,
                stdio: 'ignore'
            });
            this._watchProcess.unref();
            this._watchProcess.on('error', (err) => {
                console.warn("[Calendian] Watch process error:", err.message);
                this._watchProcess = null;
            });
            this._watchProcess.on('exit', (code) => {
                // REQ-SYNC-007: Watch process died — timer-based refresh still works as fallback
                console.warn("[Calendian] Watch process exited (code=" + code + ") — falling back to timer-only refresh");
                this._watchProcess = null;
            });
            console.log("[Calendian] Watch process started (pid=" + this._watchProcess.pid + ")");
        } catch (e) {
            console.warn("[Calendian] Failed to start watch process:", e.message);
            this._watchProcess = null;
        }

        // Poll signal file every 2 seconds
        this._watchPollTimer = setInterval(() => {
            this._checkWatchSignal();
        }, 2000);
    }

    _checkWatchSignal() {
        try {
            if (!nodeFS.existsSync(this._watchSignalFile)) return;
            var content = nodeFS.readFileSync(this._watchSignalFile, 'utf8').trim();
            if (!content) return;
            if (content !== this._lastWatchSignal) {
                this._lastWatchSignal = content;
                console.log("[Calendian] macOS Calendar/Reminders change detected — refreshing...");
                this.refreshInBackground();
            }
        } catch (e) {
            // Signal file not yet available, or watch process hasn't written yet
        }
    }

    stopWatch() {
        if (this._watchPollTimer) {
            clearInterval(this._watchPollTimer);
            this._watchPollTimer = null;
        }
        if (this._watchProcess) {
            try { this._watchProcess.kill(); } catch (e) {}
            this._watchProcess = null;
        }
    }

    // --- Cleanup ---
        // EXTRACTED → src/macos/helper-executor.js (see src/ modules)
}

// NOTE: src/ module extraction in progress (REQ-ARCH-001, v0.3).
// Modules exist on disk (src/macos/helper-executor.js, src/cache/schedule-cache.js,
// src/macos/writer.js) but are not yet wired via require() — Obsidian plugin loading
// does not support top-level require() to local files in all contexts.
// Methods remain inline until a compatible module-loading strategy is verified.

// src/macos/helper-executor.js — MacOSIntegration prototype methods
// Auto-generated by split script. Edit here, then run ./build-main.sh

MacOSIntegration.prototype.execHelper = function(args) {
        if (!this.helperPath) return Promise.reject(new Error('Helper not available'));
        return new Promise((resolve, reject) => {
            var proc = nodeChildProcess.spawn(this.helperPath, args);
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

MacOSIntegration.prototype.classifyError = function(err) {
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

MacOSIntegration.prototype.execJXA = function(script) {
        return new Promise((resolve, reject) => {
            const proc = nodeChildProcess.spawn('/usr/bin/osascript', ['-l', 'JavaScript']);
            let stdout = '';
            let stderr = '';
            let settled = false;

            // 5-minute timeout (only for true hangs, not slow syncs)
            const timer = setTimeout(() => {
                if (!settled) {
                    settled = true;
                    proc.kill('SIGTERM');
                    reject({ error: new Error('JXA execution timed out after 5min'), stderr, stdout });
                }
            }, 300000);

            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            proc.on('close', (code) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                if (code !== 0) {
                    reject({ error: new Error('osascript exited with code ' + code), stderr, stdout });
                    return;
                }
                resolve(stdout.trim());
            });
            proc.on('error', (err) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject({ error: err, stderr, stdout });
            });
            proc.stdin.write(script);
            proc.stdin.end();
        });
    }

MacOSIntegration.prototype.isPermissionError = function(err) {
        return this.classifyError(err) === 'permission_denied';
    }

MacOSIntegration.prototype.startAutoRefresh = function() {
        this.stopAutoRefresh();
        const intervalMinutes = this.plugin.options?.refreshIntervalMinutes || 5;
        const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
        this.refreshTimer = setInterval(() => {
            this.init();
        }, intervalMs);
    }

MacOSIntegration.prototype.stopAutoRefresh = function() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

MacOSIntegration.prototype.destroy = function() {
        this.stopAutoRefresh();
        this.stopWatch();
        if (this.eventsPanelEl) {
            this.eventsPanelEl.remove();
            this.eventsPanelEl = null;
        }
    }

// src/cache/schedule-cache.js — MacOSIntegration prototype methods
// Auto-generated by split script. Edit here, then run ./build-main.sh

MacOSIntegration.prototype.loadEventsFromCache = async function() {
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
    }

MacOSIntegration.prototype.isCacheFresh = function() {
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
    }

MacOSIntegration.prototype.saveEventsToCache = async function() {
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
                    recurrenceSummary: e.recurrenceSummary || "",
                    isDisplayOnly: e.isDisplayOnly || false
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
    }

MacOSIntegration.prototype.saveRemindersToCache = async function() {
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
                    notes: r.notes || "",
                    isDisplayOnly: r.isDisplayOnly || false
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
    }

MacOSIntegration.prototype.loadRemindersFromCache = async function() {
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
    }

MacOSIntegration.prototype.preloadAll = async function() {
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
                    accountName: e.accountName || "",
                    isDisplayOnly: !e.id  // REQ-DATA-003: mark items without a stable EventKit identifier
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
    }

MacOSIntegration.prototype.preloadReminders = async function() {
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
                    parentId: r.parentId || "",
                    isDisplayOnly: !r.id
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
                        parentId: nd.parentId || "",
                        isDisplayOnly: !nd.id
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
    }

MacOSIntegration.prototype.getEventsForDate = function(date) {
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
    }

MacOSIntegration.prototype.getRemindersForDate = function(date) {
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
    }

MacOSIntegration.prototype.getNoDateReminders = function() {
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
    }

MacOSIntegration.prototype.parseEvents = function(raw) {
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
    }

MacOSIntegration.prototype.parseReminders = function(raw) {
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
    }

MacOSIntegration.prototype.countReminderLists = function(reminders) {
        var lists = {};
        for (var i = 0; i < reminders.length; i++) {
            var ln = reminders[i].listName || reminders[i].list || "";
            if (ln) lists[ln] = true;
        }
        return Object.keys(lists).length;
    }

// src/macos/writer.js — write adapter for EventKit helper, safety-gated (v0.3+)
// REQ-WRITE-001 to REQ-WRITE-010, REQ-WRITE-011 to REQ-WRITE-020 (v0.4)

// ── Node.js-only helper functions (not used in Obsidian concatenation) ──
// Guarded: these are only available when loaded via require() in Node.js context.
// The Obsidian-side code uses MacOSIntegration.prototype.execHelper() instead.

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

// ── Mutation safety guards (v0.4, REQ-WRITE-015, REQ-WRITE-019, REQ-REC-002) ─

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
// build-main.sh: prototype methods from src/ are inserted here by cat

class CalendarView extends obsidian.ItemView {
    constructor(leaf, plugin, helperPath) {
        super(leaf);
        this.calendarPlugin = plugin;
        this.helperPath = helperPath || null;
        this.openOrCreateDailyNote = this.openOrCreateDailyNote.bind(this);
        this.openOrCreateWeeklyNote = this.openOrCreateWeeklyNote.bind(this);
        this.onNoteSettingsUpdate = this.onNoteSettingsUpdate.bind(this);
        this.onFileCreated = this.onFileCreated.bind(this);
        this.onFileDeleted = this.onFileDeleted.bind(this);
        this.onFileModified = this.onFileModified.bind(this);
        this.onFileOpen = this.onFileOpen.bind(this);
        this.onHoverDay = this.onHoverDay.bind(this);
        this.onHoverWeek = this.onHoverWeek.bind(this);
        this.onContextMenuDay = this.onContextMenuDay.bind(this);
        this.onContextMenuWeek = this.onContextMenuWeek.bind(this);
        this.registerEvent(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.app.workspace.on("periodic-notes:settings-updated", this.onNoteSettingsUpdate));
        this.registerEvent(this.app.vault.on("create", this.onFileCreated));
        this.registerEvent(this.app.vault.on("delete", this.onFileDeleted));
        this.registerEvent(this.app.vault.on("modify", this.onFileModified));
        this.registerEvent(this.app.workspace.on("file-open", this.onFileOpen));
        this.settings = null;
        this.macosIntegration = null;
        this.macosWrappedOnClickDay = null;
        this.options = get_store_value(settings); // Initial value before subscribe fires
        settings.subscribe((val) => {
            this.options = val;
            this.settings = val;
            // Refresh the calendar dots if settings change
            if (this.calendar) {
                this.calendar.tick();
            }
        });
    }
    // --- Persistent disk cache helpers (stored inside data.json) ---
    async writeCacheFile(key, data) {
        try {
            var allData = (await this.calendarPlugin.loadData()) || {};
            allData[key] = data;
            await this.calendarPlugin.saveData(allData);
        } catch (e) {
            console.warn("[Calendian] Failed to write cache:", e.message);
        }
    }
    async readCacheFile(key) {
        try {
            var allData = (await this.calendarPlugin.loadData()) || {};
            return allData[key] || null;
        } catch (e) {
            console.warn("[Calendian] Failed to read cache:", e.message);
        }
        return null;
    }

    getViewType() {
        return VIEW_TYPE_CALENDAR;
    }
    getDisplayText() {
        return "Calendar";
    }
    getIcon() {
        return "calendar-with-checkmark";
    }
    onClose() {
        if (this._handleWindowFocus) {
            window.removeEventListener('focus', this._handleWindowFocus);
            this._handleWindowFocus = null;
        }
        if (this.calendar) {
            this.calendar.$destroy();
        }
        if (this.macosIntegration) {
            this.macosIntegration.destroy();
        }
        return Promise.resolve();
    }
    async onOpen() {
        // Integration point: external plugins can listen for `calendar:open`
        // to feed in additional sources.
        const sources = [
            customTagsSource,
            streakSource,
            wordCountSource,
            tasksSource,
        ];
        this.app.workspace.trigger(TRIGGER_ON_OPEN, sources);

        // === macOS Calendar & Reminders integration ===
        // Create MacOSIntegration first so its metadata source is available for Calendar
        this.macosIntegration = new MacOSIntegration(this);

        // REQ-UX-006: Add macOS event/reminder dot source to the calendar
        sources.push(this.macosIntegration.getEventMetadataSource());

        // Click day: single click = select date (show events), Cmd/Ctrl+click = open/create note
        const self = this;
        this.macosWrappedOnClickDay = (date, inNewSplit) => {
            // Always update the panel to show selected date's events (instant from cache)
            if (self.macosIntegration) {
                self.macosIntegration.selectDate(date);
            }
            // Only open/create note if Cmd/Ctrl is held, or if explicitly requested via context
            if (inNewSplit) {
                self.openOrCreateDailyNote(date, inNewSplit);
            }
        };

        this.calendar = new Calendar({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            target: this.contentEl,
            props: {
                onClickDay: this.macosWrappedOnClickDay,
                onClickWeek: this.openOrCreateWeeklyNote,
                onHoverDay: this.onHoverDay,
                onHoverWeek: this.onHoverWeek,
                onContextMenuDay: this.onContextMenuDay,
                onContextMenuWeek: this.onContextMenuWeek,
                sources,
            },
        });

        this.macosIntegration.calendarComponent = this.calendar;
        this.macosIntegration._calendarSources = sources;
        this.eventsPanelEl = this.contentEl.createDiv("macos-events-panel");
        this.macosIntegration.eventsPanelEl = this.eventsPanelEl;
        this.macosIntegration.startAutoRefresh();
        this.macosIntegration.startWatch();
        this.macosIntegration.init();

        // REQ-SYNC-004: Refresh when window gains focus
        // Always show cached data instantly, then background-refresh from EventKit
        // to pick up external changes (Calendar.app / Reminders.app edits).
        // The cache freshness check is only for timer-driven refresh — focus should
        // always re-query, since the user may have changed data in another app.
        this._handleWindowFocus = () => {
            if (this.macosIntegration) {
                console.log("[Calendian] Window focused — refreshing from macOS...");
                this.macosIntegration.render();
                this.macosIntegration.refreshInBackground();
            }
        };
        window.addEventListener('focus', this._handleWindowFocus);
    }
    onHoverDay(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const { format } = getDailyNoteSettings_1();
        const note = getDailyNote_1(date, get_store_value(dailyNotes));
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onHoverWeek(date, targetEl, isMetaPressed) {
        if (!isMetaPressed) {
            return;
        }
        const note = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        const { format } = getWeeklyNoteSettings_1();
        this.app.workspace.trigger("link-hover", this, targetEl, date.format(format), note === null || note === void 0 ? void 0 : note.path);
    }
    onContextMenuDay(date, event) {
        const note = getDailyNote_1(date, get_store_value(dailyNotes));
        if (!note) {
            // If no file exists for a given day, show nothing.
            return;
        }
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onContextMenuWeek(date, event) {
        const note = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        if (!note) {
            // If no file exists for a given day, show nothing.
            return;
        }
        showFileMenu(this.app, note, {
            x: event.pageX,
            y: event.pageY,
        });
    }
    onNoteSettingsUpdate() {
        dailyNotes.reindex();
        weeklyNotes.reindex();
        this.updateActiveFile();
    }
    async onFileDeleted(file) {
        if (getDateFromFile_1(file, "day")) {
            dailyNotes.reindex();
            this.updateActiveFile();
        }
        if (getDateFromFile_1(file, "week")) {
            weeklyNotes.reindex();
            this.updateActiveFile();
        }
    }
    async onFileModified(file) {
        const date = getDateFromFile_1(file, "day") || getDateFromFile_1(file, "week");
        if (date && this.calendar) {
            this.calendar.tick();
        }
    }
    onFileCreated(file) {
        if (this.app.workspace.layoutReady && this.calendar) {
            if (getDateFromFile_1(file, "day")) {
                dailyNotes.reindex();
                this.calendar.tick();
            }
            if (getDateFromFile_1(file, "week")) {
                weeklyNotes.reindex();
                this.calendar.tick();
            }
        }
    }
    onFileOpen(_file) {
        if (this.app.workspace.layoutReady) {
            this.updateActiveFile();
        }
    }
    updateActiveFile() {
        const { view } = this.app.workspace.activeLeaf;
        let file = null;
        if (view instanceof obsidian.FileView) {
            file = view.file;
        }
        activeFile.setFile(file);
        if (this.calendar) {
            this.calendar.tick();
        }
    }
    revealActiveNote() {
        const { moment } = window;
        const { activeLeaf } = this.app.workspace;
        if (activeLeaf.view instanceof obsidian.FileView) {
            // Check to see if the active note is a daily-note
            let date = getDateFromFile_1(activeLeaf.view.file, "day");
            if (date) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
            // Check to see if the active note is a weekly-note
            const { format } = getWeeklyNoteSettings_1();
            date = moment(activeLeaf.view.file.basename, format, true);
            if (date.isValid()) {
                this.calendar.$set({ displayedMonth: date });
                return;
            }
        }
    }
    async openOrCreateWeeklyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const startOfWeek = date.clone().startOf("week");
        const existingFile = getWeeklyNote_1(date, get_store_value(weeklyNotes));
        if (!existingFile) {
            // File doesn't exist
            tryToCreateWeeklyNote(startOfWeek, inNewSplit, this.settings, (file) => {
                activeFile.setFile(file);
            });
            return;
        }
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile);
        activeFile.setFile(existingFile);
    }
    async openOrCreateDailyNote(date, inNewSplit) {
        const { workspace } = this.app;
        const existingFile = getDailyNote_1(date, get_store_value(dailyNotes));
        if (!existingFile) {
            // File doesn't exist
            tryToCreateDailyNote(date, inNewSplit, this.settings, (dailyNote) => {
                activeFile.setFile(dailyNote);
            });
            return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mode = this.app.vault.getConfig("defaultViewMode");
        const leaf = inNewSplit
            ? workspace.splitActiveLeaf()
            : workspace.getUnpinnedLeaf();
        await leaf.openFile(existingFile, { mode });
        activeFile.setFile(existingFile);
    }
}

class CalendarPlugin extends obsidian.Plugin {
    onunload() {
        this.app.workspace
            .getLeavesOfType(VIEW_TYPE_CALENDAR)
            .forEach((leaf) => {
                const view = leaf.view;
                if (view.macosIntegration) {
                    view.macosIntegration.destroy();
                }
                leaf.detach();
            });
    }
    async onload() {
        // REQ-PLAT-004: Graceful unsupported-platform handling
        if (!isMacOS()) {
            new obsidian.Notice(
                "Calendian requires macOS. This plugin reads from macOS Calendar.app and Reminders.app and cannot run on other platforms.",
                10000
            );
            console.warn("[Calendian] Unsupported platform detected. Plugin disabled.");
            return;
        }

        this.register(settings.subscribe((value) => {
            this.options = value;
        }));
        // Pass helper path to view — try multiple approaches
        var helperPath = null;
        var vaultBase = '';
        try { vaultBase = this.app.vault.adapter.getBasePath(); } catch(e) {}
        try { if (!vaultBase) vaultBase = this.app.vault.adapter.basePath; } catch(e) {}
        console.log("[Calendian] vaultBase=" + vaultBase);

        if (vaultBase) {
            helperPath = nodePath.join(vaultBase, '.obsidian', 'plugins', 'calendian', 'calendian-helper');
            console.log("[Calendian] Trying helperPath=" + helperPath);
            try { if (!nodeFS.existsSync(helperPath)) helperPath = null; } catch(e) {}
        }
        console.log("[Calendian] Helper path: " + (helperPath || "NOT FOUND"));
        this.registerView(VIEW_TYPE_CALENDAR, (leaf) => (this.view = new CalendarView(leaf, this, helperPath)));
        this.addCommand({
            id: "show-calendar-view",
            name: "Open view",
            checkCallback: (checking) => {
                if (checking) {
                    return (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0);
                }
                this.initLeaf();
            },
        });
        this.addCommand({
            id: "open-weekly-note",
            name: "Open Weekly Note",
            checkCallback: (checking) => {
                if (checking) {
                    return !appHasPeriodicNotesPluginLoaded();
                }
                this.view.openOrCreateWeeklyNote(window.moment(), false);
            },
        });
        this.addCommand({
            id: "reveal-active-note",
            name: "Reveal active note",
            callback: () => this.view.revealActiveNote(),
        });
        await this.loadOptions();
        this.addSettingTab(new CalendarSettingsTab(this.app, this));
        if (this.app.workspace.layoutReady) {
            this.initLeaf();
        }
        else {
            this.registerEvent(this.app.workspace.on("layout-ready", this.initLeaf.bind(this)));
        }
    }
    initLeaf() {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length) {
            return;
        }
        this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE_CALENDAR,
        });
    }
    async loadOptions() {
        const options = await this.loadData();
        // v0.1: Migrate old setting names to new schema
        if (options) {
            if (options.showMacOSCalendar !== undefined && options.enableCalendar === undefined) {
                options.enableCalendar = options.showMacOSCalendar;
                delete options.showMacOSCalendar;
            }
            if (options.showMacOSReminders !== undefined && options.enableReminders === undefined) {
                options.enableReminders = options.showMacOSReminders;
                delete options.showMacOSReminders;
            }
            if (options.macOSCalendarNames !== undefined && options.selectedCalendarIds === undefined) {
                options.selectedCalendarIds = options.macOSCalendarNames;
                delete options.macOSCalendarNames;
            }
            if (options.macOSReminderListNames !== undefined && options.selectedReminderListIds === undefined) {
                options.selectedReminderListIds = options.macOSReminderListNames;
                delete options.macOSReminderListNames;
            }
            if (options.macOSRefreshInterval !== undefined && options.refreshIntervalMinutes === undefined) {
                options.refreshIntervalMinutes = options.macOSRefreshInterval;
                delete options.macOSRefreshInterval;
            }
        }
        settings.update((old) => {
            return Object.assign(Object.assign({}, old), (options || {}));
        });
        await this.saveData(this.options);
    }
    async writeOptions(changeOpts) {
        settings.update((old) => (Object.assign(Object.assign({}, old), changeOpts(old))));
        await this.saveData(this.options);
    }
}

module.exports = CalendarPlugin;

/* nosourcemap */