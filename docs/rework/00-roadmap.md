# AI QA Assistant Rework Roadmap

## Goal

Turn the current prototype into a maintainable internal product for long-term QA workflows.

## Target Stack

- Frontend: React + Vite, migrated incrementally from the current static UI.
- Backend: Express first, with a clean service/controller structure.
- Data: SQLite for single-team/internal usage, PostgreSQL later if multi-team usage grows.
- Validation: Zod schemas for API requests and AI output.
- AI: backend-side provider router for Gemini, Claude, and OpenAI.

## Phases

### Phase 1: Stabilize Current Prototype

- Add usable scripts for local run and syntax checks.
- Fix known runtime errors in tree/test-case persistence.
- Remove duplicated AI provider functions.
- Escape user/AI/database values before rendering HTML.
- Keep behavior close to the current UI.

### Phase 2: Backend Boundary

- Move AI provider calls from browser to backend.
- Keep API keys outside the browser.
- Add request validation and centralized error handling.
- Replace direct JSON-file writes with a storage service.

### Phase 3: Durable Data

- Introduce SQLite tables for projects, nodes, test cases, snippets, settings, and AI runs.
- Add migrations and seed data.
- Store test cases as records, not a single large JSON array.
- Add revision history for generated and updated test cases.

### Phase 4: Frontend Rebuild

- Migrate UI to React + Vite.
- Build stable components: ProjectTree, PromptPanel, TestCaseTable, ProviderSettings, ExportMenu.
- Make test cases editable in-table.
- Use safe markdown rendering with sanitization.

### Phase 5: Team Readiness

- Add auth if multiple users need access.
- Add project-level permissions.
- Add audit logs for generated, edited, imported, and exported data.
- Add automated tests for API, data migrations, and critical UI workflows.

