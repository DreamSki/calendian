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
    execHelper(args) {
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

    // REQ-ERR-001: Classify JXA errors by type
    classifyError(err) {
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

    // --- Execute JXA via spawn + stdin (with 30s timeout) ---
    execJXA(script) {
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

    // --- Load events from persistent disk cache (instant) ---
    async loadEventsFromCache() {
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

    // --- Check if cache is fresh enough to skip background refresh ---
    isCacheFresh() {
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

    // --- Save events to persistent disk cache ---
    async saveEventsToCache() {
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
    }

    // --- Save reminders to persistent disk cache ---
    async saveRemindersToCache() {
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
    }

    // --- Load reminders from persistent disk cache (instant) ---
    async loadRemindersFromCache() {
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

    // --- Preload all events for ±6 months ---
    // --- Preload events via EventKit helper (fast) ---
    async preloadAll() {
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
    }

    // --- Preload reminders via EventKit helper (fast) ---
    async preloadReminders() {
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

    // --- Get events for a specific date from cache ---
    // REQ-CAL-009: Multi-day events appear on every overlapping day
    getEventsForDate(date) {
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

    // --- Get reminders for a specific date from cache ---
    // REQ-REM-007: displayRange controls the date window — 'today', '7days', or 'all'
    getRemindersForDate(date) {
        var opts = this.plugin.options || {};
        var displayRange = opts.reminderDisplayRange || 'today';
        var filterIds = opts.selectedReminderListIds || [];

        var d = date.toDate();
        var y = d.getFullYear(), m = d.getMonth(), day = d.getDate();
        var start = new Date(y, m, day, 0, 0, 0);
        var end;

        if (displayRange === '7days') {
            // From selected date through +7 days
            end = new Date(y, m, day + 7, 23, 59, 59);
        } else if (displayRange === 'all') {
            // Show all incomplete reminders (full cache range)
            end = new Date(y + 10, m, day, 23, 59, 59);
        } else {
            // 'today' — selected date only
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

    // --- Get reminders without a due date (REQ-REM-006) ---
    getNoDateReminders() {
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

    // --- Check if error is a permission error (delegates to classifyError) ---
    isPermissionError(err) {
        return this.classifyError(err) === 'permission_denied';
    }

    // --- Parse event data ---
    // v0.1 fields per SPEC §5.1: id, source, calendarId, calendarName, calendarColor,
    //   title, start, end, isAllDay, isRecurring, recurrenceSummary,
    //   location, url, notes, attendees, alarms
    // v0.2 fields (REQ-CAL-007): location, url, notes populated from JXA
    parseEvents(raw) {
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

    // --- Parse reminder data ---
    // REQ-DATA-007: Treat optional JXA fields as optional
    parseReminders(raw) {
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

    // --- Count unique reminder lists ---
    countReminderLists(reminders) {
        var lists = {};
        for (var i = 0; i < reminders.length; i++) {
            var ln = reminders[i].listName || reminders[i].list || "";
            if (ln) lists[ln] = true;
        }
        return Object.keys(lists).length;
    }

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
            this.initBackground(initStart);
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
    async initBackground(initStart) {
        if (this._refreshRunning) { console.log("[Calendian] initBackground skipped (refresh already running)"); return; }
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

        // Date header row with refresh button
        const today = window.moment();
        const isToday = this.selectedDate.isSame(today, "day");
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
            self.plugin.writeOptions(function() { return { reminderDisplayRange: rangeSelector.value }; });
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

            // Checkbox + title
            const titleEl = itemEl.createDiv("macos-item-title");
            titleEl.textContent = "○ " + (rem.title || rem.name || "");

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
                timeEl.textContent = this.formatTime(rem.due);
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
                var nr = noDateReminders[k];
                var nrItemEl = nodateList.createDiv("macos-item");

                var nrTitleEl = nrItemEl.createDiv("macos-item-title");
                nrTitleEl.textContent = "○ " + (nr.title || nr.name || "");

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
                    color: s.color || ""
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
    startAutoRefresh() {
        this.stopAutoRefresh();
        const intervalMinutes = this.plugin.options?.refreshIntervalMinutes || 5;
        const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
        this.refreshTimer = setInterval(() => {
            this.init();
        }, intervalMs);
    }

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    // --- Cleanup ---
    destroy() {
        this.stopAutoRefresh();
        if (this.eventsPanelEl) {
            this.eventsPanelEl.remove();
            this.eventsPanelEl = null;
        }
    }
}

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
        this.macosIntegration.init();
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