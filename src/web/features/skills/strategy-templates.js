// Test Strategy / Test Plan — taxonomy + template mặc định + skill-gating (F6/F7 + System layer).
// Dùng CHUNG giữa skill prompt (skill-registry.js), UI (StrategyPanel.jsx) và skill-gating
// (utils/skill-gating.js) để các nơi không lệch nhau. Có 2 TRỤC tách biệt (theo thiết kế đã chốt):
//   - Trục 1: HOẠT ĐỘNG test (STAGE_ACTIVITIES) — cái được toggle ON/OFF trong Test Plan.
//   - Trục 2: stage_type / phase (STAGE_TYPES) — AI gán cho từng stage theo context.
// SKILL-GATING: mỗi activity bật lên sẽ "mở khóa" các skill tương ứng (skillIds) ở skill panel.

// ── Trục 1: Hoạt động test (toggle ON/OFF) ──────────────────────────────────
// skillIds: skill (key trong SKILLS registry) được HIỆN khi activity này bật trong test plan.
export const STAGE_ACTIVITIES = [
  { key: 'api', label: 'API Testing', hint: 'Kiểm thử API/backend ngay khi dev xong endpoint', skillIds: ['apitest'] },
  { key: 'smoke', label: 'Smoke Test', hint: 'Bộ TC ngắn xác nhận build không bể', skillIds: ['testcase'] },
  { key: 'manual', label: 'Manual / Functional', hint: 'Test nghiệp vụ, edge case theo TC đầy đủ', skillIds: ['testcase', 'uitest'] },
  { key: 'regression', label: 'Regression', hint: 'Chạy lại TC đã stable để chắc không hồi quy', skillIds: ['testcase'] },
  { key: 'performance', label: 'Performance', hint: 'Tải/độ trễ trên staging trước release', skillIds: ['performance'] },
  { key: 'security', label: 'Security', hint: 'Rà lỗ hổng bảo mật trên staging trước release', skillIds: ['security'] },
];

// ── Skill-gating config ──────────────────────────────────────────────────────
// Skill LUÔN hiện bất kể test plan (nền tảng — không gắn với activity nào).
export const ALWAYS_ON_SKILLS = ['srs', 'buganalyzer'];

// Skill nội bộ — KHÔNG bao giờ hiện ở skill panel (chỉ gọi lập trình).
export const INTERNAL_SKILLS = ['srsdecomposer', 'teststrategy'];

// applicable_nodes: skill chỉ hiện ở các node type này (mặc định = mọi node trừ project).
// Khai báo tường minh để làm điểm mở rộng; hiện giữ nguyên hành vi cũ (hiện ở module/screen/feature).
export const SKILL_APPLICABLE_NODES = {
  srs: ['module', 'screen', 'feature'],
  testcase: ['module', 'screen', 'feature'],
  apitest: ['module', 'screen', 'feature'],
  uitest: ['module', 'screen', 'feature'],
  buganalyzer: ['module', 'screen', 'feature'],
  security: ['module', 'screen', 'feature'],
  performance: ['module', 'screen', 'feature'],
};

// ── Trục 2: stage_type / phase (enum trong data model) ───────────────────────
export const STAGE_TYPES = [
  { key: 'new_feature', label: 'New Feature' },
  { key: 'integration', label: 'Integration' },
  { key: 'pre_release', label: 'Pre-release' },
  { key: 'post_release', label: 'Post-release' },
  { key: 'regression', label: 'Regression' },
];

