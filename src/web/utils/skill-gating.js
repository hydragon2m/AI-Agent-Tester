// Skill gating — tính danh sách skill được HIỆN ở skill panel dựa trên node type
// và Test Plan của project. Nguồn cấu hình: features/skills/strategy-templates.js.
//
// Nguyên tắc:
//   - Node "project" không có skill panel (dùng Test Plan panel) → luôn trả [].
//   - Test Plan CHƯA cấu hình (chưa có plan / status != configured|approved) → trả ĐỦ skill
//     (backward-compat: project/node cũ không có plan vẫn dùng được đầy đủ skill cơ bản).
//   - Test Plan ĐÃ cấu hình → chỉ hiện ALWAYS_ON_SKILLS + skill của các activity đang bật,
//     rồi lọc theo applicable_nodes của từng skill.

import { SKILLS } from '../features/skills/skill-registry';
import {
  STAGE_ACTIVITIES,
  ALWAYS_ON_SKILLS,
  INTERNAL_SKILLS,
  SKILL_APPLICABLE_NODES,
  getTemplate,
} from '../features/skills/strategy-templates';

// Vũ trụ skill hiển thị được (theo thứ tự registry, bỏ skill nội bộ).
const ALL_SKILL_IDS = Object.keys(SKILLS).filter(k => !INTERNAL_SKILLS.includes(k));

function isPlanConfigured(plan) {
  return !!(plan && Array.isArray(plan.stages) && (plan.status === 'configured' || plan.status === 'approved'));
}

// Lọc theo applicable_nodes (mặc định: mọi node trừ project).
function filterByNode(skillIds, nodeType) {
  return skillIds.filter(id => {
    const allowed = SKILL_APPLICABLE_NODES[id];
    if (!allowed) return nodeType !== 'project';
    return allowed.includes(nodeType);
  });
}

// Giữ đúng thứ tự trong SKILLS registry cho ổn định UI.
function orderSkills(ids) {
  const wanted = new Set(ids);
  return ALL_SKILL_IDS.filter(id => wanted.has(id));
}

// ALWAYS_ON + skill của các activity đang bật.
function skillsForEnabledActivities(enabledKeys) {
  const set = new Set(ALWAYS_ON_SKILLS);
  for (const key of enabledKeys) {
    const act = STAGE_ACTIVITIES.find(a => a.key === key);
    (act?.skillIds || []).forEach(s => set.add(s));
  }
  return Array.from(set);
}

// Danh sách skill hiện ra cho 1 node, dựa trên test plan đã lưu.
export function getVisibleSkillIds(nodeType, plan) {
  if (nodeType === 'project') return [];
  if (!isPlanConfigured(plan)) {
    return orderSkills(filterByNode(ALL_SKILL_IDS, nodeType));
  }
  const enabledKeys = plan.stages.filter(s => s.enabled).map(s => s.key);
  return orderSkills(filterByNode(skillsForEnabledActivities(enabledKeys), nodeType));
}

// Preview khi đang toggle trên wizard/panel (chưa lưu). Dùng draftStages nếu có,
// nếu không thì lấy enabledByDefault của template.
export function previewVisibleSkillIds(nodeType, templateId, draftStages) {
  if (nodeType === 'project') return [];
  let enabledKeys;
  if (Array.isArray(draftStages) && draftStages.length) {
    enabledKeys = draftStages.filter(s => s.enabled).map(s => s.key);
  } else {
    const tpl = getTemplate(templateId);
    enabledKeys = tpl?.enabledByDefault || [];
  }
  return orderSkills(filterByNode(skillsForEnabledActivities(enabledKeys), nodeType));
}
