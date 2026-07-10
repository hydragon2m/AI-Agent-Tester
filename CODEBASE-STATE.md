# CODEBASE STATE — Demo_v2

> **QUAN TRỌNG:** Claude PHẢI đọc file này trước khi sửa bất kỳ code nào.
> Sau mỗi lần thêm/sửa chức năng thành công → cập nhật file này.
> Ngày cập nhật cuối: 2026-07-08

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
    - System prompt (cập nhật 2026-07-08 — HỎI NHIỀU VÒNG): khi input có heading
      "### CÂU TRẢ LỜI LÀM RÕ" → TUYỆT ĐỐI không hỏi lại câu đã trả lời. Sau đó:
      nếu câu trả lời VẪN còn thiếu sót business-critical (state/validation/phân
      quyền/ràng buộc nghiệp vụ/số liệu) → ĐƯỢC PHÉP chèn lại hộp "[CÂU HỎI LÀM RÕ]"
      liệt kê hết câu hỏi MỚI trong 1 lượt, chưa viết SRS (lặp qua nhiều vòng đến
      khi hết khúc mắc). Chỉ khi hết business-critical mới viết SRS đầy đủ; "[GIẢ ĐỊNH]"
      CHỈ dùng cho chi tiết cosmetic, KHÔNG dùng để né hỏi. Toast ở main.jsx phân
      biệt "cần trả lời tiếp" vs "SRS hoàn chỉnh".
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

> ⚠️ **Cập nhật 2026-07-08: auto-audit giờ là TÙY CHỌN, mặc định TẮT** (tiết kiệm token).
> Chỉ tự chạy khi user tick checkbox "Tự động đánh giá chất lượng" ở SkillOptions (skill
> testcase) — `main.jsx#generate()` gate bằng `workspace.options.autoAudit`. Không tick →
> gen TC xong dừng; user bấm nút "Đánh giá chất lượng" ở Output khi cần.

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

> ⚠️ **Bảng TC (`TestCaseTable.jsx`) đã nâng cấp nhiều (2026-07-08)**: cột Module/Screen/Feature
> (Screen/Feature read-only từ cây) + Status (dropdown, gần cuối) + hover `title` xem full;
> **kéo chỉnh độ rộng cột** (`table-layout: fixed` + `COLUMNS`/`colWidths`); **cuộn ngang** trong
> khung (`.tc-table-wrapper` max-height 65vh + `overflow:auto`, header **sticky**); **phân trang
> 20 TC/trang** — GIỮ INDEX TUYỆT ĐỐI (`idx = pageStart + i`) khi sửa/xóa. IDE Gemini thêm:
> auto-sinh TC ID (`getNextTestCaseId`) khi Thêm dòng, `sortTestCases` khi lưu, empty-state khi 0 TC.

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

### FLOW 7 — Test Strategy tại Project node (F6+F7, mới 2026-07-08)

```
User chọn node type="project" trên tree
    ↓
★ WORKSPACE CHỈ HIỆN PANEL TEST STRATEGY ★ (main.jsx: isProjectNode → render
StrategyPanel inline; ẩn SkillSidebar + panel Requirement/Output + nút Generate).
    ↓
[StrategyPanel.jsx] on mount: GET /api/strategies?projectId= (strategy.api.js)
    - Có strategy → view "current" (read-only + trạng thái approved).
    - Chưa có → view "generate".
    ↓
View GENERATE: user chọn 1 trong 4 template (new_product / feature_addition /
hotfix / custom — strategy-templates.js) + ghi chú tùy chọn → "Sinh Test Strategy"
    ↓
[main.jsx] handleGenerateStrategyDraft(template, note):
    POST /api/ai/generate skill="teststrategy", expectJson:true
    (systemPrompt/buildPrompt lấy từ SKILLS.teststrategy) → JSON:
    { summary, stages[], executionPlan{sprintMap,ownerMap,priorityOrder}, releaseGate }
    → normalizeStages(stages, template) ép về ĐỦ 6 activity đúng key.
    ↓
View REVIEW: hiện 6 stage, mỗi stage có toggle ON/OFF + stageType/trigger/entry/exit/skills;
execution plan + release gate. User bật/tắt → "Approve strategy"
    ↓
[StrategyPanel] POST /api/strategies (status="approved") → lưu vào table
test_strategies (mỗi approve = 1 revision mới, giữ bản cũ) → view "current".
    ↓
View CURRENT: các stage đang bật + execution plan + release gate + placeholder
"Tiến độ %/Go-No-go sẽ có ở TS-F8/F9 khi có Lark status sync (F3)". Nút "Tạo lại".
```

