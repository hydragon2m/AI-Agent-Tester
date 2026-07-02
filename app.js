// ============================================================
//  AI QA ASSISTANT — app.js
//  Main application logic: API calls, skill routing, UI
// ============================================================

/* ── State ─────────────────────────────────────────────── */
const STATE = {
  // Legacy single key (kept for backward compat)
  apiKey: localStorage.getItem('qa_api_key') || '',
  provider: localStorage.getItem('qa_provider') || 'gemini',
  // Multi-provider config
  providers: JSON.parse(localStorage.getItem('qa_providers') || JSON.stringify({
    gemini: { key: localStorage.getItem('qa_api_key') || '', enabled: true },
    claude: { key: '', enabled: false },
    openai: { key: '', enabled: false },
  })),
  activeSkill: 'testcase',
  larkMapping: JSON.parse(localStorage.getItem('qa_lark_mapping') || JSON.stringify({
    priority: { high: '', medium: '', low: '' },
    type: { positive: '', negative: '', edge: '', ui: '', security: '', performance: '' }
  })),
  history: JSON.parse(localStorage.getItem('qa_history') || '[]'),
  generating: false,
  activeProvider: null,
  demoMode: false,
};

/* ── Project State ──────────────────────────────────────── */
const PROJECT_STATE = {
  projects: JSON.parse(localStorage.getItem('qa_projects') || '[]'),
  activeId: localStorage.getItem('qa_active_project') || null,

  get active() {
    return this.projects.find(p => p.id === this.activeId) || null;
  },

  save() {
    localStorage.setItem('qa_projects', JSON.stringify(this.projects));
    localStorage.setItem('qa_active_project', this.activeId || '');
  },

  create(data) {
    const project = {
      id: `proj_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...data,
    };
    this.projects.push(project);
    this.activeId = project.id;
    this.save();
    return project;
  },

  update(id, data) {
    const idx = this.projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.projects[idx] = { ...this.projects[idx], ...data, updatedAt: new Date().toISOString() };
      this.save();
    }
  },

  delete(id) {
    this.projects = this.projects.filter(p => p.id !== id);
    if (this.activeId === id) {
      this.activeId = this.projects[0]?.id || null;
    }
    this.save();
  },

  setActive(id) {
    this.activeId = id;
    localStorage.setItem('qa_active_project', id || '');
  },
};


/* ── DOM Helpers ────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showToast(msg, type = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function showLoading(text = 'AI đang phân tích...') {
  $('#loading-text').textContent = text;
  $('#loading-overlay').style.display = 'flex';
}

function hideLoading() {
  $('#loading-overlay').style.display = 'none';
}
/* ── API Status ─────────────────────────────────────────── */
const PROVIDER_META = {
  gemini: { label: 'Gemini', emoji: '🟢', color: '#10b981' },
  claude: { label: 'Claude', emoji: '🟣', color: '#8b5cf6' },
  openai: { label: 'GPT-4o', emoji: '🔵', color: '#3b82f6' },
};

function updateApiStatus(activeProvider = null) {
  const el = $('#api-status');
  const txt = $('#status-text');
  const dot = el.querySelector('.status-dot');
  const anyEnabled = Object.values(STATE.providers).some(p => p.enabled && p.key);

  if (STATE.demoMode) {
    el.classList.add('connected');
    txt.textContent = '🎮 Demo Mode';
    txt.style.color = '#fbbf24';
    dot.style.background = '#f59e0b';
    return;
  }

  if (anyEnabled) {
    el.classList.add('connected');
    const prov = activeProvider || Object.keys(STATE.providers).find(k => STATE.providers[k].enabled && STATE.providers[k].key);
    const meta = PROVIDER_META[prov] || PROVIDER_META.gemini;
    txt.textContent = `${meta.emoji} ${meta.label} connected`;
    txt.style.color = '';
    dot.style.background = meta.color;
  } else {
    el.classList.remove('connected');
    txt.textContent = 'Chưa cấu hình';
    txt.style.color = '';
    dot.style.background = '';
  }
}

/* ── Gemini API Call ────────────────────────────────────── */
async function callGemini(systemPrompt, userContent, retryCount = 0) {
  const key = STATE.providers.gemini?.key;
  if (!key) throw new Error('NO_KEY_GEMINI');

  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
  const model = MODELS[Math.min(retryCount, MODELS.length - 1)];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 8192 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    const isRetryable = res.status === 429 || res.status === 404
      || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')
      || errMsg.includes('not found') || errMsg.includes('not supported');

    if (isRetryable && retryCount < MODELS.length - 1) {
      showToast(`⏳ Thử model ${MODELS[retryCount + 1]}...`, 'info');
      await new Promise(r => setTimeout(r, 1500));
      return callGemini(systemPrompt, userContent, retryCount + 1);
    }
    const isQuota = res.status === 429 || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
    throw new Error(isQuota ? 'QUOTA_EXCEEDED' : errMsg);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/* ── Claude API Call ────────────────────────────────────── */
async function callClaude(systemPrompt, userContent) {
  const key = STATE.providers.claude?.key;
  if (!key) throw new Error('NO_KEY_CLAUDE');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    const isQuota = res.status === 429 || errMsg.includes('credit') || errMsg.includes('quota');
    throw new Error(isQuota ? 'QUOTA_EXCEEDED' : errMsg);
  }

  const data = await res.json();
  const textBlock = data.content?.find(b => b.type === 'text');
  return textBlock?.text || '';
}

/* ── OpenAI API Call ────────────────────────────────────── */
async function callOpenAI(systemPrompt, userContent, retryCount = 0) {
  const key = STATE.providers.openai?.key;
  if (!key) throw new Error('NO_KEY_OPENAI');

  const MODELS = ['gpt-4o', 'gpt-4o-mini'];
  const model = MODELS[Math.min(retryCount, MODELS.length - 1)];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const errMsg = err?.error?.message || `HTTP ${res.status}`;
    const isRetryable = res.status === 429 || errMsg.includes('quota');
    if (isRetryable && retryCount < MODELS.length - 1) {
      showToast(`⏳ Thử model ${MODELS[retryCount + 1]}...`, 'info');
      await new Promise(r => setTimeout(r, 1500));
      return callOpenAI(systemPrompt, userContent, retryCount + 1);
    }
    throw new Error(isRetryable ? 'QUOTA_EXCEEDED' : errMsg);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ── Smart AI Router with Auto-Fallback ─────────────────── */
async function callAI(systemPrompt, userContent) {
  // Build ordered list of enabled providers with keys
  const ORDER = ['gemini', 'claude', 'openai'];
  const available = ORDER.filter(p => STATE.providers[p]?.enabled && STATE.providers[p]?.key);

  if (available.length === 0) {
    showToast('⚠️ Chưa cấu hình API Key nào! Vào ⚙️ Settings để thêm key.', 'error');
    openSettings();
    throw new Error('No API key');
  }

  let lastError = null;
  for (const provider of available) {
    try {
      updateApiStatus(provider);
      showLoading(`🤖 ${PROVIDER_META[provider].label} đang phân tích...`);
      let result;
      if (provider === 'gemini') result = await callGemini(systemPrompt, userContent);
      else if (provider === 'claude') result = await callClaude(systemPrompt, userContent);
      else if (provider === 'openai') result = await callOpenAI(systemPrompt, userContent);

      STATE.activeProvider = provider;
      updateApiStatus(provider);
      return result;
    } catch (e) {
      lastError = e;
      const isExhausted = e.message === 'QUOTA_EXCEEDED' || e.message.includes('NO_KEY');
      if (isExhausted) {
        const nextIdx = available.indexOf(provider) + 1;
        if (nextIdx < available.length) {
          const next = PROVIDER_META[available[nextIdx]].label;
          showToast(`⚡ ${PROVIDER_META[provider].label} hết quota → chuyển sang ${next}...`, 'info');
          await new Promise(r => setTimeout(r, 1000));
          continue; // try next provider
        }
      } else {
        throw e; // non-quota error, don't fallback
      }
    }
  }

  // All providers exhausted
  showQuotaError();
  throw new Error('ALL_PROVIDERS_EXHAUSTED');
}

/* ── Skill Prompts ──────────────────────────────────────── */
const SKILLS = {

  testcase: {
    system: `Bạn là Senior QA Engineer 10+ năm kinh nghiệm, chuyên gia thiết kế test case theo chuẩn ISTQB và IEEE 829. Bạn viết test case chặt chẽ, phủ rủi ro, sẵn sàng đưa vào thực thi ngay.

# NHIỆM VỤ
Đọc kỹ ĐẶC TẢ CHỨC NĂNG (functional spec / rule) mà người dùng cung cấp trong tin nhắn. Sau khi hoàn tất tư duy nội bộ, sinh ra một bộ test case đầy đủ, chất lượng cao, với BỘ TRƯỜNG ĐÚNG BẰNG các cột lưu trữ (xem schema) để dữ liệu map 1-1 sang bảng quản lý / Excel / Lark Base.

# QUY TRÌNH TƯ DUY (thực hiện trong nội bộ — KHÔNG in ra ngoài)
1. Hiểu chức năng: mục tiêu, actor/người dùng, luồng chính và luồng phụ.
2. Bóc tách điểm kiểm thử: từng AC, từng BR, từng trường nhập liệu, luồng lỗi.
3. Áp dụng kỹ thuật: Equivalence Partitioning, Boundary Value Analysis, Decision Table, State Transition, Error Guessing.
4. Lập ma trận phủ: đảm bảo MỖI AC và MỖI BR có ít nhất 1 test case.
5. Chấm độ ưu tiên theo rủi ro.

# NGUYÊN TẮC BÓC TÁCH & ĐẶT TÊN (BẮT BUỘC)
- CẤM gộp chung nhiều hành vi verify hoặc nhiều trường hợp kiểm tra vào cùng một Test Case (ví dụ: gộp cả check link và check nội dung sau điều hướng). Mỗi Test Case phải là một trường hợp kiểm thử đơn nhất, cực kỳ chi tiết (Granular).
- Các trường hợp phức tạp (như điều hướng, validate dữ liệu) PHẢI được phân rã (split) thành các test case con riêng biệt. Ví dụ:
  * "Kiểm tra tính đúng đắn của URL liên kết"
  * "Kiểm tra chuyển hướng đến đúng giao diện trang đích"
  * "Kiểm tra các tham số URL đi kèm khi điều hướng"
- Đặt tên Test Case (name) rõ ràng, phản ánh đúng khía cạnh kiểm thử nhỏ nhất và nên có tiền tố phân cấp để dễ phân loại trong danh sách. Ví dụ:
  * '[Điều hướng] - Kiểm tra URL liên kết'
  * '[Điều hướng] - Kiểm tra chuyển hướng trang đích'
  * '[Validation] - Bỏ trống trường Email'
  * '[Validation] - Nhập email sai định dạng'

# NGUYÊN TẮC CHẤT LƯỢNG
- Atomic & Independent.
- Steps cụ thể, actionable.
- Expected result đo được/verify được.
- Test data thực tế.
- Traceability: mỗi test case ghi rõ nó kiểm AC/BR nào (trường "traceTo").

# ĐỘ PHỦ BẮT BUỘC
Positive, Negative, Boundary, Business rule, Error/exception flow. Nếu spec đề cập: phân quyền, bảo mật, UI/UX.

# TRƯỜNG DỮ LIỆU & QUY TẮC LƯU TRỮ
Chỉ sinh các trường nội dung (content fields). KHÔNG sinh các trường thực thi (execution fields: status, actualResult, relatedBug) — để hệ thống tự điền.
Thứ tự key bắt buộc: id, module, name, type, priority, suite, automationCandidate, traceTo, preconditions, steps, testData, expectedResult.

# GIÁ TRỊ HỢP LỆ CHO SINGLE-SELECT FIELDS (phải khớp chính xác)
- type: Positive | Negative | Boundary | Edge Case | Security | UI/UX
- priority: High | Medium | Low
- suite: Smoke | Regression | New Feature | Exploratory
- automationCandidate: Yes | No

# ĐỊNH DẠNG OUTPUT — BẮT BUỘC
- TRỰC TIẾP trả về kết quả dưới dạng văn bản (text). CẤM sử dụng Analysis Tool (không chạy code Python hoặc bash ngầm).
- Chỉ trả về duy nhất 1 block JSON trong thẻ \`\`\`json. Không viết thêm lời dẫn mở đầu hoặc kết thúc:
\`\`\`json
{
  "summary": "Brief summary of covered scope",
  "assumptions": [],
  "openQuestions": [],
  "total": 0,
  "testCases": [
    {
      "id": "TC-001",
      "module": "Feature area / sub-flow (e.g. Forgot Password - Email Input)",
      "name": "Short test case name",
      "type": "Positive",
      "priority": "High",
      "suite": "Regression",
      "automationCandidate": "Yes",
      "traceTo": "AC-01 / BR-01",
      "preconditions": "Required conditions",
      "steps": ["Step 1...", "Step 2..."],
      "testData": "",
      "expectedResult": "Expected outcome"
    }
  ]
}
\`\`\``,
    buildPrompt(input, priority, types) {
      const activeTypes = [...$$('#test-type-group .toggle-btn.active')].map(b => b.dataset.type).join(', ');
      return `ĐẶC TẢ CHỨC NĂNG (Functional Spec / Rule):
---
${input}
---
Yêu cầu bổ sung:
- Priority focus: ${priority}
- Test types mong muốn (để ưu tiên phủ): ${activeTypes || 'Functional, Negative, Edge Case'}
- Ngôn ngữ: Tiếng Việt cho steps và descriptions
- Số lượng: Tối đa 20 test cases bao phủ đầy đủ các trường hợp quan trọng để tránh quá tải dữ liệu.`;
    }
  },

  apitest: {
    system: `Bạn là Senior API Test Engineer, chuyên gia về REST API testing.

Nhiệm vụ: Đọc API specification và sinh test cases + script hoàn chỉnh.

Nếu format là Postman: Trả về JSON Postman collection hợp lệ (v2.1).
Nếu format khác: Trả về code script rõ ràng, có comments, có assertions.

Bao gồm các loại test:
1. Happy path (status 2xx)
2. Validation errors (status 4xx)
3. Authorization tests
4. Edge cases (empty body, special chars, large payload)
5. Response schema validation

Thêm comments giải thích từng test.`,

    buildPrompt(input, format) {
      return `API Specification:
---
${input}
---
Output format: ${format}
Sinh đầy đủ test cases bao gồm assertions và test data.`;
    }
  },

  uitest: {
    system: `Bạn là Senior Automation Engineer, chuyên gia Playwright.

Nhiệm vụ: Sinh Playwright test script hoàn chỉnh, production-ready.

Yêu cầu bắt buộc:
- Dùng Page Object Model pattern
- Thêm proper waits (waitForSelector, waitForNavigation...)  
- Thêm meaningful assertions (expect)
- Xử lý error cases
- Thêm comments giải thích
- Import đúng từ @playwright/test

Trả về code ONLY, không thêm markdown fences hay text giải thích.`,

    buildPrompt(input, browser, lang) {
      return `UI Flow cần automate:
---
${input}
---
Browser: ${browser}
Language: ${lang}
Sinh script đầy đủ với Page Object Model.`;
    }
  },

  buganalyzer: {
    system: `Bạn là Senior QA Engineer và Bug Analyst có kinh nghiệm.

Khi nhận bug report, hãy phân tích và trả về theo format markdown:

## 🔍 Phân tích Root Cause
[Giải thích nguyên nhân có thể gây ra bug này]

## 🎯 Các khu vực bị ảnh hưởng
[Liệt kê các module/feature có thể liên quan]

## 🧪 Test Cases bổ sung
[Sinh thêm 5-8 test case để verify bug và tránh regression]

## 🔧 Gợi ý kiểm tra
[Các bước cụ thể để reproduce và verify fix]

## ⚠️ Rủi ro Regression
[Những gì khác có thể bị ảnh hưởng khi fix bug này]

Phân tích bằng tiếng Việt, chuyên nghiệp và thực tế.`,

    buildPrompt(input) {
      return `Bug Report:
---
${input}
---
Phân tích chi tiết và đưa ra hướng xử lý.`;
    }
  },

  security: {
    system: `Bạn là Security QA Engineer, chuyên gia OWASP Top 10 và penetration testing.

Nhiệm vụ: Sinh security test checklist chi tiết.
Trả về theo format markdown với checkboxes:

## 🛡️ Security Test Checklist — [Name tính năng]

### 1. [Loại rủi ro theo OWASP]
- [ ] Test case 1
- [ ] Test case 2

Các category cần cover:
- Input Validation & Injection
- Authentication & Authorization  
- Data Exposure
- File Upload Security (nếu có)
- CSRF & XSS
- API Security
- Session Management
- Error Handling & Logging

Mỗi item phải có: mô tả ngắn + expected behavior + severity (Critical/High/Medium/Low)`,

    buildPrompt(input) {
      return `Tính năng cần security test:
---
${input}
---
Sinh checklist bảo mật đầy đủ theo OWASP Top 10.`;
    }
  },

  performance: {
    system: `Bạn là Performance Engineer, chuyên gia về load testing và performance optimization.

Nhiệm vụ: Lên kế hoạch performance test chi tiết.
Trả về markdown với:

## 📊 Performance Test Plan — [Name hệ thống]

### Test Scenarios
[Các kịch bản test với user count cụ thể]

### Load Profile
[Ramp-up, steady state, ramp-down schedule]

### KPIs & Thresholds
[Metrics cụ thể cần đạt: response time, throughput, error rate]

### Test Script Outline (k6/JMeter)
[Code skeleton cho tool phổ biến]

### Bottleneck Checklist
[Những điểm cần monitor trong khi test]

Cụ thể, có numbers, professional.`,

    buildPrompt(input) {
      return `Thông tin hệ thống:
---
${input}
---
Lên kế hoạch performance test đầy đủ.`;
    }
  }
};

/* ── Example Data ───────────────────────────────────────── */
const EXAMPLES = {
  testcase: `Tính năng: Đăng nhập hệ thống

Mô tả:
- Người dùng nhập email và mật khẩu để đăng nhập
- Email phải đúng định dạng (có @)
- Mật khẩu tối thiểu 6 ký tự
- Nếu thông tin đúng: chuyển đến trang Dashboard và hiển thị tên user
- Nếu sai email/password: hiện thông báo "Email hoặc mật khẩu không đúng"
- Nếu sai 3 lần liên tiếp: khóa tài khoản 15 phút và hiện thông báo
- Có checkbox "Ghi nhớ đăng nhập" (remember me)
- Có link "Quên mật khẩu" chuyển sang trang reset`,

  apitest: `POST /api/v1/auth/login

Headers:
  Content-Type: application/json

Request Body:
  {
    "email": "string (required, valid email format)",
    "password": "string (required, min 6 chars)"
  }

Response 200 (Success):
  {
    "success": true,
    "token": "JWT string",
    "refreshToken": "string",
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "user|admin"
    },
    "expiresIn": 3600
  }

Response 400 (Validation Error):
  { "success": false, "message": "Validation failed", "errors": [] }

Response 401 (Wrong credentials):
  { "success": false, "message": "Invalid email or password" }

Response 423 (Account locked):
  { "success": false, "message": "Account locked. Try again in 15 minutes" }

Response 429 (Rate limit):
  { "success": false, "message": "Too many requests" }`,

  uitest: `URL: https://example.com/login
Mô tả flow test đăng nhập thành công:

1. Mở trình duyệt và truy cập URL https://example.com/login
2. Kiểm tra trang login hiển thị đúng (có title "Đăng nhập")
3. Kiểm tra có 2 input field: email (#email) và password (#password)
4. Nhập email hợp lệ: "testuser@example.com" vào field email
5. Nhập mật khẩu: "Test@123456" vào field password
6. Click button "Đăng nhập" (button[type="submit"])
7. Chờ redirect về trang /dashboard
8. Kiểm tra URL chứa "/dashboard"
9. Kiểm tra header hiển thị tên user "Test User"
10. Kiểm tra có button "Đăng xuất" ở góc trên phải`,

  buganalyzer: `Bug ID: BUG-2341
Tiêu đề: Session bị mất sau khi refresh trang

Mô tả:
Sau khi đăng nhập thành công, nếu người dùng nhấn F5 (refresh) trang Dashboard, 
hệ thống tự động redirect về trang login mà không có bất kỳ cảnh báo nào.

Environment:
- Browser: Chrome 120.0.6099.130 (Windows 11)
- URL: https://app.example.com/dashboard
- User role: Regular user

Steps to Reproduce:
1. Truy cập https://app.example.com/login
2. Đăng nhập với tài khoản hợp lệ
3. Quan sát đã vào được Dashboard
4. Nhấn F5 hoặc click nút refresh của browser
5. Quan sát bị redirect về trang Login

Expected: Vẫn ở trạng thái đăng nhập, trang refresh bình thường
Actual: Bị logout và redirect về /login

Note: Vấn đề không xảy ra khi dùng Firefox, chỉ xảy ra trên Chrome`,

  security: `Tính năng: Upload và quản lý file đính kèm

Mô tả:
- User có thể upload file: PDF, Word, Excel, JPG, PNG
- Giới hạn kích thước: 10MB/file, tối đa 5 file
- File được lưu trên server (thư mục /uploads)
- File URL format: https://app.com/uploads/{filename}
- Mọi user đã đăng nhập đều có thể download file
- Chỉ admin mới xóa được file`,

  performance: `Hệ thống: Nền tảng bán hàng online (E-commerce)

Thông tin hiện tại:
- Infrastructure: AWS EC2 t3.medium, RDS PostgreSQL
- Peak hours: 8AM-10AM và 8PM-11PM (giờ Việt Nam)
- Current users: 5,000 DAU, dự kiến tăng 3x sau campaign

Critical Endpoints:
- GET /api/products (trang danh sách sản phẩm - 80% traffic)
- POST /api/cart/add (thêm vào giỏ hàng)
- POST /api/orders (đặt hàng - critical)
- GET /api/orders/{id} (kiểm tra trạng thái đơn)

SLA yêu cầu:
- Response time P95 < 2 giây
- Availability ≥ 99.9%
- Error rate < 0.1%
- Hệ thống phải chịu được 500 concurrent users`
};

/* ── Build Project Context for AI Prompts ───────────────── */
function buildProjectContext(project = PROJECT_STATE.active) {
  const treeContext = buildActiveTreeContext();
  if (!project && !treeContext) return '';
  const parts = [];
  if (project?.stack)     parts.push(`Tech stack: ${project.stack}`);
  if (project?.framework) parts.push(`Test framework: ${project.framework}`);
  if (project?.url)       parts.push(`Staging URL: ${project.url}`);
  if (project?.api)       parts.push(`API base: ${project.api}`);
  if (project?.admin)     parts.push(`Admin account: ${project.admin}`);
  if (project?.user)      parts.push(`User account: ${project.user}`);
  if (project?.modules)   parts.push(`Modules: ${project.modules}`);
  if (project?.prefix)    parts.push(`Bug/TC ID prefix: ${project.prefix}`);
  if (project?.notes)     parts.push(`Save ý đặc biệt: ${project.notes}`);
  if (treeContext)        parts.push(treeContext);

  if (parts.length === 0) return '';
  const title = project?.name || 'Selected Tree Node';
  return `\n=== PROJECT CONTEXT — ${title} ===\n${parts.join('\n')}\n=== END CONTEXT ===\nMọi output PHẢI sử dụng thông tin project ở trên (URL, account, prefix, tech stack...).\nKhông dùng placeholder giả chung chung.\n\n`;
}

function buildActiveTreeContext() {
  if (!activeNodeId || !Array.isArray(treeData)) return '';
  const path = [];
  let curr = treeData.find(n => n.id === activeNodeId);
  while (curr) {
    path.unshift(curr);
    curr = treeData.find(n => n.id === curr.parentId);
  }
  if (path.length === 0) return '';
  return [
    `Selected tree path: ${path.map(n => `${n.type}:${n.name}`).join(' > ')}`,
    ...path.filter(n => n.context).map(n => `${n.type} context (${n.name}): ${n.context}`),
  ].join('\n');
}

function normalizeTestCasePayload(data) {
  if (typeof data !== 'string') return data;
  const jsonMatch = data.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, data];
  return JSON.parse(jsonMatch[1] || data);
}

