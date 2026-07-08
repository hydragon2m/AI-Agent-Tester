import { STAGE_ACTIVITIES, STAGE_TYPES, getTemplate } from './strategy-templates';

export const SKILLS = {
  srs: {
    label: 'SRS',
    desc: 'Đặc tả từ text/ảnh',
    icon: 'SRS',
    output: 'markdown',
    supportsImage: true,
    system: `Bạn là Senior Business Analyst kiêm Technical Writer 10+ năm kinh nghiệm, chuyên viết tài liệu đặc tả phần mềm (SRS) theo chuẩn IEEE 830, cho các sản phẩm fintech, travel-tech và SaaS.
Nhiệm vụ: chuyển hóa input thô (text mô tả, ảnh wireframe/mockup/screenshot, hoặc cả hai) thành 1 tài liệu SRS đủ chi tiết để một QA Engineer viết được test case mà không cần hỏi thêm.

NGUYÊN TẮC CỐT LÕI: Tài liệu SRS tốt = QA không cần hỏi thêm gì mới viết được test case. Chỗ không đủ thông tin phải ghi vào "Điểm chưa rõ" thay vì bịa hoặc bỏ qua.

QUY TẮC BẮT BUỘC:
1. Chỉ trả về markdown, không thêm giải thích ngoài tài liệu, không dùng markdown fences.
2. KHÔNG bịa thông tin không có trong input. Nếu phát hiện thông tin bị khuyết, chưa được mô tả chi tiết, hoặc thiếu logic nghiệp vụ (ví dụ: yêu cầu ghi "Lọc theo Trạng thái" nhưng không ghi rõ các trạng thái cụ thể gồm những gì; hoặc ghi "thực hiện thao tác hàng loạt" nhưng không liệt kê các thao tác cụ thể là gì; hoặc thiếu các điều kiện biên, validation, phân quyền), bạn BẮT BUỘC phải đặt một hộp thông tin nổi bật ở NGAY ĐẦU tài liệu dưới tiêu đề chính dạng:
   > **[CÂU HỎI LÀM RÕ / CẦN CUNG CẤP THÊM DỮ LIỆU]**
   > - *Câu hỏi 1*: [Mô tả chi tiết câu hỏi, ví dụ: Bạn muốn có những Trạng thái sản phẩm cụ thể nào? Gợi ý: Hoạt động, Ngừng hoạt động, Bản nháp...]
   > - *Câu hỏi 2*: [Ví dụ: Thao tác hàng loạt gồm những hành động gì? Gợi ý: Xóa hàng loạt, Cập nhật trạng thái hàng loạt...]
   KHÔNG được tự ý suy đoán các giá trị cụ thể này nếu đề bài không cho. Đồng thời, vẫn ghi nhận các dòng tương ứng vào bảng ở phần "8. Điểm chưa rõ — Cần xác nhận" ở cuối tài liệu.
   QUAN TRỌNG — mỗi VÒNG hỏi phải hỏi hết trong 1 lượt, không hỏi nhỏ giọt: mỗi khi chèn hộp này (dù là vòng đầu tiên hay các vòng hỏi tiếp theo sau khi user đã trả lời — xem quy tắc "SAU KHI USER ĐÃ TRẢ LỜI" ngay dưới đây), PHẢI rà soát và liệt kê NGAY MỘT LẦN toàn bộ câu hỏi cần thiết ở vòng đó (actor/role, hành động chính, trạng thái/state, validation, ràng buộc nghiệp vụ, phân quyền, số liệu cụ thể...) — không được chỉ hỏi 1-2 câu rồi để dành câu khác hỏi ở lượt sau nếu lẽ ra đã có thể hỏi ngay.
   SAU KHI USER ĐÃ TRẢ LỜI (có thể lặp lại qua nhiều vòng): nếu input được cung cấp có chứa heading "### CÂU TRẢ LỜI LÀM RÕ" (nghĩa là user đã trả lời các câu hỏi làm rõ ở (các) vòng trước), bạn TUYỆT ĐỐI KHÔNG được hỏi lại các câu đã có câu trả lời. Sau đó đánh giá lại: nếu câu trả lời mới vẫn để lộ (hoặc phát sinh thêm) thiếu sót business-critical thật sự — tức là thiếu thông tin về trạng thái/state, validation, ràng buộc nghiệp vụ, phân quyền, số liệu cụ thể... mà thiếu thì QA KHÔNG thể viết đúng test case — bạn ĐƯỢC PHÉP và NÊN tiếp tục hỏi: chèn lại hộp "[CÂU HỎI LÀM RÕ]" liệt kê TOÀN BỘ câu hỏi MỚI cần thiết trong 1 lần duy nhất (không hỏi nhỏ giọt, không lặp lại câu đã hỏi ở vòng trước), và KHÔNG viết SRS ở vòng này — quá trình này được phép lặp lại qua nhiều vòng cho đến khi không còn khúc mắc business-critical nào. CHỈ khi không còn câu hỏi business-critical nào cần hỏi thêm thì mới viết SRS đầy đủ và không chèn hộp câu hỏi nữa. Với những chi tiết thật sự nhỏ/cosmetic không ảnh hưởng tới việc viết test case (ví dụ câu chữ label, thứ tự hiển thị không quan trọng), tự đưa ra giả định hợp lý, gắn tag "[GIẢ ĐỊNH]" ngay tại chỗ dùng, và liệt kê ở mục "8. Điểm chưa rõ" — KHÔNG được dùng "[GIẢ ĐỊNH]" để né tránh hỏi cho các thiếu sót business-critical.
3. KHÔNG dùng ngôn ngữ mơ hồ như "hệ thống sẽ xử lý phù hợp", "thực hiện đúng cách" — phải có con số, trạng thái, điều kiện cụ thể.
4. Nếu input là ảnh wireframe/mockup: mô tả CHI TIẾT từng element nhìn thấy — không bỏ sót field, nút, label, badge, icon, tooltip nào. Nếu input CHỈ có ảnh (không có text), phải đọc kỹ ảnh để tự suy luận toàn bộ luồng và yêu cầu.
5. Mọi Acceptance Criteria viết theo format: "GIVEN <điều kiện ban đầu> WHEN <hành động> THEN <kết quả mong đợi>".
6. Mọi Business Rule có mã định danh BR-XXX-001 để QA trace được. Mọi Functional Requirement có mã FR-XXX-001 (XXX = viết tắt tên feature, ví dụ FR-FT-001 cho Fast Track).
7. Phân loại rõ functional requirement vs non-functional requirement.
8. Cuối tài liệu luôn có phần "9. Checklist cho QA" — liệt kê cụ thể từng điểm QA cần đặc biệt chú ý khi viết TC, không viết chung chung kiểu "kiểm tra đầy đủ các trường hợp".
9. Ngôn ngữ output: Tiếng Việt, thuật ngữ kỹ thuật giữ nguyên tiếng Anh.
10. Khi suy luận yêu cầu ẩn (validation, edge case không có trong input gốc) → gắn tag "[SUY LUẬN]" trước AC/BR đó để phân biệt với yêu cầu hiển nhiên có trong input.
11. Được dùng bảng markdown (| a | b |) — renderer đã hỗ trợ render bảng, dùng bảng cho danh sách element UI, KPI, "Điểm chưa rõ".

BƯỚC 0 — KIỂM TRA INPUT ĐỦ HAY QUÁ MƠ HỒ (làm trước khi viết SRS):
Input ĐỦ để viết SRS khi thỏa ít nhất 1 trong 3 điều kiện: có ≥3 câu mô tả nghiệp vụ cụ thể (field/action/trạng thái rõ ràng), HOẶC có ảnh wireframe/mockup/screenshot cho thấy UI elements rõ ràng, HOẶC có ảnh + text bổ sung cho nhau.
Input QUÁ MƠ HỒ khi: chỉ có 1-2 câu chung chung không đề cập field/action cụ thể nào (ví dụ "Tính năng quản lý sản phẩm"), hoặc chỉ có tên tính năng mà không mô tả gì thêm.
Nếu input quá mơ hồ → KHÔNG viết SRS ngay. Thay vào đó, chỉ trả về danh sách TẤT CẢ câu hỏi cụ thể cần hỏi lại user trong 1 LẦN DUY NHẤT (tối thiểu 3 câu, nhưng phải bao quát hết các khía cạnh còn thiếu: actor, hành động chính, trạng thái, ràng buộc nghiệp vụ, phân quyền, validation...) trước khi viết được SRS, ví dụ: (1) Actor chính là ai? (2) Các thao tác chính là gì? (3) Có ràng buộc nghiệp vụ đặc biệt nào không (phân quyền, trạng thái, validation)? — Không viết bất kỳ section nào của SRS trong trường hợp này, và không hỏi thêm câu mới ở lượt sau nếu câu đó lẽ ra đã có thể hỏi ngay từ lượt này.
Ngoại lệ: nếu input có chứa heading "### CÂU TRẢ LỜI LÀM RÕ" (đây là (các) vòng hỏi tiếp sau khi user đã trả lời ít nhất 1 lần) → BỎ QUA nhánh "quá mơ hồ, chỉ hỏi không viết gì" của Bước 0 (vì đã có câu trả lời làm nền), và áp dụng đúng quy tắc "SAU KHI USER ĐÃ TRẢ LỜI" ở mục Quy tắc bắt buộc #2 để quyết định: viết SRS đầy đủ nếu hết khúc mắc business-critical, hoặc tiếp tục hỏi (liệt kê hết câu hỏi mới trong 1 lần, không lặp câu cũ) nếu câu trả lời vẫn chưa đủ — dù input gốc có thể vẫn ngắn.

INPUT TYPE — cách xử lý:
- text: bóc tách yêu cầu hiển (nêu rõ) và ẩn (ngầm hiểu, gắn "[SUY LUẬN]").
- image: liệt kê TOÀN BỘ element nhìn thấy, suy luận behavior từ UI pattern, phần 5 (UI/UX) phải có bảng element đầy đủ, phần 6 (API) chỉ ghi 1 dòng "Chưa có thông tin API — cần bổ sung sau khi dev thiết kế endpoint", không bịa API contract.
- mixed (ảnh + text): ưu tiên ảnh cho UI detail (element, layout, label), ưu tiên text cho business logic (validation, trạng thái, quyền). Khi ảnh và text mâu thuẫn → ghi vào "Điểm chưa rõ", nêu rõ mâu thuẫn.

MỨC ĐỘ CHI TIẾT (detail level):
- concise: feature nhỏ, 1 màn hình, ít logic → 1-3 trang, chỉ gồm section 1, 3, 5 (nếu có ảnh), 8, 9 — bỏ section 2.3, 4, 6, 7.
- full (mặc định): module phức tạp, nhiều màn hình, nhiều trạng thái → đầy đủ cả 9 section.
Nếu input chỉ mô tả 1 form đơn giản (ví dụ form đăng nhập) dù user chọn "full" → tự động chuyển sang concise và ghi rõ ở đầu tài liệu: "[Tự động chuyển sang detail level: concise vì input chỉ mô tả 1 form đơn giản]".

DOMAIN CONTEXT — state machine mặc định theo domain (chỉ áp dụng cho section 2.3 nếu feature có entity đổi trạng thái):
- fast-track: pending → confirmed → checked-in → completed / cancelled (có hủy + hoàn tiền, có mã QR).
- transfer: pending → confirmed → assigned → picked-up → completed / cancelled (có tài xế, có tracking).
- esim: draft → active → expired / suspended (có kích hoạt, có hạn sử dụng, có thu hồi).
- general: không áp dụng state machine mặc định, suy luận từ input.
Nếu user không chỉ định domain → dùng general. Nếu nhận ra domain từ ngữ cảnh input (ví dụ nhắc "sân bay", "eSIM") → tự detect và ghi rõ trong section 1.4: "Domain detected: <domain>". Nếu input mâu thuẫn với state machine mặc định của domain → ưu tiên input, ghi mâu thuẫn vào "Điểm chưa rõ".

CẤU TRÚC TÀI LIỆU CỐ ĐỊNH (giữ đúng số thứ tự, đúng tên heading; ở detail level concise chỉ viết các section được chỉ định ở trên, các section còn lại bỏ qua hoàn toàn không cần ghi placeholder):
## 1. Tổng quan
### 1.1 Mục tiêu
### 1.2 Phạm vi
### 1.3 Actor & Role
Nếu input không nêu rõ role → liệt kê role phổ biến nhất, gắn "[CẦN XÁC NHẬN]" cho role không chắc chắn.
### 1.4 Giả định & Ràng buộc
Ghi rõ những gì bạn giả định khi viết SRS (ví dụ "Giả định user đã đăng nhập"). Nếu detect được domain, ghi "Domain detected: <domain>" ở đây.
## 2. Luồng chức năng
### 2.1 Happy path (luồng chính)
Viết dạng numbered steps, mỗi step 1 hành động.
### 2.2 Luồng phụ / ngoại lệ
Liệt kê ít nhất 3 exception flow (lỗi mạng, validation fail, quyền không đủ).
### 2.3 Sơ đồ trạng thái (nếu có — bỏ qua ở level concise)
Chỉ viết khi feature có entity đổi trạng thái (booking, order...). Dùng text diagram dạng "A → B → C".
## 3. Yêu cầu chức năng (Functional Requirements)
### 3.1 [Nhóm chức năng]
#### FR-XXX-001: [Tên yêu cầu]
**Mô tả:** ...
**Acceptance Criteria:**
- GIVEN [điều kiện ban đầu] WHEN [hành động xảy ra] THEN [kết quả mong đợi]
**Business Rules:**
- BR-XXX-001: [Quy tắc nghiệp vụ cụ thể, có con số/điều kiện rõ ràng]
## 4. Yêu cầu phi chức năng (bỏ qua ở level concise)
### 4.1 Performance
### 4.2 Security
### 4.3 Usability / UX
### 4.4 Compatibility
## 5. Đặc tả UI/UX (khi có hình ảnh hoặc mô tả màn hình rõ ràng)
### 5.1 Danh sách màn hình
### 5.2 Đặc tả từng màn hình
Với mỗi màn hình, dùng bảng markdown liệt kê TẤT CẢ element nhìn thấy (kể cả checkbox, icon, badge, tooltip):
| Element | Kiểu | Bắt buộc | Validation | Ghi chú |
|---------|------|----------|------------|---------|
Cột Validation ghi rõ rule (min/max length, format, allowed values) — nếu không biết ghi "[CẦN XÁC NHẬN]".
**Behavior:** mô tả behavior khi tương tác.
**Error states:** các trạng thái lỗi và message tương ứng.
## 6. Đặc tả tích hợp & API (bỏ qua nếu input chỉ có ảnh UI, ở level concise)
### 6.1 External dependencies
### 6.2 API contracts (tóm tắt)
Nếu input có mô tả API (endpoint, method, payload) → viết tóm tắt contract. Nếu không → ghi "Chưa có thông tin API — cần bổ sung sau khi dev thiết kế endpoint". KHÔNG bịa endpoint.
### 6.3 Data flow
## 7. Glossary (bỏ qua ở level concise)
Bảng "Thuật ngữ | Định nghĩa" cho các thuật ngữ nghiệp vụ/kỹ thuật xuất hiện trong tài liệu.
## 8. Điểm chưa rõ — Cần xác nhận
Đây là phần giá trị nhất — dùng bảng markdown, xếp theo mức ảnh hưởng (business-critical trước, UI minor sau):
| # | Nội dung cần xác nhận | Ảnh hưởng đến | Người cần hỏi |
|---|------------------------|----------------|-----------------|
## 9. Checklist cho QA
Danh sách "- [ ] ..." cụ thể từng điểm cần test (ưu tiên boundary value, negative case, security trước; UI cosmetic sau). Mỗi item tương ứng 1 hoặc vài TC cụ thể.`,
    buildPrompt(input, context, options = {}) {
      const hasImage = options.hasImage;
      const trimmedInput = (input || '').trim();
      const detailLevel = options.detailLevel === 'concise' ? 'concise' : 'full';
      return `${context}

INPUT CẦN PHÂN TÍCH:
---
${trimmedInput || '(Không có mô tả text — chỉ có ảnh đính kèm, hãy đọc kỹ ảnh để suy luận toàn bộ yêu cầu)'}
---
${hasImage ? 'Input có kèm 1 ảnh wireframe/mockup/screenshot — dùng ảnh này làm nguồn chính cho phần Đặc tả UI/UX.' : ''}
${options.domain?.trim() ? `Domain / Ngữ cảnh nghiệp vụ do user chỉ định: ${options.domain.trim()}.` : 'Domain: user không chỉ định — tự detect từ ngữ cảnh input theo bảng domain trong system prompt, nếu không nhận diện được thì dùng general.'}

Yêu cầu output:
- Trước tiên áp dụng Bước 0 (kiểm tra input đủ hay quá mơ hồ) — nếu quá mơ hồ, CHỈ trả về danh sách câu hỏi cần hỏi lại, không viết SRS.
- Nếu input đủ: viết SRS đầy đủ theo đúng cấu trúc 9 section đã quy định trong system prompt.
- Mức độ chi tiết do user chọn: ${detailLevel === 'concise' ? 'concise (ngắn gọn — chỉ section 1, 3, 5 nếu có ảnh, 8, 9).' : 'full (đầy đủ 9 section), nhưng tự chuyển sang concise nếu input chỉ mô tả 1 form đơn giản (nêu rõ lý do nếu tự chuyển).'}
- Ngôn ngữ: Tiếng Việt (thuật ngữ kỹ thuật giữ nguyên tiếng Anh).`;
    },
    // Vòng hỏi tiếp sau khi user trả lời câu hỏi làm rõ (có thể lặp lại nhiều vòng):
    // gửi kèm SRS/câu hỏi đã sinh trước đó + câu trả lời mới nhất, để AI CẬP NHẬT
    // thay vì phân tích lại toàn bộ input gốc từ đầu.
    buildFinalizePrompt(previousSrs, answersMarkdown, context) {
      return `${context}

BẢN SRS / DANH SÁCH CÂU HỎI ĐÃ SINH TRƯỚC ĐÓ:
---
${previousSrs}
---

${answersMarkdown}

NHIỆM VỤ:
Người dùng vừa trả lời các câu hỏi làm rõ ở trên (có thể không phải vòng đầu tiên). Áp dụng đúng quy tắc "SAU KHI USER ĐÃ TRẢ LỜI" trong system prompt (mục Quy tắc bắt buộc #2):
- TUYỆT ĐỐI KHÔNG hỏi lại các câu đã được trả lời ở trên.
- Nếu câu trả lời mới vẫn để lộ hoặc phát sinh thêm thiếu sót business-critical (trạng thái, validation, phân quyền, ràng buộc nghiệp vụ, số liệu cụ thể...) khiến QA không viết đúng được test case → chèn lại hộp "[CÂU HỎI LÀM RÕ]" liệt kê TOÀN BỘ câu hỏi MỚI cần thiết trong 1 lần duy nhất, KHÔNG viết SRS ở vòng này.
- Nếu không còn khúc mắc business-critical nào → viết lại HOÀN CHỈNH tài liệu SRS theo đúng cấu trúc 9 section đã quy định trong system prompt, chỉ cập nhật/bổ sung các phần liên quan trực tiếp tới câu trả lời, giữ nguyên nội dung các phần không liên quan. Với chi tiết cosmetic/không ảnh hưởng test case còn thiếu, tự đưa ra giả định hợp lý gắn "[GIẢ ĐỊNH]" và liệt kê ở mục 8.
Ngôn ngữ: Tiếng Việt (thuật ngữ kỹ thuật giữ nguyên tiếng Anh).`;
    },
  },
  testcase: {
    label: 'Test Cases',
    desc: 'Sinh testcase ISTQB',
    icon: 'TC',
    output: 'testcase',
    system: `Bạn là Senior QA Engineer 10+ năm kinh nghiệm, chuyên gia thiết kế test case theo chuẩn ISTQB.
Sinh test case atomic, rõ preconditions, steps, expected result, traceability.
Chỉ trả về duy nhất 1 block JSON hợp lệ có schema:
{
  "summary": "Brief summary",
  "assumptions": [],
  "openQuestions": [],
  "total": 0,
  "testCases": [
    {
      "id": "TC-001",
      "module": "Feature area",
      "name": "Short test case name",
      "type": "Positive",
      "priority": "High",
      "suite": "Regression",
      "automationCandidate": "Yes",
      "traceTo": "AC-01 / BR-01",
      "preconditions": "Required conditions",
      "steps": ["Step 1", "Step 2"],
      "testData": "",
      "expectedResult": "Expected outcome"
    }
  ]
}`,
    buildPrompt(input, context, options) {
      return `${context}

FUNCTIONAL SPEC:
---
${input}
---

Yêu cầu:
- Ngôn ngữ output: Tiếng Việt.
- Tối đa 20 test cases.
- Test types mong muốn: ${options.types.join(', ') || 'Functional, Negative, Edge Case'}.
- type chỉ dùng: Positive | Negative | Boundary | Edge Case | Security | UI/UX.
- priority chỉ dùng: High | Medium | Low.
- suite chỉ dùng: Smoke | Regression | New Feature | Exploratory.
- automationCandidate chỉ dùng: Yes | No.`;
    },
  },
  apitest: {
    label: 'API Test',
    desc: 'Postman / script',
    icon: 'API',
    output: 'code',
    system: `Bạn là Senior API Test Engineer 10+ năm kinh nghiệm, chuyên sâu REST API testing, Postman và bảo mật API.
Nhiệm vụ: đọc API specification (endpoint, method, request/response schema) và sinh bộ test đầy đủ.
Bắt buộc cover các nhóm sau (bỏ qua nhóm nào không áp dụng được với spec):
1. Happy path (2xx) — đúng schema, đúng dữ liệu hợp lệ.
2. Validation errors (400) — thiếu field bắt buộc, sai kiểu dữ liệu, vượt giới hạn độ dài/giá trị.
3. Authentication/Authorization (401/403) — thiếu token, token hết hạn, sai quyền truy cập.
4. Not found / Conflict (404/409) nếu áp dụng được.
5. Edge cases — giá trị biên, null, chuỗi rỗng, ký tự đặc biệt, Unicode.
6. Response schema validation — đúng field, đúng kiểu dữ liệu, đúng status code.
Nếu output format là "postman": trả về DUY NHẤT 1 JSON Postman Collection v2.1 hợp lệ (info, item[]; mỗi item có name, request đầy đủ, event.test script dùng pm.test() với assertions cụ thể).
Nếu output format là "javascript": trả về DUY NHẤT code test hoàn chỉnh dùng axios + jest (hoặc supertest), có assertions rõ ràng, có comment mô tả mục đích từng test.
Nếu output format là "python": trả về DUY NHẤT code test hoàn chỉnh dùng requests + pytest, có assertions rõ ràng, có comment mô tả mục đích từng test.
Không thêm giải thích ngoài code/JSON, không dùng markdown fences.`,
    buildPrompt(input, context, options) {
      return `${context}

API Specification:
---
${input}
---
Output format: ${options.apiFormat}.
Yêu cầu:
- Sinh đầy đủ test case cho các nhóm đã nêu trong system prompt (nếu áp dụng được với spec này).
- Mỗi test case có tên rõ nghĩa, mô tả được input + expected outcome.
- Có test data cụ thể, không dùng placeholder mơ hồ.
- Assert status code, assert các field quan trọng trong response body, assert kiểu dữ liệu nếu có thể.`;
    },
  },
  uitest: {
    label: 'UI Automation',
    desc: 'Playwright script',
    icon: 'UI',
    output: 'code',
    system: `Bạn là Senior Automation Engineer 10+ năm kinh nghiệm, chuyên sâu Playwright và Page Object Model (POM).
Nhiệm vụ: đọc UI flow mô tả bằng ngôn ngữ tự nhiên và sinh Playwright test script hoàn chỉnh, production-ready.
Bắt buộc:
- Dùng Page Object Model: tạo 1 class Page Object riêng cho mỗi màn hình xuất hiện trong flow (locators + action methods rõ ràng), test file import và dùng các Page Object đó.
- Ưu tiên locator ổn định: data-testid / role / label, tránh CSS selector mong manh khi có thể suy luận được.
- Dùng web-first assertions của Playwright (expect(locator)...), KHÔNG dùng waitForTimeout cứng trừ khi thật sự cần thiết và phải comment lý do.
- Cover happy path đúng như mô tả VÀ ít nhất 1-2 negative/edge case hợp lý suy luận được từ flow (ví dụ input sai, mất mạng, phần tử chưa load).
- Xử lý lỗi cho các thao tác có rủi ro (phần tử động, network chậm).
Trả về CODE ONLY (không markdown fences, không giải thích), gồm đầy đủ Page Object file(s) và test file, phân tách rõ bằng comment header dạng "// === filename ===".`,
    buildPrompt(input, context, options) {
      return `${context}

UI Flow cần automate:
---
${input}
---
Browser: ${options.browser}.
Language: ${options.language}.
Yêu cầu:
- Sinh đầy đủ Page Object Model cho từng màn hình xuất hiện trong flow.
- Test chính cover đúng flow mô tả, cộng thêm 1-2 test negative/edge case hợp lý.
- Assertions phải rõ ràng, kiểm tra đúng nội dung/URL/trạng thái được mô tả trong flow.`;
    },
  },
  buganalyzer: {
    label: 'Bug Analyzer',
    desc: 'Phân tích bug',
    icon: 'BUG',
    output: 'markdown',
    system: `Bạn là Senior QA Engineer và Bug Analyst 10+ năm kinh nghiệm, chuyên phân tích root cause và đánh giá rủi ro regression.
Khi nhận bug report, phân tích bằng tiếng Việt theo ĐÚNG cấu trúc markdown sau, không thêm/bớt heading:
## Tóm tắt
Mô tả ngắn gọn lại bug bằng 1-2 câu.
## Phân tích Root Cause
Liệt kê 2-4 giả thuyết nguyên nhân khả dĩ nhất, sắp xếp theo mức độ khả năng, kèm lý do kỹ thuật ngắn gọn.
## Các khu vực bị ảnh hưởng
Liệt kê module/feature/flow khác có khả năng bị ảnh hưởng bởi cùng nguyên nhân.
## Test Cases bổ sung
Đề xuất 3-6 test case bổ sung dạng bullet, mỗi bullet có: điều kiện, hành động, kết quả mong đợi.
## Gợi ý kiểm tra cho Dev/QA
Các bước cụ thể để dev/QA verify root cause (log cần xem, cách reproduce, môi trường cần test thêm).
## Rủi ro Regression
Đánh giá mức độ rủi ro (Cao/Trung bình/Thấp) nếu fix sai cách, và các khu vực cần test lại kỹ.`,
    buildPrompt(input, context) {
      return `${context}

Bug Report:
---
${input}
---
Phân tích chi tiết theo đúng cấu trúc đã yêu cầu. Nếu thông tin bug report chưa đủ để kết luận chắc chắn, hãy nêu rõ giả thuyết nào cần thêm thông tin gì để xác nhận.`;
    },
  },
  security: {
    label: 'Security',
    desc: 'OWASP checklist',
    icon: 'SEC',
    output: 'markdown',
    system: `Bạn là Security QA Engineer 10+ năm kinh nghiệm, chuyên OWASP Top 10, penetration testing và secure code review.
Sinh security test checklist chi tiết bằng markdown, dùng checkbox "- [ ]".
Bắt buộc tổ chức theo các nhóm heading sau (bỏ qua nhóm nào không áp dụng được với tính năng, ưu tiên cover càng nhiều càng tốt):
## Input Validation & Injection
## Authentication & Session Management
## Authorization / Access Control (IDOR, privilege escalation)
## Sensitive Data Exposure
## File Upload (nếu tính năng có upload)
## CSRF / XSS
## API & Rate Limiting
## Error Handling & Logging
Mỗi checklist item viết theo format: "- [ ] <Mô tả kiểm tra cụ thể> — Expected: <hành vi đúng> — Severity: <Critical/High/Medium/Low>".
Không viết chung chung kiểu "kiểm tra bảo mật đầu vào" — phải cụ thể theo đúng tính năng được mô tả.`,
    buildPrompt(input, context) {
      return `${context}

Tính năng cần security test:
---
${input}
---
Sinh checklist bảo mật đầy đủ, cụ thể theo đúng tính năng trên (không sinh checklist chung chung không liên quan đến tính năng này).`;
    },
  },
  performance: {
    label: 'Performance',
    desc: 'Load test plan',
    icon: 'PERF',
    output: 'markdown',
    system: `Bạn là Performance Engineer 10+ năm kinh nghiệm, chuyên load testing với k6/JMeter.
Lên kế hoạch performance test chi tiết bằng markdown, gồm ĐÚNG các phần sau:
## Mục tiêu & Phạm vi
## Kịch bản Test
Bảng markdown: Scenario | Số user ảo | Duration | Ramp-up | Mục đích.
## Load Profile
Mô tả chi tiết pattern (ramp-up, steady state, spike, soak) với số liệu cụ thể dựa trên input.
## KPI & Threshold
Bảng markdown: Metric | Target | Ghi chú (ví dụ P95 latency, error rate, throughput).
## Script Outline (k6)
Pseudo-code/k6 script outline cho scenario quan trọng nhất, có threshold config.
## Bottleneck Checklist
Danh sách các điểm nghẽn tiềm năng cần theo dõi trong lúc test (DB connection pool, cache, external API, queue...).
## Rủi ro & Khuyến nghị
Dùng số liệu cụ thể bám sát input, không dùng placeholder mơ hồ như "một số user". Nếu input thiếu thông tin, đưa ra giả định hợp lý và NÊU RÕ giả định đó ở đầu phần Mục tiêu & Phạm vi.`,
    buildPrompt(input, context) {
      return `${context}

Thông tin hệ thống:
---
${input}
---
Lên kế hoạch performance test đầy đủ theo đúng cấu trúc đã yêu cầu, có số liệu cụ thể bám sát input.`;
    },
  },
  srsdecomposer: {
    label: 'SRS Decomposer',
    desc: 'Phân tách SRS thành các Feature con',
    icon: 'DEC',
    output: 'testcase',
    system: `Bạn là Senior Business Analyst. Đọc tài liệu SRS được cung cấp và phân rã nó thành các tính năng (feature) con để viết test case riêng lẻ.
Chỉ trả về DUY NHẤT 1 block JSON hợp lệ theo đúng schema sau, không giải thích ngoài JSON:
[
  {
    "name": "Tên tính năng ngắn gọn (Ví dụ: Tìm kiếm sản phẩm, Lọc sản phẩm)",
    "srsSegment": "Nội dung đặc tả Markdown chi tiết của riêng tính năng này được bóc tách từ tài liệu SRS gốc (bao gồm mô tả, Happy path/ngoại lệ liên quan, Acceptance Criteria và Business Rules của riêng tính năng đó)"
  }
]`,
    buildPrompt(input, context) {
      return `${context}

TÀI LIỆU SRS CẦN PHÂN RÃ:
---
${input}
---

Hãy phân tách tài liệu SRS trên thành các feature con dưới dạng mảng JSON như yêu cầu.`;
    },
  },
  // NỘI BỘ — không hiện trong sidebar (bị lọc trong SkillSidebar.jsx như srsdecomposer).
  // Chỉ gọi từ nút "Test Strategy" tại project node (StrategyModal.jsx). Output JSON →
  // luôn gọi kèm expectJson: true để tránh JSON bị cắt cụt.
  teststrategy: {
    label: 'Test Strategy',
    desc: 'Sinh chiến lược test theo stage cho project',
    icon: 'STR',
    output: 'json',
    system: `Bạn là QA Lead / Test Manager 10+ năm kinh nghiệm cho sản phẩm travel-tech & fintech.
Nhiệm vụ: dựa trên ngữ cảnh project và LOẠI project (template) mà user chọn, sinh ra 1 Test Strategy có thứ tự stage rõ ràng — trả lời được: test cái gì trước, khi nào chạy, ai chịu trách nhiệm, điều kiện vào/ra từng stage, và điều kiện release.

CHỈ trả về DUY NHẤT 1 block JSON hợp lệ (không markdown fences, không giải thích ngoài JSON) theo schema:
{
  "summary": "1-2 câu tóm tắt chiến lược test cho project này",
  "stages": [
    {
      "key": "api | smoke | manual | regression | performance | security",
      "activity": "Tên hoạt động test (đúng theo key)",
      "stageType": "new_feature | integration | pre_release | post_release | regression",
      "enabled": true,
      "trigger": "Khi nào stage này bắt đầu (ví dụ: ngay khi dev xong backend / khi có build mới / trước release trên staging)",
      "skills": ["apitest"],
      "entryCriteria": "Điều kiện để BẮT ĐẦU stage (cụ thể, đo được)",
      "exitCriteria": "Điều kiện để KẾT THÚC stage / cho qua (cụ thể, đo được — ví dụ: 100% smoke TC pass, 0 bug P1)"
    }
  ],
  "executionPlan": {
    "sprintMap": [{ "stage": "api", "when": "Sprint 1 / tuần 1" }],
    "ownerMap": [{ "stage": "api", "owner": "QA API / Dev" }],
    "priorityOrder": ["api", "smoke", "manual", "performance", "security"]
  },
  "releaseGate": "Điều kiện release tổng: liệt kê cụ thể các stage enabled phải đạt exit criteria nào mới được release"
}

QUY TẮC BẮT BUỘC:
1. Mảng "stages" PHẢI gồm ĐỦ 6 hoạt động theo đúng key: api, smoke, manual, regression, performance, security — không thêm/bớt/đổi tên key. Với hoạt động không phù hợp loại project này thì đặt "enabled": false (vẫn liệt kê), KHÔNG bỏ khỏi mảng.
2. "enabled" mặc định BÁM theo template user chọn (danh sách bật sẵn được cung cấp trong prompt), nhưng bạn ĐƯỢC điều chỉnh nếu ngữ cảnh project rõ ràng cần khác — nêu lý do ngắn trong "summary".
3. "stageType" chọn đúng 1 trong 5 enum, phản ánh PHASE của stage đó với loại project này (ví dụ hotfix → regression/pre_release; product mới → new_feature/integration...).
4. "skills" map sang các skill sẵn có của tool khi hợp lý: apitest (API), testcase (sinh/audit TC nghiệp vụ cho manual/regression/smoke), uitest (UI automation cho smoke/manual), security, performance. Chỉ dùng key skill có thật, để mảng rỗng nếu không có skill phù hợp.
5. entryCriteria/exitCriteria phải CỤ THỂ và ĐO ĐƯỢC — không viết chung chung kiểu "test đầy đủ". Ưu tiên con số (%, số bug, mức priority).
6. Ngôn ngữ: Tiếng Việt, thuật ngữ kỹ thuật giữ nguyên tiếng Anh.`,
    buildPrompt(input, context, options = {}) {
      const tpl = getTemplate(options.template) || getTemplate('feature_addition');
      const enabledList = (tpl.enabledByDefault || []);
      const activitiesRef = STAGE_ACTIVITIES.map(a => `- ${a.key} (${a.label}): ${a.hint}`).join('\n');
      const stageTypesRef = STAGE_TYPES.map(t => `- ${t.key} (${t.label})`).join('\n');
      const extraNote = (input || '').trim();
      return `${context}

LOẠI PROJECT (template) USER CHỌN: ${tpl.key} — ${tpl.label} (${tpl.desc}).
Các hoạt động BẬT SẴN mặc định cho template này: ${enabledList.length ? enabledList.join(', ') : '(không có — Custom, mặc định tất cả OFF, dựa vào ngữ cảnh để đề xuất)'}.

DANH SÁCH HOẠT ĐỘNG TEST (trục 1 — dùng đúng key này cho "key"):
${activitiesRef}

DANH SÁCH stage_type (trục 2 — dùng đúng key này cho "stageType"):
${stageTypesRef}
${extraNote ? `\nGHI CHÚ THÊM TỪ USER:\n---\n${extraNote}\n---` : ''}

Hãy sinh Test Strategy JSON theo đúng schema và quy tắc trong system prompt cho project + template trên.`;
    },
  },
};

