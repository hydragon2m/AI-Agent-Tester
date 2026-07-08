# CLAUDE.md — Demo_v2 (AVIA QA Tool)

Node.js/Express + React + SQLite. Tool quản lý test case cho sản phẩm travel-tech (eSIM, Fast Track, Transfer).

## Commands
```bash
npm run dev          # Start dev server (Express 3001 + Vite 5173)
npm run build        # Production build
```

## Project Structure
```
src/server/          # Express backend
  routes/            # API endpoints (projects, test-cases, snippets, skill-runs, lark)
  services/          # Business logic (ai-router, skill-run, lark-push)
  db/                # SQLite schema + database
src/web/             # React frontend
  features/skills/   # skill-registry.js (all skill definitions + prompts)
  components/        # UI components (InputPanel, OutputPanel, TestCaseTable, LarkPushModal)
  state/             # React state hooks (useSkillWorkspace, useSkillHistory, useLarkMapping)
  backend-api/       # Frontend API clients
```

## Quy tắc code BẮT BUỘC
- LUÔN đọc file hiện tại trước khi sửa — không viết từ trí nhớ
- Sửa đúng chỗ cần sửa, KHÔNG rewrite toàn bộ file
- Khi thêm feature mới: thêm function/file mới, KHÔNG refactor code cũ đang chạy
- Không đổi tên route/endpoint đã có — frontend đang gọi đúng path
- Không thay đổi response JSON format — frontend parse theo format cũ
- Không xóa import đang dùng — check references trước
- Sau khi sửa xong: cập nhật CODEBASE-STATE.md
- ĐẦU session: đọc `HANDOFF.md` (trạng thái phiên trước + điều cấm). CUỐI session: cập nhật lại `HANDOFF.md`

## Flow nghiệp vụ chính
Đọc `CODEBASE-STATE.md` trước khi sửa code — file đó chứa 6 flow chi tiết:
1. Project Tree (module → screen → feature)
2. Gen SRS từ requirement/ảnh
3. Gen TC từ SRS (SRS tự fill vào input)
4. Auto audit TC sau khi gen
5. Review & Edit TC (edit/xóa/thêm → lưu revision mới)
6. Push TC lên Lark Base

## API Routes — KHÔNG đổi
```
GET/POST/PUT/DELETE  /tree              — Project tree CRUD
GET/POST             /testcases         — Test cases
GET/POST             /snippets          — TC snippets
POST                 /api/ai            — AI generate (multi-provider)
GET/POST             /api/skill-runs    — Skill execution history
POST                 /api/lark/info     — Check Lark table exists
POST                 /api/lark/push     — Push TC to Lark Base
GET/POST             /api/providers     — AI provider config
```

## Conventions
- Output tiếng Việt, thuật ngữ kỹ thuật giữ English
- AI provider fallback: Claude → Gemini → GPT (thứ tự QUAN TRỌNG, không đảo)
- TC JSON schema: `{ type: "testcase", testCases: [{ id, name, steps, expectedResult, priority, type }] }`
- Lark push: append-only (chưa có update/delete)
- Skill runs: mỗi lần lưu = revision mới, KHÔNG ghi đè run cũ
