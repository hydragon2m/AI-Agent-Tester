# HANDOFF.md — Bàn giao phiên làm việc

> File bàn giao giữa các session (AI/người). **Đầu session: đọc file này. Cuối session: cập nhật lại.**
> Khác với `CODEBASE-STATE.md` (trạng thái kiến trúc lâu dài) — file này chỉ ghi trạng thái phiên hiện tại.

---

## Session gần nhất: 2026-07-07 chiều (máy Windows) — Fix vòng lặp hỏi SRS + Phân rã Feature (đổi từ tự động sang thủ công)

User test lại sau session buổi sáng (xem "Session trước" bên dưới) và báo 2 chức năng đã build từ trước nhưng không hoạt động đúng: (1) SRS hỏi nhiều lượt thay vì hỏi hết 1 lần, gen lại rất chậm vì phân tích lại từ đầu; (2) Auto Decompose Feature (bóc tách SRS thành các Feature con) không thấy chạy.

Sau khi fix vòng 1 (mục 1-6 bên dưới), user tiếp tục test qua UI thật (lần đầu tiên trong ngày) và phát hiện 1 bug thật khác: tự chọn skill "SRS Decomposer" trực tiếp từ sidebar cho ra output rác `[object Object],...`. Đồng thời user làm rõ lại thiết kế mong muốn: **KHÔNG tự động** bóc tách ngay sau khi Gen SRS — phải có **nút bấm thủ công** ("Phân rã thành Feature"), và phải hoạt động được cả khi SRS được gen ở cấp **module** (không chỉ "screen") vì cách user tổ chức cây là Project → Module → Feature trực tiếp. Xem mục 9-12 bên dưới cho vòng fix thứ 2 này.

### 1. Task đã hoàn thành
- **Fix vòng lặp hỏi vô hạn của SRS**: sửa system prompt skill `srs` (`skill-registry.js`) — bắt AI liệt kê HẾT câu hỏi cần thiết trong 1 lần duy nhất (Bước 0), và khi input có heading `### CÂU TRẢ LỜI LÀM RÕ` (vòng chốt) thì BẮT BUỘC viết SRS đầy đủ, không hỏi lại câu đã trả lời — chi tiết nhỏ còn thiếu tự gắn `[GIẢ ĐỊNH]`.
- **Gen lại nhanh hơn ở vòng chốt**: thêm `SKILLS.srs.buildFinalizePrompt(previousSrs, answersMarkdown, context)` — gửi SRS cũ + câu trả lời mới thay vì toàn bộ input gốc để AI cập nhật thay vì phân tích lại từ đầu. `main.jsx#handleClarificationSubmit` đã đổi sang dùng hàm này.
- **Root cause thật (quan trọng nhất) của cả 2 bug user báo**: `parseClarificationQuestions()` (trước đây định nghĩa riêng trong `OutputPanel.jsx`) dùng regex quá cứng nhắc, chỉ nhận dạng đúng 1 kiểu format `> **[CÂU HỎI LÀM RÕ]**`. Test thật với Gemini cho thấy AI thường xuyên trả về format khác (`# [CÂU HỎI LÀM RÕ...]` dạng heading, hoặc có câu dẫn + dòng trống trước khi vào bullet câu hỏi) → parser trả về **0 câu hỏi** dù AI rõ ràng đang hỏi → (a) form trả lời không hiện ra cho user, VÀ (b) logic auto-decompose (mới thêm) tưởng SRS đã "hoàn chỉnh" nên bóc tách nhầm 1 danh sách câu hỏi → 0 feature hợp lệ được tạo. Đã tách thành `src/web/features/skills/srs-clarification.js` (module dùng chung, import ở cả `OutputPanel.jsx` và `main.jsx`) và viết lại regex lenient hơn (chấp nhận nhiều kiểu bullet/heading, chỉ dừng ở section heading `##` hoặc `---` thật sự).
- **Chặn auto-decompose chạy nhầm trên SRS chưa hoàn chỉnh**: `main.jsx` (cả trong `generate()` và `handleClarificationSubmit()`) giờ chỉ gọi `decomposeSrs()` khi `parseClarificationQuestions(parsed).length === 0`.
- **Fix JSON bị cắt cụt giữa chừng (nguyên nhân thật thứ 2 khiến decompose "không hoạt động")**: test thật phát hiện `srsdecomposer` (và tiềm ẩn cả `testcase`, `tcquality`) bị cắt cụt output ở giới hạn `maxOutputTokens: 8192` khi SRS đủ lớn (nhiều feature) → `JSON.parse` lỗi "Unterminated string" → decompose fail hoàn toàn, không tạo được feature nào. Đã thêm cờ `expectJson` xuyên suốt `ai.routes.js` → `ai-router.service.js` → `gemini.provider.js`/`openai.provider.js`: khi `true`, Gemini bật `responseMimeType: 'application/json'` + nâng `maxOutputTokens` lên 32768 (giữ 8192 cho skill markdown); OpenAI bật `response_format: json_object` + nâng `max_tokens` lên 16384. Đã verify bằng cách gọi thật `srsdecomposer` trên 1 SRS 16k ký tự — trước khi tăng token: `JSON.parse` lỗi; sau khi tăng: parse OK, ra đúng 7 feature hợp lệ.
- **Thêm banner nổi bật (không tự ẩn như toast)**: banner xanh "✅ SRS đã hoàn chỉnh" trong `OutputPanel.jsx` khi SRS xong và hết câu hỏi; banner kết quả bóc tách Feature (số lượng + tên, hoặc lỗi) trong `main.jsx`, cả 2 đều có nút "Ẩn" thủ công thay vì tự biến mất sau 2.8s.
- **Fix bug nhỏ đi kèm**: `main.jsx#handleGenAllTC` đọc field `latestSrs.output_json` — field này không tồn tại (`skill-run.service.js` trả về field tên `output`), đã sửa lại đúng tên (trước đây vô hại vì luôn fallback sang `rawOutput`, nhưng là code sai cần dọn).