**2 TRỤC STAGE (không gộp):** Trục 1 = hoạt động test (6 key toggle: api, smoke,
manual, regression, performance, security). Trục 2 = `stageType`/phase enum
(new_feature, integration, pre_release, post_release, regression). Định nghĩa dùng
chung ở `features/skills/strategy-templates.js`.

**Skill `teststrategy` là NỘI BỘ — ẩn khỏi sidebar** (SkillSidebar.jsx filter
`key !== 'teststrategy'`, giống srsdecomposer) — tự chọn qua sidebar sẽ ra JSON
OutputPanel không render nổi → bug "[object Object]".

**⛔ KHÔNG ĐƯỢC:**
- Bỏ filter `key !== 'teststrategy'` trong SkillSidebar.jsx.
- Đổi 6 activity key / 5 stageType enum mà quên sync 3 nơi: strategy-templates.js,
  prompt trong skill-registry.js, và normalizeStages.
- Chuyển Test Strategy về lại dạng modal / thêm nút "🎯 Test Strategy" (đã chốt
  panel inline, project node chỉ hiện màn này).
- Nhét strategy vào skill_runs (dùng table riêng test_strategies vì cần mutable).
- Kết luận "gen strategy lỗi" khi chưa probe route `/api/strategies` (400 khi thiếu
  param = backend mới; 404 = backend cũ chưa restart).

> ⚠️ **FLOW 7 đã được NÂNG CẤP ở phiên 2026-07-08 (System Layer + Test Plan + Skill
> Gating)** — project node giờ hiện `StrategyPanel` **2 tab**, và có thêm tầng System +
> skill gating. Xem **FLOW 8** bên dưới cho hành vi hiện tại.

---

### FLOW 8 — System Layer + Test Plan + Skill Gating (nâng cấp 2026-07-08, GỘP vào FLOW 7)

```
CÂY MỚI: System → Project → Module → Screen → Feature
(System = bảng `systems` riêng; Project vẫn là node type='project' trong bảng `nodes`,
 trỏ về system qua cột projects.system_id — vì project node id === projects.id).

[ProjectSidebar.jsx] fetch /api/systems → nhóm project theo systemId.
  - Nút "+ System" (header) tạo system (prompt tên/mô tả).
  - Mỗi system: nút "+P" mở CreateProjectModal; ✎ đổi tên; × xóa (KHÔNG xóa project,
    chỉ set system_id=NULL → project về nhóm "Chưa gán hệ thống").
  - Badge trên node project: ✓<mã ngắn> (xanh, plan đã cấu hình) / "Draft" (vàng, chưa).
    Nhãn template đầy đủ ở tooltip. Data badge lấy từ /tree (getNodes JOIN + subquery
    plan_template/plan_status từ test_strategies mới nhất).
    ↓
[CreateProjectModal.jsx] wizard 3 bước:
  B1 tên project → B2 chọn 1/5 template (new_feature/feature_addition/hotfix/
  new_version/full_product) → B3 toggle 6 stage (api/smoke/manual/regression/
  performance/security) + PREVIEW skill hiện cho Screen (previewVisibleSkillIds).
  "Lưu kế hoạch" → POST /tree (type=project, kèm systemId) + POST /api/strategies
  (tái dùng bảng test_strategies, status='configured', stages=toggle).
    ↓
SKILL GATING (utils/skill-gating.js) — khi chọn node KHÁC project:
  main.jsx fetch plan của project chứa node (fetchStrategyApi(node.projectId)) →
  getVisibleSkillIds(nodeType, plan):
    - plan CHƯA cấu hình (null/draft) → hiện ĐỦ skill (backward-compat) + BANNER VÀNG
      "chưa có kế hoạch test" + nút "Tạo kế hoạch test →" (chọn node project).
    - plan ĐÃ configured/approved → chỉ hiện ALWAYS_ON_SKILLS (srs, buganalyzer) +
      skill của các activity đang bật (api→apitest; smoke/manual/regression→testcase;
      manual→uitest; performance→performance; security→security), lọc theo
      SKILL_APPLICABLE_NODES. SkillSidebar nhận visibleSkillIds; nếu skill đang chọn
      bị ẩn → main.jsx tự nhảy sang skill hiển thị đầu tiên.
    ↓
NODE PROJECT → StrategyPanel 2 tab:
  - Tab "Kế hoạch test": generate/review/current cũ + nút "✎ Chỉnh stage" (toggle
    ON/OFF rồi "Lưu thay đổi" → updateStrategyApi status='configured', KHÔNG cần AI).
  - Tab "Release Check": GET /api/strategies/release-check?projectId= →
    getReleaseCheck gom test_cases theo cột `stage`, tính %pass/fail/block mỗi stage
    (chỉ các stage đang bật nếu plan configured), blockers, badge Go/No-go
    (go/no-go/pending). Cảnh báo TC chưa gán stage (unassignedCount).
```