/* ── Render Project Sidebar List ────────────────────────── */
function renderProjectList() {
  /* Disabled to prevent Tree View overwrite */
}

/* ── Select Project ─────────────────────────────────────── */
function selectProject(id) {
  PROJECT_STATE.setActive(id);
  renderProjectList();
  showToast(`✅ Selected project: ${PROJECT_STATE.active?.name}`, 'success');
}

/* ── Update Context Badges in all skill panels ──────────── */
function updateContextBadges(project) {
  const SKILL_IDS = ['testcase', 'apitest', 'uitest', 'buganalyzer', 'security', 'performance'];
  SKILL_IDS.forEach(skill => {
    const badge = $(`#ctx-${skill}`);
    if (!badge) return;

    if (!project) {
      badge.className = 'context-badge';
      badge.innerHTML = '';
      return;
    }

    const chips = [];
    if (project.stack)     chips.push(`<span class="ctx-chip">⚙️ ${escapeHtml(project.stack.split('+')[0].trim())}</span>`);
    if (project.url)       chips.push(`<span class="ctx-chip">🌐 ${escapeHtml(project.url)}</span>`);
    if (project.prefix)    chips.push(`<span class="ctx-chip">🏷️ ${escapeHtml(project.prefix)}</span>`);
    if (project.modules)   chips.push(`<span class="ctx-chip">📦 ${escapeHtml(project.modules.split(',').slice(0,3).join(', '))}</span>`);

    badge.className = 'context-badge visible';
    badge.innerHTML = `
      <span class="ctx-project-name">📁 ${escapeHtml(project.name)}</span>
      <span class="ctx-chips">${chips.join('')}</span>
      <button class="ctx-edit-btn" onclick="openProjectModal('${escapeHtml(project.id)}')">✏️ Sửa context</button>
    `;
  });
}

