// src/notes/note-link-resolver.js — note path resolution (v0.5)
// REQ-NOTE-004: Handle missing or renamed notes safely

/**
 * Resolve a note path, checking if it still exists.
 * If the file at `path` no longer exists, search for a file with a matching title
 * (basename without extension) among vault markdown files.
 *
 * @param {string} path — original vault-relative path (e.g. "folder/My Note.md")
 * @param {string} [originalTitle] — the expected file basename (without extension)
 * @returns {{path: string, exists: boolean, renamed: boolean}}
 */
MacOSIntegration.prototype.resolveNotePath = function(path, originalTitle) {
    var app = this.plugin.app;
    if (!app || !app.vault) {
        return { path: path, exists: false, renamed: false };
    }

    // Fast path: file still exists at original path
    var file = app.vault.getAbstractFileByPath(path);
    if (file) {
        return { path: path, exists: true, renamed: false };
    }

    // Slow path: search by title
    var searchTitle = originalTitle;
    if (!searchTitle) {
        // Extract basename from path
        var parts = path.replace(/\\/g, "/").split("/");
        var basename = parts[parts.length - 1];
        searchTitle = basename.replace(/\.md$/, "");
    }

    try {
        var files = app.vault.getMarkdownFiles();
        for (var i = 0; i < files.length; i++) {
            if (files[i].basename === searchTitle) {
                console.log("[Calendian] Note renamed: " + path + " → " + files[i].path);
                return { path: files[i].path, exists: true, renamed: true };
            }
        }
    } catch (e) {
        console.warn("[Calendian] Failed to search for renamed note:", e.message);
    }

    return { path: path, exists: false, renamed: false };
};
