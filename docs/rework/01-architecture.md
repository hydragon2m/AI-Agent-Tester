# Target Architecture

## Current Problem

The prototype keeps UI rendering, AI calls, local state, tree logic, exports, and persistence in a single large browser script. API keys are stored in localStorage and provider APIs are called directly from the browser.

## Target Boundary

```text
Browser UI
  -> Backend API
      -> AI Provider Router
      -> Data Services
      -> SQLite/PostgreSQL
```

## Frontend Responsibilities

- Render project tree, prompt panels, generated output, and editable test case tables.
- Send user actions to backend APIs.
- Keep only short-lived UI state in memory.
- Never store raw AI provider keys.
- Never directly call AI provider APIs.

## Backend Responsibilities

- Own provider credentials and fallback logic.
- Validate every request body and response shape.
- Persist project tree and test case records.
- Track AI generation history.
- Serve export-ready data.

## Module Layout Proposal

```text
src/
  server/
    app.ts
    routes/
      projects.routes.ts
      nodes.routes.ts
      test-cases.routes.ts
      ai.routes.ts
      snippets.routes.ts
    services/
      project.service.ts
      node.service.ts
      test-case.service.ts
      ai-router.service.ts
    ai/
      providers/
        gemini.provider.ts
        claude.provider.ts
        openai.provider.ts
      prompts/
        testcase.prompt.ts
        api-test.prompt.ts
        security.prompt.ts
    db/
      schema.sql
      migrations/
  web/
    components/
    pages/
    state/
    api/
```

## Incremental Approach

Do not rewrite everything at once. First stabilize the existing files, then move one boundary at a time:

1. Current browser app + improved Express server.
2. Browser app calls backend for AI.
3. Backend uses SQLite.
4. Frontend migrates to React components.