/* ── Project Modal ──────────────────────────────────────── */
let _editingProjectId = null;

function openProjectModal(projectId = null) {
  _editingProjectId = projectId;
  const modal = $('#modal-project');
  const title = $('#project-modal-title');
  const deleteBtn = $('#btn-delete-project');

  if (projectId) {
    const p = PROJECT_STATE.projects.find(x => x.id === projectId);
    title.textContent = '✏️ Chỉnh sửa Project';
    deleteBtn.style.display = 'block';
    // Fill form — new simplified format
    $('#pf-name').value = p?.name || '';
    $('#pf-context').value = p?.context || p?.notes || '';
    // Advanced fields
    $('#pf-stack').value = p?.stack || '';
    $('#pf-framework').value = p?.framework || '';
    $('#pf-url').value = p?.url || '';
    $('#pf-api').value = p?.api || '';
    $('#pf-prefix').value = p?.prefix || '';
    $('#pf-modules').value = p?.modules || '';
    // Auto-open advanced if any advanced field has data
    const hasAdv = p?.stack || p?.framework || p?.url || p?.api || p?.prefix || p?.modules;
    if (hasAdv) $('#pf-advanced').open = true;
  } else {
    title.textContent = '📁 Create Project';
    deleteBtn.style.display = 'none';
    // Clear form
    ['pf-name','pf-context','pf-stack','pf-framework',
     'pf-url','pf-api','pf-prefix','pf-modules'].forEach(id => {
      const el = $(`#${id}`);
      if (el) el.value = '';
    });
    const adv = $('#pf-advanced');
    if (adv) adv.open = false;
  }
  modal.style.display = 'flex';
  $('#pf-name').focus();
}

function closeProjectModal() {
  $('#modal-project').style.display = 'none';
  _editingProjectId = null;
}

$('#btn-new-project').addEventListener('click', () => {
  if (typeof openAddNodeModal === 'function') {
    openAddNodeModal(null, 'project');
  } else {
    openProjectModal(null);
  }
});
$('#close-project-modal').addEventListener('click', closeProjectModal);
$('#cancel-project-modal').addEventListener('click', closeProjectModal);
$('#modal-project').addEventListener('click', (e) => { if (e.target === $('#modal-project')) closeProjectModal(); });

$('#save-project-modal').addEventListener('click', () => {
  let name = $('#pf-name').value.trim();
  if (!name) name = 'Project không tên';

  const data = {
    name,
    context:   $('#pf-context').value.trim(),   // free-form context
    stack:     $('#pf-stack')?.value.trim() || '',
    framework: $('#pf-framework')?.value.trim() || '',
    url:       $('#pf-url')?.value.trim() || '',
    api:       $('#pf-api')?.value.trim() || '',
    prefix:    $('#pf-prefix')?.value.trim() || '',
    modules:   $('#pf-modules')?.value.trim() || '',
  };

  if (_editingProjectId) {
    PROJECT_STATE.update(_editingProjectId, data);
    showToast(`✅ Đã cập nhật project: ${name}`, 'success');
  } else {
    PROJECT_STATE.create(data);
    showToast(`🎉 Đã tạo project: ${name}`, 'success');
  }

  closeProjectModal();
  renderProjectList();
});

$('#btn-delete-project').addEventListener('click', () => {
  if (!_editingProjectId) return;
  const p = PROJECT_STATE.projects.find(x => x.id === _editingProjectId);
  if (!confirm(`Delete project "${p?.name}"? Hành động này không thể hoàn tác.`)) return;
  PROJECT_STATE.delete(_editingProjectId);
  closeProjectModal();
  renderProjectList();
  showToast('🗑️ Đã xóa project', 'info');
});

/* ── Export / Import Projects ───────────────────────────── */
$('#btn-export-projects').addEventListener('click', () => {
  const data = JSON.stringify({ version: 1, projects: PROJECT_STATE.projects }, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = `qa-projects-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('⬇️ Đã export projects!', 'success');
});

$('#import-projects-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const json = JSON.parse(ev.target.result);
      const imported = json.projects || json;
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      // Merge (avoid duplicate IDs)
      const existingIds = new Set(PROJECT_STATE.projects.map(p => p.id));
      const newProjects = imported.filter(p => !existingIds.has(p.id));
      PROJECT_STATE.projects.push(...newProjects);
      PROJECT_STATE.save();
      renderProjectList();
      showToast(`⬆️ Đã import ${newProjects.length} projects!`, 'success');
    } catch {
      showToast('❌ File không hợp lệ!', 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

/* ── Settings Modal ─────────────────────────────────────── */
function openSettings() {
  const modal = $('#modal-settings');
  modal.style.display = 'flex';
  // Load saved values into form
  const p = STATE.providers;
  $('#key-gemini').value = p.gemini?.key || '';
  $('#key-claude').value = p.claude?.key || '';
  $('#key-openai').value = p.openai?.key || '';
  $('#enable-gemini').checked = p.gemini?.enabled !== false;
  $('#enable-claude').checked = !!p.claude?.enabled;
  $('#enable-openai').checked = !!p.openai?.enabled;

  // Load Lark Mapping values
  const lm = STATE.larkMapping || {
    priority: { high: '', medium: '', low: '' },
    type: { positive: '', negative: '', edge: '', ui: '', security: '', performance: '' }
  };
  $('#lark-prio-high').value = lm.priority?.high || '';
  $('#lark-prio-med').value = lm.priority?.medium || '';
  $('#lark-prio-low').value = lm.priority?.low || '';
  $('#lark-type-pos').value = lm.type?.positive || '';
  $('#lark-type-neg').value = lm.type?.negative || '';
  $('#lark-type-edge').value = lm.type?.edge || '';
  $('#lark-type-ui').value = lm.type?.ui || '';
  $('#lark-type-sec').value = lm.type?.security || '';
  $('#lark-type-perf').value = lm.type?.performance || '';
}

function closeSettings() {
  $('#modal-settings').style.display = 'none';
}

$('#btn-settings').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', closeSettings);
$('#cancel-settings').addEventListener('click', closeSettings);
$('#modal-settings').addEventListener('click', (e) => { if (e.target === $('#modal-settings')) closeSettings(); });

// Generic reveal toggle for all provider key inputs
$$('.btn-reveal').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const inp = targetId ? $(`#${targetId}`) : null;
    if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
  });
});