### 2. File đã sửa / tạo mới
- `src/web/features/skills/skill-registry.js` — sửa system prompt SRS (hỏi hết 1 lượt, không hỏi lại ở vòng chốt), thêm `buildFinalizePrompt`.
- `src/web/features/skills/srs-clarification.js` (**mới**) — `parseClarificationQuestions()` dùng chung, regex lenient với nhiều format AI trả về.
- `src/web/components/output/OutputPanel.jsx` — import parser từ module chung thay vì định nghĩa riêng; thêm `SrsCompleteBanner`.
- `src/web/main.jsx` — dùng `buildFinalizePrompt` ở `handleClarificationSubmit`; chặn `decomposeSrs()` khi còn câu hỏi (cả 2 chỗ gọi); thêm `expectJson: true` cho mọi lệnh gọi AI trả JSON (testcase, tcquality, srsdecomposer, batch gen); thêm state + banner `decomposeResult`; fix field `output_json` → `output`.
- `src/server/routes/ai.routes.js` — nhận thêm `expectJson` từ body, truyền xuống `callAI`.
- `src/server/services/ai-router.service.js` — nhận `expectJson`, truyền xuống Gemini/OpenAI provider.
- `src/server/ai/providers/gemini.provider.js` — bật `responseMimeType: 'application/json'` + `maxOutputTokens: 32768` khi `expectJson`.
- `src/server/ai/providers/openai.provider.js` — bật `response_format: json_object` + `max_tokens: 16384` khi `expectJson`.

### 3. Quyết định quan trọng
- **Không cố ép AI tuân thủ 100% 1 định dạng markdown cố định cho hộp câu hỏi** — thay vào đó làm parser (`srs-clarification.js`) lenient/robust với nhiều biến thể thật đã quan sát được. Lý do: LLM luôn có biến thiên định dạng dù system prompt ghi rõ, siết prompt thêm nữa không đảm bảo 100%, nên phòng thủ ở tầng parse chắc ăn hơn.
- **Tăng `maxOutputTokens` CHỈ khi `expectJson: true`** (giữ 8192 cho skill markdown như SRS) — tránh tăng chi phí/latency không cần thiết cho các skill vốn không gặp vấn đề cắt cụt.
- Đã test thật bằng Gemini (không dùng demo mode) qua script tạm gọi thẳng `ai-router.service.js`/`gemini.provider.js`, xoá sạch sau khi xong — không còn file tạm nào sót lại trong repo (đã kiểm tra `git status`).

