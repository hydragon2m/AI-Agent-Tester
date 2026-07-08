# Migration Plan

## Phase 1: Keep Current Files Running

- Keep the original static prototype running while backend boundaries are introduced.
- Add npm scripts for local run and syntax checks.
- Serve static files from the existing Express server.
- Fix runtime errors around tree-node test-case persistence.
- Reduce unsafe rendering in high-traffic areas.

Status: complete for stabilization. The backend has since moved from `server_db.js` into `src/server/app.js`, and the old static prototype files have been removed from the active repo tree.

## Phase 2: Add Backend AI API

Create:

```text
POST /api/ai/generate
```

Request:

```json
{
  "skill": "testcase",
  "systemPrompt": "...",
  "userPrompt": "...",
  "nodeId": "node_..."
}
```

The backend chooses the provider, calls the AI API, validates output, persists an `ai_run`, and returns the result.

Status: initial backend boundary exists under `src/server/`:

- `routes/ai.routes.js`
- `services/ai-router.service.js`
- `ai/providers/*.provider.js`
- `routes/providers.routes.js`

The active web client should call relative API paths through Vite proxy or Express static hosting.

## Phase 3: Replace JSON File Storage

- Add SQLite.
- Add migrations.
- Write a one-time importer from `database.json`.
- Keep the old JSON file as a backup artifact, not as runtime storage.

## Phase 4: React Frontend

- Build React app beside the current static app.
- Move one workflow at a time:
  - project tree
  - skill switcher
  - prompt/options panel
  - generate output through backend AI API
  - test case table and generic output renderers
  - export actions
  - provider settings

Status: initial Vite/React shell exists under `src/web/` with:

- project tree CRUD
- provider status/settings
- skill switcher for Test Cases, API Test, UI Automation, Bug Analyzer, Security, and Performance
- test-case generation through backend AI API
- generic backend generation flow for non-testcase skills
- load/save test cases by selected node
- JSON/CSV export for test cases
- copy/export actions for generated output
- local demo mode and local history
- manual prompt processing, update/append, Lark copy/mapping, Markdown export
- tree export/import

Legacy static files are no longer root runtime files and are no longer kept as an in-repo fallback.

Next step: add focused UI/API tests for the React workflows.

## Phase 5: Remove Prototype Artifacts

- Static prototype artifacts have been removed from root runtime.
- Direct browser AI calls have been removed from the active web client.
- LocalStorage project/test-case persistence has been replaced by backend APIs for active runtime data.