$('#save-settings').addEventListener('click', () => {
  const newProviders = {
    gemini: { key: $('#key-gemini').value.trim(), enabled: $('#enable-gemini').checked },
    claude: { key: $('#key-claude').value.trim(), enabled: $('#enable-claude').checked },
    openai: { key: $('#key-openai').value.trim(), enabled: $('#enable-openai').checked },
  };
  STATE.providers = newProviders;
  // Also update legacy key for backward compat
  STATE.apiKey = newProviders.gemini.key || newProviders.claude.key || newProviders.openai.key;
  localStorage.setItem('qa_providers', JSON.stringify(newProviders));
  localStorage.setItem('qa_api_key', STATE.apiKey);

  // Save Lark Mapping values
  const newLarkMapping = {
    priority: {
      high: $('#lark-prio-high').value.trim(),
      medium: $('#lark-prio-med').value.trim(),
      low: $('#lark-prio-low').value.trim()
    },
    type: {
      positive: $('#lark-type-pos').value.trim(),
      negative: $('#lark-type-neg').value.trim(),
      edge: $('#lark-type-edge').value.trim(),
      ui: $('#lark-type-ui').value.trim(),
      security: $('#lark-type-sec').value.trim(),
      performance: $('#lark-type-perf').value.trim()
    }
  };
  STATE.larkMapping = newLarkMapping;
  localStorage.setItem('qa_lark_mapping', JSON.stringify(newLarkMapping));

  updateApiStatus();
  closeSettings();
  const activeCount = Object.values(newProviders).filter(p => p.enabled && p.key).length;
  showToast(`✅ Đã lưu ${activeCount} AI provider${activeCount > 1 ? ' (auto-fallback bật)' : ''}`, 'success');
});

/* ── Skill Navigation ───────────────────────────────────── */
$$('.skill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const skill = btn.dataset.skill;
    STATE.activeSkill = skill;

    $$('.skill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    $$('.skill-panel').forEach(p => p.classList.remove('active'));
    $(`#panel-${skill}`).classList.add('active');
  });
});

/* ── Toggle Buttons ─────────────────────────────────────── */
$$('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => btn.classList.toggle('active'));
});

/* ── History ────────────────────────────────────────────── */
function saveHistory(skill, summary, output) {
  const item = {
    id: Date.now(),
    skill,
    summary: summary.substring(0, 60) + (summary.length > 60 ? '...' : ''),
    timestamp: new Date().toLocaleString('vi-VN'),
    output,
  };
  STATE.history.unshift(item);
  if (STATE.history.length > 20) STATE.history.pop();
  localStorage.setItem('qa_history', JSON.stringify(STATE.history));
  renderHistory();
}

function renderHistory() {
  const container = $('#history-list');
  if (STATE.history.length === 0) {
    container.innerHTML = '<div class="history-empty">Chưa có lịch sử</div>';
    return;
  }
  container.innerHTML = STATE.history.map(item => `
    <div class="history-item" title="${escapeHtml(item.summary)}">
      <div class="history-item-title">${SKILL_ICONS[item.skill] || '📋'} ${escapeHtml(item.summary)}</div>
      <div class="history-item-meta">${escapeHtml(item.timestamp)}</div>
    </div>
  `).join('');
}
const SKILL_ICONS = {
  testcase: '📋', apitest: '🔌', uitest: '🖥️',
  buganalyzer: '🐛', security: '🔐', performance: '📊'
};

let CURRENT_TEST_CASES = null;

/* ── Test Case Renderer ─────────────────────────────────── */
function renderTestCases(data) {
  const container = $('#tc-output-content');

  let parsed;
  try {
    parsed = normalizeTestCasePayload(data);
  } catch (e) {
    // Fallback: display as markdown
    container.innerHTML = `<div class="markdown-output">${markdownToHtml(data)}</div>`;
    return;
  }

  CURRENT_TEST_CASES = parsed;
  const tcs = parsed.testCases || [];

  let html = '';
  
  // Render assumptions and openQuestions if present
  if (parsed.summary || (parsed.assumptions && parsed.assumptions.length) || (parsed.openQuestions && parsed.openQuestions.length)) {
    html += `<div style="margin-bottom:16px;padding:12px 16px;background:rgba(99,102,241,0.08);border-radius:8px;border-left:3px solid var(--primary);font-size:0.82rem;color:var(--text-secondary);">`;
    if (parsed.summary) html += `<div style="margin-bottom:8px;"><strong style="color:var(--text-primary)">📌 Tóm tắt:</strong> ${escapeHtml(parsed.summary)}</div>`;
    if (parsed.assumptions && parsed.assumptions.length) {
      html += `<div style="margin-bottom:4px;"><strong style="color:var(--text-primary)">🤔 Giả định:</strong></div><ul style="margin:0 0 8px 20px;">${parsed.assumptions.map(a => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`;
    }
    if (parsed.openQuestions && parsed.openQuestions.length) {
      html += `<div style="margin-bottom:4px;"><strong style="color:#f59e0b">❓ Câu hỏi / Điểm thiếu sót:</strong></div><ul style="margin:0 0 0 20px;">${parsed.openQuestions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}</ul>`;
    }
    html += `</div>`;
  }

  html += `<div class="tc-table-wrapper" style="overflow-x:auto; margin-top:16px; border:1px solid var(--border); border-radius:var(--radius); background:var(--bg-card);">
    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:0.85rem; color:var(--text-primary);">
      <thead>
        <tr style="background:rgba(255,255,255,0.02); border-bottom:1px solid var(--border);">
          <th style="padding:12px; font-weight:600; width:90px;">TC ID</th>
          <th style="padding:12px; font-weight:600; width:160px;">Module</th>
          <th style="padding:12px; font-weight:600; min-width:200px;">Test Case Name</th>
          <th style="padding:12px; font-weight:600; width:100px;">Type</th>
          <th style="padding:12px; font-weight:600; width:90px;">Priority</th>
          <th style="padding:12px; font-weight:600; width:100px;">Suite</th>
          <th style="padding:12px; font-weight:600; width:90px;">Automation</th>
          <th style="padding:12px; font-weight:600; width:120px;">Trace To</th>
          <th style="padding:12px; font-weight:600; min-width:160px;">Preconditions</th>
          <th style="padding:12px; font-weight:600; min-width:250px;">Steps</th>
          <th style="padding:12px; font-weight:600; min-width:220px;">Expected Result</th>
          <th style="padding:12px; font-weight:600; width:130px;">Test Data</th>
        </tr>
      </thead>
      <tbody>
        ${tcs.map(tc => {
          const priorityClass = (tc.priority || 'medium').toLowerCase();
          const stepsHtml = (tc.steps || []).map((s, idx) => `<div style="margin-bottom:4px;">${idx + 1}. ${escapeHtml(s)}</div>`).join('');
          const typeColor = {Positive:'#10b981',Negative:'#ef4444',Boundary:'#f59e0b','Edge Case':'#8b5cf6',Security:'#ec4899','UI/UX':'#06b6d4'};
          const priorityColor = {High:'#ef4444',Medium:'#f59e0b',Low:'#10b981'};
          const safeType = escapeHtml(tc.type || '-');
          const safePriority = escapeHtml(tc.priority || '-');
          return `
            <tr style="border-bottom:1px solid var(--border); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.015)'" onmouseout="this.style.background='transparent'">
              <td style="padding:12px; font-family:var(--font-mono); font-weight:600; color:var(--primary-light); vertical-align:top;">${escapeHtml(tc.id)}</td>
              <td style="padding:12px; color:var(--text-secondary); font-size:0.8rem; vertical-align:top;">${escapeHtml(tc.module || '-')}</td>
              <td style="padding:12px; font-weight:500; vertical-align:top;">${escapeHtml(tc.name)}</td>
              <td style="padding:12px; vertical-align:top;">
                <span style="font-size:0.75rem; background:${typeColor[tc.type]||'rgba(255,255,255,0.08)'}22; border:1px solid ${typeColor[tc.type]||'#475569'}55; color:${typeColor[tc.type]||'#94a3b8'}; padding:3px 8px; border-radius:20px; display:inline-block; white-space:nowrap;">${safeType}</span>
              </td>
              <td style="padding:12px; vertical-align:top;">
                <span style="font-size:0.75rem; background:${priorityColor[tc.priority]||'#47556922'}22; border:1px solid ${priorityColor[tc.priority]||'#475569'}55; color:${priorityColor[tc.priority]||'#94a3b8'}; padding:3px 8px; border-radius:20px; display:inline-block; font-weight:600;">${safePriority}</span>
              </td>
              <td style="padding:12px; color:var(--text-secondary); font-size:0.8rem; vertical-align:top;">${escapeHtml(tc.suite || '-')}</td>
              <td style="padding:12px; vertical-align:top;">
                <span style="font-size:0.75rem; color:${tc.automationCandidate==='Yes'?'#10b981':'#94a3b8'}; font-weight:600;">${escapeHtml(tc.automationCandidate || '-')}</span>
              </td>
              <td style="padding:12px; color:var(--text-muted); font-size:0.78rem; vertical-align:top;">${escapeHtml(tc.traceTo || '-')}</td>
              <td style="padding:12px; color:var(--text-secondary); font-size:0.8rem; white-space:pre-wrap; vertical-align:top;">${escapeHtml(tc.preconditions || '-')}</td>
              <td style="padding:12px; font-size:0.8rem; vertical-align:top; color:var(--text-secondary);">
                <div style="display:flex; flex-direction:column;">${stepsHtml}</div>
              </td>
              <td style="padding:12px; color:var(--green); font-size:0.8rem; white-space:pre-wrap; vertical-align:top;">${escapeHtml(tc.expectedResult)}</td>
              <td style="padding:12px; font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted); vertical-align:top;">${escapeHtml(tc.testData || '-')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>`;

  container.innerHTML = html;
  // Save parsed data so export/copy handlers can access it
  container.dataset.parsed = JSON.stringify(parsed);
}

/* ── Markdown to HTML ───────────────────────────────────── */
function markdownToHtml(md) {
  return escapeHtml(md)
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="checklist-item"><input type="checkbox"> <span>$1</span></div>')
    .replace(/^- \[x\] (.+)$/gm, '<div class="checklist-item"><input type="checkbox" checked> <span>$1</span></div>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[a-z])(.+)$/gm, (m) => m.startsWith('<') ? m : m);
}

function renderMarkdown(text, containerId) {
  const container = $(containerId);
  container.innerHTML = `<div class="markdown-output">${markdownToHtml(text)}</div>`;
}

function renderCode(text, containerId) {
  const container = $(containerId);
  // Clean markdown code fences if present
  const clean = text.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
  container.innerHTML = `<pre>${escapeHtml(clean)}</pre>`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Error Handler ─────────────────────────────────────── */
function handleApiError(e) {
  if (e.message === 'No API key') return;
  if (e.message === 'QUOTA_EXCEEDED') {
    showQuotaError();
    return;
  }
  showToast(`❌ Lỗi: ${e.message}`, 'error');
}

function showQuotaError() {
  const existing = $('#quota-error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'quota-error-banner';
  banner.innerHTML = `
    <div style="
      position:fixed; bottom:80px; right:24px; z-index:500;
      background:#1e1a2e; border:1px solid rgba(239,68,68,0.4);
      border-radius:12px; padding:16px 20px; max-width:380px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      font-family:var(--font-sans); font-size:0.82rem;
    ">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:1.1rem;">🚫</span>
        <strong style="color:#f87171;">Gemini API Quota vượt giới hạn</strong>
      </div>
      <div style="color:#94a3b8;line-height:1.6;margin-bottom:12px;">
        Free tier đã hết request. Bạn có thể:
        <ul style="margin:6px 0 0 16px;">
          <li>Dùng <strong style="color:#6ee7b7;">Demo Mode</strong> để xem kết quả mẫu</li>
          <li>Chờ ~1 phút rồi thử lại</li>
          <li>Lấy API key mới tại <a href="https://aistudio.google.com/apikey" target="_blank" style="color:#818cf8;">aistudio.google.com</a></li>
        </ul>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="enableDemoMode()" style="
          padding:7px 14px; border-radius:7px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#6366f1,#a855f7); color:white;
          font-size:0.78rem; font-weight:600;
        ">🎮 Dùng Demo Mode</button>
        <button onclick="document.getElementById('quota-error-banner').remove()" style="
          padding:7px 14px; border-radius:7px; cursor:pointer;
          background:#1a1a26; border:1px solid rgba(255,255,255,0.1);
          color:#94a3b8; font-size:0.78rem;
        ">Đóng</button>
      </div>
    </div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 30000);
}