### 4. Lỗi còn lại
- AI thỉnh thoảng vẫn có thể hỏi thêm ở vòng chốt nếu câu trả lời user tạo ra mâu thuẫn nghiệp vụ thật sự mới — đây là hành vi ĐÚNG theo thiết kế mới (chỉ hỏi khi thật sự cần), không phải bug.
- `parseClarificationQuestions` đã test với 3 biến thể định dạng thật từ Gemini nhưng không thể bao quát 100% mọi biến thể có thể xảy ra trong tương lai — nếu gặp case mới không detect được, cần bổ sung thêm pattern vào regex trong `srs-clarification.js`.
- Phát hiện lại vấn đề cũ từ session sáng: có tiến trình backend cũ (`npm start`) bị bỏ quên chạy ngầm từ session trước, khiến lúc đầu test HTTP API không phản ánh đúng code mới (đã kill và restart sạch, xem mục 5).

### 5. Test đã chạy
- `npm run build` (Vite) — pass sau tất cả các lần sửa, không lỗi cú pháp.
- `node --check` trên toàn bộ file backend đã sửa — pass.
- **Test thật với Gemini (không demo mode)**, gọi trực tiếp `ai-router.service.js` với system prompt/buildPrompt thật lấy từ `skill-registry.js`:
  - Round 1 (input mơ hồ "Tính năng quản lý sản phẩm") → AI hỏi 7 câu hỏi bao quát trong 1 lần, parser nhận diện đúng cả 7.
  - Round 2 (dùng `buildFinalizePrompt` với câu trả lời mẫu) → AI trả về SRS đầy đủ 16k+ ký tự, dùng `[GIẢ ĐỊNH]` cho chi tiết nhỏ, **0 câu hỏi còn lại** → decompose gate cho phép chạy tiếp.
  - `srsdecomposer` trên SRS 16k ký tự đó: với `maxOutputTokens: 8192` → `JSON.parse` lỗi cắt cụt; với `32768` → parse OK, ra đúng 7 feature hợp lệ, mỗi feature có `srsSegment` đầy đủ.
- Phát hiện & xử lý: tiến trình backend cũ (PID còn từ session sáng, listening port 3001 từ trước khi sửa code) khiến test HTTP đầu tiên qua `/api/ai/generate` không phản ánh code mới — đã kill, `npm start` lại sạch, verify lại qua HTTP thành công.
- Đã dọn file test tạm (`_tmp_test_srs_flow.js`, `round1_output.md`, `round2_output.md`) khỏi project root sau khi test xong — `git status` sạch.

### 6. Lệnh cần chạy lại (Windows)
```powershell
cd d:\HANH_TEST_AI\AI-Agent-Tester

# Nếu nghi ngờ backend đang chạy từ TRƯỚC khi code được sửa (rất dễ nhầm vì
# server không tự reload) — luôn kiểm tra port trước khi kết luận "vẫn lỗi":
netstat -ano | findstr :3001
# Nếu có PID cũ, kill rồi chạy lại:
npm start        # backend Express -> http://localhost:3001
npm run dev      # frontend Vite   -> http://localhost:5173
```

### 7. Task tiếp theo được khuyến nghị
- User nên tự test lại trên UI thật (chọn 1 Screen, nhập requirement mơ hồ → xem form hỏi hiện đúng 1 lần đủ câu hỏi → trả lời → xem SRS hoàn chỉnh + banner xanh → xem Feature con tự tạo trong sidebar + banner kết quả bóc tách). Session này đã verify logic ở tầng service/AI thật, nhưng CHƯA click qua UI thật (không có Playwright cài sẵn lúc này).
- Cân nhắc thêm streaming response (SSE) — vẫn là gợi ý tồn đọng từ session trước, giá trị cao nhất để giảm cảm giác "đứng máy" khi chờ AI.
- Nếu sau này vẫn gặp case AI trả hộp câu hỏi ở định dạng lạ khiến `parseClarificationQuestions` miss, thêm biến thể mới vào regex trong `srs-clarification.js` thay vì viết lại từ đầu.

