import { useEffect, useState } from 'react';
import {
  STRATEGY_TEMPLATES,
  getTemplate,
  stageTypeLabel,
  activityLabel,
  normalizeStages,
} from '../../features/skills/strategy-templates';
import {
  createStrategyApi,
  fetchStrategyApi,
  updateStrategyApi,
  fetchReleaseCheckApi,
} from '../../backend-api/strategy.api';

// Panel Test Strategy hiển thị INLINE trong workspace khi node đang chọn là project.
// Thay thế hoàn toàn phần skill (Requirement/Output) — project node chỉ có màn này.
// view: 'loading' | 'current' (đã có strategy) | 'generate' (chọn template) | 'review' (duyệt draft AI).
export function StrategyPanel({ projectNode, onGenerateDraft, onToast, demoMode, onPlanChanged }) {
  const projectId = projectNode?.projectId || projectNode?.id;
  const [tab, setTab] = useState('plan'); // 'plan' | 'release'
  const [view, setView] = useState('loading');
  const [existing, setExisting] = useState(null);
  const [template, setTemplate] = useState('feature_addition');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState(null);      // { summary, stages, executionPlan, releaseGate, provider }
  const [stages, setStages] = useState([]);       // stages có thể toggle trong Review
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tải strategy hiện tại mỗi khi đổi sang 1 project node khác.
  useEffect(() => {
    let alive = true;
    setDraft(null);
    setStages([]);
    if (!projectId) { setView('generate'); return; }
    setView('loading');
    fetchStrategyApi(projectId)
      .then(s => {
        if (!alive) return;
        if (s) { setExisting(s); setView('current'); }
        else { setExisting(null); setView('generate'); }
      })
      .catch(e => {
        if (!alive) return;
        onToast?.(`Lỗi tải strategy: ${e.message}`);
        setExisting(null);
        setView('generate');
      });
    return () => { alive = false; };
  }, [projectId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const parsed = await onGenerateDraft(template, note);
      if (!parsed) return;
      setDraft(parsed);
      setStages(normalizeStages(parsed.stages, template));
      setView('review');
    } catch (e) {
      onToast?.(`Sinh strategy thất bại: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }

  function toggleStage(key) {
    setStages(prev => prev.map(s => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  }

  async function handleApprove() {
    if (!projectId) { onToast?.('Không xác định được project'); return; }
    setSaving(true);
    try {
      const saved = await createStrategyApi({
        projectId,
        nodeId: projectNode?.id || null,
        template,
        summary: draft?.summary || '',
        stages,
        executionPlan: draft?.executionPlan || null,
        releaseGate: draft?.releaseGate || '',
        status: 'approved',
        approvedBy: '',
      });
      setExisting(saved);
      setView('current');
      onPlanChanged?.(); // refresh badge sidebar
      onToast?.('✅ Đã lưu & approve Test Strategy');
    } catch (e) {
      onToast?.(`Lưu strategy thất bại: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  function startRegenerate() {
    setDraft(null);
    setStages([]);
    setView('generate');
  }

  // Lưu toggle stage của plan hiện có mà KHÔNG cần AI regen (cập nhật tại chỗ, đánh dấu configured).
  async function handleSaveToggles(newStages) {
    if (!existing?.id) return;
    try {
      const saved = await updateStrategyApi(existing.id, { stages: newStages, status: 'configured' });
      setExisting(saved);
      onPlanChanged?.(); // refresh badge sidebar
      onToast?.('✅ Đã lưu kế hoạch test');
    } catch (e) {
      onToast?.(`Lưu kế hoạch thất bại: ${e.message}`);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="step-badge">Test Plan</span>
          <h2>Kế hoạch test — {projectNode?.name || 'Project'}</h2>
          <span>Cấu hình stage test → quản lý release theo tiến độ</span>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'plan' && (
        <div style={{ padding: '4px 2px' }}>
          {view === 'loading' && <p className="pf-hint">Đang tải kế hoạch test...</p>}

          {view === 'generate' && (
            <GenerateView
              template={template}
              setTemplate={setTemplate}
              note={note}
              setNote={setNote}
              generating={generating}
              onGenerate={handleGenerate}
              hasExisting={!!existing}
              onBack={existing ? () => setView('current') : null}
              demoMode={demoMode}
            />
          )}

          {view === 'review' && (
            <ReviewView
              draft={draft}
              stages={stages}
              template={template}
              toggleStage={toggleStage}
              saving={saving}
              onApprove={handleApprove}
              onRegenerate={startRegenerate}
            />
          )}

          {view === 'current' && existing && (
            <CurrentView
              strategy={existing}
              onRegenerate={startRegenerate}
              onSaveToggles={handleSaveToggles}
              onGoRelease={() => setTab('release')}
            />
          )}
        </div>
      )}

      {tab === 'release' && <ReleaseCheckView projectId={projectId} />}
    </section>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [{ key: 'plan', label: 'Kế hoạch test' }, { key: 'release', label: 'Release Check' }];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-color, #444)', marginBottom: 8 }}>
      {tabs.map(t => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              background: 'none', border: 'none', color: active ? 'var(--accent-color, #f0a000)' : 'inherit',
              borderBottom: `2px solid ${active ? 'var(--accent-color, #f0a000)' : 'transparent'}`,
              opacity: active ? 1 : 0.7, marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function GenerateView({ template, setTemplate, note, setNote, generating, onGenerate, hasExisting, onBack, demoMode }) {
  return (
    <>
      <p className="pf-hint" style={{ marginTop: 0 }}>
        Chọn loại project — tool sẽ đề xuất các stage test theo thứ tự, điều kiện vào/ra và điều kiện release.
        {demoMode ? ' (Đang ở Demo mode — kết quả là mẫu.)' : ''}
      </p>
      <div className="pf-field">
        <label className="pf-label">Loại project (template)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {STRATEGY_TEMPLATES.map(t => {
            const active = t.key === template;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplate(t.key)}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${active ? 'var(--accent-color, #f0a000)' : 'var(--border-color, #444)'}`,
                  background: active ? 'rgba(240,160,0,0.10)' : 'var(--panel-bg-alt, #222)',
                  color: 'var(--text-color, #fff)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{t.desc}</div>
                <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4 }}>
                  Bật sẵn: {t.enabledByDefault.length ? t.enabledByDefault.join(', ') : '—'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="pf-field">
        <label className="pf-label">Ghi chú thêm (tùy chọn)</label>
        <textarea
          className="pf-input"
          style={{ minHeight: 60, resize: 'vertical' }}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Ràng buộc riêng, deadline, môi trường, phần cần đặc biệt lưu ý..."
        />
      </div>
      <div className="modal-actions">
        {onBack && <button className="btn-secondary" onClick={onBack} disabled={generating}>Quay lại</button>}
        <button className="btn-primary" onClick={onGenerate} disabled={generating}>
          {generating ? 'Đang sinh...' : (hasExisting ? 'Sinh lại chiến lược' : 'Sinh Test Strategy')}
        </button>
      </div>
    </>
  );
}

function ReviewView({ draft, stages, template, toggleStage, saving, onApprove, onRegenerate }) {
  const tpl = getTemplate(template);
  const enabledCount = stages.filter(s => s.enabled).length;
  return (
    <>
      {draft?.summary && (
        <p className="pf-hint" style={{ marginTop: 0 }}><strong>Tóm tắt:</strong> {draft.summary}</p>
      )}
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
        Template: <strong>{tpl?.label || template}</strong> · Bật {enabledCount}/{stages.length} stage · Bấm để bật/tắt từng stage.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stages.map((s, i) => (
          <StageRow key={s.key} stage={s} index={i + 1} onToggle={() => toggleStage(s.key)} editable />
        ))}
      </div>
      <ExecutionPlan plan={draft?.executionPlan} />
      {draft?.releaseGate && (
        <div className="pf-field" style={{ marginTop: 12 }}>
          <label className="pf-label">🚦 Release gate</label>
          <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', opacity: 0.85 }}>{draft.releaseGate}</div>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onRegenerate} disabled={saving}>Sinh lại</button>
        <button className="btn-primary" onClick={onApprove} disabled={saving || enabledCount === 0}>
          {saving ? 'Đang lưu...' : 'Approve strategy'}
        </button>
      </div>
    </>
  );
}

function CurrentView({ strategy, onRegenerate, onSaveToggles, onGoRelease }) {
  const [editing, setEditing] = useState(false);
  const [localStages, setLocalStages] = useState(strategy.stages || []);
  const [saving, setSaving] = useState(false);

  // Đổi project (hoặc lưu xong) → đồng bộ lại local, thoát chế độ edit.
  useEffect(() => { setLocalStages(strategy.stages || []); setEditing(false); }, [strategy]);

  const isApproved = strategy.status === 'approved';
  const enabled = (strategy.stages || []).filter(s => s.enabled);
  const disabled = (strategy.stages || []).filter(s => !s.enabled);

  function toggleLocal(key) {
    setLocalStages(prev => prev.map(s => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  }
  async function save() {
    setSaving(true);
    await onSaveToggles?.(localStages);
    setSaving(false);
  }

  return (
    <>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10,
        padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        border: '1px solid #2ecc71', color: '#2ecc71', background: 'rgba(46,204,113,0.08)',
      }}>
        {isApproved ? '✅ Đã approve' : '✅ Đã cấu hình'}
        {isApproved && strategy.approvedAt ? ` · ${new Date(strategy.approvedAt).toLocaleString('vi-VN')}` : ''}
      </div>
      {strategy.summary && (
        <p className="pf-hint" style={{ marginTop: 0 }}><strong>Tóm tắt:</strong> {strategy.summary}</p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className="pf-label" style={{ margin: 0 }}>
          {editing ? 'Bật/tắt stage rồi bấm Lưu' : `Các stage đang bật (${enabled.length})`}
        </label>
        {!editing && (
          <button className="btn-secondary" style={{ padding: '2px 10px', fontSize: 11 }} onClick={() => setEditing(true)}>
            ✎ Chỉnh stage
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {editing
          ? localStages.map((s, i) => (
              <StageRow key={s.key} stage={s} index={i + 1} onToggle={() => toggleLocal(s.key)} editable />
            ))
          : enabled.map((s, i) => <StageRow key={s.key} stage={s} index={i + 1} />)}
        {!editing && enabled.length === 0 && <div className="pf-hint">Chưa có stage nào được bật.</div>}
      </div>

      {!editing && disabled.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, opacity: 0.55 }}>
          Stage tắt: {disabled.map(s => s.activity).join(', ')}
        </div>
      )}

      <ExecutionPlan plan={strategy.executionPlan} />
      {strategy.releaseGate && (
        <div className="pf-field" style={{ marginTop: 12 }}>
          <label className="pf-label">🚦 Release gate</label>
          <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', opacity: 0.85 }}>{strategy.releaseGate}</div>
        </div>
      )}

      {!editing && (
        <div style={{
          marginTop: 14, padding: '8px 12px', borderRadius: 6, fontSize: 11.5,
          background: 'rgba(255,255,255,0.04)', border: '1px dashed var(--border-color, #444)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        }}>
          <span style={{ opacity: 0.8 }}>📊 Tiến độ % pass mỗi stage và Go/No-go release ở tab <strong>Release Check</strong>.</span>
          <button className="btn-secondary" style={{ padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap' }} onClick={onGoRelease}>
            Mở Release Check →
          </button>
        </div>
      )}

      <div className="modal-actions">
        {editing ? (
          <>
            <button className="btn-secondary" onClick={() => { setEditing(false); setLocalStages(strategy.stages || []); }} disabled={saving}>
              Hủy
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </>
        ) : (
          <button className="btn-primary" onClick={onRegenerate}>Tạo lại bằng AI</button>
        )}
      </div>
    </>
  );
}

function StageRow({ stage, index, onToggle, editable }) {
  const on = stage.enabled;
  return (
    <div style={{
      border: `1px solid ${on ? 'var(--accent-color, #f0a000)' : 'var(--border-color, #444)'}`,
      borderRadius: 8, padding: '10px 12px',
      background: on ? 'rgba(240,160,0,0.06)' : 'rgba(255,255,255,0.02)',
      opacity: on ? 1 : 0.6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          Stage {index}: {stage.activity}
          {stage.stageType && (
            <span style={{
              marginLeft: 8, fontSize: 10, fontWeight: 500, padding: '1px 7px', borderRadius: 10,
              background: 'rgba(255,255,255,0.08)', opacity: 0.8,
            }}>
              {stageTypeLabel(stage.stageType)}
            </span>
          )}
        </div>
        {editable ? (
          <button
            type="button"
            onClick={onToggle}
            style={{
              minWidth: 54, padding: '3px 10px', borderRadius: 14, cursor: 'pointer', fontSize: 11, fontWeight: 700,
              border: 'none', color: on ? '#0b0b0b' : '#fff',
              background: on ? '#2ecc71' : 'var(--panel-bg-alt, #444)',
            }}
          >
            {on ? 'ON' : 'OFF'}
          </button>
        ) : (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#2ecc71' }}>ON</span>
        )}
      </div>
      {(stage.trigger || stage.entryCriteria || stage.exitCriteria || (stage.skills && stage.skills.length > 0)) && (
        <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, opacity: 0.82 }}>
          {stage.trigger && <div>⏱ <strong>Khi nào:</strong> {stage.trigger}</div>}
          {stage.entryCriteria && <div>▶ <strong>Vào:</strong> {stage.entryCriteria}</div>}
          {stage.exitCriteria && <div>⏹ <strong>Ra:</strong> {stage.exitCriteria}</div>}
          {stage.skills && stage.skills.length > 0 && <div>🧩 <strong>Skill:</strong> {stage.skills.join(', ')}</div>}
        </div>
      )}
    </div>
  );
}

function ExecutionPlan({ plan }) {
  if (!plan) return null;
  const sprintMap = Array.isArray(plan.sprintMap) ? plan.sprintMap : [];
  const ownerMap = Array.isArray(plan.ownerMap) ? plan.ownerMap : [];
  const priorityOrder = Array.isArray(plan.priorityOrder) ? plan.priorityOrder : [];
  if (!sprintMap.length && !ownerMap.length && !priorityOrder.length) return null;
  return (
    <div className="pf-field" style={{ marginTop: 12 }}>
      <label className="pf-label">📋 Execution plan</label>
      {priorityOrder.length > 0 && (
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <strong>Thứ tự ưu tiên:</strong> {priorityOrder.join(' → ')}
        </div>
      )}
      {(sprintMap.length > 0 || ownerMap.length > 0) && (
        <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sprintMap.map((m, i) => (
            <div key={`sp-${i}`}>🗓 <strong>{m.stage}:</strong> {m.when}</div>
          ))}
          {ownerMap.map((m, i) => (
            <div key={`ow-${i}`}>👤 <strong>{m.stage}:</strong> {m.owner}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tab Release Check — tiến độ test theo stage (từ test_cases.stage + status) + Go/No-go.
const GO_BADGE = {
  go: { text: '✅ GO — đủ điều kiện release', color: '#2ecc71' },
  'no-go': { text: '⛔ NO-GO — chưa đủ điều kiện', color: '#e74c3c' },
  pending: { text: '⏳ Chưa đủ dữ liệu', color: '#c9a227' },
};

function ReleaseCheckView({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  function load() {
    if (!projectId) return;
    setLoading(true); setErr('');
    fetchReleaseCheckApi(projectId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setErr(e.message); setLoading(false); });
  }
  useEffect(() => {
    let alive = true;
    if (!projectId) { setLoading(false); return; }
    setLoading(true); setErr('');
    fetchReleaseCheckApi(projectId)
      .then(d => { if (alive) { setData(d); setLoading(false); } })
      .catch(e => { if (alive) { setErr(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, [projectId]);

  if (loading) return <p className="pf-hint" style={{ padding: '8px 2px' }}>Đang tính tiến độ release...</p>;
  if (err) return <p className="pf-hint" style={{ padding: '8px 2px', color: '#e74c3c' }}>Lỗi tải release check: {err}</p>;
  if (!data) return null;

  const badge = GO_BADGE[data.goNoGo] || GO_BADGE.pending;

  return (
    <div style={{ padding: '4px 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', padding: '5px 12px', borderRadius: 20,
          fontSize: 12.5, fontWeight: 700, border: `1px solid ${badge.color}`, color: badge.color,
          background: `${badge.color}14`,
        }}>
          {badge.text}
        </span>
        <button className="btn-secondary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={load}>↻ Làm mới</button>
      </div>

      {!data.planConfigured && (
        <p className="pf-hint" style={{ marginTop: 0 }}>
          Chưa có test plan cấu hình — đang thống kê theo các stage xuất hiện trong test case.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.stages.map(s => <StageProgress key={s.key} stage={s} />)}
        {data.stages.length === 0 && <div className="pf-hint">Chưa có test case nào để tính tiến độ.</div>}
      </div>

      {data.unassignedCount > 0 && (
        <div style={{ marginTop: 10, fontSize: 11.5, opacity: 0.6 }}>
          ⚠ {data.unassignedCount} test case chưa gán stage (không tính vào tiến độ).
        </div>
      )}

      {data.blockers.length > 0 && (
        <div className="pf-field" style={{ marginTop: 14 }}>
          <label className="pf-label">🚧 Blockers ({data.blockers.length})</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {data.blockers.slice(0, 30).map((b, i) => (
              <div key={`${b.id}-${i}`} style={{ fontSize: 11.5, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
                  border: `1px solid ${b.reason === 'fail' ? '#e74c3c' : '#c9a227'}`,
                  color: b.reason === 'fail' ? '#e74c3c' : '#c9a227',
                }}>
                  {b.reason === 'fail' ? 'FAIL' : 'BLOCK'}
                </span>
                <span style={{ opacity: 0.85 }}>[{activityLabel(b.stage)}] {b.name || b.id}</span>
                {b.priority && <span style={{ opacity: 0.5 }}>· {b.priority}</span>}
                {b.relatedBug && <span style={{ opacity: 0.5 }}>· 🐞 {b.relatedBug}</span>}
              </div>
            ))}
            {data.blockers.length > 30 && (
              <div className="pf-hint" style={{ fontSize: 11 }}>...và {data.blockers.length - 30} blocker khác.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StageProgress({ stage }) {
  const pct = stage.percent;
  const barColor = pct === 100 ? '#2ecc71' : (stage.failed > 0 || stage.blocked > 0 ? '#e74c3c' : '#f0a000');
  return (
    <div style={{ border: '1px solid var(--border-color, #444)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
        <span>{activityLabel(stage.key)}</span>
        <span style={{ opacity: 0.8 }}>{stage.passed}/{stage.total} pass ({pct}%)</span>
      </div>
      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.2s' }} />
      </div>
      <div style={{ marginTop: 5, fontSize: 10.5, opacity: 0.65, display: 'flex', gap: 12 }}>
        {stage.failed > 0 && <span style={{ color: '#e74c3c' }}>✗ {stage.failed} fail</span>}
        {stage.blocked > 0 && <span style={{ color: '#c9a227' }}>▣ {stage.blocked} block</span>}
        {stage.pending > 0 && <span>◌ {stage.pending} chưa chạy</span>}
        {stage.total === 0 && <span>Chưa có test case</span>}
      </div>
    </div>
  );
}
