import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { generateAiOutput } from './backend-api/ai.api';
import { fetchTestCases, saveTestCasesApi, exportScopeApi } from './backend-api/test-cases.api';
import { fetchLarkLinkApi, linkLarkProjectApi, pushToLarkApi } from './backend-api/lark.api';
import { createNodeApi } from './backend-api/nodes.api';
import { createSkillRun, fetchSkillRuns } from './backend-api/skill-runs.api';
import { SkillOptions } from './components/controls/SkillOptions';
import { ProjectSidebar } from './components/layout/ProjectSidebar';
import { HistoryItem } from './components/layout/HistoryItem';
import { LarkLinkModal } from './components/output/LarkLinkModal';
import { ManualPromptModal } from './components/output/ManualPromptModal';
import { OutputPanel } from './components/output/OutputPanel';
import { ExportFileModal } from './components/output/ExportFileModal';
import { ExportLarkModal } from './components/output/ExportLarkModal';
import { ImportTestCaseModal } from './components/output/ImportTestCaseModal';
import { ProviderSettingsModal } from './components/providers/ProviderSettingsModal';
import { StrategyPanel } from './components/strategy/StrategyPanel';
import { CreateProjectModal } from './components/strategy/CreateProjectModal';
import { SKILLS } from './features/skills/skill-registry';
import { parseClarificationQuestions } from './features/skills/srs-clarification';
import { getVisibleSkillIds } from './utils/skill-gating';
import { fetchStrategyApi } from './backend-api/strategy.api';
import { toCsv, toLarkClipboardPayload, toMarkdown } from './features/testcase/testcase-export';
import { parseAiJson, stripCodeFence, parsePastedTestCases } from './features/testcase/testcase-parser';
import { QUALITY_SYSTEM_PROMPT, buildQualityPrompt, buildFinalTestCases, sortTestCases } from './features/testcase/testcase-quality';
import { useLarkConfig } from './state/useLarkConfig';
import { useLarkMapping } from './state/useLarkMapping';
import { buildContext, useProjectTree } from './state/useProjectTree';
import { useProviderSettings } from './state/useProviderSettings';
import { useSkillHistory } from './state/useSkillHistory';
import { Button } from './components/ui/Button';
import { DropdownMenu, DropdownMenuItem } from './components/ui/DropdownMenu';
import { ChevronDown, Download, Share2, Copy, Save, Play, CheckSquare, Sparkles, FolderTree, History, X } from 'lucide-react';
import { useSkillWorkspace } from './state/useSkillWorkspace';
import './index.css';

// Node types mà SRS trên đó có thể "Phân rã thành Feature" (tạo node con type=feature) —
// 'screen' theo đúng hierarchy module→screen→feature, và 'module' cho project không dùng
// cấp screen trung gian (SRS viết thẳng ở module, feature là con trực tiếp của module).
const FEATURE_PARENT_TYPES = ['module', 'screen'];

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

function fileToImagePayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const data = dataUrl.split(',')[1] || '';
      resolve({ mediaType: file.type, data, name: file.name, previewUrl: dataUrl });
    };
    reader.onerror = () => reject(new Error('Không đọc được file ảnh'));
    reader.readAsDataURL(file);
  });
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
  const [batchGenLoading, setBatchGenLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualResponse, setManualResponse] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [supplementNote, setSupplementNote] = useState('');
  const [qualityReview, setQualityReview] = useState(null);
  const [reviewDecisions, setReviewDecisions] = useState({});
  const [newSuggestionDecisions, setNewSuggestionDecisions] = useState({});
  const [larkLinkOpen, setLarkLinkOpen] = useState(false);
  const [larkLinkUrl, setLarkLinkUrl] = useState('');
  const [larkLinking, setLarkLinking] = useState(false);
  const [decomposeResult, setDecomposeResult] = useState(null);
  const [decomposing, setDecomposing] = useState(false);
  const [createProject, setCreateProject] = useState(null); // { systemId, systemName } | null → mở CreateProjectModal
  const [activePlan, setActivePlan] = useState(undefined);   // undefined = chưa fetch, null = không có plan, obj = plan
  const [exportFileData, setExportFileData] = useState(null);    // {scopeType, scopeName, groups} | null → mở ExportFileModal
  const [exportLarkTarget, setExportLarkTarget] = useState(null); // {scopeType, scopeId, name} | null → mở ExportLarkModal

  const projectTree = useProjectTree(setToast);
  const providers = useProviderSettings(setToast);
  const workspace = useSkillWorkspace();
  const skillHistory = useSkillHistory(projectTree.activeNodeId, workspace.activeSkill);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pushingToLark, setPushingToLark] = useState(false);
  const lark = useLarkMapping();
  const larkConfig = useLarkConfig(setToast);

  const skill = SKILLS[workspace.activeSkill];
  const testCases = workspace.output?.testCases || [];
  const skipNextHistorySync = useRef(false);

  // Project node = màn Test Strategy (ẩn hoàn toàn phần skill Requirement/Output).
  const isProjectNode = projectTree.activeNode?.type === 'project';

  // Skill-gating: danh sách skill được hiện dựa trên node type + test plan của project.
  // Plan chưa cấu hình → getVisibleSkillIds trả đủ skill (backward-compat).
  const visibleSkillIds = getVisibleSkillIds(projectTree.activeNode?.type, activePlan);
  const planConfigured = !!(activePlan && (activePlan.status === 'configured' || activePlan.status === 'approved'));

  // Module/Screen/Feature của node đang chọn (context) — dùng cho bảng TC + export CSV.
  const nodePathInfo = { module: '', screen: '', feature: '' };
  for (const n of projectTree.activePath) {
    if (n.type === 'module') nodePathInfo.module = n.name;
    else if (n.type === 'screen') nodePathInfo.screen = n.name;
    else if (n.type === 'feature') nodePathInfo.feature = n.name;
  }

  // Tải test plan của project chứa node đang chọn (cho gating + banner cảnh báo).
  useEffect(() => {
    const node = projectTree.activeNode;
    if (!node || node.type === 'project' || !node.projectId) { setActivePlan(node && node.type !== 'project' ? null : undefined); return; }
    let alive = true;
    setActivePlan(undefined);
    fetchStrategyApi(node.projectId)
      .then(p => { if (alive) setActivePlan(p || null); })
      .catch(() => { if (alive) setActivePlan(null); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectTree.activeNodeId, projectTree.activeNode?.projectId, projectTree.activeNode?.type]);

  // Nếu skill đang chọn bị gating ẩn đi → tự chuyển sang skill hiển thị đầu tiên.
  useEffect(() => {
    if (isProjectNode || !visibleSkillIds.length) return;
    if (!visibleSkillIds.includes(workspace.activeSkill)) workspace.setActiveSkill(visibleSkillIds[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSkillIds.join(','), isProjectNode, workspace.activeSkill]);

  async function handleProjectCreated(project) {
    setCreateProject(null);
    await projectTree.refreshTree();
    projectTree.setActiveNodeId(project.id);
  }

  const srsMarkdownForActions = workspace.activeSkill === 'srs' ? String(workspace.output || workspace.rawOutput || '') : '';
  const canDecomposeFeatures = Boolean(srsMarkdownForActions.trim())
    && FEATURE_PARENT_TYPES.includes(projectTree.activeNode?.type)
    && parseClarificationQuestions(srsMarkdownForActions).length === 0;

  useEffect(() => {
    // Chuyển skill sang tab khác (ví dụ nút "Viết Test Case →") load lại history
    // của skill đó — nếu ta vừa chủ động điền input (SRS -> TC), bỏ qua 1 lần
    // để không bị lịch sử cũ ghi đè lên giá trị vừa điền.
    if (skipNextHistorySync.current) {
      skipNextHistorySync.current = false;
      return;
    }
    const latest = skillHistory.runs[0] || null;
    setActiveHistoryId(latest?.id || null);
    
    let defaultInput = latest?.input || '';
    if (workspace.activeSkill === 'testcase' && !defaultInput) {
      const srsText = workspace.outputs.srs;
      if (srsText) {
        defaultInput = typeof srsText === 'string' ? srsText : (srsText.content || '');
      }
    }
    workspace.setSkillInput(defaultInput);

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
      const generated = await generateAiOutput({
        skill: 'tcquality',
        systemPrompt: QUALITY_SYSTEM_PROMPT,
        userPrompt: buildQualityPrompt(cases, requirement),
        nodeId: projectTree.activeNodeId,
        expectJson: true,
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
    const nextSuggestions = {};
    (qualityReview?.newSuggestions || []).forEach((_, idx) => { nextSuggestions[idx] = true; });
    setReviewDecisions(next);
    setNewSuggestionDecisions(nextSuggestions);
    applyReviewSelections(next, nextSuggestions);
  }

  function keepAllOriginals() {
    setReviewDecisions({});
    setNewSuggestionDecisions({});
  }

  async function applyReviewSelections(decisionsOverride = reviewDecisions, newSuggestionsOverride = newSuggestionDecisions) {
    if (!qualityReview || !projectTree.activeNodeId) return;
    const before = testCases.length;
    setLoading(true);
    try {
      const final = buildFinalTestCases(
        testCases,
        qualityReview.reviews,
        decisionsOverride,
        newSuggestionsOverride,
        qualityReview.newSuggestions,
        renumberNewCases,
      );
      if (!Array.isArray(final)) throw new Error('Dữ liệu test case không hợp lệ');
      await saveTestCasesApi(projectTree.activeNodeId, final);
      workspace.setSkillOutput({ ...workspace.output, testCases: final, total: final.length });
      dismissReview();
      setToast(`Đã áp dụng thay đổi: ${before} → ${final.length} test case`);
    } catch (e) {
      console.error('Apply review failed:', e, { reviewDecisions: decisionsOverride, newSuggestionDecisions: newSuggestionsOverride, final: e.final });
      setToast(`Lỗi áp dụng đánh giá: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function generate() {
    const hasImage = Boolean(skill.supportsImage && workspace.image);
    if (!workspace.input.trim() && !hasImage) {
      setToast(skill.supportsImage ? 'Nhập nội dung hoặc upload ảnh trước' : 'Nhập nội dung trước');
      return;
    }
    dismissReview();
    setLoading(true);
    try {
      const generated = await generateAiOutput({
        skill: workspace.activeSkill,
        systemPrompt: skill.system,
        userPrompt: skill.buildPrompt(workspace.input, buildContext(projectTree.activePath), { ...workspace.options, hasImage }),
        nodeId: projectTree.activeNodeId,
        image: hasImage ? { mediaType: workspace.image.mediaType, data: workspace.image.data } : undefined,
        expectJson: skill.output === 'testcase',
      });

      const parsed = skill.output === 'testcase' ? parseAiJson(generated.output) : stripCodeFence(generated.output);
      if (workspace.activeSkill === 'testcase' && projectTree.activeNodeId && Array.isArray(parsed.testCases)) {
        const sorted = sortTestCases(parsed.testCases);
        parsed.testCases = sorted;
        await saveTestCasesApi(projectTree.activeNodeId, sorted);
      }
      workspace.setSkillOutput(parsed, generated.output);
      await saveSkillRun(workspace.input, parsed, generated.output, generated.provider);
      setToast(`Đã sinh output bằng ${generated.provider}`);
      // Chỉ auto-audit khi user bật checkbox (tiết kiệm token); mặc định tắt — user tự bấm "Đánh giá chất lượng" ở Output.
      if (workspace.options.autoAudit && workspace.activeSkill === 'testcase' && projectTree.activeNodeId && Array.isArray(parsed.testCases) && parsed.testCases.length) {
        await runQualityCheck(parsed.testCases, workspace.input);
      }
    } catch (e) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function appendTestCases(noteOverride) {
    if (workspace.activeSkill !== 'testcase') return;
    // onClick truyền event vào arg đầu → chỉ coi là note khi là string (gọi từ form trả lời câu hỏi).
    const usingOverride = typeof noteOverride === 'string';
    const note = (usingOverride ? noteOverride : supplementNote).trim();
    if (!note) {
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
      // Chỉ gửi id + tên (+ module) của TC đã có để AI biết mà tránh trùng — KHÔNG
      // gửi full steps/expected/preconditions (tiết kiệm mạnh input token).
      const existingBrief = existingCases.map(tc => ({ id: tc.id, name: tc.name, module: tc.module })).filter(x => x.id || x.name);
      const appendPrompt = `Danh sách Test Case ĐÃ CÓ (chỉ gồm id + tên để bạn TRÁNH trùng — KHÔNG sinh lại các case này):
\`\`\`json
${JSON.stringify(existingBrief, null, 2)}
\`\`\`

GHI CHÚ BỔ SUNG / TRẢ LỜI CÂU HỎI TỪ NGƯỜI DÙNG:
---
${note}
---

NHIỆM VỤ:
Chỉ sinh ra các Test Case MỚI (chưa có trong danh sách trên) để bổ sung theo ghi chú trên.
Trường "testCases" trong JSON trả về CHỈ chứa các test case mới, không lặp lại case cũ.`;

      const generated = await generateAiOutput({
        skill: 'testcase',
        systemPrompt: skill.system,
        userPrompt: `${buildContext(projectTree.activePath)}\n\n${appendPrompt}`,
        nodeId: projectTree.activeNodeId,
        expectJson: true,
      });
      const parsedNew = parseAiJson(generated.output);
      const newCases = renumberNewCases(existingCases, parsedNew.testCases || []);
      const mergedCases = [...existingCases, ...newCases];
      // Cập nhật lại openQuestions theo phản hồi mới nhất → xóa các câu hỏi vừa được trả lời khỏi ô cảnh báo.
      const mergedOutput = { ...workspace.output, testCases: mergedCases, total: mergedCases.length, openQuestions: parsedNew.openQuestions || [] };
      const nextRequirement = [workspace.input.trim(), `[Bổ sung] ${note}`].filter(Boolean).join('\n\n');

      workspace.setSkillInput(nextRequirement);
      workspace.setSkillOutput(mergedOutput, JSON.stringify(mergedOutput, null, 2));
      if (projectTree.activeNodeId) {
        await saveTestCasesApi(projectTree.activeNodeId, mergedCases);
      }
      await saveSkillRun(nextRequirement, mergedOutput, JSON.stringify(mergedOutput, null, 2), generated.provider);
      if (!usingOverride) setSupplementNote('');
      setToast(`Đã bổ sung ${newCases.length} test case mới`);
    } catch (e) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Trả lời batch các câu hỏi "openQuestions" mà skill TC nêu ra: gộp Q&A thành 1
  // ghi chú rồi đưa qua đúng flow bổ sung (appendTestCases) — không cần gõ tay từng câu.
  async function handleTcClarificationSubmit(pairs) {
    if (!Array.isArray(pairs) || !pairs.length) return;
    const note = 'TRẢ LỜI CÁC CÂU HỎI CẦN LÀM RÕ:\n' +
      pairs.map(p => `- ${p.q}\n  → ${p.a}`).join('\n');
    await appendTestCases(note);
  }

  // Import TC dán từ Excel/Sheets/Lark/CSV → lưu thẳng DB (0 token). MERGE thêm vào
  // TC hiện có của node (không xóa). Server tự gán ID theo module nếu thiếu/trùng.
  async function handleImportTestCases(text) {
    if (!projectTree.activeNodeId) {
      setToast('Chọn một node trước khi import');
      return;
    }
    const imported = parsePastedTestCases(text);
    if (!imported.length) {
      setToast('Không nhận diện được test case nào trong nội dung dán');
      return;
    }
    setLoading(true);
    try {
      const existing = workspace.output?.testCases || [];
      const merged = [...existing, ...imported];
      const saved = await saveTestCasesApi(projectTree.activeNodeId, merged);
      const savedCases = Array.isArray(saved) ? saved : (saved.testCases || merged);
      const sorted = sortTestCases(savedCases);
      const output = { type: 'testcase', testCases: sorted, total: sorted.length };
      workspace.setSkillOutput(output, JSON.stringify(output, null, 2), 'testcase');
      workspace.setActiveSkill('testcase');
      await saveSkillRun(`Import ${imported.length} TC (Manual)`, output, JSON.stringify(output, null, 2), 'manual');
      setImportOpen(false);
      setToast(`Đã import ${imported.length} test case (0 token)`);
    } catch (e) {
      setToast(`Lỗi import: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function sendSrsToTestCase() {
    const srsText = workspace.output || workspace.rawOutput;
    if (!srsText) return;
    skipNextHistorySync.current = true;
    workspace.setSkillInput(String(srsText), 'testcase');
    workspace.setActiveSkill('testcase');
    setToast('Đã chuyển SRS sang Test Cases — bấm Generate để sinh test case');
  }

  async function handleClarificationSubmit(answers) {
    if (workspace.activeSkill !== 'srs') return;

    const answerMarkdown = "### CÂU TRẢ LỜI LÀM RÕ:\n" +
      Object.entries(answers)
        .map(([qLabel, qAnswer]) => `- **${qLabel}**: ${qAnswer}`)
        .join('\n');

    // Giữ nguyên bản SRS/câu hỏi trước đó — dùng làm cơ sở cho vòng chốt thay vì
    // phân tích lại input gốc từ đầu (nhanh hơn, và AI không hỏi lại câu đã trả lời).
    const previousSrsText = String(workspace.output || workspace.rawOutput || '');
    const nextRequirement = workspace.input.trim() + "\n\n" + answerMarkdown;
    workspace.setSkillInput(nextRequirement);

    setTimeout(async () => {
      dismissReview();
      setLoading(true);
      try {
        const generated = await generateAiOutput({
          skill: 'srs',
          systemPrompt: skill.system,
          userPrompt: skill.buildFinalizePrompt(previousSrsText, answerMarkdown, buildContext(projectTree.activePath)),
          nodeId: projectTree.activeNodeId,
        });

        const parsed = stripCodeFence(generated.output);
        workspace.setSkillOutput(parsed, generated.output);
        await saveSkillRun(nextRequirement, parsed, generated.output, generated.provider);
        const stillHasQuestions = parseClarificationQuestions(parsed).length > 0;
        setToast(stillHasQuestions
          ? `AI cần thêm thông tin — vui lòng trả lời tiếp các câu hỏi mới (${generated.provider})`
          : `Đã cập nhật SRS hoàn chỉnh bằng ${generated.provider}`);
      } catch (e) {
        setToast(`Lỗi: ${e.message}`);
      } finally {
        setLoading(false);
      }
    }, 50);
  }

  // Được gọi thủ công từ nút "Phân rã thành Feature" trên Output (sau khi user
  // xác nhận SRS đã ổn) — KHÔNG tự chạy ngay sau khi Gen SRS xong nữa, vì user
  // muốn tự quyết định lúc nào mới bóc tách thay vì AI tự ý làm luôn.
  async function handleDecomposeFeatures() {
    const srsContent = String(workspace.output || workspace.rawOutput || '');
    if (!srsContent.trim() || !projectTree.activeNodeId) return;
    setDecomposing(true);
    try {
      await decomposeSrs(srsContent);
    } finally {
      setDecomposing(false);
    }
  }

  async function decomposeSrs(srsContent, provider) {
    if (!projectTree.activeNodeId) return;
    setToast('Đang phân rã SRS thành các Feature...');
    setDecomposeResult(null);
    try {
      const systemPrompt = SKILLS.srsdecomposer.system;
      const userPrompt = SKILLS.srsdecomposer.buildPrompt(srsContent, buildContext(projectTree.activePath));

      const generated = await generateAiOutput({
        skill: 'srsdecomposer',
        systemPrompt,
        userPrompt,
        nodeId: projectTree.activeNodeId,
        expectJson: true,
      });

      const features = parseAiJson(generated.output);
      if (!Array.isArray(features)) {
        console.error('Features decomp did not return array:', features);
        setDecomposeResult({ status: 'error', message: 'AI không trả về danh sách feature hợp lệ.' });
        return;
      }

      let createdCount = 0;
      const createdNames = [];
      for (const feature of features) {
        if (!feature.name || !feature.srsSegment) continue;

        const exists = projectTree.nodes.some(n =>
          n.parentId === projectTree.activeNodeId &&
          n.name.trim().toLowerCase() === feature.name.trim().toLowerCase()
        );
        if (exists) continue;

        const created = await createNodeApi({
          parentId: projectTree.activeNodeId,
          type: 'feature',
          name: feature.name.trim(),
          context: `Đặc tả bóc tách từ: ${projectTree.activeNode.name}`,
        });

        await createSkillRun({
          nodeId: created.id,
          skill: 'srs',
          title: `SRS Phân rã: ${feature.name.trim()}`,
          input: 'Được bóc tách từ SRS của node cha',
          output: feature.srsSegment,
          rawOutput: feature.srsSegment,
          provider: generated.provider
        });
        createdCount++;
        createdNames.push(feature.name.trim());
      }

      await projectTree.refreshTree();
      setToast(`Đã tạo và bóc tách ${createdCount} Feature thành công!`);
      setDecomposeResult({ status: 'done', count: createdCount, total: features.length, names: createdNames });
    } catch (e) {
      console.error('Failed to decompose SRS:', e);
      setToast(`Lỗi phân tách Feature: ${e.message}`);
      setDecomposeResult({ status: 'error', message: e.message });
    }
  }

  async function handleGenerateStrategyDraft(template, note) {
    const generated = await generateAiOutput({
      skill: 'teststrategy',
      systemPrompt: SKILLS.teststrategy.system,
      userPrompt: SKILLS.teststrategy.buildPrompt(note, buildContext(projectTree.activePath), { template }),
      nodeId: projectTree.activeNodeId,
      expectJson: true,
    });
    const parsed = parseAiJson(generated.output);
    return { ...parsed, provider: generated.provider };
  }

  async function handleGenAllTC() {
    const childFeatures = projectTree.nodes.filter(n => n.parentId === projectTree.activeNodeId && n.type === 'feature');
    if (!childFeatures.length) {
      setToast('Không có Feature con nào dưới node này để sinh Test Case');
      return;
    }
    
    if (!window.confirm(`Sinh Test Case song song cho ${childFeatures.length} Feature con?`)) return;
    
    setBatchGenLoading(true);

    // Batched parallel execution – process BATCH_SIZE features at a time
    // to avoid hitting API rate limits while still being much faster than sequential
    const BATCH_SIZE = 3;
    let successCount = 0;
    let failCount = 0;

    async function genForFeature(feature) {
      const runs = await fetchSkillRuns(feature.id, 'srs');
      const latestSrs = runs[0];
      if (!latestSrs) {
        console.warn(`Feature ${feature.name} không có SRS run, bỏ qua.`);
        return false;
      }

      const srsContent = latestSrs.output || latestSrs.rawOutput;

      const generated = await generateAiOutput({
        skill: 'testcase',
        systemPrompt: SKILLS.testcase.system,
        userPrompt: SKILLS.testcase.buildPrompt(srsContent, `Feature context: ${feature.name}`, { types: ['Positive', 'Negative', 'Boundary', 'Edge Case'] }),
        nodeId: feature.id,
        expectJson: true,
      });

      const parsed = parseAiJson(generated.output);

      if (Array.isArray(parsed.testCases)) {
        await saveTestCasesApi(feature.id, parsed.testCases);
      }

      await createSkillRun({
        nodeId: feature.id,
        skill: 'testcase',
        title: `Batch Gen: ${feature.name}`,
        input: srsContent,
        output: parsed,
        rawOutput: generated.output,
        provider: generated.provider
      });

      return true;
    }

    for (let i = 0; i < childFeatures.length; i += BATCH_SIZE) {
      const batch = childFeatures.slice(i, i + BATCH_SIZE);
      const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(childFeatures.length / BATCH_SIZE);

      setToast(`Đang xử lý batch ${batchIndex}/${totalBatches} (${batch.map(f => f.name).join(', ')})...`);

      const results = await Promise.allSettled(batch.map(feature => genForFeature(feature)));

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value === true) {
          successCount++;
        } else {
          failCount++;
          if (result.status === 'rejected') {
            console.error('Batch gen error:', result.reason);
          }
        }
      }
    }

    setBatchGenLoading(false);

    if (failCount === 0) {
      setToast(`✅ Đã sinh Test Case thành công cho tất cả ${successCount}/${childFeatures.length} Feature!`);
    } else {
      setToast(`⚠ Hoàn tất: ${successCount} thành công, ${failCount} thất bại trong tổng số ${childFeatures.length} Feature.`);
    }
  }

  function handleUpdateTestCases(updatedCases) {
    workspace.setSkillOutput({
      ...workspace.output,
      testCases: updatedCases,
      total: updatedCases.length
    }, workspace.rawOutput, 'testcase');
  }

  async function handleSaveEditedTestCases() {
    if (!projectTree.activeNodeId) return;
    setLoading(true);
    try {
      const sorted = sortTestCases(testCases);
      await saveTestCasesApi(projectTree.activeNodeId, sorted);
      workspace.setSkillOutput({
        ...workspace.output,
        testCases: sorted,
        total: sorted.length
      }, workspace.rawOutput, 'testcase');
      setToast('Đã lưu các thay đổi của test case vào cơ sở dữ liệu!');
    } catch (e) {
      setToast(`Lỗi lưu test case: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const payload = await fileToImagePayload(file);
      workspace.setSkillImage(payload);
    } catch (e) {
      setToast(`Lỗi upload ảnh: ${e.message}`);
    }
  }

  async function handleRequirementPaste(event) {
    if (!skill.supportsImage) return;
    const items = event.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        event.preventDefault();
        try {
          const payload = await fileToImagePayload(file);
          workspace.setSkillImage(payload);
          setToast('Đã dán ảnh từ clipboard');
        } catch (e) {
          setToast(`Lỗi dán ảnh: ${e.message}`);
        }
        return;
      }
    }
  }

  function removeImage() {
    workspace.setSkillImage(null);
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
      if (format === 'csv') return downloadFile(toCsv(testCases, nodePathInfo, lark.larkMapping), `test-cases-${Date.now()}.csv`, 'text/csv');
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

  // Export test case theo scope (system/project/module/screen/feature) — 0 token AI.
  // node = { id, name, type } (type === scopeType; 'system' cho nhóm System trên sidebar).
  async function handleExportScopeFile(node) {
    if (!node?.id || !node?.type) return;
    try {
      const data = await exportScopeApi(node.type, node.id);
      setExportFileData(data);
    } catch (e) {
      setToast(`Không tải được test case để export: ${e.message}`);
    }
  }
  function handleExportScopeLark(node) {
    if (!node?.id || !node?.type) return;
    setExportLarkTarget({ scopeType: node.type, scopeId: node.id, name: node.name });
  }

  return (
    <>
      <div className="bg-grid" />
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
          onCreateProject={(systemId, systemName) => setCreateProject({ systemId, systemName })}
          onExportFile={handleExportScopeFile}
          onExportLark={handleExportScopeLark}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <section className="web-workspace">
          {!isProjectNode && projectTree.activeNode && (
            <div className="sticky top-0 z-30 bg-[#09090b] flex items-center justify-between h-[52px] border-b border-zinc-800 -mx-6 -mt-5 px-6 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider shrink-0" style={{ fontSize: '10px' }}>Skills</span>
                <div className="inline-flex h-9 items-center justify-start rounded-lg bg-zinc-900/80 p-1 text-zinc-400 w-max max-w-full overflow-x-auto border border-zinc-800/40">
                  {Object.entries(SKILLS)
                    .filter(([key]) => key !== 'srsdecomposer' && key !== 'teststrategy')
                    .filter(([key]) => !visibleSkillIds || visibleSkillIds.includes(key))
                    .map(([key, item]) => {
                      const active = workspace.activeSkill === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => workspace.setActiveSkill(key)}
                          className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-1 text-xs font-medium transition-all ${active ? 'bg-zinc-800 text-slate-100 shadow-sm font-semibold' : 'hover:text-zinc-200'}`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                </div>
              </div>
              
              {projectTree.activeNodeId && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-1.5 h-8 text-[11px] border-zinc-800 hover:bg-zinc-800 hover:text-white shrink-0 animate-in fade-in duration-200"
                  onClick={() => setHistoryOpen(true)}
                >
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Lịch sử ({skillHistory.runs?.length || 0})</span>
                </Button>
              )}
            </div>
          )}

          {isProjectNode && (
            <StrategyPanel
              projectNode={projectTree.activeNode}
              onGenerateDraft={handleGenerateStrategyDraft}
              onToast={setToast}
              onPlanChanged={projectTree.refreshTree}
            />
          )}

          {!isProjectNode && (
          <>
          {projectTree.activeNode && activePlan !== undefined && !planConfigured && projectTree.activeNode.projectId && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                border: '1px solid #c9a227', background: 'rgba(201, 162, 39, 0.10)',
                padding: '10px 16px', borderRadius: 8, marginBottom: 12,
              }}
            >
              <span style={{ color: '#c9a227', fontWeight: 600, fontSize: 13 }}>
                ⚠ Dự án chưa có kế hoạch test — skill đang hiển thị đầy đủ mặc định. Cấu hình plan để bật gating theo stage.
              </span>
              <button
                type="button"
                className="btn-secondary"
                style={{ whiteSpace: 'nowrap' }}
                onClick={() => projectTree.setActiveNodeId(projectTree.activeNode.projectId)}
              >
                Tạo kế hoạch test →
              </button>
            </div>
          )}

          {decomposeResult && workspace.activeSkill === 'srs' && FEATURE_PARENT_TYPES.includes(projectTree.activeNode?.type) && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                border: `1px solid ${decomposeResult.status === 'error' ? '#e74c3c' : '#2ecc71'}`,
                background: decomposeResult.status === 'error' ? 'rgba(231, 76, 60, 0.08)' : 'rgba(46, 204, 113, 0.08)',
                padding: '10px 16px', borderRadius: 8, marginBottom: 12,
              }}
            >
              <span style={{ color: decomposeResult.status === 'error' ? '#e74c3c' : '#2ecc71', fontWeight: 600, fontSize: 13 }}>
                {decomposeResult.status === 'error'
                  ? `⚠ Bóc tách Feature thất bại: ${decomposeResult.message}`
                  : decomposeResult.count > 0
                    ? `✅ Đã bóc tách ${decomposeResult.count} Feature mới: ${decomposeResult.names.join(', ')}`
                    : '⚠ Không có Feature mới nào được tạo (có thể đã tồn tại sẵn, hoặc SRS chưa đủ chi tiết để bóc tách).'}
              </span>
              <button type="button" className="btn-secondary" onClick={() => setDecomposeResult(null)}>Ẩn</button>
            </div>
          )}

          <section className="panel">
            <div className="panel-header flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div>
                <span className="step-badge">Bước 1 · Requirement</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <h2 className="text-sm font-semibold text-slate-100">{skill.label}</h2>
                  {projectTree.activeNode && (
                    <span className="text-xs text-zinc-500 font-normal">
                      ({projectTree.activePath.map(n => n.name).join(' / ')})
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 block mt-0.5">{skill.desc}</span>
              </div>
              <div className="flex items-center gap-2">
                {workspace.activeSkill === 'testcase' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 text-xs border-zinc-800 hover:bg-zinc-800 hover:text-white"
                    onClick={copyManualPrompt}
                  >
                    Copy Manual Prompt
                  </Button>
                )}
              </div>
            </div>
            <SkillOptions activeSkill={workspace.activeSkill} options={workspace.options} setOptions={workspace.setOptions} />
            {skill.supportsImage && (
              <div className="image-upload-row">
                <label className="btn-secondary image-upload-btn">
                  Upload ảnh (wireframe/mockup/screenshot)
                  <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                </label>
                {workspace.image && (
                  <div className="image-preview-chip">
                    <img src={workspace.image.previewUrl} alt={workspace.image.name} className="image-preview-thumb" />
                    <span className="image-preview-name">{workspace.image.name}</span>
                    <button className="btn-secondary" onClick={removeImage}>Xóa ảnh</button>
                  </div>
                )}
              </div>
            )}
            <textarea
              className="pf-textarea requirement-input"
              value={workspace.input}
              onChange={e => workspace.setSkillInput(e.target.value)}
              onPaste={handleRequirementPaste}
              placeholder={skill.supportsImage ? 'Dán mô tả requirement, hoặc Ctrl+V để dán ảnh trực tiếp (tùy chọn nếu đã upload ảnh)...' : 'Dán spec / report / flow vào đây...'}
            />
            {workspace.activeSkill === 'testcase' && testCases.length > 0 && (
              <div className="supplement-row">
                <textarea
                  className="pf-textarea supplement-input"
                  value={supplementNote}
                  onChange={e => setSupplementNote(e.target.value)}
                  placeholder="Bổ sung case còn thiếu, hoặc trả lời câu hỏi AI nêu ra ở Output..."
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={appendTestCases}
                  disabled={!supplementNote.trim() || loading}
                  title="Chỉ thêm test case mới vào danh sách hiện có, không sinh lại từ đầu"
                >
                  {loading ? 'Đang xử lý...' : 'Bổ sung thêm'}
                </Button>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-3">
              {workspace.activeSkill === 'testcase' && projectTree.activeNodeId && (
                <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={loading || batchGenLoading} title="Dán bảng TC từ Excel/Sheets/Lark → lưu thẳng, không tốn token">
                  Import TC (0 token)
                </Button>
              )}
              {FEATURE_PARENT_TYPES.includes(projectTree.activeNode?.type) && (
                <Button variant="outline" size="sm" onClick={handleGenAllTC} disabled={batchGenLoading || loading}>
                  {batchGenLoading ? 'Đang gen hàng loạt...' : 'Gen All TC'}
                </Button>
              )}
              <Button variant="default" size="sm" onClick={generate} disabled={loading || batchGenLoading}>
                {loading ? 'Đang xử lý...' : `Generate ${skill.label}`}
              </Button>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <span className="step-badge">Bước 2 · Output</span>
                <h2>Output</h2>
                <span>{workspace.activeSkill === 'testcase' ? `${testCases.length} case` : skill.output}</span>
              </div>
              <div className="output-actions-react flex items-center gap-2 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyOutput} 
                  disabled={!workspace.output && !workspace.rawOutput}
                >
                  <Copy className="w-3.5 h-3.5 mr-1.5" />
                  Copy
                </Button>

                {workspace.activeSkill === 'testcase' && testCases.length > 0 && (
                  <DropdownMenu 
                    align="right"
                    trigger={
                      <Button variant="outline" size="sm">
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Tải xuống
                        <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    }
                  >
                    <DropdownMenuItem onClick={() => exportOutput('csv')}>
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => exportOutput('md')}>
                      Export Markdown (MD)
                    </DropdownMenuItem>
                    {projectTree.activeNodeId && projectTree.activeNode && (
                      <DropdownMenuItem onClick={() => handleExportScopeFile({ id: projectTree.activeNodeId, name: projectTree.activeNode.name, type: projectTree.activeNode.type })}>
                        Export cả nhánh
                      </DropdownMenuItem>
                    )}
                  </DropdownMenu>
                )}

                {workspace.activeSkill === 'testcase' && testCases.length > 0 && (
                  <DropdownMenu 
                    align="right"
                    trigger={
                      <Button variant="outline" size="sm">
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Đồng bộ Lark
                        <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    }
                  >
                    <DropdownMenuItem onClick={copyForLark}>
                      Copy Lark HTML
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={openLarkPushModal} disabled={pushingToLark}>
                      Đẩy lên Lark Base
                    </DropdownMenuItem>
                    {projectTree.activeNodeId && projectTree.activeNode && (
                      <DropdownMenuItem onClick={() => handleExportScopeLark({ id: projectTree.activeNodeId, name: projectTree.activeNode.name, type: projectTree.activeNode.type })}>
                        Lark cả nhánh
                      </DropdownMenuItem>
                    )}
                  </DropdownMenu>
                )}

                {workspace.activeSkill !== 'testcase' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportOutput()} 
                    disabled={!workspace.output && !workspace.rawOutput}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export
                  </Button>
                )}

                {workspace.activeSkill === 'srs' && (workspace.output || workspace.rawOutput) && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={sendSrsToTestCase} 
                    title="Chuyển nội dung SRS sang skill Test Cases"
                  >
                    Viết Test Case →
                  </Button>
                )}

                {canDecomposeFeatures && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleDecomposeFeatures} 
                    disabled={decomposing}
                    title="Tách tài liệu SRS này thành từng Feature con và tạo node tương ứng trong cây dự án"
                  >
                    {decomposing ? 'Đang phân rã...' : 'Phân rã thành Feature'}
                  </Button>
                )}

                {workspace.activeSkill === 'testcase' && projectTree.activeNodeId && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleSaveEditedTestCases} 
                    disabled={loading} 
                    title="Lưu lại toàn bộ chỉnh sửa test case của node này xuống cơ sở dữ liệu"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </Button>
                )}

                {workspace.activeSkill === 'testcase' && testCases.length > 0 && !qualityReview && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => runQualityCheck(testCases, workspace.input)} 
                    disabled={loading}
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    Đánh giá chất lượng
                  </Button>
                )}
              </div>            </div>
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
              onSubmitClarifications={handleClarificationSubmit}
              loading={loading}
              onUpdateTestCases={handleUpdateTestCases}
              onSubmitTcQuestions={handleTcClarificationSubmit}
              nodePath={nodePathInfo}
            />
          </section>
          </>
          )}
        </section>
      </main>
      {historyOpen && (
        <div className="fixed inset-0 z-[160] flex justify-end">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
          <div className="relative w-80 max-w-full bg-zinc-950 border-l border-zinc-800 p-5 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-50 uppercase tracking-wider">
                <History className="w-4 h-4 text-indigo-400" />
                Lịch sử (History)
              </div>
              <Button variant="ghost" size="icon" onClick={() => setHistoryOpen(false)} className="h-8 w-8 text-slate-400 hover:text-white rounded-md">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {!projectTree.activeNodeId && <div className="text-center text-xs text-zinc-500 py-8">Chọn một node để xem lịch sử</div>}
              {projectTree.activeNodeId && skillHistory.loading && <div className="text-center text-xs text-zinc-500 py-8">Đang tải...</div>}
              {projectTree.activeNodeId && !skillHistory.loading && skillHistory.runs.length === 0 && <div className="text-center text-xs text-zinc-500 py-8">Chưa có lịch sử chạy</div>}
              {projectTree.activeNodeId && skillHistory.runs.map(item => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  active={item.id === activeHistoryId}
                  onView={(itm) => { viewHistoryItem(itm); setHistoryOpen(false); }}
                  onRename={renameHistoryItem}
                  onDelete={deleteHistoryItem}
                  onRestore={restoreHistoryItem}
                />
              ))}
            </div>
          </div>
        </div>
      )}

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
      {importOpen && (
        <ImportTestCaseModal
          onClose={() => setImportOpen(false)}
          onImport={handleImportTestCases}
          busy={loading}
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
      {createProject && (
        <CreateProjectModal
          systemId={createProject.systemId}
          systemName={createProject.systemName}
          onClose={() => setCreateProject(null)}
          onCreated={handleProjectCreated}
          onToast={setToast}
        />
      )}
      {exportFileData && (
        <ExportFileModal
          data={exportFileData}
          onClose={() => setExportFileData(null)}
          onToast={setToast}
        />
      )}
      {exportLarkTarget && (
        <ExportLarkModal
          scope={exportLarkTarget}
          onClose={() => setExportLarkTarget(null)}
          onToast={setToast}
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