### 8. Điều KHÔNG được làm (vòng fix thứ 1)
- KHÔNG copy lại logic `parseClarificationQuestions` vào `OutputPanel.jsx` hay bất kỳ đâu khác — luôn import từ `src/web/features/skills/srs-clarification.js`.
- KHÔNG hạ `maxOutputTokens` của nhánh `expectJson` xuống lại 8192 — sẽ tái phát lỗi JSON bị cắt cụt khi SRS/bộ TC đủ lớn.
- KHÔNG kết luận "chức năng chưa được build/không hoạt động" chỉ dựa vào việc gọi thử qua backend đang chạy sẵn — LUÔN kiểm tra `netstat` xem backend đó có được khởi động SAU lần sửa code gần nhất hay không trước khi kết luận.

> **Lưu ý:** điều kiện `parseClarificationQuestions(parsed).length === 0` không còn nằm ngay trước lệnh gọi `decomposeSrs()` nữa (đã đổi sang thủ công — xem mục 9-12 bên dưới); giờ nó nằm trong biến `canDecomposeFeatures` (main.jsx) để quyết định có HIỆN nút "Phân rã thành Feature" hay không. Vẫn giữ nguyên tinh thần: không cho phép bóc tách khi SRS chưa hoàn chỉnh.

---

### 9. Task đã hoàn thành (vòng fix thứ 2, cùng ngày — sau khi user test UI thật)
- **Fix bug "[object Object]" khi tự chọn "SRS Decomposer" từ sidebar**: `SkillSidebar.jsx` trước đây lặp `Object.entries(SKILLS).map(...)` hiển thị TẤT CẢ skill trong registry thành nút bấm, kể cả `srsdecomposer` — skill này vốn CHỈ được thiết kế để gọi lập trình từ `decomposeSrs()`, không phải để user chọn thủ công. Khi chọn thủ công: AI trả về mảng JSON `[{name, srsSegment}]`, nhưng `OutputPanel.jsx` không biết render dạng này (không phải markdown, không phải `{testCases:[...]}`) nên `String(mảng)` ra `"[object Object],..."`. Tệ hơn, cách này KHÔNG tạo Feature nào cả vì logic tạo node chỉ nằm trong `decomposeSrs()`. Đã sửa: thêm `.filter(([key]) => key !== 'srsdecomposer')` vào `SkillSidebar.jsx` — ẩn khỏi sidebar, giữ nguyên trong registry để flow thủ công (mục dưới) vẫn dùng được. Đã chạy 1 workflow verify độc lập (agent khác, tự đọc code, tự chạy `npm run build`, tự grep toàn repo) xác nhận: fix đúng, tối thiểu, không ảnh hưởng `decomposeSrs()`, không còn path nào khác lộ `srsdecomposer`, và không có skill nội bộ nào khác (`tcquality` không nằm trong `SKILLS` registry nên không bị lỗi tương tự) cần fix thêm.
- **Đổi từ TỰ ĐỘNG sang THỦ CÔNG theo yêu cầu user**: bỏ 2 chỗ tự động gọi `decomposeSrs()` (1 trong `generate()`, 1 trong `handleClarificationSubmit()`). Thay bằng nút **"Phân rã thành Feature"** hiện ở khu Output (cạnh nút "Viết Test Case →") khi SRS đã hoàn chỉnh — user tự bấm khi muốn, có state loading riêng (`decomposing`) không đụng vào `loading` chung.
- **Mở rộng hỗ trợ node type "module"**: user tổ chức cây Project → Module → Feature trực tiếp (không tạo "Screen" trung gian) — trước đây nút/logic bóc tách chỉ áp dụng cho node type `screen`. Đã thêm hằng số `FEATURE_PARENT_TYPES = ['module', 'screen']` (main.jsx) dùng chung cho: nút "Phân rã thành Feature", nút "Gen All TC", và banner kết quả bóc tách. Đã verify bằng cách gọi thẳng `node.service.js#createNode` tạo 1 node `feature` với parent là node `module` — backend hoàn toàn không ràng buộc quan hệ type cha/con (chỉ validate `type` nằm trong enum hợp lệ), nên an toàn.
- Đổi vài dòng text cho đúng ngữ nghĩa mới (bỏ chữ "tự động"/"Screen" hardcode trong toast và context field của feature con, vì giờ có thể chạy thủ công từ cả module lẫn screen).