/* ── Demo Mode ──────────────────────────────────────────── */
const DEMO_OUTPUTS = {
  testcase: JSON.stringify({
    summary: "Tính năng Đăng nhập — gồm validation email/password, xử lý sai thông tin, khóa tài khoản và quên mật khẩu",
    total: 10,
    testCases: [
      { id: "TC-001", name: "Đăng nhập thành công với email và mật khẩu hợp lệ", type: "Positive", priority: "High", preconditions: "Tài khoản tồn tại và chưa bị khóa", steps: ["Mở trang đăng nhập", "Nhập email hợp lệ: test@example.com", "Nhập mật khẩu đúng: Test@123", "Click nút 'Đăng nhập'"], expectedResult: "Chuyển hướng sang trang Dashboard, hiển thị tên người dùng ở header", testData: "Email: test@example.com | Password: Test@123" },
      { id: "TC-002", name: "Đăng nhập thất bại với mật khẩu sai", type: "Negative", priority: "High", preconditions: "Tài khoản tồn tại", steps: ["Mở trang đăng nhập", "Nhập email hợp lệ", "Nhập mật khẩu SAI: WrongPass", "Click 'Đăng nhập'"], expectedResult: "Hiển thị thông báo lỗi: 'Email hoặc mật khẩu không đúng'. Không chuyển trang.", testData: "Password sai: WrongPass123" },
      { id: "TC-003", name: "Khóa tài khoản sau 3 lần nhập sai liên tiếp", type: "Negative", priority: "High", preconditions: "Tài khoản chưa bị khóa", steps: ["Nhập mật khẩu sai lần 1 → thấy thông báo lỗi", "Nhập mật khẩu sai lần 2 → thấy thông báo lỗi", "Nhập mật khẩu sai lần 3"], expectedResult: "Tài khoản bị khóa 15 phút. Hiển thị: 'Tài khoản tạm khóa, thử lại sau 15 phút'", testData: "3 lần nhập sai liên tiếp" },
      { id: "TC-004", name: "Đăng nhập với email không đúng định dạng", type: "Negative", priority: "Medium", preconditions: "Trang đăng nhập đang mở", steps: ["Nhập email không có @: 'testexample.com'", "Nhập mật khẩu bất kỳ", "Click 'Đăng nhập'"], expectedResult: "Hiển thị lỗi validation: 'Email không đúng định dạng' ngay tại trường email", testData: "Email: testexample.com" },
      { id: "TC-005", name: "Trường email để trống", type: "Negative", priority: "High", preconditions: "Trang đăng nhập đang mở", steps: ["Bỏ trống trường email", "Nhập mật khẩu", "Click 'Đăng nhập'"], expectedResult: "Hiển thị lỗi validation: 'Vui lòng nhập email'", testData: "Email: (trống)" },
      { id: "TC-006", name: "Mật khẩu ít hơn 6 ký tự", type: "Edge Case", priority: "Medium", preconditions: "Trang đăng nhập đang mở", steps: ["Nhập email hợp lệ", "Nhập mật khẩu 5 ký tự: '12345'", "Click 'Đăng nhập'"], expectedResult: "Hiển thị lỗi: 'Mật khẩu phải có ít nhất 6 ký tự'", testData: "Password: 12345 (5 ký tự)" },
      { id: "TC-007", name: "Chức năng 'Ghi nhớ đăng nhập' hoạt động đúng", type: "Positive", priority: "Medium", preconditions: "Tài khoản hợp lệ", steps: ["Đăng nhập thành công với checkbox 'Ghi nhớ' được tick", "Đóng tab trình duyệt", "Mở lại URL hệ thống"], expectedResult: "Người dùng vẫn ở trạng thái đăng nhập, không bị redirect về trang login", testData: "Remember me: checked" },
      { id: "TC-008", name: "Link 'Quên mật khẩu' dẫn đến trang đúng", type: "Positive", priority: "Medium", preconditions: "Trang đăng nhập đang mở", steps: ["Click vào link 'Quên mật khẩu'"], expectedResult: "Chuyển sang trang /forgot-password với form nhập email", testData: "N/A" },
      { id: "TC-009", name: "Đăng nhập với tài khoản đã bị khóa", type: "Edge Case", priority: "High", preconditions: "Tài khoản đang bị khóa (đã sai 3 lần)", steps: ["Nhập đúng email và mật khẩu của tài khoản bị khóa", "Click 'Đăng nhập'"], expectedResult: "Không cho đăng nhập. Hiển thị: 'Tài khoản bị khóa, thử lại sau X phút'", testData: "Tài khoản đang bị locked" },
      { id: "TC-010", name: "Kiểm tra giao diện trang đăng nhập", type: "UI/UX", priority: "Low", preconditions: "Truy cập trang đăng nhập", steps: ["Mở trang đăng nhập", "Kiểm tra các phần tử UI", "Kiểm tra responsive trên mobile"], expectedResult: "Có đủ: field email, field password, checkbox remember me, button đăng nhập, link quên mật khẩu. Responsive trên mobile 375px", testData: "Viewport: 375px, 768px, 1440px" }
    ]
  }),

  apitest: `// Postman Collection — Login API Tests\n// Import file này vào Postman để chạy\n\n{\n  "info": {\n    "name": "Auth API Test Suite",\n    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"\n  },\n  "item": [\n    {\n      "name": "TC-API-001: Login thành công",\n      "event": [{\n        "listen": "test",\n        "script": {\n          "exec": [\n            "pm.test('Status 200', () => pm.response.to.have.status(200));",\n            "pm.test('Có token', () => {\n              const body = pm.response.json();\n              pm.expect(body.token).to.be.a('string');\n              pm.expect(body.success).to.be.true;\n              pm.environment.set('auth_token', body.token);\n            });"\n          ]\n        }\n      }],\n      "request": {\n        "method": "POST",\n        "url": "{{base_url}}/api/v1/auth/login",\n        "body": { "email": "test@example.com", "password": "Test@123" }\n      }\n    },\n    {\n      "name": "TC-API-002: Sai mật khẩu → 401",\n      "event": [{\n        "listen": "test",\n        "script": {\n          "exec": [\n            "pm.test('Status 401', () => pm.response.to.have.status(401));",\n            "pm.test('Message đúng', () => {\n              pm.expect(pm.response.json().message).to.include('Invalid');\n            });"\n          ]\n        }\n      }],\n      "request": {\n        "method": "POST",\n        "url": "{{base_url}}/api/v1/auth/login",\n        "body": { "email": "test@example.com", "password": "WrongPass" }\n      }\n    },\n    {\n      "name": "TC-API-003: Thiếu email → 400",\n      "request": { "method": "POST", "body": { "password": "Test@123" } }\n    }\n  ]\n}`,

  uitest: `import { test, expect, Page } from '@playwright/test';\n\n// Page Object Model\nclass LoginPage {\n  constructor(private page: Page) {}\n\n  async navigate() {\n    await this.page.goto('https://example.com/login');\n    await this.page.waitForSelector('#email');\n  }\n\n  async login(email: string, password: string) {\n    await this.page.fill('#email', email);\n    await this.page.fill('#password', password);\n    await this.page.click('button[type="submit"]');\n  }\n\n  async getErrorMessage() {\n    return this.page.locator('.error-message').textContent();\n  }\n}\n\ntest.describe('Login Feature', () => {\n  let loginPage: LoginPage;\n\n  test.beforeEach(async ({ page }) => {\n    loginPage = new LoginPage(page);\n    await loginPage.navigate();\n  });\n\n  test('TC-UI-001: Đăng nhập thành công', async ({ page }) => {\n    await loginPage.login('test@example.com', 'Test@123');\n    await page.waitForURL('**/dashboard');\n    await expect(page).toHaveURL(/dashboard/);\n    await expect(page.locator('.user-name')).toBeVisible();\n  });\n\n  test('TC-UI-002: Hiển thị lỗi khi sai mật khẩu', async () => {\n    await loginPage.login('test@example.com', 'WrongPass');\n    const error = await loginPage.getErrorMessage();\n    expect(error).toContain('không đúng');\n  });\n\n  test('TC-UI-003: Validation email trống', async ({ page }) => {\n    await page.click('button[type="submit"]');\n    await expect(page.locator('#email')).toBeFocused();\n  });\n});`,

  buganalyzer: `## 🔍 Phân tích Root Cause\n\n**Nguyên nhân có thể:** Session token được lưu trong memory (JavaScript variable) thay vì localStorage/sessionStorage. Khi trang refresh, bộ nhớ JS bị xóa → token mất → API calls trả về 401 → hệ thống redirect về login.\n\nHoặc: Cookie authentication không set đúng flag SameSite/Secure, bị trình duyệt Chrome chặn từ phiên bản 80+.\n\n## 🎯 Các khu vực bị ảnh hưởng\n\n- **AuthService**: Logic lưu/đọc token\n- **HTTP Interceptor**: Có thể không attach token đúng cách\n- **Route Guard**: Redirect logic có thể bị trigger sai\n\n## 🧪 Test Cases bổ sung\n\n1. Test refresh trên nhiều browser (Chrome, Firefox, Safari, Edge)\n2. Test với tab incognito\n3. Test sau khi clear cookies nhưng giữ localStorage\n4. Test hard refresh (Ctrl+Shift+R) vs soft refresh (F5)\n5. Kiểm tra Network tab xem token có được gửi trong request header không\n\n## 🔧 Gợi ý kiểm tra\n\n1. Mở DevTools → Application → Local Storage → kiểm tra có token không\n2. Mở DevTools → Network → sau khi login, xem response có Set-Cookie không\n3. So sánh behavior Chrome vs Firefox\n\n## ⚠️ Rủi ro Regression\n\nSau khi fix, cần regression test: Single Sign-On flow, Remember Me feature, Auto-logout sau timeout`,

  security: `## 🛡️ Security Test Checklist — Upload File\n\n### 1. File Type Validation (CRITICAL)\n- [ ] Upload file .php, .exe, .sh — **phải bị reject** (server-side check, không chỉ extension)\n- [ ] Upload file đổi tên thành .jpg nhưng thực chất là .php — phải bị detect\n- [ ] Upload file có magic bytes sai (JPEG header nhưng content là script)\n\n### 2. File Size & DoS (HIGH)\n- [ ] Upload file >10MB — phải reject với message rõ ràng\n- [ ] Upload 100 file đồng thời — server không bị crash\n- [ ] Upload file tên dài 1000 ký tự — không gây lỗi\n\n### 3. Path Traversal (CRITICAL)\n- [ ] Upload file tên: \'../../../etc/passwd\'\n- [ ] Upload file tên có null byte: \'file.jpg\\x00.php\'\n- [ ] Kiểm tra file được lưu đúng thư mục, không ngoài web root\n\n### 4. Authorization (HIGH)\n- [ ] User A không thể download/xóa file của User B\n- [ ] File URL có thể đoán được không? (dùng UUID thay vì sequential ID)\n- [ ] API endpoint có yêu cầu authentication không?\n\n### 5. XSS via Filename (MEDIUM)\n- [ ] Upload file tên: \'<script>alert(1)</script>.jpg\'\n- [ ] Name file có được escape khi hiển thị trên web không?`,

  performance: `## 📊 Performance Test Plan — E-commerce Platform\n\n### Test Scenarios\n\n| Scenario | Users | Duration | Mục tiêu |\n|----------|-------|----------|---------|\n| Smoke Test | 10 | 5 phút | Verify baseline |\n| Load Test | 500 | 30 phút | Normal peak load |\n| Stress Test | 1500 | 15 phút | Tìm breaking point |\n| Spike Test | 0→1000 đột ngột | 5 phút | Handle flash sale |\n\n### Load Profile (Load Test)\n\n\`\`\`\n0-5 phút:  Ramp up 0→500 users\n5-25 phút: Steady state 500 users\n25-30 phút: Ramp down 500→0\n\`\`\`\n\n### KPIs & Thresholds\n\n| Metric | Target | Alert |\n|--------|--------|-------|\n| P95 Response Time | < 2s | > 3s |\n| P99 Response Time | < 5s | > 8s |\n| Error Rate | < 0.1% | > 1% |\n| Throughput | > 200 req/s | < 100 req/s |\n\n### k6 Script Outline\n\n\`\`\`javascript\nimport http from 'k6/http';\nimport { check, sleep } from 'k6';\n\nexport const options = {\n  stages: [\n    { duration: '5m', target: 500 },\n    { duration: '20m', target: 500 },\n    { duration: '5m', target: 0 },\n  ],\n  thresholds: { http_req_duration: [\'p(95)<2000\'] }\n};\n\nexport default function() {\n  const res = http.get(\'https://shop.example.com/api/products\');\n  check(res, { \'status 200\': r => r.status === 200 });\n  sleep(1);\n}\n\`\`\``
};

