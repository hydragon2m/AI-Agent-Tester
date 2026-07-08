const { dbRun, dbGet, dbAll } = require('../db/db_manager');

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    nodeId: row.node_id || null,
    template: row.template || '',
    summary: row.summary || '',
    stages: row.stages_json ? JSON.parse(row.stages_json) : [],
    executionPlan: row.execution_plan_json ? JSON.parse(row.execution_plan_json) : null,
    releaseGate: row.release_gate || '',
    status: row.status || 'draft',
    approvedBy: row.approved_by || '',
    approvedAt: row.approved_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || null,
  };
}

// Strategy "hiện tại" của 1 project = bản mới nhất (mỗi lần approve = 1 revision mới,
// giữ nguyên bản cũ — cùng triết lý revision với skill_runs).
async function getLatestStrategy(projectId) {
  const row = await dbGet(
    'SELECT * FROM test_strategies WHERE project_id = ? ORDER BY created_at DESC LIMIT 1',
    [projectId]
  );
  return mapRow(row);
}

async function getStrategyById(id) {
  return mapRow(await dbGet('SELECT * FROM test_strategies WHERE id = ?', [id]));
}

async function createStrategy({ projectId, nodeId, template, summary, stages, executionPlan, releaseGate, status, approvedBy }) {
  const id = 'strat_' + Date.now().toString() + '_' + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  // 'configured' = test plan đã được cấu hình toggle (skill-gating bật). 'approved' = chốt release.
  const finalStatus = ['approved', 'configured', 'draft'].includes(status) ? status : 'draft';
  await dbRun(
    `INSERT INTO test_strategies
       (id, project_id, node_id, template, summary, stages_json, execution_plan_json, release_gate, status, approved_by, approved_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      nodeId || null,
      template || '',
      summary || '',
      JSON.stringify(stages || []),
      JSON.stringify(executionPlan || null),
      releaseGate || '',
      finalStatus,
      approvedBy || '',
      finalStatus === 'approved' ? now : null,
      now,
      now,
    ]
  );
  return getStrategyById(id);
}

// Cập nhật toggle/nội dung của 1 strategy đã lưu (không tạo revision mới).
async function updateStrategy(id, { summary, stages, executionPlan, releaseGate, status, approvedBy }) {
  const existing = await dbGet('SELECT * FROM test_strategies WHERE id = ?', [id]);
  if (!existing) return null;
  const now = new Date().toISOString();
  const nextStatus = status || existing.status;
  const becameApproved = nextStatus === 'approved' && existing.status !== 'approved';
  await dbRun(
    `UPDATE test_strategies SET
       summary = COALESCE(?, summary),
       stages_json = COALESCE(?, stages_json),
       execution_plan_json = COALESCE(?, execution_plan_json),
       release_gate = COALESCE(?, release_gate),
       status = ?,
       approved_by = COALESCE(?, approved_by),
       approved_at = ?,
       updated_at = ?
     WHERE id = ?`,
    [
      summary !== undefined ? summary : null,
      stages !== undefined ? JSON.stringify(stages) : null,
      executionPlan !== undefined ? JSON.stringify(executionPlan) : null,
      releaseGate !== undefined ? releaseGate : null,
      nextStatus,
      approvedBy !== undefined ? approvedBy : null,
      becameApproved ? now : existing.approved_at,
      now,
      id,
    ]
  );
  return getStrategyById(id);
}

async function deleteStrategy(id) {
  const existing = await dbGet('SELECT * FROM test_strategies WHERE id = ?', [id]);
  if (!existing) return false;
  await dbRun('DELETE FROM test_strategies WHERE id = ?', [id]);
  return true;
}

// ── Release Check ─────────────────────────────────────────────────────────────
// Tính tiến độ test theo từng stage (activity) của project, dựa trên cột
// test_cases.stage + status. Status theo vocabulary Lark: Pass/Fail/Pending/Block/Untest
// (rỗng = chưa chạy). Chỉ tính các stage đang BẬT trong test plan mới nhất (nếu có
// plan configured/approved); nếu chưa có plan thì lấy các stage đang xuất hiện trong TC.
function normStatus(s) {
  return (s || '').trim().toLowerCase();
}

function mkBlocker(tc, stageKey, reason) {
  return {
    id: tc.id,
    name: tc.name,
    stage: stageKey,
    priority: tc.priority || '',
    status: tc.status || '',
    relatedBug: tc.related_bug || '',
    reason, // 'fail' | 'block'
  };
}

async function getReleaseCheck(projectId) {
  const latest = await getLatestStrategy(projectId);
  const rows = await dbAll(
    `SELECT id, name, stage, status, priority, related_bug
       FROM test_cases
      WHERE node_id IN (SELECT id FROM nodes WHERE project_id = ?)`,
    [projectId]
  );

  // Gom TC theo stage (activity key). TC chưa gán stage → đếm riêng.
  let unassignedCount = 0;
  const byStage = new Map();
  for (const tc of rows) {
    const key = normStatus(tc.stage); // dùng cùng chuẩn hóa (lower/trim) cho stage key
    if (!key) { unassignedCount++; continue; }
    if (!byStage.has(key)) byStage.set(key, []);
    byStage.get(key).push(tc);
  }

  // Stage cần báo cáo: nếu plan đã cấu hình → các activity đang bật; ngược lại → stage có TC.
  const planConfigured = latest && Array.isArray(latest.stages)
    && (latest.status === 'configured' || latest.status === 'approved');
  const stageKeys = planConfigured
    ? latest.stages.filter(s => s.enabled).map(s => s.key)
    : Array.from(byStage.keys());

  const blockers = [];
  const stages = stageKeys.map(key => {
    const list = byStage.get(key) || [];
    let passed = 0, failed = 0, blocked = 0, pending = 0;
    for (const tc of list) {
      const st = normStatus(tc.status);
      if (st === 'pass') passed++;
      else if (st === 'fail') { failed++; blockers.push(mkBlocker(tc, key, 'fail')); }
      else if (st === 'block') { blocked++; blockers.push(mkBlocker(tc, key, 'block')); }
      else pending++; // pending / untest / rỗng = chưa hoàn thành
    }
    const total = list.length;
    const percent = total ? Math.round((passed / total) * 100) : 0;
    return { key, total, passed, failed, blocked, pending, percent };
  });

  // Go / No-go: chưa có TC nào → 'pending'; mọi stage bật đều 100% pass & không blocker → 'go'; còn lại 'no-go'.
  const anyTc = stages.some(s => s.total > 0);
  let goNoGo;
  if (!anyTc) goNoGo = 'pending';
  else {
    const allPass = stages.every(s => s.total > 0 && s.passed === s.total);
    goNoGo = (allPass && blockers.length === 0) ? 'go' : 'no-go';
  }

  return { projectId, planConfigured: !!planConfigured, stages, blockers, unassignedCount, goNoGo };
}

module.exports = {
  getLatestStrategy,
  getStrategyById,
  createStrategy,
  updateStrategy,
  deleteStrategy,
  getReleaseCheck,
};