### 10. File đã sửa (vòng fix thứ 2)
- `src/web/components/layout/SkillSidebar.jsx` — thêm `.filter(([key]) => key !== 'srsdecomposer')` khi render danh sách skill.
- `src/web/main.jsx` — bỏ 2 lệnh gọi tự động `decomposeSrs()`; thêm `FEATURE_PARENT_TYPES`, state `decomposing`, biến `canDecomposeFeatures`, hàm `handleDecomposeFeatures()`; thêm nút "Phân rã thành Feature"; mở rộng điều kiện hiện nút "Gen All TC" + banner kết quả bóc tách sang `FEATURE_PARENT_TYPES` thay vì chỉ `'screen'`; sửa wording toast/context không hardcode "Screen"/"tự động" nữa.

### 11. Test đã chạy (vòng fix thứ 2)
- `npm run build` — pass sau khi sửa.
- Workflow verify độc lập (agent riêng, không dùng lại context của agent sửa code): đọc lại diff, xác nhận `srsdecomposer` còn nguyên trong registry, xác nhận `decomposeSrs()` không phụ thuộc sidebar, grep toàn `src/web` không còn path nào khác có thể set `activeSkill = 'srsdecomposer'`, tự chạy lại `npm run build` — tất cả PASS. Đồng thời rà toàn bộ 8 key trong `SKILLS` registry để tìm skill nội bộ khác bị lộ tương tự — không tìm thấy thêm case nào (`tcquality` sống ở file riêng, không nằm trong `SKILLS`).
- Gọi thẳng `node.service.js#createNode` tạo project → module → feature (bỏ qua screen) qua đúng API thật (có dọn dẹp sau khi test) — xác nhận tạo thành công, không bị chặn bởi ràng buộc hierarchy nào ở backend.

### 12. Điều KHÔNG được làm (vòng fix thứ 2)
- KHÔNG bỏ `.filter(([key]) => key !== 'srsdecomposer')` trong `SkillSidebar.jsx` — sẽ tái phát bug "[object Object]".
- KHÔNG xóa `srsdecomposer` khỏi `SKILLS` registry (`skill-registry.js`) — `decomposeSrs()` trong `main.jsx` vẫn cần `SKILLS.srsdecomposer.system`/`.buildPrompt`.
- KHÔNG tự ý đổi lại thành tự động (auto-trigger ngay sau khi Gen SRS xong) — user đã xác nhận rõ muốn nút bấm thủ công, đây là quyết định thiết kế có chủ đích, không phải bug.
- KHÔNG giới hạn lại chỉ `type === 'screen'` cho nút "Phân rã thành Feature"/"Gen All TC" — user tổ chức cây có thể bỏ qua cấp Screen, dùng `FEATURE_PARENT_TYPES` (hiện gồm `['module', 'screen']`) thay vì hardcode 1 type.
- Session này **CHƯA** verify nút "Phân rã thành Feature" mới qua click UI thật (chỉ verify qua code review + build + test tạo node trực tiếp qua service) — nên khuyến nghị session sau hoặc user tự bấm thử 1 lần trên UI thật để chắc chắn 100%.

### 13. ✅ ĐÃ FIX — bug phát hiện khi user bấm thử nút "Phân rã thành Feature" trên UI thật

Đúng như lo ngại ở mục 12 (chưa verify qua UI thật) — user bấm nút và gặp lỗi:

```
⚠ Bóc tách Feature thất bại: projectTree.refreshTree is not a function
```

**Root cause đã xác định (đọc code, chưa sửa):** `src/web/state/useProjectTree.js` định nghĩa hàm `refreshTree()` ở dòng 29 và dùng nó NỘI BỘ trong `createNode`, `renameNode`, `deleteNode`, `importNodes` (gọi trực tiếp qua closure, không qua object trả về). NHƯNG object trả về của hook (dòng 93-103) **không hề liệt kê `refreshTree`**:
```js
return {
  nodes, activeNodeId, setActiveNodeId, activePath, activeNode,
  createNode, renameNode, deleteNode, importNodes,
};
```
→ `projectTree.refreshTree` là `undefined` ở bất kỳ nơi nào bên ngoài hook gọi tới nó. `main.jsx#decomposeSrs()` gọi `await projectTree.refreshTree();` sau khi tạo xong các Feature con → crash ngay tại đó.

