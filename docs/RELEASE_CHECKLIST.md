# Calendian Release Checklist

> Status: normative release process document
> Last updated: 2026-06-07
> Plugin ID: `calendian`

This checklist must be completed and signed off before any version is released. Process derived from `SPEC.md` §9 (Release policy) and `ACCEPTANCE.md`.

---

## Pre-release checklist (all versions)

### 1. Metadata alignment

- [ ] `manifest.json`:
  - [ ] `id` is `calendian`
  - [ ] `name` is `Calendian`
  - [ ] `version` matches the release version
  - [ ] `minAppVersion` is accurate for the APIs used
  - [ ] `isDesktopOnly` is `true`
  - [ ] `author` is correct
  - [ ] `description` is accurate
- [ ] `README.md` version references are updated.
- [ ] `SPEC.md` header version target is updated.
- [ ] `ROADMAP.md` release posture reflects this release.
- [ ] No contradiction between any of the above.

### 2. Documentation truthfulness (`GATE-GLOBAL-01`)

- [ ] README distinguishes Current, Planned, Experimental, and Non-goal features.
- [ ] No README "current" claim lacks `Implemented` or `Partial` status in `CURRENT_STATUS.md`.
- [ ] `CURRENT_STATUS.md` is updated with evidence for all status changes.
- [ ] Roadmap items reference requirement IDs.
- [ ] `TRACEABILITY.md` is updated for any new or changed requirements.

### 3. Privacy and local-first (`GATE-GLOBAL-02`)

- [ ] No calendar/reminder data is sent to external services.
- [ ] No new network calls have been introduced without explicit opt-in.
- [ ] `PRIVACY.md` accurately describes all data read and stored.
- [ ] Diagnostic output is redacted by default.
- [ ] Any change to data read/stored/logged is reflected in `PRIVACY.md`.

### 4. Permission safety (`GATE-GLOBAL-03`)

- [ ] Calendar permission denied → safe state, no crash.
- [ ] Reminders permission denied → safe state, no crash.
- [ ] Partial permission (one allowed, one denied) → working source still displays.
- [ ] Non-macOS platform → unsupported platform message, no crash.
- [ ] Recovery guidance is shown for each permission state.
- [ ] Empty data is visually distinguishable from permission failure.

### 5. Data mutation safety (`GATE-GLOBAL-04`) — v0.3+

- [ ] User confirmation exists for delete and destructive edits.
- [ ] Failed writes show recoverable error; UI does not display false success.
- [ ] Recurring event operations are explicitly scoped or safely blocked.
- [ ] Plugin refreshes from source of truth after each write.
- [ ] No mutation without stable source identity.

### 6. Risk review

- [ ] `RISKS.md` reviewed for this release.
- [ ] New risks added for any new feature area.
- [ ] Risk mitigations verified or updated.
- [ ] High-severity risks have explicit acceptance or mitigation.

### 7. Test evidence

- [ ] All manual test suites for this version pass.
- [ ] Test results recorded (date, macOS version, Obsidian version, tester, result).
- [ ] Failing tests are documented as known limitations or blocking issues.
- [ ] No P0 requirement lacks passing test evidence.

### 8. Package integrity

- [ ] Plugin loads without errors on supported macOS + Obsidian version.
- [ ] `main.js` is the compiled output (if build step exists).
- [ ] `styles.css` is present and correct.
- [ ] `manifest.json` is at plugin root.
- [ ] No unnecessary files in the plugin folder (node_modules, .git, test fixtures).
- [ ] Plugin unloads cleanly (no residual timers, DOM, or event listeners).

### 9. Changelog and tag

- [ ] `CHANGELOG.md` entry written for this version.
- [ ] Changelog references requirement IDs where applicable.
- [ ] Git tag created: `v<version>`.
- [ ] Release notes published (GitHub Releases or equivalent).

---

## Version-specific gates

### v0.1 — Read-only MVP

- [x] `GATE-V001-01`: Plugin loads on supported macOS + Obsidian desktop.
- [x] `GATE-V001-02`: Calendar events display for selected date (basic fields).
- [x] `GATE-V001-03`: Incomplete reminders display for selected date.
- [x] `GATE-V001-04`: Date selection updates panel from cache; single-click does NOT open/create note.
- [x] `GATE-V001-05`: Cmd/Ctrl + click retains daily-note open/create behavior.
- [x] `GATE-V001-06`: Source discovery lists available calendars/lists or shows safe failure.
- [x] `GATE-V001-07`: Auto-refresh timer clears on plugin unload.
- [x] `GATE-V001-08`: README labels this release as read-only and partial where appropriate.
- [x] `TS-001` through `TS-006` pass.

### v0.2 — Read-only polish

- [x] Overdue reminders are visually distinct.
- [x] No-date reminders have a configurable section.
- [x] Past events can be grayed out or hidden.
- [x] Multi-day events appear on every overlapping day.
- [x] Month cells can show event dots without performance regression.
- [x] Event details expose location, links, notes, recurrence summary.
- [x] Diagnostic panel shows permission status, counts, timing.
- [x] Manual refresh is available.
- [x] Last refresh time is displayed.

### v0.3 — Safe create

- [ ] Simple non-recurring event creation works end-to-end.
- [ ] Simple reminder creation works end-to-end.
- [ ] Required fields validated before write.
- [ ] Write success confirmed only after source refresh.
- [ ] Write failure shows recoverable error.
- [ ] Natural language input parses title, date, time, duration.
- [ ] Ambiguous NL input shows confirmation dialog.
- [ ] Recurring event creation is blocked (or explicitly scoped).

### v0.4 — Safe edit/delete

- [ ] Simple non-recurring event edit works.
- [ ] Simple non-recurring event delete works with confirmation.
- [ ] Reminder completion toggles correctly.
- [ ] Reminder edit and delete work with confirmation.
- [ ] Recurring event edit/delete is blocked or explicitly scoped.

### v0.5 — Note association and notifications

- [ ] Event/reminder association writes stable frontmatter.
- [ ] Associated notes discoverable from event/reminder details.
- [ ] Missing/renamed notes fail gracefully.
- [ ] Template variables documented and validated.
- [ ] Event-start notifications fire at configured lead time.
- [ ] Overdue reminder notifications fire.
- [ ] Notifications can be enabled/disabled.
- [ ] Notification unavailability degrades gracefully.

### v0.5.5 — Self-direction

- [ ] Goals: define, break into steps, complete steps, pause, archive. All data local.
- [ ] Habits: define, complete, view consistency rate (NOT streak), minimum-viable, rest periods, retire.
- [ ] Habit: single missed period does NOT reset progress to zero.
- [ ] Nudges: daily intention prompt, configurable tone, full disable, no shaming language by default.
- [ ] Reviews: daily and weekly from templates, completed items before missed, carry focus forward.
- [ ] All self-direction data computed and stored locally.

### v0.6 — Advanced views, search, export

- [ ] Timeline view: correct vertical position and duration.
- [ ] Week view: seven-day schedule consistent with day list.
- [ ] Search returns events/reminders across cache range.
- [ ] Export date range as Markdown.
- [ ] Export data as JSON for backup.
- [ ] Export does not send data externally.
- [ ] Compact/comfortable density options.
- [ ] Configurable event field display.

---

## Release sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Developer | | | |
| Reviewer (if applicable) | | | |
| Tester | | | |

---

## Post-release

- [ ] Verify the release is installable from the distribution method.
- [ ] Verify the plugin loads in a fresh vault.
- [ ] Monitor for immediate bug reports or permission issues.
- [ ] Update `CURRENT_STATUS.md` if post-release issues are discovered.
