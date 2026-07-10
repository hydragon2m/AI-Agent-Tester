const REVIEWABLE_FIELDS = ['name', 'type', 'priority', 'preconditions', 'steps', 'expectedResult', 'testData'];

export const QUALITY_SYSTEM_PROMPT = `Bạn là Senior QA Reviewer 10+ năm kinh nghiệm, chuyên đánh giá chất lượng test case theo chuẩn ISTQB.
Nhiệm vụ: nhận một danh sách Test Case đã sinh ra kèm requirement gốc, đánh giá từng case và đề xuất cải thiện.
Với mỗi test case, xác định:
- "keep": case đã đúng, đủ, không thừa — không cần sửa gì.
- "modify": case có vấn đề (sai/thiếu/mơ hồ ở 1 hay nhiều field) — liệt kê rõ field nào cần sửa, giá trị cũ và giá trị mới đề xuất.
- "delete": case bị thừa/trùng lặp ý nghĩa với case khác trong danh sách — nêu rõ lý do và trùng với case nào.
Ngoài ra, nếu phát hiện thiếu coverage so với requirement (ví dụ thiếu negative case, thiếu edge case, thiếu security case liên quan), đề xuất thêm test case mới hoàn toàn ở mục "newSuggestions".

Chỉ trả về DUY NHẤT 1 block JSON hợp lệ, đúng schema sau, không thêm giải thích ngoài JSON:
{
  "summary": "Nhận xét tổng quan ngắn gọn về chất lượng bộ test case",
  "reviews": [
    {
      "id": "TC-001",
      "action": "keep | modify | delete",
      "reason": "Lý do cụ thể, ngắn gọn",
      "changes": [
        { "field": "expectedResult", "oldValue": "Giá trị hiện tại", "newValue": "Giá trị đề xuất" }
      ]
    }
  ],
  "newSuggestions": [
    {
      "reason": "Lý do cần thêm case này (thiếu coverage gì)",
      "testCase": {
        "module": "Feature area",
        "name": "Tên case mới",
        "type": "Positive",
        "priority": "High",
        "suite": "Regression",
        "automationCandidate": "Yes",
        "traceTo": "",
        "preconditions": "",
        "steps": ["Step 1", "Step 2"],
        "testData": "",
        "expectedResult": "Kết quả mong đợi"
      }
    }
  ]
}

Ràng buộc bắt buộc:
- Field trong "changes" CHỈ được dùng 1 trong các giá trị: ${REVIEWABLE_FIELDS.join(', ')}.
- action="modify" bắt buộc có "changes" không rỗng.
- action="delete" bắt buộc có "reason" giải thích rõ trùng/thừa với case nào.
- action="keep" thì để "changes" là mảng rỗng.
- Phải đánh giá ĐỦ tất cả test case trong danh sách được cung cấp, không bỏ sót case nào trong "reviews".
- Không tự ý đổi "id" của case đã có.`;

export function buildQualityPrompt(testCases, requirement) {
  return `Requirement gốc:
---
${requirement}
---

Danh sách Test Case cần đánh giá (JSON):
\`\`\`json
${JSON.stringify(testCases, null, 2)}
\`\`\`

Hãy đánh giá từng test case theo đúng schema đã yêu cầu.`;
}

function normalizeStepsValue(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  const text = typeof value === 'string' ? value : String(value);
  return text
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*\d+[.)]?\s*/, '').trim())
    .filter(line => line.length > 0);
}

function applyChanges(testCase, changes) {
  const updated = { ...testCase };
  for (const change of changes || []) {
    if (!REVIEWABLE_FIELDS.includes(change.field)) continue;
    if (change.field === 'steps') {
      updated.steps = normalizeStepsValue(change.newValue);
      continue;
    }
    updated[change.field] = change.newValue;
  }
  return updated;
}

export function sortTestCases(tcs) {
  if (!Array.isArray(tcs)) return [];
  // GIỮ NGUYÊN thứ tự AI sinh (tổng quan → chi tiết: happy path trước, rồi
  // negative/boundary/edge/security/UI). Chỉ GOM các TC cùng module lại gần nhau
  // theo thứ tự module xuất hiện lần đầu — KHÔNG sort alphabet theo name (cách cũ
  // đẩy "Boundary..." lên trước "Happy Path..." làm xáo trộn luồng logic).
  const moduleOrder = [];
  const groups = new Map();
  for (const tc of tcs) {
    const key = String(tc.module || '');
    if (!groups.has(key)) { groups.set(key, []); moduleOrder.push(key); }
    groups.get(key).push(tc);
  }
  return moduleOrder.flatMap(k => groups.get(k));
}

export function buildFinalTestCases(originalTCs, reviews, decisions, newSuggestionDecisions, newSuggestions, renumberFn) {
  const reviewsById = new Map((reviews || []).map(r => [r.id, r]));

  const kept = [];
  for (const tc of originalTCs) {
    const review = reviewsById.get(tc.id);
    if (!review) {
      kept.push(tc);
      continue;
    }
    if (review.action === 'delete' && decisions[tc.id] === 'remove') {
      continue;
    }
    if (review.action === 'modify' && decisions[tc.id] === 'apply') {
      kept.push(applyChanges(tc, review.changes));
      continue;
    }
    kept.push(tc);
  }

  const acceptedSuggestions = (newSuggestions || [])
    .filter((s, idx) => newSuggestionDecisions[idx] && s?.testCase)
    .map(s => s.testCase);

  const combined = !acceptedSuggestions.length
    ? kept
    : [...kept, ...renumberFn(kept, acceptedSuggestions)];

  return sortTestCases(combined);
}