// ── Template (quyết định bộ stage bật/tắt mặc định) ──────────────────────────
// enabledByDefault: các activity BẬT sẵn khi chọn template; các activity còn lại
// vẫn hiện trong UI để user tự bật, nhưng mặc định OFF.
export const STRATEGY_TEMPLATES = [
  {
    key: 'new_feature',
    label: 'Tính năng mới',
    desc: 'Feature mới trong sản phẩm — test chức năng từ API tới manual',
    enabledByDefault: ['api', 'smoke', 'manual'],
  },
  {
    key: 'feature_addition',
    label: 'Bổ sung / mở rộng tính năng',
    desc: 'Thêm vào product đang chạy — cần regression để không hồi quy',
    enabledByDefault: ['api', 'smoke', 'manual', 'regression'],
  },
  {
    key: 'hotfix',
    label: 'Sửa bug / Hotfix',
    desc: 'Vá nhanh — test trọng tâm quanh vùng sửa + regression',
    enabledByDefault: ['smoke', 'manual', 'regression'],
  },
  {
    key: 'new_version',
    label: 'Phiên bản mới / Release lớn',
    desc: 'Release version mới — full functional + performance trước khi phát hành',
    enabledByDefault: ['api', 'smoke', 'manual', 'regression', 'performance'],
  },
  {
    key: 'full_product',
    label: 'Sản phẩm mới hoàn toàn',
    desc: 'Sản phẩm mới — chạy full pipeline gồm cả performance & security',
    enabledByDefault: ['api', 'smoke', 'manual', 'regression', 'performance', 'security'],
  },
];

export function getTemplate(key) {
  return STRATEGY_TEMPLATES.find(t => t.key === key) || null;
}

// Mã ngắn cho badge sidebar (đủ gọn để không che tên project; nhãn đầy đủ để ở tooltip).
export function templateShort(key) {
  return ({
    new_feature: 'NEW',
    feature_addition: 'ADD',
    hotfix: 'FIX',
    new_version: 'VER',
    full_product: 'FULL',
  })[key] || 'TP';
}

export function activityLabel(key) {
  return STAGE_ACTIVITIES.find(a => a.key === key)?.label || key;
}

export function stageTypeLabel(key) {
  return STAGE_TYPES.find(t => t.key === key)?.label || key;
}

// Chi tiết CHUẨN của từng hoạt động test (dùng chung mọi template — chỉ khác nhau ở
// stage nào được BẬT). Cho phép sinh Test Strategy đầy đủ bằng CODE (0 token) thay vì AI.
export const STAGE_DETAILS = {
  api: {
    stageType: 'integration', trigger: 'Ngay khi dev hoàn thành endpoint', skills: ['apitest'],
    entryCriteria: 'Endpoint đã deploy lên môi trường test, có API spec/tài liệu',
    exitCriteria: '100% API test case pass, 0 bug P1/P2 trên API',
    owner: 'QA API / Dev', sprint: 'Sớm — khi backend sẵn sàng',
  },
  smoke: {
    stageType: 'integration', trigger: 'Mỗi khi có build mới deploy', skills: ['testcase'],
    entryCriteria: 'Build deploy thành công lên môi trường test',
    exitCriteria: 'Toàn bộ smoke test pass (luồng chính không bể)',
    owner: 'QA', sprint: 'Mỗi build',
  },
  manual: {
    stageType: 'new_feature', trigger: 'Sau khi smoke test pass', skills: ['testcase', 'uitest'],
    entryCriteria: 'Smoke đã pass, feature sẵn sàng test chức năng',
    exitCriteria: 'Full functional test pass, bug P1/P2 đã fix & verify',
    owner: 'QA Manual', sprint: 'Trong sprint phát triển feature',
  },
  regression: {
    stageType: 'regression', trigger: 'Trước mỗi release / sau khi fix bug lớn', skills: ['testcase'],
    entryCriteria: 'Các thay đổi đã test xong ở stage trước',
    exitCriteria: 'Bộ regression pass 100%, không phát sinh hồi quy',
    owner: 'QA', sprint: 'Trước release',
  },
  performance: {
    stageType: 'pre_release', trigger: 'Trên staging trước khi release', skills: ['performance'],
    entryCriteria: 'Chức năng đã ổn định trên staging',
    exitCriteria: 'Đạt ngưỡng KPI (P95 latency, error rate, throughput) đã đặt',
    owner: 'Performance Engineer', sprint: 'Giai đoạn pre-release',
  },
  security: {
    stageType: 'pre_release', trigger: 'Trên staging trước khi release', skills: ['security'],
    entryCriteria: 'Chức năng đã ổn định trên staging',
    exitCriteria: 'Không còn lỗ hổng Critical/High theo OWASP checklist',
    owner: 'Security QA', sprint: 'Giai đoạn pre-release',
  },
};