function enableDemoMode() {
  STATE.demoMode = true;
  const banner = $('#quota-error-banner');
  if (banner) banner.remove();

  // Update API status
  const el = $('#api-status');
  const txt = $('#status-text');
  el.classList.add('connected');
  el.style.borderColor = 'rgba(245,158,11,0.4)';
  txt.textContent = '🎮 Demo Mode';
  txt.style.color = '#fbbf24';
  el.querySelector('.status-dot').style.background = '#f59e0b';

  showToast('🎮 Demo Mode đã bật! Kết quả mẫu sẽ được hiển thị', 'success');
}

function getDemoOutput(skill) {
  return DEMO_OUTPUTS[skill] || 'Demo output cho skill này chưa có.';
}

/* ── Generate: Test Cases ───────────────────────────────── */
$('#btn-example-tc').addEventListener('click', () => { $('#tc-input').value = EXAMPLES.testcase; });

/* ── Generate: Manual Mode (Copy Prompt) ────────────────── */
$('#btn-manual-tc')?.addEventListener('click', () => {
  const input = $('#tc-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng nhập requirement!', 'error'); return; }

  const priority = $('#tc-priority').value;
  const { system, buildPrompt } = SKILLS.testcase;
  const ctxSystem = buildProjectContext() + system;
  const userPrompt = buildPrompt(input, priority);

  const fullPrompt = `=== HƯỚNG DẪN DÀNH CHO AI ===\n${ctxSystem}\n\n=== YÊU CẦU TỪ NGƯỜI DÙNG ===\n${userPrompt}`;
  
  copyText(fullPrompt);
  $('#modal-manual').style.display = 'flex';
  $('#manual-ai-response').value = ''; // clear cũ
  showToast('Copied to clipboard Prompt! Hãy dán vào AI của bạn.', 'info');
});

$('#close-manual-modal')?.addEventListener('click', () => { $('#modal-manual').style.display = 'none'; });
$('#cancel-manual-modal')?.addEventListener('click', () => { $('#modal-manual').style.display = 'none'; });

