import { useEffect, useState } from 'react';
import { Zap, Bot, Edit2, Check, RefreshCw, AlertCircle, Calendar, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import {
  STRATEGY_TEMPLATES,
  getTemplate,
  stageTypeLabel,
  activityLabel,
  normalizeStages,
  generateDefaultStrategy,
} from '../../features/skills/strategy-templates';
import {
  createStrategyApi,
  fetchStrategyApi,
  updateStrategyApi,
  fetchReleaseCheckApi,
} from '../../backend-api/strategy.api';

// Panel Test Strategy hiển thị INLINE trong workspace khi node đang chọn là project.
// Thay thế hoàn toàn phần skill (Requirement/Output) — project node chỉ có màn này.
export function StrategyPanel({ projectNode, onGenerateDraft, onToast, onPlanChanged }) {
  const [tab, setTab] = useState('plan'); // 'plan' | 'release'
  const [view, setView] = useState('loading'); // 'loading' | 'generate' | 'review' | 'current'
  const [existing, setExisting] = useState(null); // strategy hiện có
  const [template, setTemplate] = useState('feature_addition');
  const [note, setNote] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // review view states
  const [draft, setDraft] = useState(null);
  const [stages, setStages] = useState([]);

  const projectId = projectNode?.id || null;

  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    setView('loading');
    fetchStrategyApi(projectId)
      .then(strat => {
        if (!alive) return;
        if (strat) {
          setExisting(strat);
          setView('current');
        } else {
          setExisting(null);
          setView('generate');
        }
      })
      .catch(e => {
        if (!alive) return;
        onToast?.(`Không tải được strategy: ${e.message}`);
        setView('generate');
      });
    return () => { alive = true; };
  }, [projectId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const data = await onGenerateDraft(template, note);
      setDraft(data);
      setStages(normalizeStages(data.stages || []));
      setView('review');
    } catch (e) {
      onToast?.(`Sinh strategy thất bại: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerateCode() {
    try {
      const data = generateDefaultStrategy(template, projectNode.name, note);
      setDraft(data);
      setStages(normalizeStages(data.stages || []));
      setView('review');
    } catch (e) {
      onToast?.(`Sinh bằng code thất bại: ${e.message}`);
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
    <section className="panel space-y-5">
      <div className="panel-header border-b border-zinc-800 pb-4 mb-4 flex items-center justify-between">
        <div>
          <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 bg-indigo-500/5 text-[10px] uppercase font-bold tracking-wider mb-2">
            Test Plan
          </Badge>
          <h2 className="text-lg font-bold text-slate-50 tracking-tight mt-1">Kế hoạch test</h2>
          <span className="text-xs text-zinc-400">Cấu hình stage test → quản lý release theo tiến độ</span>
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} />

      {tab === 'plan' && (
        <div className="space-y-4">
          {view === 'loading' && <p className="text-xs text-zinc-500 italic">Đang tải kế hoạch test...</p>}

          {view === 'generate' && (
            <GenerateView
              template={template}
              setTemplate={setTemplate}
              note={note}
              setNote={setNote}
              generating={generating}
              onGenerate={handleGenerate}
              onGenerateCode={handleGenerateCode}
              hasExisting={!!existing}
              onBack={existing ? () => setView('current') : null}
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
    <div className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 p-1 text-zinc-400 mb-6">
      {tabs.map(t => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3.5 py-1 text-xs font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${active ? 'bg-zinc-950 text-zinc-50 shadow-sm' : 'hover:text-zinc-200'}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function GenerateView({ template, setTemplate, note, setNote, generating, onGenerate, onGenerateCode, hasExisting, onBack }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-400 leading-normal">
        Chọn loại project → <strong>Sinh bằng Code</strong> (nhanh, 0 token) để lấy cấu hình chuẩn, hoặc <strong>Sinh bằng AI</strong> để AI phân tích ngữ cảnh dự án.
      </p>
      <div className="pf-field flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Loại project (template)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STRATEGY_TEMPLATES.map(t => {
            const active = t.key === template;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTemplate(t.key)}
                className={`text-left p-3.5 rounded-lg border cursor-pointer transition-all duration-150 ${active ? 'border-zinc-500 bg-zinc-800/10 text-white' : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700'}`}
              >
                <div className="font-bold text-xs mb-1 text-zinc-100">{t.label}</div>
                <div className="text-[10px] text-zinc-400 leading-relaxed mb-2">{t.desc}</div>
                <div className="text-[9px] text-zinc-500">
                  Bật sẵn: {t.enabledByDefault.length ? t.enabledByDefault.join(', ') : '—'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="pf-field flex flex-col gap-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ghi chú thêm (tùy chọn)</label>
        <textarea
          className="w-full min-h-[60px] p-3 rounded-md border border-zinc-800 bg-zinc-950 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700 resize-none"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Ràng buộc riêng, deadline, môi trường, phần cần đặc biệt lưu ý..."
        />
      </div>
      <div className="modal-actions flex items-center justify-end gap-2 border-t border-zinc-800 pt-4 mt-5">
        {onBack && <Button variant="ghost" size="sm" onClick={onBack} disabled={generating}>Quay lại</Button>}
        <Button variant="outline" size="sm" onClick={onGenerateCode} disabled={generating} title="Lấy cấu hình chuẩn theo template — tức thời, không tốn token">
          <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
          Sinh bằng Code
        </Button>
        <Button variant="default" size="sm" onClick={onGenerate} disabled={generating} title="AI phân tích ngữ cảnh dự án để sinh chiến lược tùy chỉnh">
          {generating ? 'Đang sinh...' : <><Bot className="w-3.5 h-3.5 mr-1.5" />Sinh bằng AI</>}
        </Button>
      </div>
    </div>
  );
}

function ReviewView({ draft, stages, template, toggleStage, saving, onApprove, onRegenerate }) {
  const tpl = getTemplate(template);
  const enabledCount = stages.filter(s => s.enabled).length;
  return (
    <div className="space-y-4">
      {draft?.summary && (
        <div className="text-xs text-zinc-350 leading-relaxed bg-zinc-950 border border-zinc-800 p-4 rounded-lg shadow-sm">
          <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">Tóm tắt chiến dịch</span>
          {draft.summary}
        </div>
      )}
      <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
        Template: <strong className="text-slate-200">{tpl?.label || template}</strong> · Bật {enabledCount}/{stages.length} stage · Bấm để bật/tắt từng stage.
      </div>
      <div className="flex flex-col gap-3">
        {stages.map((s, i) => (
          <StageRow key={s.key} stage={s} index={i + 1} onToggle={() => toggleStage(s.key)} editable />
        ))}
      </div>
      <ExecutionPlan plan={draft?.executionPlan} />
      {draft?.releaseGate && (
        <Card className="p-4">
          <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">🚦 Release gate</label>
          <div className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{draft.releaseGate}</div>
        </Card>
      )}
      <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-4">
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={saving}>Sinh lại</Button>
        <Button variant="default" size="sm" onClick={onApprove} disabled={saving || enabledCount === 0}>
          {saving ? 'Đang lưu...' : 'Approve strategy'}
        </Button>
      </div>
    </div>
  );
}

function CurrentView({ strategy, onRegenerate, onSaveToggles, onGoRelease }) {
  const [editing, setEditing] = useState(false);
  const [localStages, setLocalStages] = useState([]);

  useEffect(() => {
    if (strategy?.stages) setLocalStages(strategy.stages);
  }, [strategy]);

  const enabled = localStages.filter(s => s.enabled);
  const disabled = localStages.filter(s => !s.enabled);
  const isApproved = strategy.status === 'approved';

  function toggleLocal(key) {
    setLocalStages(prev => prev.map(s => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  }

  async function handleSave() {
    setEditing(false);
    await onSaveToggles(localStages);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5 flex items-center gap-1 text-[10px]">
          <Check className="w-3.5 h-3.5" />
          <span>{isApproved ? 'Đã approve' : 'Đã cấu hình'}</span>
        </Badge>
        {isApproved && strategy.approvedAt && (
          <span className="text-[10px] text-zinc-500 font-mono">
            {new Date(strategy.approvedAt).toLocaleString('vi-VN')}
          </span>
        )}
      </div>

      {strategy.summary && (
        <div className="text-xs text-zinc-350 leading-relaxed bg-zinc-950 border border-zinc-800 p-4 rounded-lg relative overflow-hidden shadow-sm">
          <span className="text-[9px] font-bold uppercase text-zinc-500 tracking-wider block mb-1">Tóm tắt chiến dịch</span>
          {strategy.summary}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
          {editing ? 'Bật/tắt stage rồi bấm Lưu' : `Các stage đang bật (${enabled.length})`}
        </h4>
        {!editing && (
          <Button variant="outline" size="sm" className="h-8 text-xs border-zinc-800 hover:bg-zinc-800" onClick={() => setEditing(true)}>
            <Edit2 className="w-3 h-3 mr-1.5" /> Chỉnh stage
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {editing
          ? localStages.map((s, i) => (
              <StageRow key={s.key} stage={s} index={i + 1} onToggle={() => toggleLocal(s.key)} editable />
            ))
          : enabled.map((s, i) => <StageRow key={s.key} stage={s} index={i + 1} />)}
        {!editing && enabled.length === 0 && <div className="text-xs text-zinc-500 italic">Chưa có stage nào được bật.</div>}
      </div>

      {!editing && disabled.length > 0 && (
        <div className="text-[10px] text-zinc-500 pl-1">
          Stage tắt: {disabled.map(s => s.activity).join(', ')}
        </div>
      )}

      {editing ? (
        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-4">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setLocalStages(strategy.stages); }}>Hủy</Button>
          <Button variant="default" size="sm" onClick={handleSave}>Lưu thay đổi</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between border-t border-zinc-800 pt-4 mt-4">
          <Button variant="outline" size="sm" className="border-zinc-800 hover:bg-zinc-850" onClick={onRegenerate}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Làm mới / AI Sinh lại
          </Button>
          {strategy.status === 'configured' && (
            <Button variant="default" size="sm" onClick={onGoRelease}>
              Kiểm tra Release Gate →
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function StageRow({ stage, index, onToggle, editable }) {
  return (
    <Card 
      className={`transition-all hover:bg-zinc-900/35 cursor-pointer ${stage.enabled ? 'opacity-100' : 'opacity-55 bg-zinc-950/20'}`}
      onClick={editable ? onToggle : undefined}
    >
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-zinc-500 font-mono">#{index}</span>
            <span className="text-sm font-semibold text-slate-100">{stage.activity}</span>
            <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0.2">
              {stageTypeLabel(stage.stageType)}
            </Badge>
          </div>
          {editable && (
            <Badge variant={stage.enabled ? 'default' : 'secondary'} className="text-[9px] font-bold px-2 py-0.5">
              {stage.enabled ? 'ON' : 'OFF'}
            </Badge>
          )}
        </div>
        {stage.trigger && (
          <div className="text-[11px] text-zinc-400">
            <span className="text-zinc-500 font-medium">Trigger:</span> {stage.trigger}
          </div>
        )}
        {stage.enabled && (stage.entryCriteria || stage.exitCriteria) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-zinc-800 text-[11px] text-zinc-300">
            <div className="bg-zinc-905/30 p-2.5 rounded border border-zinc-800/40">
              <span className="text-zinc-500 font-bold block mb-1 text-[9px] uppercase tracking-wider">Entry Criteria</span>
              <span className="leading-relaxed text-zinc-300">{stage.entryCriteria || '—'}</span>
            </div>
            <div className="bg-zinc-905/30 p-2.5 rounded border border-zinc-800/40">
              <span className="text-zinc-500 font-bold block mb-1 text-[9px] uppercase tracking-wider">Exit Criteria</span>
              <span className="leading-relaxed text-zinc-300">{stage.exitCriteria || '—'}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function ExecutionPlan({ plan }) {
  if (!plan) return null;
  const showSprints = plan.sprintMap?.length > 0;
  const showOwners = plan.ownerMap?.length > 0;
  const showOrders = plan.priorityOrder?.length > 0;
  if (!showSprints && !showOwners && !showOrders) return null;

  return (
    <Card className="p-4 space-y-3">
      <label className="text-xs font-semibold text-zinc-350 block flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-indigo-400" /> Kế hoạch thực hiện (Execution Plan)
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {showSprints && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Tiến trình (Sprint)</span>
            <div className="space-y-1">
              {plan.sprintMap.map((m, i) => (
                <div key={i} className="flex justify-between p-1.5 rounded bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-300 font-medium">{activityLabel(m.stage)}</span>
                  <span className="text-indigo-450 font-semibold">{m.when}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {showOwners && (
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-500 uppercase">Chủ trì (Owner)</span>
            <div className="space-y-1">
              {plan.ownerMap.map((m, i) => (
                <div key={i} className="flex justify-between p-1.5 rounded bg-zinc-950 border border-zinc-800">
                  <span className="text-zinc-300 font-medium">{activityLabel(m.stage)}</span>
                  <span className="text-zinc-400">{m.owner}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {showOrders && (
        <div className="space-y-1 pt-2 border-t border-zinc-850">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Thứ tự ưu tiên</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {plan.priorityOrder.map((stageKey, i) => (
              <span key={stageKey} className="text-[10px] bg-zinc-900 text-zinc-300 font-semibold px-2 py-0.5 rounded border border-zinc-800">
                {i + 1}. {activityLabel(stageKey)}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReleaseCheckView({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCheck = () => {
    setLoading(true);
    fetchReleaseCheckApi(projectId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (projectId) fetchCheck();
  }, [projectId]);

  if (loading) return <p className="text-xs text-zinc-500 italic">Đang tải kết quả release check...</p>;
  if (!data) return <p className="text-xs text-zinc-500 italic">Dự án chưa được approve test plan hoặc không có dữ liệu test.</p>;

  const hasCases = data.totalCases > 0;
  const isBlock = data.blockers?.length > 0;
  const goColor = data.decision === 'Go' ? 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20' : data.decision === 'No-go' ? 'text-red-450 bg-red-500/10 border-red-500/20' : 'text-zinc-400 bg-zinc-900 border-zinc-800';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border border-zinc-800 bg-zinc-950 p-4 rounded-xl shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-slate-50 mb-0.5">🚦 Trạng thái: {data.decision}</h3>
          <p className="text-[10px] text-zinc-500 font-medium">Release Gate: Pass 100% smoke + 0 blocker bug</p>
        </div>
        <div className={`px-4 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${goColor}`}>
          {data.decision}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-zinc-950 border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Tổng Test Case</span>
          <span className="text-2xl font-bold text-slate-50 mt-1">{data.totalCases}</span>
        </Card>
        <Card className="p-4 bg-zinc-950 border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Đã Pass</span>
          <span className="text-2xl font-bold text-emerald-400 mt-1">{data.passedCount} ({data.passedPercent}%)</span>
        </Card>
        <Card className="p-4 bg-zinc-950 border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">Thất bại (Fail)</span>
          <span className="text-2xl font-bold text-red-400 mt-1">{data.failedCount}</span>
        </Card>
        <Card className="p-4 bg-zinc-950 border-zinc-800 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">Blockers</span>
          <span className="text-2xl font-bold text-amber-400 mt-1">{data.blockersCount}</span>
        </Card>
      </div>

      {hasCases && (
        <Card className="p-4">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-3">Chi tiết theo Stage</span>
          <div className="space-y-3.5">
            {data.stages.map(s => {
              const count = s.passedCount + s.failedCount + s.blockedCount;
              const percent = count > 0 ? Math.round((s.passedCount / count) * 100) : 0;
              return (
                <div key={s.key} className="space-y-1 text-xs">
                  <div className="flex justify-between font-medium text-zinc-300">
                    <span>{s.activity}</span>
                    <span className="font-mono text-zinc-400">{s.passedCount}/{count} Passed ({percent}%)</span>
                  </div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-zinc-100 h-1.5 rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {isBlock ? (
        <div className="border border-red-900/20 bg-red-900/10 p-4 rounded-xl space-y-2">
          <div className="text-xs font-bold text-red-400 uppercase flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> Blockers phát hiện ({data.blockers.length})
          </div>
          <div className="space-y-1.5">
            {data.blockers.map(tc => (
              <div key={tc.id} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs flex items-center justify-between">
                <span className="font-bold text-amber-500">{tc.id}</span>
                <span className="text-zinc-350 text-left flex-1 px-3 truncate">{tc.name}</span>
                <Badge variant="destructive" className="text-[9px] font-bold uppercase">
                  {tc.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 border border-emerald-500/20 bg-emerald-500/5 p-3 rounded-lg text-xs text-emerald-450 font-medium">
          <Check className="w-4 h-4 text-emerald-400" /> Không phát hiện blocker nào cản trở Release.
        </div>
      )}

      {data.unassignedCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 italic bg-zinc-900/10 p-2.5 rounded-lg border border-zinc-800">
          <AlertCircle className="w-3.5 h-3.5" /> Có {data.unassignedCount} test case chưa được gán stage và không tính vào Gate.
        </div>
      )}

      <div className="flex justify-end border-t border-zinc-800 pt-4">
        <Button variant="outline" size="sm" onClick={fetchCheck}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Làm mới Release Gate
        </Button>
      </div>
    </div>
  );
}
