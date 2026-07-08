import { useState, useMemo } from 'react';
import {
  STRATEGY_TEMPLATES,
  buildDefaultStages,
  generateDefaultStrategy,
  getTemplate,
} from '../../features/skills/strategy-templates';
import { previewVisibleSkillIds } from '../../utils/skill-gating';
import { SKILLS } from '../../features/skills/skill-registry';
import { createNodeApi } from '../../backend-api/nodes.api';
import { createStrategyApi } from '../../backend-api/strategy.api';
import { Button } from '../ui/Button';
import { X, ArrowLeft, ArrowRight, Check } from 'lucide-react';

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
      // Sinh Test Strategy đầy đủ bằng CODE (0 token) theo template + toggle của user →
      // mở project ra là có sẵn plan chi tiết (summary/executionPlan/releaseGate), status configured.
      const strat = generateDefaultStrategy(template, name.trim(), context, stages);
      await createStrategyApi({
        projectId: project.id,
        nodeId: project.id,
        template,
        summary: strat.summary,
        stages: strat.stages,
        executionPlan: strat.executionPlan,
        releaseGate: strat.releaseGate,
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
    <div className="modal-overlay flex items-center justify-center fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm p-4">
      <div className="modal modal-wide w-full max-w-2xl bg-slate-900 border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="modal-header flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Tạo Project mới{systemName ? ` — ${systemName}` : ''}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={saving} className="h-8 w-8 text-slate-400 hover:text-white rounded-md">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="modal-body p-5 space-y-4">
          <StepIndicator step={step} />

          {step === 1 && (
            <div className="space-y-4">
              <div className="pf-field flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-350">Tên dự án *</label>
                <input
                  className="w-full h-9 px-3 rounded-md border border-border bg-slate-950 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ví dụ: Kho"
                  onKeyDown={e => { if (e.key === 'Enter' && name.trim()) setStep(2); }}
                />
              </div>
              <div className="pf-field flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-350">Context / mô tả (tùy chọn)</label>
                <textarea
                  className="w-full min-h-[80px] p-3 rounded-md border border-border bg-slate-950 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder="Bối cảnh nghiệp vụ, stack, ghi chú..."
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="pf-field flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-350 mb-2">Loại dự án (quyết định các stage test bật mặc định)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {STRATEGY_TEMPLATES.map(t => {
                  const active = t.key === template;
                  return (
                    <button
                      key={t.key} 
                      type="button" 
                      onClick={() => chooseTemplate(t.key)}
                      className={`text-left p-3.5 rounded-lg border cursor-pointer transition-all duration-150 ${active ? 'border-indigo-500 bg-indigo-500/10 text-white' : 'border-border bg-slate-950 text-slate-300 hover:border-slate-700'}`}
                    >
                      <div className="font-bold text-xs mb-1 text-slate-100">{t.label}</div>
                      <div className="text-[10px] text-slate-400 leading-relaxed mb-2">{t.desc}</div>
                      <div className="text-[9px] text-slate-500">
                        {t.enabledByDefault.length} stage: {t.enabledByDefault.join(', ') || '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-350 block">
                  Stage test — bật {enabledCount}/{stages.length} (template: {getTemplate(template)?.label || template})
                </label>
                <div className="flex flex-col gap-2">
                  {stages.map(s => (
                    <button
                      key={s.key} 
                      type="button" 
                      onClick={() => toggleStage(s.key)}
                      className={`flex items-center justify-between gap-3 p-2.5 rounded-md border cursor-pointer text-left transition-all ${s.enabled ? 'border-indigo-500 bg-indigo-500/5 text-white opacity-100' : 'border-border bg-slate-950/40 text-slate-400 opacity-60 hover:opacity-80'}`}
                    >
                      <span className="font-bold text-xs">{s.activity}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${s.enabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                        {s.enabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-350 block">Skill sẽ hiện ở màn hình (Screen)</label>
                <div className="p-3.5 rounded-md border border-dashed border-border bg-slate-950/40 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {previewSkills.map(id => (
                      <span key={id} className="text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                        {SKILLS[id]?.label || id}
                      </span>
                    ))}
                    {previewSkills.length === 0 && <span className="text-xs text-slate-500 italic">Không có skill nào.</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal">
                    Bật/tắt stage bên trái để xem skill thay đổi. Skill nền tảng (SRS, Bug Analyzer) luôn hiện.
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="modal-actions flex items-center justify-end gap-2 border-t border-border pt-4 mt-5">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Hủy</Button>
            {step > 1 && (
              <Button variant="secondary" size="sm" onClick={() => setStep(step - 1)} disabled={saving}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Quay lại
              </Button>
            )}
            {step < 3 && (
              <Button variant="default" size="sm" onClick={() => setStep(step + 1)} disabled={step === 1 && !name.trim()}>
                Tiếp <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button variant="default" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Đang lưu...' : 'Lưu kế hoạch'}
              </Button>
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
    <div className="flex gap-2 mb-4">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div 
            key={n} 
            className={`flex-1 text-center text-[10px] font-bold py-1.5 px-1 rounded-md border transition-all ${active ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 opacity-100' : done ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 opacity-100' : 'border-border bg-transparent text-slate-500 opacity-55'}`}
          >
            {done ? <Check className="w-3 h-3 inline-block mr-1 align-text-top" /> : `${n}. `}
            {label}
          </div>
        );
      })}
    </div>
  );
}