// Bộ stage khởi tạo cho 1 template — CHI TIẾT ĐẦY ĐỦ (từ STAGE_DETAILS) + enabled theo
// template. Dùng làm: khung merge kết quả AI (normalizeStages), và nguồn sinh strategy bằng code.
export function buildDefaultStages(templateKey) {
  const tpl = getTemplate(templateKey);
  const enabled = new Set(tpl?.enabledByDefault || []);
  return STAGE_ACTIVITIES.map(a => {
    const d = STAGE_DETAILS[a.key] || {};
    return {
      key: a.key,
      activity: a.label,
      stageType: d.stageType || '',
      enabled: enabled.has(a.key),
      trigger: d.trigger || '',
      skills: d.skills ? [...d.skills] : [],
      entryCriteria: d.entryCriteria || '',
      exitCriteria: d.exitCriteria || '',
    };
  });
}

// Chuẩn hóa stages AI trả về: khớp theo key với 6 activity chuẩn, giữ nguyên thứ tự,
// lấp phần AI thiếu bằng default của template. Phòng thủ để UI luôn có đủ 6 dòng
// dù AI trả thiếu/thừa/sai key (giống cách phòng thủ ở srs-clarification.js).
export function normalizeStages(aiStages, templateKey) {
  const base = buildDefaultStages(templateKey);
  if (!Array.isArray(aiStages)) return base;
  const byKey = new Map();
  for (const s of aiStages) {
    if (s && typeof s === 'object' && s.key) byKey.set(s.key, s);
  }
  return base.map(def => {
    const ai = byKey.get(def.key);
    if (!ai) return def;
    return {
      key: def.key,
      activity: def.activity,
      stageType: typeof ai.stageType === 'string' ? ai.stageType : def.stageType,
      enabled: typeof ai.enabled === 'boolean' ? ai.enabled : def.enabled,
      trigger: typeof ai.trigger === 'string' ? ai.trigger : def.trigger,
      skills: Array.isArray(ai.skills) ? ai.skills : def.skills,
      entryCriteria: typeof ai.entryCriteria === 'string' ? ai.entryCriteria : def.entryCriteria,
      exitCriteria: typeof ai.exitCriteria === 'string' ? ai.exitCriteria : def.exitCriteria,
    };
  });
}

// Sinh Test Strategy HOÀN CHỈNH bằng CODE (0 token, tức thời) — summary + stages +
// executionPlan + releaseGate, dựa trên template. Nếu truyền stagesOverride (ví dụ user
// đã toggle trong wizard) thì dùng bộ đó; executionPlan/releaseGate tính theo stage đang BẬT.
export function generateDefaultStrategy(templateKey, projectName, note, stagesOverride) {
  const stages = Array.isArray(stagesOverride) && stagesOverride.length
    ? stagesOverride
    : buildDefaultStages(templateKey);
  const enabled = stages.filter(s => s.enabled);
  const tpl = getTemplate(templateKey);

  const summary = `Chiến lược test cho "${projectName || 'dự án'}" theo loại "${tpl?.label || templateKey}". `
    + (enabled.length
      ? `Chạy ${enabled.length} stage: ${enabled.map(s => s.activity).join(', ')}.`
      : 'Chưa bật stage nào — cần cấu hình trước khi release.')
    + (note && note.trim() ? ` Ghi chú: ${note.trim()}` : '');

  const executionPlan = {
    priorityOrder: enabled.map(s => s.key),
    sprintMap: enabled.map(s => ({ stage: s.key, when: STAGE_DETAILS[s.key]?.sprint || '' })),
    ownerMap: enabled.map(s => ({ stage: s.key, owner: STAGE_DETAILS[s.key]?.owner || 'QA' })),
  };

  const releaseGate = enabled.length
    ? `Đủ điều kiện release khi các stage bật (${enabled.map(s => s.activity).join(', ')}) đều đạt exit criteria, 0 bug P1 open.`
    : 'Chưa bật stage nào — cần cấu hình kế hoạch test trước khi release.';

  return { summary, stages, executionPlan, releaseGate };
}
