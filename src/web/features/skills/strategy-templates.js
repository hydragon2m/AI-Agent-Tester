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

// Bộ stage khởi tạo cho 1 template — dùng làm fallback nếu AI lỗi, và làm khung
// để merge kết quả AI vào (giữ đúng thứ tự + đủ 6 activity).
export function buildDefaultStages(templateKey) {
  const tpl = getTemplate(templateKey);
  const enabled = new Set(tpl?.enabledByDefault || []);
  return STAGE_ACTIVITIES.map(a => ({
    key: a.key,
    activity: a.label,
    stageType: '',
    enabled: enabled.has(a.key),
    trigger: '',
    skills: [],
    entryCriteria: '',
    exitCriteria: '',
  }));
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
