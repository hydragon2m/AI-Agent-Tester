import { useState } from 'react';
import { scopeToCsv, scopeToMarkdown } from '../../features/testcase/testcase-export';
import { Button } from '../ui/Button';
import { X, FileSpreadsheet, FileText } from 'lucide-react';

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
    <div className="modal-overlay flex items-center justify-center fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm p-4">
      <div className="modal w-full max-w-md bg-slate-900 border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="modal-header flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Export Excel/CSV</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-white rounded-md">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="modal-body p-5 space-y-4">
          <div className="text-xs text-slate-400 leading-normal space-y-1">
            <div>Phạm vi: <strong className="text-slate-200">{SCOPE_LABELS[data?.scopeType] || 'Scope'} · {scopeName}</strong></div>
            <div>Tổng số: <strong className="text-slate-200">{total}</strong> test case</div>
            {includeProjectName && <div className="text-indigo-400">{groups.length} project (gộp 1 file, kèm cột Project Name)</div>}
          </div>
          
          <div className="pf-field space-y-2 border border-border bg-slate-950/40 p-3.5 rounded-md">
            <label className="text-xs font-semibold text-slate-350 block mb-2">Định dạng tải về</label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input 
                type="radio" 
                name="exp-fmt" 
                checked={format === 'csv'} 
                onChange={() => setFormat('csv')} 
                className="border-border bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>CSV (mặc định — tương thích Excel)</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer mt-1">
              <input 
                type="radio" 
                name="exp-fmt" 
                checked={format === 'md'} 
                onChange={() => setFormat('md')} 
                className="border-border bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Markdown (.md)</span>
            </label>
          </div>

          <div className="modal-actions flex items-center justify-end gap-2 border-t border-border pt-4 mt-5">
            <Button variant="ghost" size="sm" onClick={onClose}>Đóng</Button>
            <Button variant="default" size="sm" onClick={handleDownload} disabled={!total}>
              Tải xuống{total ? ` (${total})` : ''}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