**⛔ KHÔNG ĐƯỢC (bổ sung cho FLOW 8):**
- Tạo bảng `test_plans` / route `/api/test-plans` — Test Plan TÁI DÙNG `test_strategies`
  + `/api/strategies` (đã có thêm `release-check`).
- Tạo `config/strategy-templates.js` thứ 2 — chỉ 1 file `features/skills/strategy-templates.js`
  (5 template; đã bỏ `new_product`/`custom`).
- Bỏ filter internal trong SkillSidebar — `visibleSkillIds` chồng THÊM, không thay thế.
- Nhét `system_id` vào bảng `nodes` — nó ở bảng `projects`; tree lộ qua LEFT JOIN.
- Ép `createStrategy` về draft — phải nhận `'configured'`.
- Tạo `TestPlanPanel` song song — Test Plan sống trong `StrategyPanel` (2 tab).
- In nhãn template dài vào badge (che tên) — dùng `templateShort()`.

**Sinh Test Strategy 2 đường (2026-07-08):** màn generate có "⚡ Sinh bằng Code" (0 token,
cấu hình chuẩn theo template — `generateDefaultStrategy` + `STAGE_DETAILS`) và "🤖 Sinh bằng
AI" (skill teststrategy). Wizard tạo project LUÔN dùng đường Code (0 token). "✎ Chỉnh stage"
ở tab Kế hoạch test cho toggle + lưu (`updateStrategyApi` status='configured') không cần AI.

**CHƯA verify:** toàn bộ luồng UI click-test qua browser thật (backend đã e2e + probe
live; frontend mới build + esbuild compile). **Còn thiếu để chạy thật đầy đủ**: (a) gán
cột `stage` cho TC khi gen (chưa có), (b) F3 Lark→Tool status sync để Release Check có
status TC thật.

---

### FLOW 9 — Export Test Case theo phạm vi rộng (System / Project / Module / Screen / Feature) — mới 2026-07-08, 100% CODE, 0 token AI

