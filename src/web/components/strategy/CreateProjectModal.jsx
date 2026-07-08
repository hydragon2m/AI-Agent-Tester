import { useState, useMemo } from 'react';
import {
  STRATEGY_TEMPLATES,
  buildDefaultStages,
  getTemplate,
} from '../../features/skills/strategy-templates';
import { previewVisibleSkillIds } from '../../utils/skill-gating';
import { SKILLS } from '../../features/skills/skill-registry';
import { createNodeApi } from '../../backend-api/nodes.api';
import { createStrategyApi } from '../../backend-api/strategy.api';

// Wizard 3 bước tạo Project + Test Plan trong 1 System.
//   B1: tên dự án (+ context)  →  B2: chọn template  →  B3: toggle stage + preview skill (Screen).
// Lưu = tạo project node (kèm systemId) + tạo test_strategies status='configured'.
export function CreateProjectModal({ systemId, systemName, onClose, onCreated, onToast }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [template, setTemplate] = useState('feature_addition');
  const [stages, setStages] = useState(() => buildDefaultStages('feature_addition'));
  const [saving, setSaving] = useState(false);

  function chooseTemplate(key) {
    setTemplate(key);
    setStages(buildDefaultStages(key)); // đổi template → reset toggle về mặc định của template
  }
  function toggleStage(key) {
    setStages(prev => prev.map(s => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  }

  // Preview skill hiển thị cho node Screen theo cấu hình đang chọn.
  const previewSkills = useMemo(() => previewVisibleSkillIds('screen', template, stages), [template, stages]);
  const enabledCount = stages.filter(s => s.enabled).length;

  async function handleSave() {
    if (!name.trim()) { onToast?.('Nhập tên dự án'); setStep(1); return; }
    setSaving(true);
    try {
      const project = await createNodeApi({
        parentId: null, type: 'project',
        name: name.trim(), context: context.trim(), systemId: systemId || null,
      });
      await createStrategyApi({
        projectId: project.id,
        nodeId: project.id,
        template,
        summary: '',
        stages,
        executionPlan: null,
        releaseGate: '',
        status: 'configured',
      });
      onToast?.(`✅ Đã tạo project "${project.name}" + test plan`);
      onCreated?.(project);
    } catch (e) {
      onToast?.(`Tạo project thất bại: ${e.message}`);
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>Tạo Project mới{systemName ? ` — ${systemName}` : ''}</h2>
          <button className="btn-close" onClick={onClose} disabled={saving}>×</button>
        </div>
        <div className="modal-body">
          <StepIndicator step={step} />

          {step === 1 && (
            <>
              <div className="pf-field">
                <label className="pf-label">Tên dự án *</label>
                <input
                  className="pf-input"
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ví dụ: Kho"
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2); }}
                />
              </div>
              <div className="pf-field">
                <label className="pf-label">Context / mô tả (tùy chọn)</label>
                <textarea
                  className="pf-input"
                  style={{ minHeight: 60, resize: 'vertical' }}
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="Bối cảnh nghiệp vụ, stack, ghi chú..."
                />
              </div>
            </>
          )}

          {step === 2 && (
            <div className="pf-field">
              <label className="pf-label">Loại dự án (quyết định các stage test bật mặc định)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {STRATEGY_TEMPLATES.map(t => {
                  const active = t.key === template;
                  return (
                    <button
                      key={t.key} type="button" onClick={() => chooseTemplate(t.key)}
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
                        {t.enabledByDefault.length} stage mặc định: {t.enabledByDefault.join(', ') || '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
              <div>
                <label className="pf-label">
                  Stage test — bật {enabledCount}/{stages.length} (template: {getTemplate(template)?.label || template})
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                  {stages.map(s => (
                    <button
                      key={s.key} type="button" onClick={() => toggleStage(s.key)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        padding: '8px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: `1px solid ${s.enabled ? 'var(--accent-color, #f0a000)' : 'var(--border-color, #444)'}`,
                        background: s.enabled ? 'rgba(240,160,0,0.06)' : 'rgba(255,255,255,0.02)',
                        color: 'var(--text-color, #fff)', opacity: s.enabled ? 1 : 0.6,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 12.5 }}>{s.activity}</span>
                      <span style={{
                        minWidth: 42, textAlign: 'center', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                        color: s.enabled ? '#0b0b0b' : '#fff', background: s.enabled ? '#2ecc71' : 'var(--panel-bg-alt, #444)',
                      }}>
                        {s.enabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="pf-label">Skill sẽ hiện ở màn hình (Screen)</label>
                <div style={{
                  marginTop: 6, padding: '10px 12px', borderRadius: 8,
                  border: '1px dashed var(--border-color, #444)', background: 'rgba(255,255,255,0.03)',
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {previewSkills.map(id => (
                      <span key={id} style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12,
                        border: '1px solid #2ecc71', color: '#2ecc71',
                      }}>
                        {SKILLS[id]?.label || id}
                      </span>
                    ))}
                    {previewSkills.length === 0 && <span className="pf-hint">Không có skill nào.</span>}
                  </div>
                  <div className="pf-hint" style={{ marginTop: 8, fontSize: 10.5 }}>
                    Bật/tắt stage bên trái để xem skill thay đổi. Skill nền tảng (SRS, Bug Analyzer) luôn hiện.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={saving}>Hủy</button>
            {step > 1 && <button className="btn-secondary" onClick={() => setStep(step - 1)} disabled={saving}>← Quay lại</button>}
            {step < 3 && (
              <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !name.trim()}>
                Tiếp →
              </button>
            )}
            {step === 3 && (
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ step }) {
  const labels = ['Tên dự án', 'Chọn template', 'Cấu hình stage'];
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={n} style={{
            flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '5px 4px', borderRadius: 6,
            border: `1px solid ${active ? 'var(--accent-color, #f0a000)' : 'var(--border-color, #444)'}`,
            background: active ? 'rgba(240,160,0,0.12)' : (done ? 'rgba(46,204,113,0.08)' : 'transparent'),
            color: active ? 'var(--accent-color, #f0a000)' : (done ? '#2ecc71' : 'inherit'),
            opacity: active || done ? 1 : 0.55,
          }}>
            {done ? '✓' : n}. {label}
          </div>
        );
      })}
    </div>
  );
}
