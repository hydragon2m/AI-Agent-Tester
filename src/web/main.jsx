import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const NODE_TYPES = ['project', 'module', 'screen', 'feature'];
const NEXT_TYPE = {
  project: 'module',
  module: 'screen',
  screen: 'feature',
  feature: 'feature',
};

const TESTCASE_SYSTEM_PROMPT = `Bạn là Senior QA Engineer 10+ năm kinh nghiệm, chuyên gia thiết kế test case theo chuẩn ISTQB.
Sinh test case atomic, rõ preconditions, steps, expected result, traceability.
Chỉ trả về duy nhất 1 block JSON hợp lệ có schema:
{
  "summary": "Brief summary",
  "assumptions": [],
  "openQuestions": [],
  "total": 0,
  "testCases": [
    {
      "id": "TC-001",
      "module": "Feature area",
      "name": "Short test case name",
      "type": "Positive",
      "priority": "High",
      "suite": "Regression",
      "automationCandidate": "Yes",
      "traceTo": "AC-01 / BR-01",
      "preconditions": "Required conditions",
      "steps": ["Step 1", "Step 2"],
      "testData": "",
      "expectedResult": "Expected outcome"
    }
  ]
}`;

function parseAiJson(output) {
  const text = String(output || '').trim();
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1] : text);
}

async function requestJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
  }
  return body;
}

function buildNodePath(nodes, activeNodeId) {
  const path = [];
  let curr = nodes.find(n => n.id === activeNodeId);
  while (curr) {
    path.unshift(curr);
    curr = nodes.find(n => n.id === curr.parentId);
  }
  return path;
}

function buildPrompt(requirement, path) {
  const context = path.length
    ? [
        `Selected tree path: ${path.map(n => `${n.type}:${n.name}`).join(' > ')}`,
        ...path.filter(n => n.context).map(n => `${n.type} context (${n.name}): ${n.context}`),
      ].join('\n')
    : 'No selected project node.';

  return `PROJECT CONTEXT:
${context}

FUNCTIONAL SPEC:
---
${requirement}
---

Yêu cầu:
- Ngôn ngữ output: Tiếng Việt.
- Tối đa 20 test cases.
- type chỉ dùng: Positive | Negative | Boundary | Edge Case | Security | UI/UX.
- priority chỉ dùng: High | Medium | Low.
- suite chỉ dùng: Smoke | Regression | New Feature | Exploratory.
- automationCandidate chỉ dùng: Yes | No.`;
}

