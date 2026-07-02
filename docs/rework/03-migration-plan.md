# Migration Plan

## Phase 1: Keep Current Files Running

- Keep `index.html`, `style.css`, `app.js`, and `server_db.js`.
- Add npm scripts for local run and syntax checks.
- Serve static files from the existing Express server.
- Fix runtime errors around tree-node test-case persistence.
- Reduce unsafe rendering in high-traffic areas.

Status: mostly complete for stabilization. The backend has since moved from `server_db.js` into `src/server/app.js`.

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
  - generate test case
  - test case table
  - export actions
  - provider settings

Status: initial Vite/React shell exists under `src/web/` with:

- project tree CRUD
- provider status/settings
- test-case generation through backend AI API
- load/save test cases by selected node
- JSON export

Legacy root files (`index.html`, `style.css`, `app.js`) should stay read-only until the React web flow reaches feature parity.

## Phase 5: Remove Prototype Artifacts

- Delete patch/fix/repair scripts after behavior is covered.
- Remove direct browser AI calls.
- Remove localStorage project/test-case persistence.