$('#process-manual-response')?.addEventListener('click', () => {
  const response = $('#manual-ai-response').value.trim();
  if (!response) { showToast('⚠️ Vui lòng dán kết quả từ AI!', 'error'); return; }
  
  $('#modal-manual').style.display = 'none';
  showLoading('Đang xử lý kết quả...');
  try {
    $('#tc-output').style.display = 'block';
    renderTestCases(response); // hàm renderTestCases đã có sẵn try-catch JSON parser và regex
    saveHistory('testcase', $('#tc-input').value.trim() + ' (Manual)', response);
    showToast(`✅ Đã parse kết quả thành công!`, 'success');
    $('#tc-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    showToast(`❌ Lỗi parse JSON: ${e.message}`, 'error');
  } finally {
    hideLoading();
  }
});

$('#btn-generate-tc').addEventListener('click', async () => {
  const input = $('#tc-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng nhập requirement!', 'error'); return; }

  const priority = $('#tc-priority').value;

  showLoading('AI đang sinh test cases...');
  try {
    let result;
    if (STATE.demoMode) {
      await new Promise(r => setTimeout(r, 1200)); // simulate loading
      result = getDemoOutput('testcase');
    } else {
      const { system, buildPrompt } = SKILLS.testcase;
      const ctxSystem = buildProjectContext() + system;
      result = await callAI(ctxSystem, buildPrompt(input, priority));
    }
    $('#tc-output').style.display = 'block';
    renderTestCases(result);
    if (activeNodeId) {
      try {
        await saveTestCasesToNode(CURRENT_TEST_CASES?.testCases || []);
      } catch(e) {}
    }
    saveHistory('testcase', input, result);
    showToast(`✅ Đã sinh test cases thành công!`, 'success');
    $('#tc-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

$('#btn-update-tc').addEventListener('click', async () => {
  const input = $('#tc-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng nhập rule / yêu cầu bổ sung!', 'error'); return; }
  if (!CURRENT_TEST_CASES) { showToast('⚠️ Bạn cần sinh test case lần đầu trước khi cập nhật!', 'error'); return; }

  showLoading('AI đang bổ sung & cập nhật test cases...');
  try {
    const { system } = SKILLS.testcase;
    const ctxSystem = buildProjectContext() + system;
    
    // Construct prompt specifically for updating
    const updatePrompt = `Dưới đây là bộ Test Case HIỆN TẠI (định dạng JSON):
\`\`\`json
${JSON.stringify(CURRENT_TEST_CASES, null, 2)}
\`\`\`

YÊU CẦU BỔ SUNG / CẬP NHẬT TỪ NGƯỜI DÙNG:
---
${input}
---

NHIỆM VỤ: 
Dựa vào yêu cầu mới, hãy cập nhật bộ JSON hiện tại (thêm test case mới, sửa test case cũ nếu bị ảnh hưởng). 
GIỮ NGUYÊN các test case không liên quan đến thay đổi này.
Trả về TOÀN BỘ JSON hợp lệ chứa tất cả test case (kể cả cái cũ và cái mới).`;

    const result = await callAI(ctxSystem, updatePrompt);
    $('#tc-output').style.display = 'block';
    renderTestCases(result);
    if (activeNodeId) {
      try {
        await saveTestCasesToNode(CURRENT_TEST_CASES?.testCases || []);
      } catch(e) {}
    }
    saveHistory('testcase', 'Update: ' + input, result);
    showToast(`✅ Đã cập nhật test cases thành công!`, 'success');
    $('#tc-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

/* ── Generate: API Test ─────────────────────────────────── */
$('#btn-example-api').addEventListener('click', () => { $('#api-input').value = EXAMPLES.apitest; });

$('#btn-generate-api').addEventListener('click', async () => {
  const input = $('#api-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng nhập API specification!', 'error'); return; }

  const format = $('#api-format').value;
  showLoading('AI đang viết API tests...');
  try {
    let result;
    if (STATE.demoMode) {
      await new Promise(r => setTimeout(r, 1200));
      result = getDemoOutput('apitest');
    } else {
      const { system, buildPrompt } = SKILLS.apitest;
      const ctxSystem = buildProjectContext() + system;
      result = await callAI(ctxSystem, buildPrompt(input, format));
    }
    $('#api-output').style.display = 'block';
    renderCode(result, '#api-output-content');
    saveHistory('apitest', input, result);
    showToast('✅ Đã sinh API test script!', 'success');
    $('#api-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

/* ── Generate: UI Test ──────────────────────────────────── */
$('#btn-example-ui').addEventListener('click', () => { $('#ui-input').value = EXAMPLES.uitest; });

$('#btn-generate-ui').addEventListener('click', async () => {
  const input = $('#ui-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng mô tả UI flow cần test!', 'error'); return; }

  const browser = $('#ui-browser').value;
  const lang = $('#ui-language').value;
  showLoading('AI đang sinh Playwright script...');
  try {
    let result;
    if (STATE.demoMode) {
      await new Promise(r => setTimeout(r, 1200));
      result = getDemoOutput('uitest');
    } else {
      const { system, buildPrompt } = SKILLS.uitest;
      const ctxSystem = buildProjectContext() + system;
      result = await callAI(ctxSystem, buildPrompt(input, browser, lang));
    }
    $('#ui-output').style.display = 'block';
    renderCode(result, '#ui-output-content');
    saveHistory('uitest', input, result);
    showToast('✅ Đã sinh Playwright script!', 'success');
    $('#ui-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

/* ── Generate: Bug Analyzer ─────────────────────────────── */
$('#btn-example-bug').addEventListener('click', () => { $('#bug-input').value = EXAMPLES.buganalyzer; });

$('#btn-generate-bug').addEventListener('click', async () => {
  const input = $('#bug-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng nhập mô tả bug!', 'error'); return; }

  showLoading('AI đang phân tích bug...');
  try {
    let result;
    if (STATE.demoMode) {
      await new Promise(r => setTimeout(r, 1200));
      result = getDemoOutput('buganalyzer');
    } else {
      const { system, buildPrompt } = SKILLS.buganalyzer;
      const ctxSystem = buildProjectContext() + system;
      result = await callAI(ctxSystem, buildPrompt(input));
    }
    $('#bug-output').style.display = 'block';
    renderMarkdown(result, '#bug-output-content');
    saveHistory('buganalyzer', input, result);
    showToast('✅ Phân tích bug hoàn tất!', 'success');
    $('#bug-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

/* ── Generate: Security ─────────────────────────────────── */
$('#btn-example-sec').addEventListener('click', () => { $('#security-input').value = EXAMPLES.security; });

$('#btn-generate-sec').addEventListener('click', async () => {
  const input = $('#security-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng mô tả tính năng cần test!', 'error'); return; }

  showLoading('AI đang sinh Security checklist...');
  try {
    let result;
    if (STATE.demoMode) {
      await new Promise(r => setTimeout(r, 1200));
      result = getDemoOutput('security');
    } else {
      const { system, buildPrompt } = SKILLS.security;
      const ctxSystem = buildProjectContext() + system;
      result = await callAI(ctxSystem, buildPrompt(input));
    }
    $('#security-output').style.display = 'block';
    renderMarkdown(result, '#security-output-content');
    saveHistory('security', input, result);
    showToast('✅ Security checklist đã sẵn sàng!', 'success');
    $('#security-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

/* ── Generate: Performance ──────────────────────────────── */
$('#btn-example-perf').addEventListener('click', () => { $('#performance-input').value = EXAMPLES.performance; });

$('#btn-generate-perf').addEventListener('click', async () => {
  const input = $('#performance-input').value.trim();
  if (!input) { showToast('⚠️ Vui lòng nhập thông tin hệ thống!', 'error'); return; }

  showLoading('AI đang lên kế hoạch Performance test...');
  try {
    let result;
    if (STATE.demoMode) {
      await new Promise(r => setTimeout(r, 1200));
      result = getDemoOutput('performance');
    } else {
      const { system, buildPrompt } = SKILLS.performance;
      const ctxSystem = buildProjectContext() + system;
      result = await callAI(ctxSystem, buildPrompt(input));
    }
    $('#performance-output').style.display = 'block';
    renderMarkdown(result, '#performance-output-content');
    saveHistory('performance', input, result);
    showToast('✅ Performance plan đã sẵn sàng!', 'success');
    $('#performance-output').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    handleApiError(e);
  } finally {
    hideLoading();
  }
});

/* ── Copy / Export Actions ──────────────────────────────── */
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to clipboard!', 'success'));
}

function downloadFile(content, filename, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
}

// Test Case copy
$('#btn-copy-tc')?.addEventListener('click', () => {
  const content = $('#tc-output-content').innerText;
  copyText(content);
});

// Copy as HTML table for Lark Base direct paste
$('#btn-copy-lark')?.addEventListener('click', async () => {
  const raw = $('#tc-output-content').dataset.parsed;
  const data = raw ? JSON.parse(raw) : CURRENT_TEST_CASES;
  if (!data || !data.testCases) { showToast('No data to copy. Please generate test cases first!', 'error'); return; }

  // Lark mapping helpers
  const lm = STATE.larkMapping || {
    priority: { high: '', medium: '', low: '' },
    type: { positive: '', negative: '', edge: '', ui: '', security: '', performance: '' }
  };

  const mapPriority = (prio) => {
    if (!prio) return '';
    const p = String(prio).toLowerCase().trim();
    if (p === 'high' && lm.priority?.high) return lm.priority.high;
    if ((p === 'medium' || p === 'med') && lm.priority?.medium) return lm.priority.medium;
    if (p === 'low' && lm.priority?.low) return lm.priority.low;
    return prio;
  };

  const mapType = (type) => {
    if (!type) return '';
    const t = String(type).toLowerCase().trim();
    if (t === 'positive' && lm.type?.positive) return lm.type.positive;
    if (t === 'negative' && lm.type?.negative) return lm.type.negative;
    if ((t === 'edge case' || t === 'edge') && lm.type?.edge) return lm.type.edge;
    if (t === 'ui/ux' && lm.type?.ui) return lm.type.ui;
    if (t === 'security' && lm.type?.security) return lm.type.security;
    if (t === 'performance' && lm.type?.performance) return lm.type.performance;
    return type;
  };

  let currentModule = '', currentScreen = '', currentFeature = '';
  if (typeof treeData !== 'undefined' && typeof activeNodeId !== 'undefined' && activeNodeId) {
    let curr = treeData.find(n => n.id === activeNodeId);
    while (curr) {
      if (curr.type === 'module') currentModule = curr.name;
      else if (curr.type === 'screen') currentScreen = curr.name;
      else if (curr.type === 'feature') currentFeature = curr.name;
      curr = treeData.find(n => n.id === curr.parentId);
    }
  }

  const esc = v => String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');

  const headers = [
    'TC ID','Module','Screen','Feature','Test Case Name','Type','Priority',
    'Preconditions','Steps','Expected Result','Test Data',
    'Status','Actual Result','Related Bug'
  ];

  const headerHtml = headers.map(h => `<th style="background:#1e293b;color:#a5b4fc;padding:8px 12px;border:1px solid #334155;font-weight:600;white-space:nowrap;">${h}</th>`).join('');

  const getAbbr = (str) => {
    if (!str) return 'TC';
    const clean = str.replace(/[^\w\sđĐ]/gi, '').trim();
    const parts = clean.split(/\s+/);
    if (parts.length === 1) return clean.substring(0, 3).toUpperCase();
    return parts.map(p => p[0]).join('').substring(0, 4).toUpperCase();
  };

  const rowsHtml = (data.testCases || []).map((tc, idx) => {
    const stepsHtml = (tc.steps || []).map((s, i) => `${i + 1}. ${esc(s)}`).join('<br>');
    const finalModule = currentModule || tc.module || '';
    const abbr = getAbbr(finalModule);
    const generatedId = `${abbr}-${String(idx + 1).padStart(4, '0')}`;

    const cells = [
      generatedId,
      finalModule,
      currentScreen || '',
      currentFeature || '',
      tc.name || '',
      mapType(tc.type || ''),
      mapPriority(tc.priority || ''),
      tc.preconditions || '',
      stepsHtml,
      tc.expectedResult || '',
      tc.testData || '',
      '', '', ''
    ];
    return `<tr>${cells.map((c, i) => `<td style="padding:8px 12px;border:1px solid #334155;vertical-align:top;">${i === 8 ? c : esc(c)}</td>`).join('')}</tr>`;
  }).join('');

  const tableHtml = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;

  // TSV fallback (same 15 cols, Status/Actual/Bug empty)
  const tsvRows = (data.testCases || []).map(tc => [
    tc.id || '', tc.module || '', tc.name || '', mapType(tc.type || ''), mapPriority(tc.priority || ''),
    tc.suite || '', tc.automationCandidate || '', tc.traceTo || '',
    tc.preconditions || '',
    (tc.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join(' | '),
    tc.expectedResult || '', tc.testData || '',
    '', '', ''  // Status, Actual Result, Related Bug — empty
  ].map(v => String(v).replace(/\t/g, ' ')).join('\t')).join('\n');

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([tableHtml], { type: 'text/html' }),
        'text/plain': new Blob([tsvRows],   { type: 'text/plain' })
      })
    ]);
    showToast('📋 Copied to clipboard bảng! Chọn ô đầu tiên trên Lark Base rồi ấn Ctrl+V.', 'success');
  } catch (e) {
    copyText(tsvRows);
    showToast('📋 Copied to clipboard (dạng text). Ấn Ctrl+V vào Lark Base.', 'info');
  }
});

// Test Case export CSV — English headers, Status/Actual/Bug left empty for Lark manual fill
$('#btn-export-csv')?.addEventListener('click', () => {
  const raw = $('#tc-output-content').dataset.parsed;
  const data = raw ? JSON.parse(raw) : CURRENT_TEST_CASES;
  if (!data || !data.testCases) { showToast('Không có dữ liệu để export. Hãy sinh test case trước!', 'error'); return; }

  // Lark mapping helpers
  const lm = STATE.larkMapping || {
    priority: { high: '', medium: '', low: '' },
    type: { positive: '', negative: '', edge: '', ui: '', security: '', performance: '' }
  };

  const mapPriority = (prio) => {
    if (!prio) return '';
    const p = String(prio).toLowerCase().trim();
    if (p === 'high' && lm.priority?.high) return lm.priority.high;
    if ((p === 'medium' || p === 'med') && lm.priority?.medium) return lm.priority.medium;
    if (p === 'low' && lm.priority?.low) return lm.priority.low;
    return prio;
  };

  const mapType = (type) => {
    if (!type) return '';
    const t = String(type).toLowerCase().trim();
    if (t === 'positive' && lm.type?.positive) return lm.type.positive;
    if (t === 'negative' && lm.type?.negative) return lm.type.negative;
    if ((t === 'edge case' || t === 'edge') && lm.type?.edge) return lm.type.edge;
    if (t === 'ui/ux' && lm.type?.ui) return lm.type.ui;
    if (t === 'security' && lm.type?.security) return lm.type.security;
    if (t === 'performance' && lm.type?.performance) return lm.type.performance;
    return type;
  };

  const header = 'TC ID,Module,Test Case Name,Type,Priority,Suite,Automation,Trace To,Preconditions,Steps,Expected Result,Test Data,Status,Actual Result,Related Bug\n';
  const rows = (data.testCases || []).map(tc => [
    tc.id || '',
    tc.module || '',
    tc.name || '',
    mapType(tc.type || ''),
    mapPriority(tc.priority || ''),
    tc.suite || '',
    tc.automationCandidate || '',
    tc.traceTo || '',
    tc.preconditions || '',
    (tc.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
    tc.expectedResult || '',
    tc.testData || '',
    '',  // Status — leave empty
    '',  // Actual Result — leave empty
    ''   // Related Bug — leave empty
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile('\uFEFF' + header + rows, `test-cases-${Date.now()}.csv`, 'text/csv');
  showToast('📊 Đã export CSV!', 'success');
});

// Test Case export Markdown
$('#btn-export-md')?.addEventListener('click', () => {
  const raw = $('#tc-output-content').dataset.parsed;
  if (!raw) { showToast('Không có dữ liệu để export', 'error'); return; }
  const data = JSON.parse(raw);
  let md = `# Test Cases\n\n_${data.summary || ''}_\n\n---\n\n`;
  (data.testCases || []).forEach(tc => {
    md += `## ${tc.id}: ${tc.name}\n\n`;
    md += `**Type:** ${tc.type} | **Priority:** ${tc.priority}\n\n`;
    if (tc.preconditions) md += `**Preconditions:** ${tc.preconditions}\n\n`;
    md += `**Steps:**\n${(tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
    md += `**Expected Result:** ${tc.expectedResult}\n\n`;
    if (tc.testData) md += `**Test Data:** ${tc.testData}\n\n`;
    md += `---\n\n`;
  });
  downloadFile(md, `test-cases-${Date.now()}.md`);
  showToast('📄 Đã export Markdown!', 'success');
});

// TC Export
$('#btn-export-tc')?.addEventListener('click', () => {
  if (!CURRENT_TEST_CASES) {
    showToast('⚠️ Không có dữ liệu để export!', 'error');
    return;
  }
  downloadFile(JSON.stringify(CURRENT_TEST_CASES, null, 2), `test-cases-${Date.now()}.json`);
  showToast('💾 Đã tải xuống file JSON!', 'success');
});

// API Test copy & export
$('#btn-copy-api')?.addEventListener('click', () => copyText($('#api-output-content').innerText));
$('#btn-export-api')?.addEventListener('click', () => {
  const fmt = $('#api-format').value;
  const ext = fmt === 'postman' ? '.json' : fmt === 'python' ? '.py' : '.js';
  downloadFile($('#api-output-content pre')?.innerText || '', `api-tests-${Date.now()}${ext}`);
  showToast('💾 Đã export file!', 'success');
});

// UI Test copy & export
$('#btn-copy-ui')?.addEventListener('click', () => copyText($('#ui-output-content').innerText));
$('#btn-export-ui')?.addEventListener('click', () => {
  const lang = $('#ui-language').value;
  const ext = lang === 'python' ? '.py' : lang === 'javascript' ? '.spec.js' : '.spec.ts';
  downloadFile($('#ui-output-content pre')?.innerText || '', `ui-test-${Date.now()}${ext}`);
  showToast('💾 Đã export script!', 'success');
});

// Bug copy
$('#btn-copy-bug')?.addEventListener('click', () => copyText($('#bug-output-content').innerText));

// Security copy
$('#btn-copy-sec')?.addEventListener('click', () => copyText($('#security-output-content').innerText));

// Performance copy
$('#btn-copy-perf')?.addEventListener('click', () => copyText($('#performance-output-content').innerText));

/* ── Toggle Sidebars ─────────────────────────────────────── */
$('#toggle-project-sidebar')?.addEventListener('click', () => {
  $('#project-sidebar').classList.toggle('collapsed');
});
$('#toggle-skill-sidebar')?.addEventListener('click', () => {
  $('#skill-sidebar').classList.toggle('collapsed');
});

/* ── Init ───────────────────────────────────────────────── */
function init() {
  $('#modal-settings').style.display = 'none';
  $('#modal-project').style.display = 'none';
  STATE.demoMode = false;

  if (new URLSearchParams(window.location.search).get('demo') === 'true') {
    enableDemoMode();
  }

  updateApiStatus();
  renderHistory();

  const anyKey = Object.values(STATE.providers).some(p => p.enabled && p.key);
  if (!anyKey) {
    setTimeout(() => {
      showToast('👋 Click ⚙️ Settings để thêm Gemini API Key (miễn phí)!', 'info');
    }, 800);
  } else {
    const ready = Object.entries(STATE.providers)
      .filter(([, v]) => v.enabled && v.key)
      .map(([k]) => PROVIDER_META[k].label);
    console.log(`%c✅ AI Providers ready: ${ready.join(' → ')}`, 'color:#10b981;font-size:12px;');
  }

  const projCount = PROJECT_STATE.projects.length;
  if (projCount > 0) {
    console.log(`%c📁 ${projCount} project(s) loaded. Active: ${PROJECT_STATE.active?.name || 'none'}`, 'color:#818cf8;font-size:12px;');
  }

  console.log('%c🤖 AI QA Assistant v2.0', 'color:#6366f1;font-size:16px;font-weight:bold;');
  console.log('%cProject Workspace + Multi-Provider — Ready!', 'color:#94a3b8;font-size:12px;');
}

init();

/* ── Tree Management ─────────────────────────────────────── */
let treeData = [];
let activeNodeId = null;

async function loadTestCasesForNode(nodeId) {
  try {
    const res = await fetch(`http://localhost:3001/testcases/${encodeURIComponent(nodeId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const testCases = await res.json();
    if (Array.isArray(testCases) && testCases.length > 0) {
      $('#tc-output').style.display = 'block';
      renderTestCases({
        summary: 'Test cases đã lưu cho node hiện tại',
        total: testCases.length,
        testCases,
      });
    } else {
      CURRENT_TEST_CASES = null;
      const container = $('#tc-output-content');
      if (container) {
        container.innerHTML = '<div class="history-empty">Node này chưa có test case đã lưu</div>';
        delete container.dataset.parsed;
      }
      $('#tc-output').style.display = 'block';
    }
  } catch (e) {
    console.error('Error loading test cases:', e);
    showToast('Không load được test case của node', 'error');
  }
}

async function saveTestCasesToNode(testCases) {
  if (!activeNodeId || !Array.isArray(testCases)) return;
  const res = await fetch(`http://localhost:3001/testcases/${encodeURIComponent(activeNodeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCases, replace: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

async function fetchTree() {
  try {
    const res = await fetch('http://localhost:3001/tree');
    treeData = await res.json();
    renderTree();
  } catch (e) {
    console.error('Error fetching tree:', e);
  }
}

function renderTree() {
  const container = document.getElementById('project-list');
  if (!container) return;
  container.innerHTML = '';
  
  const roots = treeData.filter(n => !n.parentId);
  roots.forEach(root => {
    container.appendChild(createTreeNodeElement(root, 0));
  });
}

function createTreeNodeElement(node, level) {
  const div = document.createElement('div');
  div.className = `tree-node level-${level}`;
  
  const children = treeData.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  
  const typeTextIcons = { project: 'P', module: 'M', screen: 'S', feature: 'F' };
  const isActive = activeNodeId === node.id;
  const safeName = escapeHtml(node.name);
  const safeType = ['project', 'module', 'screen', 'feature'].includes(node.type) ? node.type : 'feature';
  
  div.innerHTML = `
    <div class="tree-node-content ${isActive ? 'active' : ''}" style="padding-left: ${10 + level * 16}px;">
      <div class="tree-node-left">
        <span class="tree-toggle-icon">
          ${hasChildren ? '▼' : ' '}
        </span>
        <span class="tree-node-icon icon-${safeType}">
          ${typeTextIcons[safeType] || '-'}
        </span>
        <span class="tree-node-name" title="${safeName}">${safeName}</span>
      </div>
      <div class="tree-node-actions">
        <button class="tree-more-btn" title="Actions">⋮</button>
      </div>
    </div>
  `;
  
  const contentDiv = div.querySelector('.tree-node-content');
  const moreBtn = div.querySelector('.tree-more-btn');
  const toggleIcon = div.querySelector('.tree-toggle-icon');

  contentDiv.addEventListener('click', (e) => {
    if (e.target.closest('.tree-more-btn') || e.target.closest('.tree-context-menu') || e.target.closest('.tree-toggle-icon')) return;
    activeNodeId = node.id;
    renderTree(); 
    loadTestCasesForNode(node.id);
  });
  
  div.addEventListener('mouseenter', () => div.querySelector('.tree-node-actions').style.opacity = '1');
  div.addEventListener('mouseleave', () => div.querySelector('.tree-node-actions').style.opacity = '0.2');
  
  moreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.tree-context-menu').forEach(el => el.remove());
    
    const menu = document.createElement('div');
    menu.className = 'tree-context-menu';
    menu.style.top = '100%';
    menu.style.right = '0';
    
    let addText = '';
    if (node.type === 'project') addText = 'Create Module';
    else if (node.type === 'module') addText = 'Create Screen';
    else if (node.type === 'screen') addText = 'Create Feature';
    
    if (addText) {
      menu.innerHTML += `<button class="menu-add">${addText}</button>`;
    }
    menu.innerHTML += `<button class="menu-rename">Rename</button>`;
    menu.innerHTML += `<button class="text-red menu-del">Delete</button>`;
    
    contentDiv.appendChild(menu);
    
    const closeMenu = (evt) => {
      if (!menu.contains(evt.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
    
    if (menu.querySelector('.menu-add')) {
      menu.querySelector('.menu-add').addEventListener('click', () => {
        openAddNodeModal(node.id, getNextType(node.type));
        menu.remove();
      });
    }
    menu.querySelector('.menu-rename').addEventListener('click', () => {
      const newName = prompt('New Name:', node.name);
      if (newName && newName.trim()) {
        fetch(`http://localhost:3001/tree/${node.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() })
        }).then(() => fetchTree());
      }
      menu.remove();
    });
    menu.querySelector('.menu-del').addEventListener('click', async () => {
      if (confirm(`Delete "${node.name}" and all its contents?`)) {
        await fetch(`http://localhost:3001/tree/${node.id}`, { method: 'DELETE' });
        if (activeNodeId === node.id) activeNodeId = null;
        fetchTree();
      }
      menu.remove();
    });
  });
  
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'tree-children';
  children.forEach(child => {
    childrenContainer.appendChild(createTreeNodeElement(child, level + 1));
  });
  
  if (hasChildren) {
    toggleIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = childrenContainer.style.display === 'none';
      childrenContainer.style.display = isHidden ? 'block' : 'none';
      toggleIcon.textContent = isHidden ? '▼' : '▶';
    });
  }
  
  const wrapper = document.createElement('div');
  wrapper.appendChild(div);
  wrapper.appendChild(childrenContainer);
  return wrapper;
}

function getNextType(type) {
  if (type === 'project') return 'module';
  if (type === 'module') return 'screen';
  if (type === 'screen') return 'feature';
  return 'feature';
}

function openAddNodeModal(parentId, type) {
  document.getElementById('tree-node-parent-id').value = parentId || '';
  document.getElementById('tree-node-type').value = type;
  document.getElementById('tree-node-name').value = '';
  
  const contextEl = document.getElementById('tree-node-context');
  if (contextEl) contextEl.value = '';
  
  const typeMap = { project: 'Project', module: 'Module', screen: 'Screen', feature: 'Feature' };
  const typeName = typeMap[type] || 'Node';
  document.getElementById('tree-node-title').textContent = 'Create New ' + typeName;

  document.getElementById('modal-tree-node').style.display = 'flex';
  setTimeout(() => document.getElementById('tree-node-name').focus(), 100);
}

document.getElementById('close-tree-node')?.addEventListener('click', () => {
  document.getElementById('modal-tree-node').style.display = 'none';
});
document.getElementById('cancel-tree-node')?.addEventListener('click', () => {
  document.getElementById('modal-tree-node').style.display = 'none';
});

document.getElementById('save-tree-node')?.addEventListener('click', async () => {
  const name = document.getElementById('tree-node-name').value;
  const parentId = document.getElementById('tree-node-parent-id').value;
  const type = document.getElementById('tree-node-type').value;
  if (!name) return alert('Please enter a name');
  
  try {
    await fetch('http://localhost:3001/tree', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null, type, context: document.getElementById('tree-node-context')?.value || '' })
    });
    document.getElementById('modal-tree-node').style.display = 'none';
    fetchTree();
  } catch (e) {
    console.error(e);
  }
});

// Auto load tree
document.addEventListener('DOMContentLoaded', fetchTree);