function App() {
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [requirement, setRequirement] = useState('');
  const [result, setResult] = useState(null);
  const [rawOutput, setRawOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [providerStatus, setProviderStatus] = useState({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [providerForm, setProviderForm] = useState({
    gemini: { key: '', enabled: true, priority: 1, hasKey: false },
    claude: { key: '', enabled: false, priority: 2, hasKey: false },
    openai: { key: '', enabled: false, priority: 3, hasKey: false },
  });

  const activePath = useMemo(() => buildNodePath(nodes, activeNodeId), [nodes, activeNodeId]);
  const activeNode = activePath[activePath.length - 1] || null;
  const testCases = result?.testCases || [];

  useEffect(() => {
    fetchTree();
    fetchProviderStatus();
    fetchProviderSettings();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  async function fetchTree() {
    const data = await requestJson('/tree');
    setNodes(data);
    if (!activeNodeId && data.length > 0) setActiveNodeId(data[0].id);
  }

  async function fetchProviderStatus() {
    const data = await requestJson('/api/ai/status');
    setProviderStatus(data);
  }

  async function fetchProviderSettings() {
    const rows = await requestJson('/api/providers/settings');
    setProviderForm(prev => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.provider]) continue;
        next[row.provider] = {
          ...next[row.provider],
          enabled: row.enabled,
          priority: row.priority,
          hasKey: row.hasKey,
          key: '',
        };
      }
      return next;
    });
  }

  async function createNode(parentId, type) {
    const name = window.prompt(`Tên ${type}:`);
    if (!name?.trim()) return;
    const context = window.prompt('Context/description:', '') || '';
    await requestJson('/tree', {
      method: 'POST',
      body: JSON.stringify({ parentId, type, name: name.trim(), context }),
    });
    await fetchTree();
    setToast('Đã tạo node');
  }

  async function renameNode(node) {
    const name = window.prompt('Tên mới:', node.name);
    if (!name?.trim()) return;
    const context = window.prompt('Context:', node.context || '') ?? node.context;
    await requestJson(`/tree/${encodeURIComponent(node.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ name: name.trim(), context }),
    });
    await fetchTree();
    setToast('Đã cập nhật node');
  }

  async function deleteNode(node) {
    if (!window.confirm(`Xóa "${node.name}" và toàn bộ node con?`)) return;
    await requestJson(`/tree/${encodeURIComponent(node.id)}`, { method: 'DELETE' });
    if (activeNodeId === node.id) setActiveNodeId(null);
    await fetchTree();
    setResult(null);
    setToast('Đã xóa node');
  }

  async function loadNodeTestCases(nodeId) {
    setActiveNodeId(nodeId);
    const saved = await requestJson(`/testcases/${encodeURIComponent(nodeId)}`);
    if (saved.length > 0) {
      setResult({
        summary: 'Test cases đã lưu cho node hiện tại',
        total: saved.length,
        testCases: saved,
      });
      setRawOutput(JSON.stringify({ testCases: saved }, null, 2));
    } else {
      setResult(null);
      setRawOutput('');
    }
  }

  async function generateTestCases() {
    if (!requirement.trim()) {
      setToast('Nhập requirement trước');
      return;
    }
    setLoading(true);
    try {
      const data = await requestJson('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          skill: 'testcase',
          systemPrompt: TESTCASE_SYSTEM_PROMPT,
          userPrompt: buildPrompt(requirement, activePath),
          nodeId: activeNodeId,
        }),
      });
      const parsed = parseAiJson(data.output);
      setResult(parsed);
      setRawOutput(data.output);
      if (activeNodeId && Array.isArray(parsed.testCases)) {
        await saveTestCases(activeNodeId, parsed.testCases);
      }
      setToast(`Đã sinh test case bằng ${data.provider}`);
    } catch (e) {
      setToast(`Lỗi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveTestCases(nodeId, cases) {
    await requestJson(`/testcases/${encodeURIComponent(nodeId)}`, {
      method: 'POST',
      body: JSON.stringify({ testCases: cases, replace: true }),
    });
  }

  async function saveProviders() {
    setLoading(true);
    try {
      const entries = Object.entries(providerForm);
      for (const [provider, value] of entries) {
        await requestJson('/api/providers/settings', {
          method: 'POST',
          body: JSON.stringify({
            provider,
            key: value.key,
            enabled: value.enabled,
            priority: value.priority,
          }),
        });
      }
      await fetchProviderStatus();
      await fetchProviderSettings();
      setSettingsOpen(false);
      setToast('Đã lưu provider settings');
    } catch (e) {
      setToast(`Lỗi lưu provider: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(result || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-cases-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="bg-grid" />
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
                <path d="M10 16l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-title">AI QA Assistant</span>
              <span className="logo-sub">React Web Migration</span>
            </div>
          </div>
          <div className="header-actions">
            <ProviderPills status={providerStatus} />
            <button className="btn-icon" onClick={() => setSettingsOpen(true)} title="Provider settings">⚙</button>
          </div>
        </div>
      </header>

      <main className="main web-shell">
        <aside className="project-sidebar">
          <div className="project-sidebar-header">
            <span className="project-sidebar-title">Projects</span>
            <button className="btn-new-project" onClick={() => createNode(null, 'project')} title="Tạo project">+</button>
          </div>
          <div className="project-list">
            {nodes.filter(n => !n.parentId).map(node => (
              <TreeNode
                key={node.id}
                node={node}
                nodes={nodes}
                activeNodeId={activeNodeId}
                onSelect={loadNodeTestCases}
                onAdd={createNode}
                onRename={renameNode}
                onDelete={deleteNode}
              />
            ))}
            {nodes.length === 0 && (
              <div className="empty-state">Chưa có project. Bấm + để tạo.</div>
            )}
          </div>
        </aside>

        <section className="web-workspace">
          <div className="workspace-header">
            <div>
              <div className="eyebrow">Selected Context</div>
              <h1>{activeNode ? activePath.map(n => n.name).join(' / ') : 'Chưa chọn node'}</h1>
              <p>{activeNode?.context || 'Chọn hoặc tạo project/module/screen/feature để lưu test case đúng ngữ cảnh.'}</p>
            </div>
            <button className="btn-primary" onClick={generateTestCases} disabled={loading}>
              {loading ? 'Đang xử lý...' : 'Generate'}
            </button>
          </div>

          <div className="generator-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>Requirement</h2>
                <button className="btn-secondary" onClick={() => setRequirement(sampleRequirement)}>Sample</button>
              </div>
              <textarea
                className="pf-textarea requirement-input"
                value={requirement}
                onChange={e => setRequirement(e.target.value)}
                placeholder="Dán functional spec / rule / AC vào đây..."
              />
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>AI Output</h2>
                <button className="btn-secondary" onClick={exportJson} disabled={!result}>Export JSON</button>
              </div>
              <textarea
                className="pf-textarea raw-output"
                value={rawOutput}
                onChange={e => setRawOutput(e.target.value)}
                placeholder="Raw AI response sẽ hiển thị ở đây..."
              />
            </section>
          </div>

          <section className="panel table-panel">
            <div className="panel-header">
              <div>
                <h2>Test Cases</h2>
                <span>{testCases.length} case</span>
              </div>
              {activeNodeId && testCases.length > 0 && (
                <button className="btn-secondary" onClick={() => saveTestCases(activeNodeId, testCases).then(() => setToast('Đã lưu test case'))}>
                  Save
                </button>
              )}
            </div>
            {result?.summary && <p className="summary-text">{result.summary}</p>}
            <TestCaseTable testCases={testCases} />
          </section>
        </section>
      </main>

      {settingsOpen && (
        <ProviderModal
          form={providerForm}
          setForm={setProviderForm}
          onClose={() => setSettingsOpen(false)}
          onSave={saveProviders}
          loading={loading}
        />
      )}

      {toast && <div className="toast show">{toast}</div>}
    </>
  );
}

function ProviderPills({ status }) {
  return (
    <div className="provider-pills">
      {['gemini', 'claude', 'openai'].map(provider => (
        <span key={provider} className={`provider-pill ${status?.[provider]?.enabled ? 'on' : ''}`}>
          {provider}
        </span>
      ))}
    </div>
  );
}

function TreeNode({ node, nodes, activeNodeId, onSelect, onAdd, onRename, onDelete, level = 0 }) {
  const children = nodes.filter(n => n.parentId === node.id);
  const isActive = activeNodeId === node.id;
  const nextType = NEXT_TYPE[node.type] || 'feature';
  const canAdd = NODE_TYPES.indexOf(node.type) < NODE_TYPES.length - 1;

  return (
    <div>
      <div className={`tree-node-content ${isActive ? 'active' : ''}`} style={{ paddingLeft: 10 + level * 16 }}>
        <button className="tree-node-main" onClick={() => onSelect(node.id)}>
          <span className={`tree-node-icon icon-${node.type}`}>{node.type?.[0]?.toUpperCase() || '-'}</span>
          <span className="tree-node-name" title={node.name}>{node.name}</span>
        </button>
        <div className="tree-node-actions react-tree-actions">
          {canAdd && <button onClick={() => onAdd(node.id, nextType)} title={`Create ${nextType}`}>+</button>}
          <button onClick={() => onRename(node)} title="Rename">✎</button>
          <button onClick={() => onDelete(node)} title="Delete">×</button>
        </div>
      </div>
      {children.map(child => (
        <TreeNode
          key={child.id}
          node={child}
          nodes={nodes}
          activeNodeId={activeNodeId}
          onSelect={onSelect}
          onAdd={onAdd}
          onRename={onRename}
          onDelete={onDelete}
          level={level + 1}
        />
      ))}
    </div>
  );
}

function TestCaseTable({ testCases }) {
  if (!testCases.length) {
    return <div className="empty-state table-empty">Chưa có test case cho node hiện tại.</div>;
  }

  return (
    <div className="tc-table-wrapper">
      <table className="tc-table">
        <thead>
          <tr>
            <th>TC ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Steps</th>
            <th>Expected</th>
          </tr>
        </thead>
        <tbody>
          {testCases.map((tc, idx) => (
            <tr key={`${tc.id || 'tc'}-${idx}`}>
              <td>{tc.id || tc.externalId || `TC-${idx + 1}`}</td>
              <td>{tc.name}</td>
              <td>{tc.type}</td>
              <td>{tc.priority}</td>
              <td>
                {(tc.steps || []).map((step, i) => (
                  <div key={i}>{i + 1}. {step}</div>
                ))}
              </td>
              <td>{tc.expectedResult}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProviderModal({ form, setForm, onClose, onSave, loading }) {
  function update(provider, patch) {
    setForm(prev => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>Cấu hình AI Providers</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {Object.entries(form).map(([provider, value]) => (
            <div className="provider-card" key={provider}>
              <div className="provider-card-header">
                <div className="provider-logo">{provider[0].toUpperCase()}</div>
                <div className="provider-info">
                  <span className="provider-name">{provider}</span>
                  <span className="provider-tag">{value.hasKey ? 'Đã có key trên server' : 'Chưa có key'}</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={value.enabled}
                    onChange={e => update(provider, { enabled: e.target.checked })}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="provider-key-row">
                <input
                  className="pf-input"
                  type="password"
                  value={value.key}
                  onChange={e => update(provider, { key: e.target.value })}
                  placeholder={value.hasKey ? 'Để trống để giữ key cũ' : 'Nhập API key'}
                />
                <input
                  className="pf-input provider-priority-input"
                  type="number"
                  min="1"
                  value={value.priority}
                  onChange={e => update(provider, { priority: Number(e.target.value) })}
                />
              </div>
            </div>
          ))}
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={onSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const sampleRequirement = `Tính năng: Đăng nhập hệ thống

- Người dùng nhập email và mật khẩu để đăng nhập
- Email phải đúng định dạng
- Mật khẩu tối thiểu 6 ký tự
- Nếu thông tin đúng: chuyển đến Dashboard
- Nếu sai email/password: hiện thông báo lỗi
- Nếu sai 3 lần liên tiếp: khóa tài khoản 15 phút`;

createRoot(document.getElementById('root')).render(<App />);

