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
    api/
      ai.api.ts
      nodes.api.ts
      providers.api.ts
      test-cases.api.ts
    components/
      layout/
        AppHeader.tsx
        ProjectSidebar.tsx
        SkillSidebar.tsx
      tree/
        ProjectTree.tsx
        TreeNode.tsx
      providers/
        ProviderPills.tsx
        ProviderSettingsModal.tsx
      output/
        OutputPanel.tsx
        TestCaseTable.tsx
        MarkdownOutput.tsx
        CodeOutput.tsx
      controls/
        SkillOptions.tsx
        ExportActions.tsx
    features/
      skills/
        skill-registry.ts
        prompts/
        examples/
      testcase/
        testcase-export.ts
        testcase-parser.ts
    state/
      useProjectTree.ts
      useProviderSettings.ts
      useSkillWorkspace.ts
    pages/
      WorkspacePage.tsx
    main.tsx
```

## Incremental Approach

Do not rewrite everything at once. First stabilize the existing files, then move one boundary at a time:

1. Current browser app + improved Express server.
2. Browser app calls backend for AI.
3. Backend uses SQLite.
4. Frontend migrates to React components.

## Current React Web Boundary

The active React client is the only web runtime and lives under `src/web/`:

- `main.jsx` wires the workspace shell, hooks, API calls, generation actions, import/export actions, and modals.
- `api/` contains relative-path backend clients.
- `components/` contains layout, tree, provider, control, and output components.
- `features/` contains skill registry, examples, demo outputs, testcase parsing, and testcase export helpers.
- `state/` contains project tree, provider settings, skill workspace, and Lark mapping hooks.
- `index.css` keeps shared prototype styling plus React migration styles.
- API calls already use relative paths so the same client can run through Vite proxy or Express static hosting.

The old root static prototype has been removed from the runtime tree.
