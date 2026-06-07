# Calendian Specification-Driven Development Framework

> Status: normative process document  
> Last updated: 2026-06-07

Calendian uses Specification-Driven Development (SDD): the specification is the primary artifact, and implementation, tests, release decisions, and roadmap items must trace back to explicit requirements.

## Document hierarchy

| Layer | File | Purpose |
|---|---|---|
| Product specification | [`/SPEC.md`](../../SPEC.md) | Single source of truth for product scope, requirements, domain model, constraints, and non-goals. |
| Roadmap | [`/ROADMAP.md`](../../ROADMAP.md) | Versioned delivery plan derived from requirement IDs. |
| Current implementation status | [`CURRENT_STATUS.md`](./CURRENT_STATUS.md) | Truth table for what is implemented, partial, planned, or explicitly out of scope. |
| Acceptance model | [`ACCEPTANCE.md`](./ACCEPTANCE.md) | Release gates and requirement-level acceptance rules. |
| Test strategy | [`TESTING.md`](./TESTING.md) | Manual and future automated test coverage mapped to requirements. |
| Traceability matrix | [`TRACEABILITY.md`](./TRACEABILITY.md) | Mapping from goals → capabilities → requirements → tasks → tests → release gates. |
| Task backlog | [`TASKS.md`](./TASKS.md) | Sequenced implementation tasks with dependencies and Definition of Done. |
| Risk register | [`RISKS.md`](./RISKS.md) | Product, technical, UX, privacy, and schedule risks with mitigations. |
| Privacy model | [`../PRIVACY.md`](../PRIVACY.md) | Data read, stored, logged; diagnostics redaction; external API policy. |
| Architecture | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Target module structure, data flow, safety boundaries, design decisions. |
| Settings schema | [`../SETTINGS_SCHEMA.md`](../SETTINGS_SCHEMA.md) | Settings data structure, defaults, source identity model, migration policy. |
| Release checklist | [`../RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md) | Per-release execution checklist with version-specific gates. |

## SDD rules

1. **No feature without a requirement ID.** Every implementation task must reference one or more `REQ-*` IDs from `SPEC.md`.
2. **No release without acceptance evidence.** A release is complete only when its acceptance gates in `ACCEPTANCE.md` pass.
3. **No README promise without status.** README must distinguish current, planned, experimental, and non-goal features.
4. **No write operation without safety requirements.** Calendar/Reminder mutations require explicit safety, rollback, and confirmation behavior.
5. **No architectural drift without updating design/spec.** If implementation changes data models, permissions, caching, or sync semantics, update `SPEC.md` and `TRACEABILITY.md` in the same change.
6. **No roadmap item without risk review.** Work involving JXA writes, recurring events, cross-platform support, or external APIs must list risks in `RISKS.md`.

## Requirement syntax

Requirements should use constrained natural language, preferably EARS-style patterns:

- **Ubiquitous:** `THE SYSTEM SHALL <expected behavior>.`
- **Event-driven:** `WHEN <trigger>, THE SYSTEM SHALL <expected behavior>.`
- **State-driven:** `WHILE <state>, THE SYSTEM SHALL <expected behavior>.`
- **Optional:** `WHERE <feature is enabled>, THE SYSTEM SHALL <expected behavior>.`
- **Unwanted behavior:** `IF <failure condition>, THE SYSTEM SHALL <safe response>.`

Each requirement must include:

- stable ID
- priority (`P0`, `P1`, `P2`, `P3`)
- release target
- status (`Implemented`, `Partial`, `Planned`, `Deferred`, `Rejected`)
- acceptance evidence reference

## Change workflow

1. Update or add requirements in `SPEC.md`.
2. Update traceability in `TRACEABILITY.md`.
3. Update implementation tasks in `TASKS.md`.
4. Add or update acceptance checks in `ACCEPTANCE.md` and `TESTING.md`.
5. Implement code.
6. Update `CURRENT_STATUS.md` and README.

## Status vocabulary

| Status | Meaning |
|---|---|
| Implemented | Works in the current repository and is documented as current behavior. |
| Partial | Some behavior exists, but edge cases, UX states, or acceptance coverage are incomplete. |
| Planned | Approved scope, not implemented. |
| Deferred | Valid idea, intentionally postponed. |
| Rejected | Explicit non-goal or removed scope. |

## Definition of SDD-complete for a change

A change is SDD-complete only if:

- every changed behavior maps to requirement IDs;
- affected data model or UX state is updated;
- at least one acceptance check exists;
- risks are updated when safety, privacy, permissions, or user data mutation are involved;
- README does not overstate current functionality.
