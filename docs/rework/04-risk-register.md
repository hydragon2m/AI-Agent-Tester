# Risk Register

## High Risk

- API keys are currently stored in browser localStorage.
- AI/user/database values are rendered through `innerHTML`.
- JSON-file storage can lose data under concurrent writes.
- Missing runtime functions break tree/test-case persistence.

## Medium Risk

- AI output is parsed optimistically without schema validation.
- Provider model names and API formats can drift over time.
- Large single-file scripts make regression risk high.
- Export formats are manually assembled in multiple places.

## Low Risk

- Styling is large but self-contained.
- Prototype data shape is small and easy to migrate.
- Current Express API surface is narrow.

## Mitigations

- Move provider calls to backend.
- Add `escapeHtml`/safe rendering now, then framework-level safe rendering later.
- Add request validation.
- Add SQLite migrations.
- Add tests around generation, persistence, tree deletion, and export.

