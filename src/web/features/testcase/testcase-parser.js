export function parseAiJson(output) {
  const text = String(output || '').trim();
  
  // 1. Try to parse directly first if it starts with [ or { (valid JSON starts)
  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      // Fall through to regex matching if direct parse fails
    }
  }

  // 2. Try to match code fences
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {
      // Fall through to parsing text directly
    }
  }

  return JSON.parse(text);
}

export function stripCodeFence(text) {
  return String(text || '').replace(/^```[\w-]*\s*/i, '').replace(/```$/i, '').trim();
}

// ── Import TC từ bảng dán (Excel / Google Sheets / Lark grid / CSV) — 0 token ──
// Tên cột (header) chấp nhận nhiều biến thể EN/VI. Nếu dòng đầu không nhận diện
// được là header thì rơi về THỨ TỰ CỘT CỐ ĐỊNH (khớp bộ cột export CSV).
const HEADER_ALIASES = {
  id: ['tc id', 'tcid', 'id', 'mã tc', 'ma tc'],
  module: ['module', 'mô đun', 'mo dun'],
  screen: ['screen', 'màn hình', 'man hinh'],
  feature: ['feature', 'tính năng', 'tinh nang'],
  name: ['test case name', 'name', 'title', 'tên', 'tên test case', 'ten', 'tên tc'],
  type: ['type', 'loại', 'loai'],
  priority: ['priority', 'mức ưu tiên', 'muc uu tien', 'ưu tiên'],
  suite: ['suite', 'bộ test'],
  automationCandidate: ['automation', 'automationcandidate', 'auto'],
  traceTo: ['trace to', 'traceto', 'trace'],
  preconditions: ['preconditions', 'precondition', 'điều kiện', 'tiền điều kiện'],
  steps: ['steps', 'các bước', 'cac buoc', 'bước', 'steps (mỗi bước 1 dòng)'],
  expectedResult: ['expected result', 'expected', 'kết quả mong đợi', 'ket qua mong doi', 'expected outcome'],
  testData: ['test data', 'testdata', 'dữ liệu test'],
  status: ['status', 'trạng thái', 'trang thai'],
  actualResult: ['actual result', 'actual', 'kết quả thực tế'],
  relatedBug: ['related bug', 'relatedbug', 'bug'],
};
// Thứ tự cột cố định khi không có header — khớp toCsv (bỏ screen/feature khi lưu vì lấy từ cây).
const FIXED_ORDER = ['id', 'module', 'screen', 'feature', 'name', 'type', 'priority', 'suite', 'automationCandidate', 'traceTo', 'preconditions', 'steps', 'expectedResult', 'testData', 'status', 'actualResult', 'relatedBug'];

// Tokenizer nhận biết dấu ngoặc kép: xử lý cell nhiều dòng, chứa delimiter, và "" escape.
function tokenizeTable(text, delim) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

function splitSteps(cell) {
  return String(cell || '')
    .split(/\r?\n/)
    .map(l => l.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

export function parsePastedTestCases(text) {
  const raw = String(text || '').replace(/^﻿/, '').trim();
  if (!raw) return [];
  const firstLine = raw.split(/\r?\n/, 1)[0] || '';
  const delim = firstLine.includes('\t') ? '\t' : ',';
  const rows = tokenizeTable(raw, delim);
  if (!rows.length) return [];

  // Nhận diện header
  const map = {};
  let matched = 0;
  rows[0].forEach((h, idx) => {
    const hn = String(h || '').trim().toLowerCase();
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(hn) && !(field in map)) { map[field] = idx; matched++; break; }
    }
  });

  let colMap;
  let dataRows;
  if (matched >= 2) { colMap = map; dataRows = rows.slice(1); }
  else { colMap = {}; FIXED_ORDER.forEach((f, i) => { colMap[f] = i; }); dataRows = rows; }

  const get = (row, field) => (colMap[field] != null ? String(row[colMap[field]] ?? '').trim() : '');
  const cases = [];
  for (const row of dataRows) {
    if (row.every(c => String(c).trim() === '')) continue;
    const name = get(row, 'name');
    const stepsCell = colMap.steps != null ? row[colMap.steps] : '';
    if (!name && !String(stepsCell).trim() && !get(row, 'expectedResult')) continue;
    cases.push({
      id: get(row, 'id'),
      module: get(row, 'module'),
      name,
      type: get(row, 'type'),
      priority: get(row, 'priority'),
      suite: get(row, 'suite'),
      automationCandidate: get(row, 'automationCandidate'),
      traceTo: get(row, 'traceTo'),
      preconditions: get(row, 'preconditions'),
      steps: splitSteps(stepsCell),
      testData: get(row, 'testData'),
      expectedResult: get(row, 'expectedResult'),
      status: get(row, 'status'),
      actualResult: get(row, 'actualResult'),
      relatedBug: get(row, 'relatedBug'),
    });
  }
  return cases;
}
