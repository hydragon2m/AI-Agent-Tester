import { useState } from 'react';
import { pushScopeToLarkApi } from '../../backend-api/lark.api';
import { Button } from '../ui/Button';
import { X, Share2, AlertTriangle, CheckCircle2 } from 'lucide-react';

const SCOPE_LABELS = { system: 'Hệ thống', project: 'Project', module: 'Module', screen: 'Screen', feature: 'Feature' };

// Đẩy test case của 1 scope lên Lark Base theo URL. System → mỗi project 1 bảng
// riêng trong cùng Base; scope nhỏ hơn → 1 bảng. `scope` = { scopeType, scopeId, name }.
export function ExportLarkModal({ scope, onClose, onToast }) {
  const [url, setUrl] = useState('');
  const [saveLink, setSaveLink] = useState(true);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const isSystem = scope?.scopeType === 'system';

  async function handlePush() {
    if (!url.trim() || pushing) return;
    setPushing(true);
    setError('');
    setResult(null);
    try {
      const res = await pushScopeToLarkApi({
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        url: url.trim(),
        saveLink,
      });
      setResult(res);
      const t = res.totals || {};
      const errNote = res.errors?.length ? `, ${res.errors.length} lỗi` : '';
      onToast?.(`Lark: tạo ${t.created || 0}, cập nhật ${t.updated || 0}${errNote}`);
    } catch (e) {
      setError(e.message || 'Đẩy lên Lark thất bại');
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="modal-overlay flex items-center justify-center fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm p-4">
      <div className="modal modal-wide w-full max-w-2xl bg-slate-900 border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="modal-header flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Export to Lark Base</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-white rounded-md">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="modal-body p-5 space-y-4">
          <div className="text-xs text-slate-400 leading-normal space-y-1">
            <div>Phạm vi: <strong className="text-slate-200">{SCOPE_LABELS[scope?.scopeType] || 'Scope'} · {scope?.name || ''}</strong></div>
            <div className="text-indigo-400">
              {isSystem
                ? 'Mỗi project sẽ được đẩy vào MỘT bảng riêng (tên bảng = tên project) trong cùng Base.'
                : 'Toàn bộ test case gộp vào 1 bảng (tên bảng = tên project).'}
            </div>
          </div>

          <div className="pf-field flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-350">Link Lark Base (hoặc Wiki chứa Base)</label>
            <input
              className="w-full h-9 px-3 rounded-md border border-border bg-slate-950 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xxx.larksuite.com/base/xxx hoặc .../wiki/xxx"
              autoFocus
              disabled={pushing}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={saveLink} 
              onChange={e => setSaveLink(e.target.checked)} 
              disabled={pushing}
              className="border-border bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4 h-4 rounded"
            />
            Tự động lưu liên kết Lark vào từng project (để lần sau "Đẩy lên Lark" ở node dùng lại)
          </label>

          <p className="text-[10px] text-slate-500 leading-normal">
            Bảng/field còn thiếu sẽ được tự tạo; bảng đã có chỉ được thêm field thiếu — không sửa/xoá dữ liệu sẵn có.
          </p>

          {error && (
            <div className="flex items-center gap-2 border border-red-500/20 bg-red-500/5 p-3 rounded-md text-xs text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="border border-border bg-slate-950/40 p-4 rounded-md space-y-3 text-xs">
              <div className="font-bold text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Kết quả: tạo {result.totals?.created || 0} · cập nhật {result.totals?.updated || 0} · liên kết {result.totals?.bugsLinked || 0} bug
              </div>
              <div className="max-h-[160px] overflow-y-auto space-y-1.5 text-slate-350 pr-2">
                {(result.tables || []).map((tbl, i) => (
                  <div key={i} className="py-1 border-t border-border/30 first:border-0">
                    <strong className="text-slate-300">{tbl.projectName}</strong>
                    {tbl.error
                      ? <span className="text-red-400"> — lỗi: {tbl.error}</span>
                      : tbl.skipped
                        ? <span className="text-slate-500"> — {tbl.note || 'bỏ qua'}</span>
                        : <span className="text-slate-400"> → bảng “{tbl.tableName}”: tạo {tbl.created}, cập nhật {tbl.updated}{tbl.createdTable ? ' (bảng mới)' : ''}</span>}
                  </div>
                ))}
              </div>
              {result.errors?.length > 0 && (
                <div className="text-red-400 font-semibold border-t border-border/30 pt-2 mt-2">
                  {result.errors.length} lỗi: {result.errors.slice(0, 3).join('; ')}{result.errors.length > 3 ? '…' : ''}
                </div>
              )}
            </div>
          )}

          <div className="modal-actions flex items-center justify-end gap-2 border-t border-border pt-4 mt-5">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={pushing}>{result ? 'Đóng' : 'Huỷ'}</Button>
            <Button variant="default" size="sm" onClick={handlePush} disabled={!url.trim() || pushing}>
              {pushing ? 'Đang đẩy lên Lark...' : result ? 'Đẩy lại' : 'Đẩy lên Lark'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
