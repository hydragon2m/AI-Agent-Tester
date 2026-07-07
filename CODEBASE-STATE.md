# CODEBASE STATE — Demo_v2

> **QUAN TRỌNG:** Claude PHẢI đọc file này trước khi sửa bất kỳ code nào.
> Sau mỗi lần thêm/sửa chức năng thành công → cập nhật file này.
> Ngày cập nhật cuối: ___

---

## MỤC LỤC
1. [Kiến trúc tổng quan](#kiến-trúc-tổng-quan)
2. [Flow chức năng chi tiết](#flow-chức-năng-chi-tiết) ← phần quan trọng nhất
3. [Quy tắc code bắt buộc](#quy-tắc-code-bắt-buộc)
4. [Skills đã build](#skills-đã-build)
5. [Roadmap & Known Issues](#roadmap--known-issues)
6. [Lịch sử thay đổi](#lịch-sử-thay-đổi)

---

## Kiến trúc tổng quan

```
Demo_v2/prototype/src/
├── server/
│   ├── app.js                          — Express entry, mount routes
│   ├── db/schema.sql                   — SQLite schema
│   ├── routes/
│   │   ├── projects.routes.js          — CRUD project tree
│   │   ├── skill-runs.routes.js        — Skill execution history
│   │   └── lark-push.routes.js         — Lark Base push API
│   └── services/
│       ├── ai-router.service.js        — Multi-provider: Claude → Gemini → GPT
│       ├── skill-run.service.js        — Chạy skill + lưu history
│       └── lark-push-service.js        — Lark Open API (tạo table + push records)
└── web/
    ├── App.jsx
    ├── features/skills/
    │   └── skill-registry.js           — Tất cả skill definitions + prompts
    ├── components/
    │   ├── input/InputPanel.jsx        — Nhập req/spec, chọn skill, upload ảnh
    │   ├── output/
    │   │   ├── OutputPanel.jsx         — Hiển thị kết quả AI (markdown/TC table)
    │   │   └── TestCaseTable.jsx       — Bảng TC: edit inline, checkbox, actions
    │   └── lark/LarkPushModal.jsx      — Modal push TC lên Lark Base
    ├── state/
    │   ├── useSkillWorkspace.js        — State chính: selected node, current skill, input/output
    │   ├── useSkillHistory.js          — Lịch sử skill runs per node
    │   └── useLarkMapping.js           — Field mapping TC ↔ Lark columns
    └── backend-api/
        ├── ai.api.js                   — POST /api/ai/generate
        └── skill-runs.api.js           — GET/POST /api/skill-runs
```

---

## Flow chức năng chi tiết

> ⚠️ Đây là phần QUAN TRỌNG NHẤT. Khi sửa code, Claude phải hiểu flow end-to-end trước.

### FLOW 1 — Tạo Project Tree (module → screen → feature)

```
User click "Tạo module" trên sidebar
    ↓
[Sidebar.jsx] gọi POST /api/projects
    body: { name: "Product Management", type: "module", parent_id: null }
    ↓
[projects.routes.js] validate → INSERT INTO projects
    ↓
Response: { id: 1, name: "...", type: "module", children: [] }
    ↓
[Sidebar.jsx] refresh tree → hiển thị node mới
    ↓
User click vào node → [useSkillWorkspace.js] set selectedNode
    ↓
InputPanel + OutputPanel load theo node đó
```

**Data model:**
```sql
projects: id | name | type (module/screen/feature) | parent_id | created_at
```

**⛔ KHÔNG ĐƯỢC:** Đổi schema bảng `projects`, đổi field `type` enum values.

---

### FLOW 2 — Gen SRS từ requirement/ảnh (LUỒNG CHÍNH)

```
User chọn node feature trên tree
    ↓
User chọn skill = "srs-generator" trên InputPanel
    ↓
[InputPanel.jsx] hiện ô nhập text + nút upload ảnh (vì skill.supportsImage = true)
    ↓
User nhập requirement HOẶC upload ảnh mockup HOẶC cả hai
    ↓
User click "Generate"
    ↓
[InputPanel.jsx] gọi [ai.api.js] POST /api/ai/generate
    body: {
      skill: "srs",
      input: "Tính năng quản lý sản phẩm...",
      nodeId: 5,
      image: base64Data (nếu có ảnh)
    }
    ↓
[ai-router.service.js] chọn provider (Claude vì cần vision)
    ↓
Lấy skill config từ [skill-registry.js]:
    - SKILLS.srs.system (system prompt)
    - SKILLS.srs.buildPrompt(input, context, options) → user prompt
    ↓
Gọi Claude API:
    messages: [
      { role: "user", content: [
        { type: "image", source: { type: "base64", ... } },  // nếu có ảnh
        { type: "text", text: builtPrompt }
      ]}
    ]
    ↓
Claude trả về markdown SRS
    ↓
[skill-run.service.js] lưu vào DB:
    INSERT INTO skill_runs (node_id, skill, input, output, created_at)
    ↓
Response → [OutputPanel.jsx] render markdown SRS
```

**Output SRS lưu trong DB:**
```json
{
  "type": "markdown",
  "content": "# Product Management — SRS\n\n## 1. Tổng quan\n..."
}
```

**⛔ KHÔNG ĐƯỢC:** Đổi response format của `/api/ai/generate`, đổi `output` JSON structure trong `skill_runs`.

---

### FLOW 2b — Câu hỏi làm rõ (clarification) + Phân rã thành Feature (nối tiếp Flow 2)

```
Nếu input quá mơ hồ, SKILLS.srs (skill-registry.js) yêu cầu AI CHỈ trả về 1 hộp
"[CÂU HỎI LÀM RÕ]" liệt kê TẤT CẢ câu hỏi cần thiết trong 1 lần (không hỏi nhỏ giọt
nhiều vòng) — không viết SRS.
    ↓
[OutputPanel.jsx] parse hộp này bằng parseClarificationQuestions()
(features/skills/srs-clarification.js — dùng CHUNG giữa OutputPanel và main.jsx,
không tách 2 bản khác nhau) → hiện <ClarificationForm> cho user trả lời từng câu.
    ↓
User trả lời → [main.jsx] handleClarificationSubmit():
    - Gọi SKILLS.srs.buildFinalizePrompt(previousSrs, answersMarkdown, context)
      — gửi SRS/câu hỏi trước đó + câu trả lời mới, KHÔNG gửi lại toàn bộ input
      gốc để phân tích lại từ đầu (nhanh hơn vòng gen đầu).
    - System prompt: khi input có heading "### CÂU TRẢ LỜI LÀM RÕ" → BẮT BUỘC
      viết SRS đầy đủ, KHÔNG hỏi lại câu đã trả lời, chi tiết nhỏ còn thiếu thì
      tự gắn "[GIẢ ĐỊNH]" thay vì hỏi tiếp — tránh vòng lặp hỏi vô hạn.
    ↓
SRS hoàn chỉnh (không còn hộp câu hỏi) → [OutputPanel.jsx] hiện banner xanh
"✅ SRS đã hoàn chỉnh" (không tự ẩn như toast).
    ↓
★ THỦ CÔNG, KHÔNG TỰ ĐỘNG ★ — nếu node đang chọn có type = "module" HOẶC "screen"
(FEATURE_PARENT_TYPES trong main.jsx) VÀ parseClarificationQuestions(SRS) rỗng
(SRS thực sự hoàn chỉnh) → hiện nút "Phân rã thành Feature" ở khu Output (cùng
hàng với "Viết Test Case →"). User bấm nút này (KHÔNG tự chạy ngay sau khi Gen
SRS xong — user tự quyết định lúc nào bóc tách) → [main.jsx] handleDecomposeFeatures()
→ decomposeSrs():
    - Dùng SKILLS.srsdecomposer (skill-registry.js) để tách SRS thành mảng
      [{ name, srsSegment }] (JSON) qua POST /api/ai/generate với expectJson: true.
    - Với mỗi feature mới (chưa tồn tại node con cùng tên): tạo node type="feature"
      qua createNodeApi() — parent có thể là "module" (feature là con trực tiếp,
      bỏ qua cấp "screen" trung gian) hoặc "screen" (đúng hierarchy chuẩn) — cả 2
      đều hợp lệ, backend (node.service.js) không ràng buộc type cha/con, chỉ
      validate `type` nằm trong ['project','module','screen','feature'].
    - Tạo 1 skill_run skill="srs" cho node feature mới với output = srsSegment
      (để feature con đã có sẵn SRS riêng, gen TC luôn được).
    - Hiện banner kết quả (số feature tạo được + tên) — không tự ẩn.
    - projectTree.refreshTree() để sidebar hiện ngay các feature con mới.
    ↓
Từ Module/Screen: nút "Gen All TC" (handleGenAllTC) sinh Test Case song song
(BATCH_SIZE=3) cho TẤT CẢ feature con đã có SRS. Muốn gen thủ công từng feature
→ chọn feature đó trên sidebar, dùng skill Test Case như bình thường (Flow 3).
```

**Skill `srsdecomposer` là NỘI BỘ — không hiện trong sidebar chọn skill:**
`SkillSidebar.jsx` lọc bỏ key `srsdecomposer` khỏi danh sách nút chọn skill
(`Object.entries(SKILLS).filter(([key]) => key !== 'srsdecomposer')`) vì skill
này chỉ có ý nghĩa khi được gọi từ `decomposeSrs()` — nếu user tự chọn skill
này và bấm Generate qua đường chung, AI trả về 1 mảng JSON `[{name, srsSegment}]`
nhưng `OutputPanel.jsx` không biết render dạng này (không phải markdown, không
phải `{testCases:[...]}`) → hiện ra `"[object Object],..."`, đồng thời KHÔNG hề
tạo Feature nào (logic tạo node chỉ nằm trong `decomposeSrs()`). Đã từng là bug
thật (xem Lịch sử thay đổi) — **không được bỏ dòng filter này**.

**Về provider JSON (testcase, tcquality, srsdecomposer):** khi gọi AI cho các
skill này, luôn truyền `expectJson: true` trong body `/api/ai/generate` →
`ai-router.service.js` → Gemini bật `responseMimeType: 'application/json'` +
nâng `maxOutputTokens` lên 32768 (mặc định skill markdown vẫn 8192) — output
JSON dài (nhiều feature/nhiều TC) từng bị cắt cụt giữa chừng ở 8192 token gây
`JSON.parse` lỗi "Unterminated string", đã xác nhận qua test thực tế là tăng
token giải quyết được.

**⛔ KHÔNG ĐƯỢC:**
- Gọi `decomposeSrs()` khi `parseClarificationQuestions()` trên output còn > 0
  câu hỏi — nghĩa là SRS chưa hoàn chỉnh, chưa có gì để bóc tách.
- Tự động gọi lại `decomposeSrs()` ngay sau khi Gen SRS xong — đây là hành động
  THỦ CÔNG theo yêu cầu, user phải chủ động bấm nút "Phân rã thành Feature".
- Sửa `parseClarificationQuestions()` ở 1 chỗ mà quên chỗ kia — luôn import từ
  `features/skills/srs-clarification.js`, không copy lại logic.
- Bỏ dòng `.filter(([key]) => key !== 'srsdecomposer')` trong `SkillSidebar.jsx`
  — sẽ tái phát bug "[object Object]" khi user tự chọn skill này.

---

### FLOW 3 — Gen TC từ SRS (nối tiếp Flow 2)

```
★ SAU KHI SRS ĐƯỢC GEN XONG (Flow 2):

SRS output đang hiển thị trên OutputPanel
    ↓
User chuyển skill sang "test-case-generator" trên InputPanel
    ↓
★ SRS TỰ ĐỘNG FILL vào ô input của InputPanel ★
    [useSkillWorkspace.js] logic:
      - Khi skill thay đổi sang "test-case-generator"
      - Check: node hiện tại có skill_run nào với skill = "srs" không?
      - Nếu CÓ → lấy output.content (markdown SRS) → set vào inputText
      - User thấy ô input đã có SRS sẵn, có thể edit thêm hoặc gen luôn
    ↓
User click "Generate"
    ↓
[ai.api.js] POST /api/ai/generate
    body: {
      skill: "test-case-generator",
      input: "[nội dung SRS đã fill]",
      nodeId: 5
    }
    ↓
[skill-registry.js] SKILLS['test-case-generator'].buildPrompt(srsContent, context)
    → Prompt yêu cầu AI sinh TC theo schema JSON chuẩn
    ↓
Claude trả về JSON array test cases
    ↓
[skill-run.service.js] lưu vào skill_runs
    ↓
[OutputPanel.jsx] detect outputType = "testcase"
    → render [TestCaseTable.jsx] thay vì markdown
```

**Output TC lưu trong DB:**
```json
{
  "type": "testcase",
  "testCases": [
    {
      "id": "PM-TC-001",
      "name": "Hiển thị đủ 9 cột",
      "precondition": "Đăng nhập Super Admin",
      "steps": ["1. Vào Sản phẩm > Danh sách"],
      "expectedResult": "Bảng hiển thị 9 cột...",
      "priority": "High",
      "type": "Positive"
    },
    ...
  ]
}
```

**★ LOGIC AUTO-FILL SRS → TC INPUT:**
```js
// Trong useSkillWorkspace.js (hoặc InputPanel.jsx)
// Khi user chọn skill = "test-case-generator":
const lastSrsRun = skillRuns.find(r => r.skill === 'srs' && r.node_id === selectedNode.id);
if (lastSrsRun) {
  setInputText(lastSrsRun.output.content); // fill SRS vào input
}
```

**⛔ KHÔNG ĐƯỢC:**
- Đổi JSON schema của testCases array (TestCaseTable.jsx parse theo format này)
- Đổi key `testCases` thành tên khác
- Bỏ fields: id, name, steps, expectedResult (required cho render)

---

### FLOW 4 — Auto Audit TC sau khi gen (nối tiếp Flow 3)

```
★ SAU KHI TC ĐƯỢC GEN XONG (Flow 3):

TC table hiển thị trên OutputPanel
    ↓
★ TỰ ĐỘNG CHẠY AUDIT ★
    [OutputPanel.jsx] hoặc [useSkillWorkspace.js] logic:
      - Detect: skill vừa chạy = "test-case-generator" VÀ có output.testCases
      - Tự gọi POST /api/ai/generate với:
        body: {
          skill: "audit-tc-quality",
          input: JSON.stringify(output.testCases),
          nodeId: 5
        }
      - HOẶC: hiện nút "🔍 Audit bộ TC này" → user click mới chạy
    ↓
Claude nhận bộ TC → đánh giá theo 7 lens
    ↓
Trả về audit report (markdown):
    - Verdict
    - TC cần xem xét lại (ID + lý do)
    - Gap list
    - Khuyến nghị
    ↓
[OutputPanel.jsx] hiển thị audit report DƯỚI TC table
    → Badge cảnh báo trên các TC bị flag
    → User đọc audit → quyết định sửa TC nào
```

**⛔ KHÔNG ĐƯỢC:** Audit tự động sửa TC — chỉ HIỂN THỊ khuyến nghị, USER quyết định.

---

### FLOW 5 — Review & Edit TC (sau Audit)

```
User đọc audit report → thấy TC-PM-020 bị flag "expected result mơ hồ"
    ↓
[TestCaseTable.jsx] — User có 3 action cho mỗi TC:

★ EDIT (sửa):
    User click vào cell → inline edit → sửa expectedResult
    → State update trong component
    → Chưa lưu DB cho đến khi user click "Lưu thay đổi"
    
★ DELETE (xóa):
    User click icon 🗑️ trên TC row
    → TC bị remove khỏi array trong state
    → Chưa lưu DB cho đến khi user click "Lưu thay đổi"

★ ADD (thêm TC mới từ audit suggestion):
    User click "Thêm TC" → empty row xuất hiện
    → User nhập thủ công hoặc copy từ audit recommendation
    → TC mới thêm vào array

★ LƯU THAY ĐỔI:
    User click "Lưu" 
    ↓
    [skill-runs.api.js] PUT /api/skill-runs/:id
        body: { output: { type: "testcase", testCases: [...updated array...] } }
    ↓
    [skill-runs.routes.js] UPDATE skill_runs SET output = ? WHERE id = ?
    ↓
    ★ LƯU THÀNH REVISION MỚI ★
    Bản cũ giữ nguyên (hoặc lưu vào revision history table)
    Bản mới = bản sau edit
    → 2 bản = 2 phiên lịch sử riêng biệt
```

**Revision history logic:**
```
skill_runs table:
  run_id=1: skill=srs,     output=SRS markdown      (phiên 1)
  run_id=2: skill=tc-gen,   output=30 TCs gốc        (phiên 2 - auto gen)
  run_id=3: skill=audit,    output=audit report       (phiên 3 - auto audit)
  run_id=4: skill=tc-gen,   output=28 TCs sau edit    (phiên 4 - user edit)
```

**⛔ KHÔNG ĐƯỢC:**
- Auto-save khi user đang edit (phải explicit "Lưu")
- Ghi đè run cũ — tạo run mới để giữ history
- Audit tự sửa TC — chỉ flag + recommend

---

### FLOW 6 — Push TC lên Lark Base

```
User đã review + edit xong bộ TC
    ↓
User click "↑ Đẩy lên Lark" (LarkPushButton trên OutputPanel)
    ↓
[LarkPushModal.jsx] mở lên, hiển thị:
    - Input URL Lark Base
    - Số lượng TC sẽ push
    - Check: table đã tồn tại chưa?
    ↓
User paste URL Lark Base → click "Kiểm tra"
    ↓
[lark-push.routes.js] POST /api/lark/info
    body: { larkUrl: "https://vidivietnam.sg.larksuite.com/base/KbT2b...?table=tbl..." }
    ↓
[lark-push-service.js] parseUrl → getTenantToken → checkTableExists
    → Response: { tableExists: true/false, fields: [...] }
    ↓
Modal hiển thị: "Bảng đã tồn tại — Push vào bảng có sẵn" hoặc "Tạo bảng & Push"
    ↓
User click Push
    ↓
[lark-push.routes.js] POST /api/lark/push
    body: { larkUrl, testCases: [...28 TCs...], runId: 4 }
    ↓
[lark-push-service.js]:
    1. Nếu table chưa có → createTable(12 cột chuẩn theo STANDARD_FIELDS)
    2. Map TC fields → Lark fields (dùng useLarkMapping config)
    3. Batch insert records (có sleep 0.3s giữa mỗi batch tránh rate limit)
    ↓
Response: { success: true, created: 28 }
    ↓
Modal hiển thị "✅ Đã push 28 TC"
```

**Field mapping TC → Lark:**
```
TC.id             → Lark "Mã TC" (text)
TC.name           → Lark "Tên TC" (text)
TC.precondition   → Lark "Precondition" (text)
TC.steps[]        → Lark "Các bước" (text, join "\n")
TC.expectedResult → Lark "Kết quả mong đợi" (text)
TC.priority       → Lark "Mức ưu tiên" (single_select option_id)
TC.type           → Lark "Loại TC" (single_select option_id)
```

**⛔ KHÔNG ĐƯỢC:**
- Push khi user chưa click confirm
- Lưu Lark credentials vào DB/file
- Đổi STANDARD_FIELDS mà không update mapping

---

### FLOW TỔNG — Chuỗi hoàn chỉnh

```
[1] User tạo project tree: Module → Screen → Feature
                ↓
[2] User chọn feature node → chọn skill "SRS" → nhập req/ảnh → Gen SRS
                ↓
[3] SRS output → User chuyển sang skill "TC Gen" → SRS tự fill vào input → Gen TC
                ↓
[4] TC output → Auto audit chạy → Hiển thị audit report + flag TC yếu
                ↓
[5] User review: edit / xóa / thêm TC → Lưu → Tạo revision mới
                ↓
[6] User click "Push Lark" → Modal → Confirm → 28 TC lên Lark Base
                ↓
[7] Lark Base = source of truth cho execution
```

---

## Quy tắc code BẮT BUỘC

> Xem `CLAUDE.md` (mục "Quy tắc code BẮT BUỘC") — đó là nguồn chính, được nạp tự động mỗi session. Không lặp lại ở đây để tránh 2 bản lệch nhau.
> Bổ sung riêng cho file này: **Khi sửa bug** chỉ sửa đúng chỗ bug, không "tiện thể refactor".

---

## Skills đã build

| Skill | File | Trigger | Output |
|-------|------|---------|--------|
| srs-generator | srs-generator.md | "viết SRS", "đặc tả cho feature này" | markdown |
| test-case-generator | test-case-generator.skill | "gen TC", "sinh test case" | JSON testCases |
| audit-tc-quality | audit-tc-quality.md | "review TC", "audit bộ TC" | markdown |
| audit-structured | audit-structured.md | (internal) audit → JSON diffs | JSON diffs |
| create-api-testcase | create-api-testcase.md | "tạo TC API từ CURL" | CSV + Postman JSON |
| ui-testing | ui-testing.md | "/run TC-PM-011" | report + screenshot |
| api-testing | api-testing.md | "/run-api TC-PM-028" | report + JSON evidence |
| srsdecomposer | skill-registry.js (`SKILLS.srsdecomposer`) | (internal, tự động — xem FLOW 2b) sau khi Gen SRS xong trên node type="screen" | JSON `[{ name, srsSegment }]` |

---

## Roadmap & Known Issues

### Features planned
| # | Feature | Status | Notes |
|---|---------|--------|-------|
| F1 | Lark Base push | ✅ Code done | Cần test edge cases |
| F2 | Audit tích hợp node panel | 📋 Planned | Wire audit vào OutputPanel |
| F3 | Status sync Lark → Tool | 📋 Planned | Webhook hoặc polling |
| F4 | TC Snippet library (reuse) | 📋 Planned | CRUD + tag nghiệp vụ |
| F5 | TC Diff khi regenerate | 📋 Planned | Compare revision, highlight |
| F6 | Multi-user + phân quyền | 📋 Planned | QA vs QA Lead roles |

### Known Issues
| # | Mô tả | File | Workaround |
|---|-------|------|-----------|
| 1 | Lark rate limit khi push >50 TC | lark-push-service.js | sleep 0.3s (chưa test bộ lớn) |
| 2 | Lark field mapping vỡ khi đổi tên cột | useLarkMapping.js | Error message chưa rõ |
| 3 | SQLite không scale >5 user | schema.sql | Migrate PostgreSQL sau |
| 4 | Auto-fill SRS→TC chưa handle case nhiều SRS run | useSkillWorkspace.js | Lấy run mới nhất |
| 5 | AI SRS thỉnh thoảng vẫn hỏi thêm 1 câu ở vòng chốt nếu câu trả lời user hé lộ mâu thuẫn thật sự mới | skill-registry.js (system prompt) | Chấp nhận được — chỉ xảy ra khi có mâu thuẫn nghiệp vụ thật, không phải hỏi vụn vặt như trước |
| 6 | `parseClarificationQuestions` vẫn có thể miss nếu AI dùng định dạng hộp câu hỏi khác hẳn 3 dạng đã test (`> **[...]**`, `**[...]**`, `# [...]`) | srs-clarification.js | Regex đã lenient nhưng không bao quát 100% — nếu gặp case mới cần bổ sung thêm biến thể vào regex |
| 7 | Nút "+ Thêm feature" thủ công trên TreeNode (sidebar) vẫn gợi ý next-type theo hierarchy cứng module→screen→feature (`NEXT_TYPE` trong TreeNode.jsx) — không tự nhận biết trường hợp user tạo feature trực tiếp dưới module (bỏ qua screen) như nút "Phân rã thành Feature" hỗ trợ | TreeNode.jsx | Không ảnh hưởng — user vẫn tạo thủ công bình thường, chỉ là gợi ý mặc định chưa khớp 100% mọi cách tổ chức cây |

---

## Lịch sử thay đổi

| Ngày | Thay đổi | Files | Status |
|------|---------|-------|--------|
| ___ | Init project tree + skill registry | schema.sql, skill-registry.js | ✅ |
| ___ | Thêm Lark push (3 files) | lark-push-service/routes/modal | ✅ |
| ___ | Thêm SRS generator skill | skill-registry.js | ✅ |
| ___ | Thêm audit-structured skill | skill-registry.js | ✅ |
| ___ | Build ui-testing + api-testing skills | .md files | ✅ |
| 2026-07-07 | Fix vòng lặp hỏi vô hạn SRS (system prompt: hỏi hết 1 lượt, không hỏi lại sau vòng chốt); thêm buildFinalizePrompt (vòng chốt nhanh hơn); fix parseClarificationQuestions bỏ lỡ câu hỏi khi AI đổi format hộp câu hỏi (nguyên nhân chính khiến cả form hỏi lẫn auto-decompose "không hoạt động"); chặn auto-decompose khi SRS chưa hoàn chỉnh; fix output_json→output field sai ở handleGenAllTC; thêm expectJson ép JSON + nâng maxOutputTokens 8192→32768 cho skill JSON (fix JSON bị cắt cụt) | skill-registry.js, srs-clarification.js (mới), OutputPanel.jsx, main.jsx, ai.routes.js, ai-router.service.js, gemini.provider.js, openai.provider.js | ✅ Đã test thật với Gemini (round hỏi → round chốt → decompose ra 7 feature hợp lệ) |
| 2026-07-07 | Fix bug "[object Object]" khi user tự chọn skill nội bộ `srsdecomposer` từ sidebar (skill này giờ bị ẩn khỏi danh sách chọn); đổi "Auto Decompose" từ TỰ ĐỘNG sang THỦ CÔNG — thêm nút "Phân rã thành Feature" ở Output, user tự bấm sau khi xem SRS xong; mở rộng hỗ trợ node type "module" (không chỉ "screen") cho cả nút này lẫn "Gen All TC", vì user tổ chức cây Project→Module→Feature trực tiếp (bỏ qua Screen) — đã verify backend không ràng buộc type cha/con nên an toàn | SkillSidebar.jsx, main.jsx | ✅ Build pass; verify độc lập qua workflow (sidebar filter đúng, decomposeSrs không phụ thuộc sidebar, không còn path nào khác lộ srsdecomposer); test thật tạo node feature dưới module qua node.service.js |
| 2026-07-07 | Fix `projectTree.refreshTree is not a function` — hook `useProjectTree()` định nghĩa `refreshTree()` và dùng nội bộ (createNode/renameNode/deleteNode/importNodes) nhưng quên liệt kê trong object trả về, nên bên ngoài hook (ví dụ `main.jsx#decomposeSrs()`) gọi `projectTree.refreshTree()` luôn bị `undefined`. Bug có sẵn từ trước, chỉ lộ ra hôm nay khi user lần đầu bấm trót lọt tới bước cuối của "Phân rã thành Feature" trên UI thật | useProjectTree.js | ✅ Build pass; đối chiếu đủ 10 usage `projectTree.*` trong main.jsx với object trả về của hook, không còn field nào khác bị thiếu tương tự — CHƯA re-verify qua UI thật sau fix |
