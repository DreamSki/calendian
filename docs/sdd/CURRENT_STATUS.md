# Current Implementation Status

> Status: living status document  
> Last updated: 2026-06-07

This document records the actual repository state. It intentionally separates implemented behavior from planned behavior so that README, roadmap, and release notes do not overpromise.

## Repository-level status

| Area | Current status | Evidence / note |
|---|---|---|
| Plugin packaging | Partial | `manifest.json`, `main.js`, and `styles.css` exist. Plugin naming still needs alignment with Calendian branding. |
| Target platform | Implemented for desktop-only intent | Manifest marks the plugin as desktop-only. macOS-specific JXA usage means non-macOS support is out of scope for early releases. |
| macOS Calendar read access | Partial | JXA-based read integration exists in `main.js`; hardening, timeout handling, stable IDs, and richer fields remain incomplete. |
| macOS Reminders read access | Partial | JXA-based read integration exists; reminders currently use a minimal model. |
| Cache | Partial | ±6 month preload exists conceptually in code; range escape behavior, refresh state, and large-account performance need acceptance testing. |
| Calendar source discovery | Partial | Discover UI exists; needs color preview, empty/error states, and persistence semantics refinement. |
| Reminder list discovery | Partial | Discover UI exists; needs empty/error states and persistence semantics refinement. |
| Event display | Partial | Basic list, time range, all-day handling, calendar badge, ongoing/soon styling exist; details panel and more edge cases are not complete. |
| Reminder display | Partial | Basic list exists; overdue, no-date section, display range, priority, and subtasks are incomplete. |
| Right-click actions | Planned | Current day/week context menu is inherited from calendar note behavior; Calendian event/reminder actions are not complete. |
| Write operations | Planned | Creating/editing/deleting Calendar events or Reminders must not be documented as current behavior until safety gates are implemented. |
| Note association | Planned | Existing daily/weekly note integration comes from the base calendar plugin behavior; Calendian event/reminder frontmatter association is not complete. |
| Tasks integration | Planned | Current task dots for daily notes exist from base plugin behavior; macOS Reminders sync with Obsidian Tasks is not implemented. |
| Timeline / week / statistics views | Planned | Not current behavior. |
| Android / cross-platform | Deferred | Requires a separate architecture and authentication model. |

## Current release label

Current repository state should be treated as **pre-v0.1 / Phase 1 partial**.

## README policy

README may list only the following as current behavior unless this file is updated with evidence:

- desktop-only Obsidian plugin shell;
- macOS Calendar and Reminders read integration in partial form;
- sidebar calendar with event/reminder panel;
- basic date selection;
- basic source discovery;
- basic auto-refresh/cache behavior.

Everything else must be marked as planned, experimental, or future.

## Immediate status corrections needed

1. Align plugin name and id between README, SPEC, and `manifest.json`.
2. Align Obsidian minimum version between README/SPEC and `manifest.json`.
3. Mark multi-file structure in documentation as target architecture until code is actually split.
4. Move unimplemented README feature claims into Planned Features.
5. Add stable event/reminder IDs before any write, delete, or note-association feature is considered release-ready.