```
Có 2 hành động export ĐỘC LẬP (tách rời, không gộp 1 nút):
  (A) Export to Excel/CSV — tải file về máy.
  (B) Export to Lark Base — đẩy dữ liệu lên Lark theo URL.

★ ĐIỂM VÀO (entry points) ★
  - Trên node (cây, menu ⋯ của TreeNode): "⤓ Export Excel/CSV" + "🦊 Export to Lark"
    → scopeType = node.type (project/module/screen/feature), scopeId = node.id.
  - Trên tiêu đề nhóm System (ProjectSidebar, chỉ system thật): 2 icon ⤓ + 🦊
    → scopeType = 'system', scopeId = sys.id.
  - Trong Output panel (node đang chọn): "⤓ Export cả nhánh" + "🦊 Lark cả nhánh"
    → export toàn bộ TC của node đang chọn + mọi node con (đọc từ DB, KHÁC với
      nút CSV/MD/Copy-Lark vốn export output đang hiển thị trong bộ nhớ).

★ BACKEND (0 token — thuần DB + Lark API) ★
  test-case.service.js#getTestCasesForScope(scopeType, scopeId):
    - LUÔN gom theo PROJECT: system → mỗi project 1 group; scope nhỏ hơn → 1 group
      (project sở hữu). Mỗi row = raw test_cases + `_path{module,screen,feature}`
      (đi ngược cây). Project chưa gán system KHÔNG nằm trong system scope.
  GET /testcases/export-scope?scopeType=&scopeId=  (map sang shape frontend +
    nodePath). ⚠️ PHẢI đứng TRƯỚC route GET '/:nodeId' trong test-cases.routes.js,
    nếu không Express nuốt '/export-scope' thành nodeId.
  lark.service.js#pushTestCasesScope(scopeType, scopeId, url, saveLink):
    - resolve Base từ URL → ensureBugTable → mỗi project 1 bảng riêng (tên bảng =
      tên project, `ensureTestCaseTable(...tableName)`) → reconcileFields →
      syncRowsToTable (create/update + dedup qua lark_record_id, tái dùng logic
      của pushTestCases nhưng KHÔNG sửa pushTestCases — hàm helper MỚI).
    - saveLink=true → lưu lark link cho từng project (project sau vẫn "Đẩy lên Lark").
    - 2 project trùng tên trong 1 system → tên bảng thứ 2 thêm " (2)" (không đè nhau).
  POST /api/lark/push-scope { scopeType, scopeId, url, saveLink }.

★ FRONTEND ★
  - features/testcase/testcase-export.js: scopeToCsv(groups,{includeProjectName}) +
    scopeToMarkdown(...). System → CSV gộp 1 file + cột "Project Name" ĐẦU TIÊN.
  - ExportFileModal.jsx (chọn CSV/Markdown → tải), ExportLarkModal.jsx (URL +
    checkbox saveLink + kết quả từng bảng). Dùng class modal có sẵn, KHÔNG thêm CSS.
  - main.jsx: handleExportScopeFile (fetch rồi mở modal file), handleExportScopeLark
    (mở modal Lark). Wire vào ProjectSidebar (onExportFile/onExportLark) + Output panel.
```

**⛔ KHÔNG ĐƯỢC:**
- Chuyển route `/testcases/export-scope` xuống DƯỚI `/:nodeId` (sẽ bị nuốt thành nodeId).
- Sửa `pushTestCases`/`buildRecordFields`/`reconcileFields` khi build lên scope push
  — scope push dùng helper MỚI `syncRowsToTable` + `pushTestCasesScope`, giữ path cũ nguyên.
- Bỏ tham số `tableName` (mặc định 'Test Cases') của `ensureTestCaseTable` — caller cũ
  `linkProject` truyền 4 tham số, dựa vào default.
- Đổi thứ tự cột CSV (17 cột, khớp `toCsv`); System thêm 'Project Name' ở ĐẦU.

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
| srsdecomposer | skill-registry.js (`SKILLS.srsdecomposer`) | (internal, thủ công — xem FLOW 2b) nút "Phân rã thành Feature" trên node module/screen | JSON `[{ name, srsSegment }]` |
| teststrategy | skill-registry.js (`SKILLS.teststrategy`) | (internal — xem FLOW 7) nút trên StrategyPanel tại project node, KHÔNG hiện ở sidebar | JSON `{ summary, stages[], executionPlan, releaseGate }` |

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
| TS-F6 | Test Strategy Generator (skill `teststrategy`) | ✅ Code done | Sinh JSON stages/plan theo template, verify AI thật OK |
| TS-F7 | Test Strategy UI + table `test_strategies` | ✅ Code done | Panel inline tại project node; CHƯA click-test UI browser |
| TS-F8 | Stage progress tracking (dashboard %/status) | 🟡 Code done | Tab "Release Check" (`getReleaseCheck` + UI). % tính từ `test_cases.status`+`stage`. Cần F3 + gán stage cho TC để có data thật |
| TS-F9 | Release readiness auto-check (Go/No-go) | 🟡 Code done | Badge Go/No-go trong release-check. Cần status TC thật (F3) mới có ý nghĩa |
| SYS | System Layer (bảng `systems` + sidebar phân cấp System→Project) | ✅ Code done | `/api/systems` CRUD; `projects.system_id`; CHƯA click-test UI |
| SG | Skill Gating theo Test Plan (`utils/skill-gating.js`) | ✅ Code done | Ẩn/hiện skill theo stage bật trong plan; plan chưa cấu hình → hiện đủ (backward-compat) |
| TP | Test Plan (tái dùng `test_strategies`) + wizard tạo project | ✅ Code done | `CreateProjectModal` 3 bước; status `configured`; StrategyPanel 2 tab; CHƯA click-test UI |
| EXP | Export TC theo scope (System/Project/Module/Screen/Feature) — CSV/Markdown + Lark Base, 0 token AI | 🟡 Code done | `getTestCasesForScope`, `/testcases/export-scope`, `pushTestCasesScope`, `/api/lark/push-scope`, 2 modal + tree menu + system icons. CSV verify OK (smoke test). **Lark push CHƯA verify** (cần creds thật). **Cần restart backend** để nạp route mới |

