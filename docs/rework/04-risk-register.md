# Risk Register

## High Risk

- AI output parsing still relies on prompt-constrained JSON for testcase flows.
- Provider keys stored through the UI are encrypted in SQLite, but deployments must set a stable `ENCRYPTION_KEY`.
- Lark clipboard export depends on browser clipboard permissions and target table column order.
- Tree import recreates nodes through public create APIs, so imported node IDs are not preserved.

## Medium Risk

- Provider model names and API formats can drift over time.
- Markdown output rendering is intentionally small and should not be treated as a full Markdown sanitizer.
- `main.jsx` still coordinates several workflows and should get focused tests before deeper UI changes.
- Export formats are manually assembled and need regression coverage.

## Low Risk

- Styling is large but self-contained.
- Current Express API surface is narrow.
- Removed legacy static files reduce runtime ambiguity.

## Mitigations

- Keep provider calls backend-only.
- Set `ENCRYPTION_KEY` in `.env` before saving provider keys through the UI.
- Add schema validation for AI responses and request payloads.
- Add focused tests around generation, update/append, persistence, tree import/export, Lark copy, and exports.
- Keep legacy static prototype out of the runtime tree.