**Đây là bug CÓ SẴN TỪ TRƯỚC** (dòng `await projectTree.refreshTree()` đã tồn tại trong `decomposeSrs()` từ session trước khi tính năng bóc tách Feature được build lần đầu — không phải do 2 vòng fix trong session này gây ra) — chỉ là chưa từng lộ ra vì tính năng bóc tách chưa từng được chạy thành công tới bước cuối qua UI thật trước đây (luôn bị chặn bởi 1 trong các bug đã fix ở mục 1-12: vòng lặp hỏi, sidebar lộ skill nội bộ, JSON bị cắt cụt...). Giờ các bug chặn đường đã hết, mới lộ ra bug tiếp theo này.

**Fix đã áp dụng:** thêm `refreshTree` vào object trả về của `useProjectTree()` trong `src/web/state/useProjectTree.js` (dòng 93-104):
```js
return {
  nodes,
  activeNodeId,
  setActiveNodeId,
  activePath,
  activeNode,
  createNode,
  renameNode,
  deleteNode,
  importNodes,
  refreshTree,
};
```
Fix đúng 1 dòng như dự kiến — `refreshTree` đã định nghĩa sẵn đầy đủ ở dòng 29, chỉ thiếu export ra object. Không cần sửa gì thêm ở `main.jsx`.

**Test đã chạy sau fix:**
- `npm run build` — pass (như dự đoán, build không bắt được lỗi này vì nó chỉ crash lúc runtime khi thực sự gọi `refreshTree()`).
- Grep toàn bộ `projectTree.<member>` đang được dùng trong `main.jsx` (10 usages: `activeNode`, `activeNodeId`, `activePath`, `createNode`, `deleteNode`, `importNodes`, `nodes`, `refreshTree`, `renameNode`, `setActiveNodeId`) đối chiếu với object trả về của hook — khớp đủ cả 10, không còn hàm nội bộ nào khác bị thiếu export tương tự.
- **CHƯA** verify lại bằng cách bấm nút trên UI thật sau fix này — user nên tự bấm lại "Phân rã thành Feature" 1 lần để xác nhận hết lỗi và Feature con thực sự xuất hiện trong sidebar.

**Bài học rút ra:** đã 2 lần trong ngày hôm nay bug chỉ lộ ra khi user tự click UI thật (bug này + bug sidebar lộ `srsdecomposer` ở mục 9) dù code đã qua `npm run build` + review kỹ. Nhắc lại cho session sau: **build pass ≠ hoạt động đúng**, đặc biệt với các hàm được truyền qua nhiều lớp hook/object (dễ quên export field khi refactor).

---

## Session trước: 2026-07-07 sáng (máy Windows)