### Known Issues
| # | Mô tả | File | Workaround |
|---|-------|------|-----------|
| 1 | Lark rate limit khi push >50 TC | lark-push-service.js | sleep 0.3s (chưa test bộ lớn) |
| 2 | Lark field mapping vỡ khi đổi tên cột | useLarkMapping.js | Error message chưa rõ |
| 3 | SQLite không scale >5 user | schema.sql | Migrate PostgreSQL sau |
| 4 | Auto-fill SRS→TC chưa handle case nhiều SRS run | useSkillWorkspace.js | Lấy run mới nhất |
| 5 | ~~AI SRS thỉnh thoảng hỏi thêm ở vòng chốt~~ → **Đã đổi thành hành vi CÓ CHỦ ĐÍCH (2026-07-08)**: AI được phép hỏi tiếp qua nhiều vòng nếu câu trả lời vẫn còn thiếu sót business-critical, cho tới khi hết khúc mắc | skill-registry.js (system prompt SRS + buildFinalizePrompt) | Không còn là issue — là thiết kế. `[GIẢ ĐỊNH]` chỉ dùng cho chi tiết cosmetic |
| 6 | `parseClarificationQuestions` vẫn có thể miss nếu AI dùng định dạng hộp câu hỏi khác hẳn 3 dạng đã test (`> **[...]**`, `**[...]**`, `# [...]`) | srs-clarification.js | Regex đã lenient nhưng không bao quát 100% — nếu gặp case mới cần bổ sung thêm biến thể vào regex |
| 7 | Nút "+ Thêm feature" thủ công trên TreeNode (sidebar) vẫn gợi ý next-type theo hierarchy cứng module→screen→feature (`NEXT_TYPE` trong TreeNode.jsx) — không tự nhận biết trường hợp user tạo feature trực tiếp dưới module (bỏ qua screen) như nút "Phân rã thành Feature" hỗ trợ | TreeNode.jsx | Không ảnh hưởng — user vẫn tạo thủ công bình thường, chỉ là gợi ý mặc định chưa khớp 100% mọi cách tổ chức cây |
| 8 | Test case sinh ra CHƯA tự gán cột `test_cases.stage` (api/smoke/manual/...) → tab "Release Check" gom TC theo stage nên các TC chưa gán stage không được tính (báo `unassignedCount`) | test-case gen / TestCaseTable.jsx | Cần thêm UI/logic gán stage cho TC (lúc gen hoặc trong bảng TC). Hiện Release Check chủ yếu 'pending' cho tới khi có TC gán stage + status thật (F3) |
| 9 | Release Check phụ thuộc `test_cases.status` (Pass/Fail/Block) — hiện phần lớn TC status rỗng nên %/Go-No-go thường thấp/'pending' | strategy.service.js#getReleaseCheck | ĐÚNG thiết kế, không phải bug. Cần F3 (Lark→Tool status sync) để có status thật |
| 10 | Độ rộng cột bảng TC RESET khi reload trang (lưu trong React state, chưa persist) | TestCaseTable.jsx | Thêm localStorage (như `useResizableWidth` của sidebar) nếu cần nhớ |
| 11 | `QUOTA_EXCEEDED` khi gen AI = Gemini free-tier hết hạn mức (chỉ có key Gemini → không fallback) — KHÔNG phải bug | gemini.provider.js / ai-router.service.js | Bật Demo mode / dùng "Sinh bằng Code" / gen TC không auto-audit / đợi reset / đổi key ở Settings (đọc-live). Cân nhắc thêm provider fallback |
| 12 | **Đa công cụ sửa cùng working tree** (Claude Code + IDE Gemini) → dễ đè nhau (đã xảy ra: index.css, srs-clarification.js, TestCaseTable/OutputPanel/main). User chốt **Claude sở hữu CSS** | (nhiều file) | Mỗi file chỉ 1 công cụ sửa; LUÔN đọc lại file trước khi sửa (file hay đổi giữa các lượt) |
| 13 | `sortTestCases` + `getNextTestCaseId` (do IDE Gemini thêm) chưa được Claude review kỹ — tiêu chí sort + chống trùng ID cần verify | testcase-quality.js, TestCaseTable.jsx | Session sau đọc + test trước khi build tiếp lên |
| 14 | **Export to Lark theo scope (`pushTestCasesScope`) CHƯA verify end-to-end** — không có Lark credentials thật để test; mới `node --check` + logic soi theo `pushTestCases` đang chạy | lark.service.js | User test với Base thật. Nếu 2 project trùng tên → bảng thứ 2 thêm " (2)" |
| 15 | Route `/testcases/export-scope` + `/api/lark/push-scope` mới → **backend đang chạy (bản cũ) trả 200 rỗng cho export-scope** (nuốt thành `/:nodeId`). Phải RESTART `npm start` mới nạp route | test-cases.routes.js, lark.routes.js | Probe: `/testcases/export-scope` (thiếu param) phải trả **400** = backend mới; 200 = backend cũ |

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
| 2026-07-08 | Sửa hành vi hỏi làm rõ SRS: cho phép hỏi NHIỀU VÒNG khi câu trả lời vẫn còn thiếu business-critical (trước đó bị ép chốt sau đúng 1 vòng); `[GIẢ ĐỊNH]` chỉ dùng cho cosmetic. Sửa system prompt SRS + buildFinalizePrompt + toast | skill-registry.js, main.jsx | ✅ Build pass, verify tầng prompt; chưa test nhiều vòng qua UI |
| 2026-07-08 | **Feature MỚI: Test Strategy (TS-F6+F7)** — skill `teststrategy` (JSON stages/plan theo 4 template, 2 trục stage), table `test_strategies` + service + routes `/api/strategies`, `StrategyPanel.jsx` inline tại project node (Generate→Review→Approve→Current), ẩn skill khỏi sidebar. Project node giờ CHỈ hiện màn Test Strategy (ẩn SkillSidebar + Requirement/Output). Xem FLOW 7 | schema.sql, strategy.service.js (mới), strategy.routes.js (mới), app.js, strategy-templates.js (mới), skill-registry.js, SkillSidebar.jsx, strategy.api.js (mới), StrategyPanel.jsx (mới), main.jsx | ✅ Build pass; verify schema in-memory + HTTP CRUD end-to-end (port tạm) + gọi AI Gemini thật ra JSON đúng schema. **CHƯA click-test UI browser**. Root cause user báo "gen không chạy" = backend cũ chưa restart (route 404) |
| 2026-07-08 | **Nâng cấp: System Layer + Test Plan + Skill Gating** (GỘP vào Test Strategy, không tạo bản song song) — bảng `systems` + `/api/systems` + sidebar phân cấp **System→Project→Module→Screen→Feature**; cột `projects.system_id` + `test_cases.stage`; **skill-gating** (`utils/skill-gating.js` + 5 template mới + ALWAYS_ON + applicable_nodes trong `strategy-templates.js`); **Test Plan tái dùng bảng `test_strategies`** (status `configured` + `getReleaseCheck` + `GET /api/strategies/release-check`); `CreateProjectModal` wizard 3 bước; `StrategyPanel` → **2 tab** (Kế hoạch test + Release Check); gating + banner cảnh báo trong main.jsx; badge sidebar gọn (mã ngắn ✓NEW/…). Xem FLOW 8. Commit `28c9063` | systems.service/routes (mới), strategy.service/routes, node/project.service, nodes.routes, schema.sql, db_manager, app.js, strategy-templates, skill-gating.js (mới), systems.api.js (mới), CreateProjectModal.jsx (mới), StrategyPanel, ProjectSidebar, SkillSidebar, TreeNode, useProjectTree, strategy.api, main.jsx | ✅ Build (70 modules) + in-memory tests (schema/gating 11/release-check 13/step4 8, verbatim SQL) + **E2E service THẬT trên DB THẬT** (migrations + round-trip 11 assert + cleanup sạch) + restart & probe live (/api/systems 200, release-check 400). **CHƯA click-test UI browser** |
| 2026-07-08 | **Tối ưu token + Tinh giản UI + Cột TC + Kéo rộng cột** — (A) Test Strategy sinh bằng CODE 0 token (`generateDefaultStrategy`+`STAGE_DETAILS`, nút "Sinh bằng Code" cạnh "Sinh bằng AI", wizard auto-fill plan chi tiết bằng code); (B) auto quality-audit → TÙY CHỌN (checkbox `autoAudit`, mặc định TẮT → gen TC 1 lượt AI thay vì 2); (C) tinh giản UI chỉ qua `index.css` (palette phẳng, bỏ glow/gradient/hover-lift, scrollbar mảnh — giữ tên biến); (D) bảng TC thêm cột Module/Screen/Feature + Status gần cuối + `title` hover xem full; CSV/Copy-Lark/Push-Lark có đủ cột + Status gần cuối; (E) kéo chỉnh độ rộng cột (table-layout fixed). Xem FLOW 3/4/8 | strategy-templates, CreateProjectModal, StrategyPanel, useSkillWorkspace, SkillOptions, TestCaseTable, OutputPanel, testcase-export, lark.service, main.jsx, index.css | ✅ Build pass + logic tests (gencode 17, export 10 assert). **CHƯA click-test UI browser**. Bối cảnh: user gặp QUOTA_EXCEEDED (Gemini hết hạn mức, không phải bug) → loạt tối ưu này |
| 2026-07-08 | **Feature MỚI: Export TC phạm vi rộng (System/Project/Module/Screen/Feature) — 0 token AI** — 2 hành động tách rời: Export Excel/CSV (tải file) + Export to Lark Base (đẩy URL). Backend: `getTestCasesForScope` (gom theo project, kèm `_path`), `GET /testcases/export-scope` (TRƯỚC `/:nodeId`), `pushTestCasesScope` + helper `syncRowsToTable` (KHÔNG sửa `pushTestCases`), `ensureTestCaseTable(tableName)` (mỗi project 1 bảng), `POST /api/lark/push-scope`. Frontend: `scopeToCsv`/`scopeToMarkdown` (System +cột Project Name), `ExportFileModal`/`ExportLarkModal` (mới), menu ⋯ TreeNode + 2 icon trên header System + 2 nút "cả nhánh" ở Output. Xem FLOW 9 | test-case.service.js, test-cases.routes.js, lark.service.js, lark.routes.js, test-cases.api.js, lark.api.js, testcase-export.js, ExportFileModal.jsx (mới), ExportLarkModal.jsx (mới), TreeNode.jsx, ProjectSidebar.jsx, main.jsx | 🟡 Build pass (72 modules) + smoke test THẬT (`getTestCasesForScope` + `scopeToCsv`/`scopeToMarkdown` trên in-memory schema thật: gom project, path, loại orphan, cột Project Name — all pass). **Lark push CHƯA verify (thiếu creds). CẦN RESTART backend** (bản đang chạy chưa có route). CHƯA click-test UI |
| 2026-07-08 | **UI polish + scroll bảng + phân trang TC** (một phần từ IDE Gemini) — font `--font-sans` thêm fallback **Segoe UI** (Plus Jakarta/Inter chưa import → trước rơi Arial); palette dịu (#0f1115/#e2e8f0), base 16px, phụ 14px, tắt lưới; icon mở rộng **▼/▶**; badge Test Plan **bỏ tick + màu theo template**; bỏ toggle detailLevel SRS + mở rộng ô Domain; **di nút Generate xuống cuối Requirement**; rename app "QA_Assistant" (commit `f6cbcfb`). CHƯA commit: **scroll ngang bảng TC** (`.tc-table-wrapper` max-height 65vh + overflow auto; `.tc-table th` sticky) + **phân trang 20/trang** (giữ index tuyệt đối). Kèm (IDE Gemini): `sortTestCases`, auto-ID `getNextTestCaseId`, empty-state bảng | index.css, TreeNode, ProjectSidebar, SkillOptions, AppHeader, tauri.conf, main.jsx, TestCaseTable, OutputPanel, testcase-quality.js | ✅ Build pass. **CHƯA click-test UI**. ⚠️ Đa công cụ sửa song song → user chốt **Claude sở hữu CSS** |
| 2026-07-09 | **Sửa lỗi fallback AI router khi gặp lỗi High Demand hoặc các lỗi khác** — Cập nhật `ai-router.service.js` để tự động thử với provider tiếp theo đối với bất kỳ lỗi nào của provider hiện tại (thay vì chỉ giới hạn ở lỗi hạn mức/thiếu key), đảm bảo tự động chuyển đổi dự phòng ổn định khi Gemini gặp quá tải (High Demand/503/429) | ai-router.service.js | ✅ Build pass |
| 2026-07-09 | **Thêm chỗ nhập API Key cho Codex (UI + Backend)** — Bổ sung provider `codex` vào form cấu hình settings, render giao diện thẻ nhập Codex API Key trong `ProviderSettingsModal`, và đồng bộ trạng thái cấu hình qua route `/status` cũng như router `ai-router.service.js` | useProviderSettings.js, ProviderSettingsModal.jsx, ai.routes.js, ai-router.service.js | ✅ Build pass |
| 2026-07-09 | **Tích hợp Tailwind CSS v3 + shadcn/ui components + Loại bỏ icon button rườm rà** — Cài đặt tailwindcss, postcss, autoprefixer, lucide-react; thiết lập các component UI dùng chung (`Button`, `Select`, `DropdownMenu`, `Dialog`); refactor ProjectSidebar, TreeNode, main.jsx, và TestCaseTable để sử dụng Dropdown Menu, Select của shadcn/ui, icon Lucide và lưu kích thước cột TestCaseTable vào localStorage | tailwind.config.js, postcss.config.js, index.css, Button.jsx (mới), Select.jsx (mới), DropdownMenu.jsx (mới), Dialog.jsx (mới), utils.js (mới), ProjectSidebar.jsx, TreeNode.jsx, TestCaseTable.jsx, main.jsx, HANDOFF.md, task.md, walkthrough.md, interface_evaluation.md | ✅ Build pass |
| 2026-07-10 | **Sửa lỗi không nhận phản hồi khi gen SRS do Gemini 503 (High Demand)** — Ưu tiên đưa model `gemini-2.5-flash` lên làm mặc định đầu tiên trong file `gemini.provider.js` và nâng cấp logic `isRetryable` hỗ trợ retry khi gặp lỗi `503`, `"high demand"`, `"overloaded"`. Restart backend server. | gemini.provider.js, HANDOFF.md, CODEBASE-STATE.md | ✅ Đã test gọi API generate thành công |
| 2026-07-10 | **Cải tiến phần câu hỏi làm rõ SRS (Giới hạn 1 vòng + Điền sẵn gợi ý)** — Sửa `skill-registry.js` (system prompt + `buildFinalizePrompt`) để ép AI chỉ được hỏi tối đa 1 vòng làm rõ, sau đó bắt buộc viết SRS đầy đủ kèm tag `[GIẢ ĐỊNH]`. Nâng cấp `ClarificationForm` trong `OutputPanel.jsx` để bóc tách từ khóa "Gợi ý: ..." từ câu hỏi và điền sẵn vào textarea. | skill-registry.js, OutputPanel.jsx, HANDOFF.md, CODEBASE-STATE.md | ✅ Build pass (Vite) |