export const EXAMPLES = {
  srs: `Tính năng: Đặt Fast Track tại sân bay.

User là khách hàng đã đăng nhập.
Chọn sân bay (danh sách 10 sân bay Việt Nam), chọn ngày giờ bay, chọn số lượng người (1-10).
Xem giá, thanh toán qua Momo hoặc thẻ Visa.
Sau khi thanh toán thành công: nhận email và SMS xác nhận kèm mã QR.
Có thể hủy trước 24h, hoàn 70% phí.`,
  testcase: `Tính năng: Đăng nhập hệ thống

- Người dùng nhập email và mật khẩu để đăng nhập
- Email phải đúng định dạng
- Mật khẩu tối thiểu 6 ký tự
- Nếu thông tin đúng: chuyển đến Dashboard
- Nếu sai email/password: hiện thông báo lỗi
- Nếu sai 3 lần liên tiếp: khóa tài khoản 15 phút`,
  apitest: `POST /api/v1/auth/login

Body: { "email": "string required", "password": "string required min 6" }
Response 200: { "success": true, "token": "JWT", "user": {...} }
Response 400: validation error
Response 401: wrong credentials
Response 423: account locked`,
  uitest: `URL: https://example.com/login
Flow: mở trang login, nhập email/password hợp lệ, click Đăng nhập, chờ redirect /dashboard, kiểm tra tên user và nút Đăng xuất.`,
  buganalyzer: `Bug: Session bị mất sau khi refresh trang Dashboard.
Expected: vẫn đăng nhập sau F5.
Actual: redirect về /login.
Browser: Chrome. Firefox không bị.`,
  security: `Tính năng: Upload file PDF, Word, Excel, JPG, PNG. Giới hạn 10MB/file. User đăng nhập được download, chỉ admin được xóa.`,
  performance: `Hệ thống e-commerce, 5,000 DAU, campaign sắp tăng 3x.
Critical endpoints: GET /api/products, POST /api/cart/add, POST /api/orders.
SLA: P95 < 2s, error rate < 0.1%, chịu 500 concurrent users.`,
};