### 1. Task đã hoàn thành
- **Fix bug "provider setting"**: `ai-router.service.js` hard-code sai thứ tự fallback (`Gemini → Claude → OpenAI`) và hoàn toàn bỏ qua cột `priority` lưu trong DB (setting priority ở UI không có tác dụng gì). Đã sửa để đọc `priority` từ DB, default về đúng `Claude → Gemini → GPT` theo CLAUDE.md khi provider chưa có setting.
- **Root cause thật của lỗi lưu API key**: file `.env` **chưa từng tồn tại** trong project → `ENCRYPTION_KEY` rỗng → mọi lần lưu API key qua Settings đều crash ở `encrypt()` → hiện lỗi chung chung "Failed to save provider settings". Đã tạo `.env` với `ENCRYPTION_KEY` sinh ngẫu nhiên (không commit, đã gitignore).
- **Đơn giản hóa màn Settings** theo yêu cầu: chỉ còn 1 ô nhập **Gemini API Key**; bỏ hẳn card Claude/OpenAI (dư thừa vì chỉ dùng Gemini); phần cấu hình **Lark Base** (App ID/Secret + options mapping) không xóa — thu gọn sau nút "Cấu hình Lark Base (nâng cao)" vì đó là flow đang chạy thật (Push TC lên Lark, flow 6).
- **Bỏ dropdown Priority sai ở skill Test Cases**: dropdown này đang gửi `Priority focus: High` thẳng vào prompt AI, khiến AI chỉ tập trung sinh case ở 1 mức priority — trái với rule phải sinh đủ mọi mức High/Medium/Low. Đã bỏ dropdown, bỏ dòng prompt sai.
- **Ẩn dãy tag provider (Gemini/Claude/Openai) ở top nav** — không còn cần thiết vì chỉ dùng 1 provider. Giữ nguyên nút "Demo" (tính năng riêng, không liên quan).
- **Verify Gen SRS end-to-end** bằng Playwright + Chrome thật trên project thực tế "INVENTORY" của user → **hoạt động đúng** (sinh SRS đầy đủ ~15-20s). Vấn đề "Gen SRS không hoạt động" user báo là do backend cũ đang chạy **từ trước khi `.env` tồn tại** → không có `ENCRYPTION_KEY` trong bộ nhớ tiến trình → mọi AI generate đều fail cho tới khi restart backend.
- Giải thích cho user vì sao các skill chạy lâu (15-20s+): output dài (`maxOutputTokens: 8192`), **không streaming** (đợi full response mới trả), system prompt rất dài, và một số flow gọi AI **2 lần tuần tự** (Test Cases → tự động Auto Audit; SRS trên node "screen" → tự động Auto Decompose).

### 2. File đã sửa
- `src/server/services/ai-router.service.js` — đọc priority từ DB, default order `claude → gemini → openai`.
- `src/server/routes/providers.routes.js` — thêm field `message` vào response lỗi 500 để dễ debug.
- `src/web/state/useProviderSettings.js` — `DEFAULT_PROVIDER_FORM` chỉ còn `gemini`.
- `src/web/state/useSkillWorkspace.js` — bỏ default `priority: 'High'` không còn dùng.
- `src/web/components/providers/ProviderSettingsModal.jsx` — chỉ hiển thị ô Gemini API Key; Lark config thu gọn sau toggle "nâng cao".
- `src/web/components/controls/SkillOptions.jsx` — bỏ dropdown Priority ở skill Test Cases.
- `src/web/components/layout/AppHeader.jsx` — bỏ `ProviderPills` (dãy tag Gemini/Claude/Openai) khỏi top nav.
- `src/web/features/skills/skill-registry.js` — bỏ dòng `Priority focus: ...` sai trong prompt Test Cases.
- `src/web/main.jsx` — bỏ `priority: 'High'` trong 1 lệnh gọi buildPrompt còn sót.
- **Tạo mới `.env`** (root project) — chứa `ENCRYPTION_KEY` sinh ngẫu nhiên + 3 dòng API key để trống. **KHÔNG commit** (đã trong `.gitignore`).
- File `src/web/components/providers/ProviderPills.jsx` **vẫn còn trên đĩa nhưng không còn nơi nào import** — có thể xóa nếu chắc chắn không cần lại.

### 3. Quyết định quan trọng
- Chỉ ẩn Claude/OpenAI khỏi **UI Settings**, KHÔNG xóa code backend (`ai-router.service.js`, `provider.service.js` vẫn còn đủ logic 3 provider) — vì CLAUDE.md bắt buộc giữ fallback `Claude → Gemini → GPT`, đề phòng sau này bật lại qua biến môi trường.
- Lark Base config trong Settings modal: **ẩn, không xóa** — vì đó là tính năng đang chạy thật (Push TC lên Lark), không phải phần thừa như Claude/OpenAI.
- `ENCRYPTION_KEY` mới sinh chỉ tồn tại trong `.env` **local máy này** — TUYỆT ĐỐI không copy `.env` sang máy khác (sẽ làm key cũ trong DB SQLite không giải mã được).

