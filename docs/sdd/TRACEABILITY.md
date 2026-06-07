# Traceability Matrix

> Status: living traceability document  
> Last updated: 2026-06-07

This matrix links product goals to requirements, implementation tasks, acceptance gates, and tests. Update it whenever requirements, roadmap, or implementation tasks change.

## Product goals

| Goal ID | Goal | Success signal |
|---|---|---|
| GOAL-001 | Let Obsidian users view macOS Calendar and Reminders without switching apps. | User can reliably see selected-day events/reminders in the sidebar. |
| GOAL-002 | Preserve local-first privacy. | No calendar/reminder content leaves the user's machine by default. |
| GOAL-003 | Enable safe calendar/reminder management from Obsidian. | Writes are confirmed, recoverable, and scoped. |
| GOAL-004 | Connect schedule items to Obsidian notes. | Events/reminders can be linked to notes through stable metadata. |
| GOAL-005 | Offer richer planning views over time. | Timeline, week, search, and export views share the same source data model. |
| GOAL-006 | Help users build consistency through goals, habits, and reflection without shame or external services. | Goals, habits, nudges, and reviews are tracked locally in Obsidian with encouragement-oriented stats. |

## Goal to requirement groups

| Goal | Requirement groups |
|---|---|
| GOAL-001 | `REQ-PLAT-*`, `REQ-PERM-*`, `REQ-CAL-*`, `REQ-REM-*`, `REQ-SRC-*`, `REQ-CACHE-*`, `REQ-UX-*` |
| GOAL-002 | `REQ-PRIV-*`, `REQ-ERR-*`, `REQ-DIAG-*` |
| GOAL-003 | `REQ-WRITE-*`, `REQ-REC-*`, `REQ-NL-*`, `REQ-ERR-*` |
| GOAL-004 | `REQ-NOTE-*`, `REQ-TASK-*`, `REQ-NOTIF-*` |
| GOAL-005 | `REQ-VIEW-*`, `REQ-SEARCH-*`, `REQ-EXPORT-*`, `REQ-UI-*` |
| GOAL-006 | `REQ-GOAL-*`, `REQ-HABIT-*`, `REQ-NUDGE-*`, `REQ-REVIEW-*`, `REQ-STATS-*` |

## Version traceability

| Version | Primary requirement IDs | Acceptance gates | Test suites |
|---|---|---|---|
| v0.1 Read-only MVP | `REQ-PLAT-001..004`, `REQ-PERM-001..004`, `REQ-CAL-001..006`, `REQ-REM-001..004`, `REQ-SRC-001..004`, `REQ-CACHE-001..005`, `REQ-UX-001..004`, `REQ-PRIV-001..002`, `REQ-ERR-001..004` | `GATE-V001-*` | `TS-001` to `TS-006` |
| v0.2 Read-only polish | `REQ-CAL-007..012`, `REQ-REM-005..009`, `REQ-DIAG-001..002`, `REQ-CACHE-006..008`, `REQ-UX-006`, `REQ-UX-010`, `REQ-ERR-003` | v0.2 gates | `TS-003` to `TS-006` |
| v0.3 Safe create | `REQ-WRITE-001..010`, `REQ-NL-001..005`, `REQ-ERR-005..006`, `REQ-REC-001..003`, `REQ-ARCH-001` | v0.3 gates | `TS-007` |
| v0.4 Safe edit/delete | `REQ-WRITE-011..020`, `REQ-REC-004..008` | v0.4 gates | `TS-008` |
| v0.5 Note association & notifications | `REQ-NOTE-001..010`, `REQ-TASK-001..004`, `REQ-NOTIF-001..005`, `REQ-PRIV-003` | v0.5 gates | `TS-009` |
| v0.5.5 Self-direction | `REQ-GOAL-001..008`, `REQ-HABIT-001..010`, `REQ-NUDGE-001..009`, `REQ-REVIEW-001..007`, `REQ-STATS-001..006` | v0.5.5 gates | `TS-010` to `TS-013` |
| v0.6 Advanced views/export | `REQ-VIEW-001..006`, `REQ-SEARCH-001..005`, `REQ-EXPORT-001..004`, `REQ-UI-001..004` | v0.6 gates | future view/search suites |
| v1.x Cross-platform | `REQ-XPLAT-*` | future gates | future platform suites |

## Requirement to implementation task mapping

| Requirement group | Task group |
|---|---|
| `REQ-PLAT-*` | `TASK-001` packaging and compatibility alignment |
| `REQ-PERM-*` | `TASK-002` permission state model and recovery UI |
| `REQ-CAL-*` | `TASK-003` event read model and rendering |
| `REQ-REM-*` | `TASK-004` reminder read model and rendering |
| `REQ-SRC-*` | `TASK-005` source discovery and filtering |
| `REQ-CACHE-*` | `TASK-006` cache lifecycle and refresh behavior |
| `REQ-UX-*` | `TASK-007` sidebar UX states and visual polish |
| `REQ-PRIV-*` | `TASK-008` privacy and diagnostics redaction |
| `REQ-ERR-*` | `TASK-009` error classification and recovery |
| `REQ-WRITE-*` | `TASK-020` to `TASK-029` safe write implementation |
| `REQ-NL-*` | `TASK-023` natural language event creation |
| `REQ-REC-*` | `TASK-030` recurring event safety model |
| `REQ-NOTE-*` | `TASK-040` to `TASK-049` note association |
| `REQ-NOTIF-*` | `TASK-043` in-app notifications |
| `REQ-TASK-*` | `TASK-050` to `TASK-054` Tasks integration |
| `REQ-GOAL-*` | `TASK-090` to `TASK-094` goals and focus |
| `REQ-HABIT-*` | `TASK-095` to `TASK-099` habits and consistency |
| `REQ-NUDGE-*` | `TASK-100` to `TASK-104` encouragement nudges |
| `REQ-REVIEW-*` | `TASK-105` to `TASK-109` reflection and review |
| `REQ-STATS-*` | `TASK-110` to `TASK-114` encouragement statistics |
| `REQ-VIEW-*` | `TASK-060` to `TASK-069` advanced views |
| `REQ-SEARCH-*` | `TASK-070` to `TASK-074` search |
| `REQ-EXPORT-*` | `TASK-075` to `TASK-079` data export |
| `REQ-XPLAT-*` | future platform track |

## Traceability maintenance checklist

When adding a requirement:

- [ ] Add it to `SPEC.md` with ID, priority, target version, and status.
- [ ] Add or update corresponding task in `TASKS.md`.
- [ ] Add acceptance criteria in `ACCEPTANCE.md`.
- [ ] Add manual or automated test coverage in `TESTING.md`.
- [ ] Add risk entry if the requirement affects privacy, permissions, user data, writes, or cross-platform behavior.
- [ ] Update README if user-facing status changes.
