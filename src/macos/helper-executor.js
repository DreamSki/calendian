// src/macos/helper-executor.js — spawn helper binary, capture JSON, classify errors, refresh lifecycle
// v0.3 code split (REQ-ARCH-001)
// Extracted from main.js MacOSIntegration class

var nodeChildProcess = require('child_process');

module.exports = {
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
    },

    // REQ-ERR-001: Classify errors by type
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
    },

    // --- Execute JXA via spawn + stdin (with 5min timeout) ---
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
    },

    isPermissionError(err) {
        return this.classifyError(err) === 'permission_denied';
    },

    // --- Refresh lifecycle ---
    startAutoRefresh() {
        this.stopAutoRefresh();
        const intervalMinutes = this.plugin.options?.refreshIntervalMinutes || 5;
        if (intervalMinutes <= 0) return;
        this.refreshTimer = setInterval(() => {
            this.init();
        }, intervalMinutes * 60 * 1000);
    },

    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },

    destroy() {
        this.stopAutoRefresh();
    }
};
