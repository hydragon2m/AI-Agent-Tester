import { useState } from 'react';
import { scopeToCsv, scopeToMarkdown } from '../../features/testcase/testcase-export';

const SCOPE_LABELS = { system: 'Hệ thống', project: 'Project', module: 'Module', screen: 'Screen', feature: 'Feature' };

function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Tải test case của 1 scope (system/project/module/screen/feature) về file.
// `data` = phản hồi từ exportScopeApi: { scopeType, scopeName, groups[] }.
// System scope → gộp mọi project vào 1 file, thêm cột "Project Name".
export function ExportFileModal({ data, onClose, onToast }) {
  const [format, setFormat] = useState('csv');

  const groups = data?.groups || [];
  const total = groups.reduce((n, g) => n + (g.testCases?.length || 0), 0);
  const includeProjectName = data?.scopeType === 'system';
  const scopeName = data?.scopeName || 'export';
  const safeName = String(scopeName).replace(/[^\w\-]+/g, '_').slice(0, 40) || 'export';

  function handleDownload() {
    if (!total) { onToast?.('Không có test case để tải'); return; }
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      download(scopeToCsv(groups, { includeProjectName }), `${safeName}-${stamp}.csv`, 'text/csv;charset=utf-8');
    } else {
      download(scopeToMarkdown(groups, { scopeName, includeProjectName }), `${safeName}-${stamp}.md`, 'text/markdown');
    }
    onToast?.(`Đã tải ${total} test case (${format.toUpperCase()})`);
    onClose?.();
  }

  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal">
        <div className="modal-header">
          <h2>Export Excel/CSV</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="pf-hint" style={{ marginTop: 0 }}>
            Phạm vi: <strong>{SCOPE_LABELS[data?.scopeType] || 'Scope'} · {scopeName}</strong>
            <br />
            Tổng: <strong>{total}</strong> test case
            {includeProjectName ? ` · ${groups.length} project (gộp 1 file, kèm cột Project Name)` : ''}.
          </p>
          <div className="pf-field">
            <label className="pf-label">Định dạng tải về</label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, cursor: 'pointer' }}>
              <input type="radio" name="exp-fmt" checked={format === 'csv'} onChange={() => setFormat('csv')} />
              CSV (mặc định — tương thích Excel)
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="exp-fmt" checked={format === 'md'} onChange={() => setFormat('md')} />
              Markdown (.md)
            </label>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Đóng</button>
            <button className="btn-primary" onClick={handleDownload} disabled={!total}>
              Tải xuống{total ? ` (${total})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
