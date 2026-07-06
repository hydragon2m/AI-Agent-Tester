import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateAiOutput } from './backend-api/ai.api';
import { fetchTestCases, saveTestCasesApi } from './backend-api/test-cases.api';
import { fetchLarkLinkApi, linkLarkProjectApi, pushToLarkApi } from './backend-api/lark.api';
import { SkillOptions } from './components/controls/SkillOptions';
import { AppHeader } from './components/layout/AppHeader';
import { ProjectSidebar } from './components/layout/ProjectSidebar';
import { SkillSidebar } from './components/layout/SkillSidebar';
import { LarkLinkModal } from './components/output/LarkLinkModal';
import { ManualPromptModal } from './components/output/ManualPromptModal';
import { OutputPanel } from './components/output/OutputPanel';
import { ProviderSettingsModal } from './components/providers/ProviderSettingsModal';
import { DEMO_OUTPUTS, EXAMPLES, SKILLS } from './features/skills/skill-registry';
import { toCsv, toLarkClipboardPayload, toMarkdown } from './features/testcase/testcase-export';
import { parseAiJson, stripCodeFence } from './features/testcase/testcase-parser';
import { QUALITY_SYSTEM_PROMPT, buildQualityPrompt, buildFinalTestCases } from './features/testcase/testcase-quality';
import { useLarkConfig } from './state/useLarkConfig';
import { useLarkMapping } from './state/useLarkMapping';
import { buildContext, useProjectTree } from './state/useProjectTree';
import { useProviderSettings } from './state/useProviderSettings';
import { useSkillHistory } from './state/useSkillHistory';
import { useSkillWorkspace } from './state/useSkillWorkspace';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ padding: 40 }}>
          <h2>Đã có lỗi xảy ra</h2>
          <p>{this.state.error.message}</p>
          <button className="btn-primary" onClick={() => this.setState({ error: null })}>Thử lại</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function downloadFile(content, filename, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Gán ID mới cho các test case bổ sung để tránh trùng với test case đã có,
// vì AI không biết ID đã dùng khi chỉ được yêu cầu sinh phần bổ sung.
function renumberNewCases(existingCases, newCases) {
  const existingIds = new Set(existingCases.map(tc => tc.id).filter(Boolean));
  const prefixMatch = /^(\D*)/.exec(existingCases[0]?.id || 'TC-');
  const prefix = prefixMatch[1] || 'TC-';
  let maxNumber = 0;
  existingCases.forEach(tc => {
    const m = /(\d+)\s*$/.exec(tc.id || '');
    if (m) maxNumber = Math.max(maxNumber, parseInt(m[1], 10));
  });
  return newCases.map(tc => {
    if (tc.id && !existingIds.has(tc.id)) {
      existingIds.add(tc.id);
      return tc;
    }
    maxNumber += 1;
    const id = `${prefix}${String(maxNumber).padStart(3, '0')}`;
    existingIds.add(id);
    return { ...tc, id };
  });
}

function App() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualResponse, setManualResponse] = useState('');
  const [supplementNote, setSupplementNote] = useState('');
  const [qualityReview, setQualityReview] = useState(null);
  const [reviewDecisions, setReviewDecisions] = useState({});
  const [newSuggestionDecisions, setNewSuggestionDecisions] = useState({});
  const [larkLinkOpen, setLarkLinkOpen] = useState(false);
  const [larkLinkUrl, setLarkLinkUrl] = useState('');
  const [larkLinking, setLarkLinking] = useState(false);

  const projectTree = useProjectTree(setToast);
  const providers = useProviderSettings(setToast);
  const workspace = useSkillWorkspace();
  const skillHistory = useSkillHistory(projectTree.activeNodeId, workspace.activeSkill);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [pushingToLark, setPushingToLark] = useState(false);
  const lark = useLarkMapping();
  const larkConfig = useLarkConfig(setToast);

  const skill = SKILLS[workspace.activeSkill];
  const testCases = workspace.output?.testCases || [];

  useEffect(() => {
    const latest = skillHistory.runs[0] || null;
    setActiveHistoryId(latest?.id || null);
    workspace.setSkillInput(latest?.input || '');
    if (workspace.activeSkill !== 'testcase') {
      if (latest) workspace.setSkillOutput(latest.output, latest.rawOutput, workspace.activeSkill);
      else workspace.clearSkillOutput(workspace.activeSkill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillHistory.runs]);

  function viewHistoryItem(item) {
    setActiveHistoryId(item.id);
    workspace.setSkillInput(item.input || '');
    workspace.setSkillOutput(item.output, item.rawOutput, workspace.activeSkill);
  }

  async function renameHistoryItem(item) {
    const title = window.prompt('Tên mới cho bản ghi này:', item.title || '');
    if (title === null) return;
    await skillHistory.rename(item.id, title.trim());
  }

  async function deleteHistoryItem(item) {
    if (!window.confirm(`Xóa lịch sử "${item.title || item.input || item.id}"?`)) return;
    await skillHistory.remove(item.id);
    setToast('Đã xóa lịch sử');
  }

  async function restoreHistoryItem(item) {
    if (!window.confirm('Đặt lại phiên bản hiện tại về bản ghi này?')) return;
    await skillHistory.restore(item.id);
    setToast('Đã reset về phiên bản đã chọn');
  }

  async function saveSkillRun(input, output, rawOutput, provider) {
    if (!projectTree.activeNodeId) return;
    await skillHistory.saveRun({
      title: input.slice(0, 80),
      input,
      output,
      rawOutput,
      provider,
    });
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  function dismissReview() {
    setQualityReview(null);
    setReviewDecisions({});
    setNewSuggestionDecisions({});
  }

  async function handleSelectNode(nodeId) {
    projectTree.setActiveNodeId(nodeId);
    dismissReview();
    const saved = await fetchTestCases(nodeId);
    if (saved.length > 0) {
      const value = { summary: 'Test cases đã lưu cho node hiện tại', total: saved.length, testCases: saved };
      workspace.setSkillOutput(value, value, 'testcase');
      workspace.setActiveSkill('testcase');
    } else {
      workspace.clearSkillOutput('testcase');
    }
  }

  async function handleDeleteNode(node) {
    const deleted = await projectTree.deleteNode(node);
    if (deleted) {
      workspace.clearSkillOutput('testcase');
      dismissReview();
    }
  }

  async function runQualityCheck(cases, requirement) {
    if (!cases?.length) return;
    setLoading(true);
    try {
      const generated = demoMode
        ? { output: JSON.stringify({ summary: 'Demo review', reviews: [], newSuggestions: [] }), provider: 'demo' }
        : await generateAiOutput({
            skill: 'tcquality',
            systemPrompt: QUALITY_SYSTEM_PROMPT,
            userPrompt: buildQualityPrompt(cases, requirement),
            nodeId: projectTree.activeNodeId,
          });
      const review = parseAiJson(generated.output);
      setQualityReview(review);
      setReviewDecisions({});
      setNewSuggestionDecisions({});
    } catch (e) {
      setToast(`Đã lưu test case nhưng đánh giá chất lượng thất bại: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleReviewDecision(id, value) {
    setReviewDecisions(prev => ({ ...prev, [id]: value }));
  }

  function toggleSuggestionDecision(idx, checked) {
    setNewSuggestionDecisions(prev => ({ ...prev, [idx]: checked }));
  }

  function acceptAllReviewChanges() {
    const next = {};
    (qualityReview?.reviews || []).forEach(r => {
      if (r.action === 'modify') next[r.id] = 'apply';
      if (r.action === 'delete') next[r.id] = 'remove';
    });
    setReviewDecisions(next);
    const nextSuggestions = {};
    (qualityReview?.newSuggestions || []).forEach((_, idx) => { nextSuggestions[idx] = true; });
    setNewSuggestionDecisions(nextSuggestions);
  }

  function keepAllOriginals() {
    setReviewDecisions({});
    setNewSuggestionDecisions({});
  }

  async function applyReviewSelections() {
    if (!qualityReview || !projectTree.activeNodeId) return;
    const before = testCases.length;
    setLoading(true);
    try {
      const final = buildFinalTestCases(
        testCases,
        qualityReview.reviews,
        reviewDecisions,
        newSuggestionDecisions,
        qualityReview.newSuggestions,
        renumberNewCases,
      );
      await saveTestCasesApi(projectTree.activeNodeId, final);
      workspace.setSkillOutput({ ...workspace.output, testCases: final, total: final.length });
      dismissReview();
      setToast(`Đã áp dụng thay đổi: ${before} → ${final.length} test case`);
    } catch (e) {
      setToast(`Lỗi áp dụng đánh giá: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    if (!workspace.input.trim()) {
      setToast('Nhập nội dung trước');
      return;
    }
    dismissReview();
    setLoading(true);
    try {
      const generated = demoMode
        ? { output: DEMO_OUTPUTS[workspace.activeSkill], provider: 'demo' }
        : await generateAiOutput({
            skill: workspace.activeSkill,
            systemPrompt: skill.system,
            userPrompt: skill.buildPrompt(workspace.input, buildContext(projectTree.activePath), workspace.options),
            nodeId: projectTree.activeNodeId,
          });

      const parsed = skill.output === 'testcase' ? parseAiJson(generated.output) : stripCodeFence(generated.output);
      workspace.setSkillOutput(parsed, generated.output);
      if (workspace.activeSkill === 'testcase' && projectTree.activeNodeId && Array.isArray(parsed.testCases)) {
        await saveTestCasesApi(projectTree.activeNodeId, parsed.testCases);
      }
      await saveSkillRun(workspace.input, parsed, generated.output, generated.provider);
      setToast(`Đã sinh output bằng ${generated.provider}`);
      if (workspace.activeSkill === 'testcase' && projectTree.activeNodeId && Array.isArray(parsed.testCases) && parsed.testCases.length) {
        await runQualityCheck(parsed.testCases, workspace.input);
      }
    } catch (e) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function appendTestCases() {
    if (workspace.activeSkill !== 'testcase') return;
    if (!supplementNote.trim()) {
      setToast('Nhập nội dung cần bổ sung (case còn thiếu / trả lời câu hỏi)');
      return;
    }
    const existingCases = workspace.output?.testCases || [];
    if (!existingCases.length) {
      setToast('Cần sinh test case lần đầu trước khi bổ sung');
      return;
    }

    setLoading(true);
    try {
      const appendPrompt = `Dưới đây là danh sách Test Case ĐÃ CÓ (định dạng JSON) — KHÔNG lặp lại các case này trong câu trả lời:
\`\`\`json
${JSON.stringify(existingCases, null, 2)}
\`\`\`

GHI CHÚ BỔ SUNG / TRẢ LỜI CÂU HỎI TỪ NGƯỜI DÙNG:
---
${supplementNote}
---

NHIỆM VỤ:
Chỉ sinh ra các Test Case MỚI (chưa có trong danh sách trên) để bổ sung theo ghi chú trên.
Trường "testCases" trong JSON trả về CHỈ chứa các test case mới, không lặp lại case cũ.`;

      const generated = demoMode
        ? { output: DEMO_OUTPUTS.testcase, provider: 'demo' }
        : await generateAiOutput({
            skill: 'testcase',
            systemPrompt: skill.system,
            userPrompt: `${buildContext(projectTree.activePath)}\n\n${appendPrompt}`,
            nodeId: projectTree.activeNodeId,
          });
      const parsedNew = parseAiJson(generated.output);
      const newCases = renumberNewCases(existingCases, parsedNew.testCases || []);
      const mergedCases = [...existingCases, ...newCases];
      const mergedOutput = { ...workspace.output, testCases: mergedCases, total: mergedCases.length };
      const nextRequirement = [workspace.input.trim(), `[Bổ sung] ${supplementNote.trim()}`].filter(Boolean).join('\n\n');

      workspace.setSkillInput(nextRequirement);
      workspace.setSkillOutput(mergedOutput, JSON.stringify(mergedOutput, null, 2));
      if (projectTree.activeNodeId) {
        await saveTestCasesApi(projectTree.activeNodeId, mergedCases);
      }
      await saveSkillRun(nextRequirement, mergedOutput, JSON.stringify(mergedOutput, null, 2), generated.provider);
      setSupplementNote('');
      setToast(`Đã bổ sung ${newCases.length} test case mới`);
    } catch (e) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function copyManualPrompt() {
    if (workspace.activeSkill !== 'testcase') return;
    if (!workspace.input.trim()) {
      setToast('Nhập requirement trước');
      return;
    }
    const prompt = `=== HƯỚNG DẪN DÀNH CHO AI ===
${buildContext(projectTree.activePath)}

${skill.system}

=== YÊU CẦU TỪ NGƯỜI DÙNG ===
${skill.buildPrompt(workspace.input, buildContext(projectTree.activePath), workspace.options)}`;
    setManualPrompt(prompt);
    setManualResponse('');
    navigator.clipboard.writeText(prompt).then(() => setToast('Đã copy manual prompt'));
    setManualOpen(true);
  }

  async function processManualResponse() {
    if (!manualResponse.trim()) {
      setToast('Dán response JSON trước');
      return;
    }
    try {
      const parsed = parseAiJson(manualResponse);
      workspace.setSkillOutput(parsed, manualResponse, 'testcase');
      workspace.setActiveSkill('testcase');
      if (projectTree.activeNodeId && Array.isArray(parsed.testCases)) {
        await saveTestCasesApi(projectTree.activeNodeId, parsed.testCases);
      }
      await saveSkillRun(`${workspace.input || 'Manual'} (Manual)`, parsed, manualResponse, 'manual');
      setManualOpen(false);
      setToast('Đã parse manual response');
    } catch (e) {
      setToast(`Lỗi parse JSON: ${e.message}`);
    }
  }

  async function saveProviders() {
    setLoading(true);
    try {
      await providers.saveProviders();
      lark.saveLarkMapping(lark.larkMapping);
      await larkConfig.saveLarkConfig();
      setSettingsOpen(false);
      setToast('Đã lưu provider settings');
    } catch (e) {
      setToast(`Lỗi lưu provider: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function copyOutput() {
    const text = workspace.activeSkill === 'testcase'
      ? JSON.stringify(workspace.output || {}, null, 2)
      : String(workspace.output || workspace.rawOutput || '');
    navigator.clipboard.writeText(text).then(() => setToast('Đã copy'));
  }

  function exportOutput(format = 'txt') {
    if (!workspace.output && !workspace.rawOutput) return;
    if (workspace.activeSkill === 'testcase') {
      if (format === 'csv') return downloadFile(toCsv(testCases, lark.larkMapping), `test-cases-${Date.now()}.csv`, 'text/csv');
      if (format === 'md') return downloadFile(toMarkdown(workspace.output), `test-cases-${Date.now()}.md`, 'text/markdown');
      return downloadFile(JSON.stringify(workspace.output || {}, null, 2), `test-cases-${Date.now()}.json`, 'application/json');
    }
    const ext = workspace.activeSkill === 'uitest' ? '.spec.ts' : workspace.activeSkill === 'apitest' ? '.json' : '.md';
    downloadFile(String(workspace.output || workspace.rawOutput), `${workspace.activeSkill}-${Date.now()}${ext}`);
  }

  async function copyForLark() {
    if (!workspace.output?.testCases?.length) {
      setToast('Không có test case để copy');
      return;
    }
    const payload = toLarkClipboardPayload(workspace.output, projectTree.activePath, lark.larkMapping);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([payload.html], { type: 'text/html' }),
          'text/plain': new Blob([payload.text], { type: 'text/plain' }),
        }),
      ]);
      setToast('Đã copy bảng cho Lark Base');
    } catch {
      await navigator.clipboard.writeText(payload.text);
      setToast('Đã copy dạng text cho Lark Base');
    }
  }

  // Always asks for the Base URL before pushing: prefills the previously
  // saved link (if any) so the user can just confirm it, since a saved link
  // can silently go stale (e.g. Base deleted on Lark's side) between pushes.
  async function openLarkPushModal() {
    if (!projectTree.activeNodeId) return;
    try {
      const link = await fetchLarkLinkApi(projectTree.activeNodeId);
      setLarkLinkUrl(link?.sourceUrl || '');
    } catch {
      setLarkLinkUrl('');
    }
    setLarkLinkOpen(true);
  }

  async function pushTestCasesToLark() {
    if (!projectTree.activeNodeId) return;
    setPushingToLark(true);
    try {
      const summary = await pushToLarkApi(projectTree.activeNodeId);
      const errorNote = summary.errors?.length ? `, ${summary.errors.length} lỗi` : '';
      setToast(`Lark: đã tạo ${summary.created}, cập nhật ${summary.updated}, liên kết ${summary.bugsLinked} bug${errorNote}`);
    } catch (e) {
      // Any push failure (not just "never linked") means the user needs a
      // chance to paste a link — e.g. the previously linked Base was since
      // deleted/moved on Lark's side, which fails with a normal error, not
      // NOT_LINKED, but still leaves them stuck without a way to fix it.
      if (e.code !== 'NOT_LINKED') {
        setToast(`Đẩy lên Lark thất bại: ${e.message}`);
      }
      setLarkLinkOpen(true);
    } finally {
      setPushingToLark(false);
    }
  }

  async function confirmLarkLink() {
    if (!larkLinkUrl.trim() || !projectTree.activeNodeId) return;
    setLarkLinking(true);
    try {
      const summary = await linkLarkProjectApi(projectTree.activeNodeId, larkLinkUrl.trim());
      const tableNote = summary.createdTable ? 'đã tạo bảng Test Cases mới' : 'dùng bảng có sẵn';
      const fieldsNote = summary.addedFields?.length ? `, thêm field: ${summary.addedFields.join(', ')}` : '';
      const upgradedNote = summary.upgradedFields?.length ? `, chuyển single select: ${summary.upgradedFields.join(', ')}` : '';
      const resyncNote = summary.resyncedCount ? `, đồng bộ lại ${summary.resyncedCount} test case do đổi Base` : '';
      setToast(`Đã gán Lark Base (${tableNote}${fieldsNote}${upgradedNote}${resyncNote})`);
      setLarkLinkOpen(false);
      setLarkLinkUrl('');
      await pushTestCasesToLark();
    } catch (e) {
      setToast(`Gán link Lark thất bại: ${e.message}`);
    } finally {
      setLarkLinking(false);
    }
  }

  function exportTree() {
    const data = JSON.stringify({ version: 1, nodes: projectTree.nodes }, null, 2);
    downloadFile(data, `qa-tree-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
  }

  async function importTree(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await projectTree.importNodes(json.nodes || json.projects || json);
    } catch (e) {
      setToast(`File import không hợp lệ: ${e.message}`);
    } finally {
      event.target.value = '';
    }
  }

  return (
    <>
      <div className="bg-grid" />
      <AppHeader
        demoMode={demoMode}
        setDemoMode={setDemoMode}
        providerStatus={providers.providerStatus}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="main web-shell">
        <ProjectSidebar
          nodes={projectTree.nodes}
          activeNodeId={projectTree.activeNodeId}
          onSelect={handleSelectNode}
          onAdd={projectTree.createNode}
          onRename={projectTree.renameNode}
          onDelete={handleDeleteNode}
          onExport={exportTree}
          onImport={importTree}
        />

        <SkillSidebar
          activeSkill={workspace.activeSkill}
          setActiveSkill={workspace.setActiveSkill}
          history={skillHistory.runs}
          historyLoading={skillHistory.loading}
          activeHistoryId={activeHistoryId}
          hasActiveNode={!!projectTree.activeNodeId}
          onViewHistory={viewHistoryItem}
          onRenameHistory={renameHistoryItem}
          onDeleteHistory={deleteHistoryItem}
          onRestoreHistory={restoreHistoryItem}
        />

        <section className="web-workspace">
          <div className="workspace-header">
            <div>
              <div className="eyebrow">Selected Context</div>
              <h1>{projectTree.activeNode ? projectTree.activePath.map(n => n.name).join(' / ') : 'Chưa chọn node'}</h1>
              <p>{projectTree.activeNode?.context || 'Chọn hoặc tạo project/module/screen/feature để output có đúng ngữ cảnh.'}</p>
            </div>
            <button className="btn-primary" onClick={generate} disabled={loading}>
              {loading ? 'Đang xử lý...' : `Generate ${skill.label}`}
            </button>
          </div>

          <section className="panel">
            <div className="panel-header">
              <div>
                <span className="step-badge">Bước 1 · Requirement</span>
                <h2>{skill.label}</h2>
                <span>{skill.desc}</span>
              </div>
              <button className="btn-secondary" onClick={() => workspace.setSkillInput(EXAMPLES[workspace.activeSkill] || '')}>Sample</button>
            </div>
            <SkillOptions activeSkill={workspace.activeSkill} options={workspace.options} setOptions={workspace.setOptions} />
            {workspace.activeSkill === 'testcase' && (
              <div className="testcase-utility-row">
                <button className="btn-secondary" onClick={copyManualPrompt}>Copy Manual Prompt</button>
              </div>
            )}
            <textarea
              className="pf-textarea requirement-input"
              value={workspace.input}
              onChange={e => workspace.setSkillInput(e.target.value)}
              placeholder="Dán spec / report / flow vào đây..."
            />
            {workspace.activeSkill === 'testcase' && testCases.length > 0 && (
              <div className="supplement-row">
                <textarea
                  className="pf-textarea supplement-input"
                  value={supplementNote}
                  onChange={e => setSupplementNote(e.target.value)}
                  placeholder="Bổ sung case còn thiếu, hoặc trả lời câu hỏi AI nêu ra ở Output..."
                />
                <button
                  className="btn-secondary"
                  onClick={appendTestCases}
                  disabled={!supplementNote.trim() || loading}
                  title="Chỉ thêm test case mới vào danh sách hiện có, không sinh lại từ đầu"
                >
                  {loading ? 'Đang xử lý...' : 'Bổ sung thêm'}
                </button>
              </div>
            )}
          </section>

          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <span className="step-badge">Bước 2 · Output</span>
                <h2>Output</h2>
                <span>{workspace.activeSkill === 'testcase' ? `${testCases.length} case` : skill.output}</span>
              </div>
              <div className="output-actions-react">
                <button className="btn-secondary" onClick={copyOutput} disabled={!workspace.output && !workspace.rawOutput}>Copy</button>
                {workspace.activeSkill === 'testcase' && <button className="btn-secondary" onClick={() => exportOutput('csv')} disabled={!testCases.length}>CSV</button>}
                {workspace.activeSkill === 'testcase' && <button className="btn-secondary" onClick={() => exportOutput('md')} disabled={!testCases.length}>MD</button>}
                {workspace.activeSkill === 'testcase' && <button className="btn-secondary" onClick={copyForLark} disabled={!testCases.length}>Copy Lark</button>}
                <button className="btn-secondary" onClick={() => exportOutput()} disabled={!workspace.output && !workspace.rawOutput}>Export</button>
                {workspace.activeSkill === 'testcase' && projectTree.activeNodeId && testCases.length > 0 && (
                  <button className="btn-secondary" onClick={openLarkPushModal} disabled={pushingToLark} title="Xác nhận link Lark Base rồi đẩy các test case đã duyệt lên">
                    {pushingToLark ? 'Đang đẩy...' : 'Đẩy lên Lark'}
                  </button>
                )}
                {workspace.activeSkill === 'testcase' && testCases.length > 0 && !qualityReview && (
                  <button className="btn-secondary" onClick={() => runQualityCheck(testCases, workspace.input)} disabled={loading}>
                    Đánh giá chất lượng
                  </button>
                )}
              </div>
            </div>
            <OutputPanel
              activeSkill={workspace.activeSkill}
              output={workspace.output}
              rawOutput={workspace.rawOutput}
              review={qualityReview}
              reviewDecisions={reviewDecisions}
              newSuggestionDecisions={newSuggestionDecisions}
              onToggleDecision={toggleReviewDecision}
              onToggleSuggestion={toggleSuggestionDecision}
              onAcceptAllReview={acceptAllReviewChanges}
              onKeepAllReview={keepAllOriginals}
              onApplyReview={applyReviewSelections}
              onDismissReview={dismissReview}
            />
          </section>
        </section>
      </main>

      {settingsOpen && (
        <ProviderSettingsModal
          form={providers.providerForm}
          setForm={providers.setProviderForm}
          larkMapping={lark.larkMapping}
          setLarkMapping={lark.saveLarkMapping}
          larkConfig={larkConfig.larkConfig}
          setLarkConfig={larkConfig.setLarkConfig}
          onTestLarkConnection={larkConfig.testConnection}
          testingLarkConnection={larkConfig.testingConnection}
          onClose={() => setSettingsOpen(false)}
          onSave={saveProviders}
          loading={loading}
        />
      )}
      {manualOpen && (
        <ManualPromptModal
          prompt={manualPrompt}
          response={manualResponse}
          setResponse={setManualResponse}
          onClose={() => setManualOpen(false)}
          onProcess={processManualResponse}
        />
      )}
      {larkLinkOpen && (
        <LarkLinkModal
          url={larkLinkUrl}
          setUrl={setLarkLinkUrl}
          onClose={() => setLarkLinkOpen(false)}
          onConfirm={confirmLarkLink}
          loading={larkLinking}
        />
      )}
      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