### 4. Lỗi còn lại
- **Phải restart backend** (`npm start`) mỗi khi sửa `.env` — Node chỉ đọc biến môi trường 1 lần lúc khởi động. Nếu Gen SRS/Test Cases báo lỗi "NO_API_KEYS_ON_SERVER" hoặc lỗi lạ, việc đầu tiên cần kiểm tra là **backend có đang chạy từ trước khi `.env` được tạo/sửa hay không**.
- `package-lock.json` có diff lớn so với git HEAD — **đã tồn tại từ trước session này** (không phải do session này gây ra), chưa rõ nguyên nhân gốc (nghi do khác biệt platform khi `npm install` trên máy Windows này so với lockfile gốc).
- 2 vulnerabilities cũ (1 moderate, 1 high) từ `npm audit` — chưa xử lý, không ảnh hưởng chạy dev.
- Skill Gen SRS/Test Cases vốn chậm (15-20s+) là đặc điểm thiết kế hiện tại (xem mục 1), không phải bug — nếu muốn cải thiện UX cần đổi kiến trúc (xem mục 7).

### 5. Test đã chạy
- `encrypt()`/`decrypt()` round-trip với `ENCRYPTION_KEY` mới — OK.
- Gọi thẳng Google Gemini API bằng key thật đã lưu — HTTP 200, response hợp lệ.
- `POST /api/providers/settings` lưu Gemini key qua đúng route — 200, `hasKey: true`.
- `GET /api/ai/status` — `gemini.enabled: true`.
- `npm run build` (Vite) — pass sau mỗi lần sửa UI, không lỗi cú pháp.
- Playwright + Chrome thật (cài tạm `playwright-core`, đã gỡ sau khi xong) trên project "INVENTORY" thật: chọn skill SRS → nhập yêu cầu → Generate → SRS sinh thành công, skill-run lưu đúng lịch sử.
- Đã dọn dữ liệu test (key giả, file script tạm `_tmp_test_srs*.js`) khỏi DB thật và khỏi thư mục project sau khi test xong.

### 6. Lệnh cần chạy lại (Windows)
```powershell
cd d:\HANH_TEST_AI\AI-Agent-Tester

# Nếu vừa sửa .env hoặc nghi ngờ backend cũ chưa nạp ENCRYPTION_KEY mới:
#   tắt hẳn tiến trình node đang chạy backend cũ rồi chạy lại:
npm start        # backend Express -> http://localhost:3001
npm run dev      # frontend Vite   -> http://localhost:5173
```

### 7. Task tiếp theo được khuyến nghị
- Cân nhắc thêm **streaming response** cho AI generate (SSE) để UX đỡ cảm giác "đứng máy" khi chờ 15-20s.
- Cân nhắc chạy song song Auto Audit / Auto Decompose thay vì tuần tự nếu muốn giảm thời gian chờ — cân nhắc kỹ vì có thể tăng rate-limit/chi phí API.
- Điều tra và dọn sạch diff bất thường ở `package-lock.json` (mục 4) trước khi commit.
- Xóa `src/web/components/providers/ProviderPills.jsx` nếu xác nhận không cần dùng lại.
- Thống nhất mâu thuẫn `npm run dev` giữa CLAUDE.md và `package.json` (đề xuất dùng `concurrently`) — vấn đề này còn tồn đọng từ session trước trên máy macOS, chưa xử lý.

### 8. Điều KHÔNG được làm ở session sau
- KHÔNG xóa `.env` hoặc đổi `ENCRYPTION_KEY` khi DB đã có key đã lưu (sẽ mất khả năng giải mã key cũ, phải nhập lại toàn bộ).
- KHÔNG commit `.env` (đã gitignore, chứa secret).
- KHÔNG copy `.env`/`node_modules` giữa các máy — mỗi máy tự tạo `.env` riêng và tự `npm install`.
- KHÔNG xóa code Claude/OpenAI ở backend (`ai-router.service.js`, `provider.service.js`) — chỉ đang ẩn ở UI, giữ nguyên fallback logic `Claude → Gemini → GPT` theo CLAUDE.md.
- KHÔNG xóa code cấu hình Lark Base trong `ProviderSettingsModal.jsx` — chỉ đang ẩn sau nút "nâng cao", vẫn là flow đang chạy thật.
- KHÔNG đổi tên route/endpoint hoặc format JSON response (frontend đang phụ thuộc).
- KHÔNG rewrite toàn bộ file khi sửa; chỉ sửa đúng chỗ.
