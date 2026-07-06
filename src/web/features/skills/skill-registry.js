export const SKILLS = {
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
- Priority focus: ${options.priority}.
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
};

export const EXAMPLES = {
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