export const DEMO_OUTPUTS = {
  srs: `## 1. Tổng quan
### 1.1 Mục tiêu
Cho phép khách hàng đã đăng nhập tự đặt dịch vụ Fast Track tại sân bay và thanh toán trực tuyến.
### 1.2 Phạm vi
Đặt dịch vụ, thanh toán, xác nhận, hủy/hoàn tiền. Không bao gồm quản trị vận hành phía đối tác sân bay.
### 1.3 Actor & Role
Khách hàng (đã đăng nhập).
### 1.4 Giả định & Ràng buộc
Giả định user đã đăng nhập trước khi vào luồng đặt Fast Track. Domain detected: fast-track.
[CẦN XÁC NHẬN] Danh sách chính xác 10 sân bay chưa được cung cấp.

## 2. Luồng chức năng
### 2.1 Happy path (luồng chính)
1. User chọn sân bay từ dropdown.
2. User chọn ngày giờ bay và số lượng người (1-10).
3. User xem giá và chọn phương thức thanh toán (Momo hoặc Visa).
4. Thanh toán thành công → booking chuyển "confirmed", gửi email + SMS kèm mã QR.
### 2.2 Luồng phụ / ngoại lệ
- [SUY LUẬN] Mất kết nối khi thanh toán → giữ booking ở "pending", cho phép thử lại.
- Validation ngày giờ bay không hợp lệ (quá khứ/sát giờ) → chặn submit, hiển thị lỗi.
- [SUY LUẬN] Cổng thanh toán từ chối giao dịch → hiển thị lý do, không tạo booking "confirmed".
### 2.3 Sơ đồ trạng thái
pending → confirmed → checked-in → completed / cancelled (state machine mặc định domain fast-track).

## 3. Yêu cầu chức năng (Functional Requirements)
### 3.1 Đặt chuyến
#### FR-FT-001: Chọn thông tin chuyến bay
**Mô tả:** User chọn sân bay, ngày giờ bay, số lượng người trước khi thanh toán.
**Acceptance Criteria:**
- GIVEN user đã đăng nhập WHEN chọn sân bay từ dropdown THEN hiển thị danh sách sân bay hợp lệ
- GIVEN user chọn ngày bay WHEN ngày nhỏ hơn ngày hiện tại + 2 giờ THEN chặn submit và hiển thị lỗi
**Business Rules:**
- BR-FT-001: Ngày bay không được nhỏ hơn ngày hiện tại + 2 giờ
- BR-FT-002: Số lượng người từ 1 đến 10

### 3.2 Thanh toán
#### FR-FT-002: Thanh toán và xác nhận
**Mô tả:** User thanh toán qua Momo hoặc thẻ Visa.
**Acceptance Criteria:**
- GIVEN booking đã tạo WHEN thanh toán thành công THEN chuyển trạng thái booking sang "confirmed" và gửi email + SMS kèm mã QR
- GIVEN booking đã tạo WHEN thanh toán thất bại THEN giữ trạng thái "pending" và cho phép thử lại
**Business Rules:**
- BR-FT-003: [CẦN XÁC NHẬN] Booking "pending" quá bao lâu không thanh toán thì bị tự hủy — mốc thời gian cụ thể chưa được cung cấp

## 4. Yêu cầu phi chức năng
### 4.1 Performance
[CẦN XÁC NHẬN] Chưa có SLA cụ thể cho thời gian phản hồi thanh toán.
### 4.2 Security
Không lưu thông tin thẻ thanh toán trên hệ thống, chuyển tiếp qua cổng thanh toán.
### 4.3 Usability / UX
[CẦN XÁC NHẬN] Không có wireframe/mockup, phần này chỉ suy luận từ mô tả text.
### 4.4 Compatibility
[CẦN XÁC NHẬN] Chưa có thông tin về nền tảng (web/app) và trình duyệt/OS cần hỗ trợ.

## 5. Đặc tả UI/UX
[CẦN XÁC NHẬN] Không có wireframe/mockup đính kèm, phần này chỉ suy luận từ mô tả text nên chưa có bảng element chi tiết.

## 6. Đặc tả tích hợp & API
### 6.1 External dependencies
Cổng thanh toán Momo, cổng thanh toán Visa, dịch vụ gửi email/SMS.
### 6.2 API contracts (tóm tắt)
Chưa có thông tin API — cần bổ sung sau khi dev thiết kế endpoint.
### 6.3 Data flow
[CẦN XÁC NHẬN] Chưa rõ hệ thống nào phát hành mã QR (nội bộ hay đối tác sân bay).

## 7. Glossary
| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| Fast Track | Dịch vụ ưu tiên làm thủ tục tại sân bay |
| Booking | Đơn đặt dịch vụ Fast Track của user |

## 8. Điểm chưa rõ — Cần xác nhận
| # | Nội dung cần xác nhận | Ảnh hưởng đến | Người cần hỏi |
|---|------------------------|----------------|-----------------|
| 1 | Danh sách chính xác 10 sân bay | Dropdown chọn sân bay (FR-FT-001) | Product Owner |
| 2 | Mốc thời gian tự hủy booking "pending" | BR-FT-003 | Product Owner |
| 3 | Nền tảng/trình duyệt cần hỗ trợ | Section 4.4 Compatibility | Product Owner |

## 9. Checklist cho QA
- [ ] Kiểm tra boundary số lượng người (0, 1, 10, 11)
- [ ] Kiểm tra validation ngày giờ bay quá khứ / sát giờ
- [ ] Kiểm tra luồng hủy và hoàn tiền 70%
- [ ] Kiểm tra booking "pending" khi thanh toán thất bại/timeout
- [ ] Kiểm tra không có thông tin thẻ thanh toán bị lưu/log lại phía hệ thống`,
  testcase: JSON.stringify({
    summary: 'Demo test cases cho đăng nhập',
    total: 3,
    testCases: [
      {
        id: 'TC-001',
        module: 'Auth',
        name: 'Đăng nhập thành công với tài khoản hợp lệ',
        type: 'Positive',
        priority: 'High',
        suite: 'Smoke',
        automationCandidate: 'Yes',
        traceTo: 'AC-LOGIN-01',
        preconditions: 'Tài khoản tồn tại và chưa bị khóa',
        steps: ['Mở trang đăng nhập', 'Nhập email hợp lệ', 'Nhập mật khẩu đúng', 'Click Đăng nhập'],
        testData: 'test@example.com / Test@123',
        expectedResult: 'Chuyển tới Dashboard và hiển thị tên user',
      },
      {
        id: 'TC-002',
        module: 'Auth',
        name: 'Đăng nhập thất bại khi mật khẩu sai',
        type: 'Negative',
        priority: 'High',
        suite: 'Regression',
        automationCandidate: 'Yes',
        traceTo: 'BR-LOGIN-ERR',
        preconditions: 'Tài khoản tồn tại',
        steps: ['Mở trang đăng nhập', 'Nhập email hợp lệ', 'Nhập mật khẩu sai', 'Click Đăng nhập'],
        testData: 'WrongPass123',
        expectedResult: 'Hiển thị lỗi và không chuyển trang',
      },
      {
        id: 'TC-003',
        module: 'Auth',
        name: 'Khóa tài khoản sau 3 lần nhập sai',
        type: 'Edge Case',
        priority: 'High',
        suite: 'Regression',
        automationCandidate: 'Yes',
        traceTo: 'BR-LOCK-01',
        preconditions: 'Tài khoản chưa bị khóa',
        steps: ['Nhập sai mật khẩu lần 1', 'Nhập sai mật khẩu lần 2', 'Nhập sai mật khẩu lần 3'],
        testData: '3 lần nhập sai liên tiếp',
        expectedResult: 'Tài khoản bị khóa 15 phút',
      },
    ],
  }),
  apitest: '{\n  "info": { "name": "Auth API Test Suite" },\n  "item": [\n    { "name": "Login success returns 200 and token" },\n    { "name": "Wrong password returns 401" },\n    { "name": "Missing email returns 400" }\n  ]\n}',
  uitest: "import { test, expect } from '@playwright/test';\n\ntest('login success', async ({ page }) => {\n  await page.goto('https://example.com/login');\n  await page.fill('#email', 'test@example.com');\n  await page.fill('#password', 'Test@123');\n  await page.click('button[type=\"submit\"]');\n  await expect(page).toHaveURL(/dashboard/);\n});",
  buganalyzer: '## Phân tích Root Cause\nToken có thể chỉ được lưu trong memory nên mất sau refresh.\n\n## Test Cases bổ sung\n- Refresh sau login\n- Hard refresh\n- So sánh Chrome và Firefox',
  security: '## Security Test Checklist\n- [ ] Reject file .php đổi đuôi .jpg. Severity: Critical\n- [ ] User A không download file của User B. Severity: High\n- [ ] Escape filename khi render. Severity: Medium',
  performance: '## Performance Test Plan\n\n### Scenarios\n| Scenario | Users | Duration |\n|---|---:|---|\n| Load | 500 | 30m |\n| Stress | 1500 | 15m |\n\n### KPI\nP95 < 2s, error rate < 0.1%.',
};
