import { useState } from 'react';
import { pushScopeToLarkApi } from '../../backend-api/lark.api';

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
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>Export to Lark Base</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="pf-hint" style={{ marginTop: 0 }}>
            Phạm vi: <strong>{SCOPE_LABELS[scope?.scopeType] || 'Scope'} · {scope?.name || ''}</strong>.{' '}
            {isSystem
              ? 'Mỗi project sẽ được đẩy vào MỘT bảng riêng (tên bảng = tên project) trong cùng Base.'
              : 'Toàn bộ test case gộp vào 1 bảng (tên bảng = tên project).'}
          </p>

          <div className="pf-field">
            <label className="pf-label">Link Lark Base (hoặc Wiki chứa Base)</label>
            <input
              className="pf-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xxx.larksuite.com/base/xxx hoặc .../wiki/xxx"
              autoFocus
              disabled={pushing}
            />
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={saveLink} onChange={e => setSaveLink(e.target.checked)} disabled={pushing} />
            Tự động lưu liên kết Lark vào từng project (để lần sau "Đẩy lên Lark" ở node dùng lại)
          </label>

          <p className="pf-hint">
            Bảng/field còn thiếu sẽ được tự tạo; bảng đã có chỉ được thêm field thiếu — không sửa/xoá dữ liệu sẵn có.
          </p>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 10 }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', borderRadius: 8, marginBottom: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Kết quả: tạo {result.totals?.created || 0} · cập nhật {result.totals?.updated || 0} · liên kết {result.totals?.bugsLinked || 0} bug
              </div>
              <div style={{ maxHeight: 180, overflow: 'auto' }}>
                {(result.tables || []).map((tbl, i) => (
                  <div key={i} style={{ padding: '3px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <strong>{tbl.projectName}</strong>
                    {tbl.error
                      ? <span style={{ color: '#fca5a5' }}> — lỗi: {tbl.error}</span>
                      : tbl.skipped
                        ? <span style={{ opacity: 0.6 }}> — {tbl.note || 'bỏ qua'}</span>
                        : <span style={{ opacity: 0.85 }}> → bảng “{tbl.tableName}”: tạo {tbl.created}, cập nhật {tbl.updated}{tbl.createdTable ? ' (bảng mới)' : ''}</span>}
                  </div>
                ))}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ color: '#fca5a5', marginTop: 6 }}>
                  {result.errors.length} lỗi: {result.errors.slice(0, 3).join('; ')}{result.errors.length > 3 ? '…' : ''}
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={pushing}>{result ? 'Đóng' : 'Huỷ'}</button>
            <button className="btn-primary" onClick={handlePush} disabled={!url.trim() || pushing}>
              {pushing ? 'Đang đẩy lên Lark...' : result ? 'Đẩy lại' : 'Đẩy lên Lark'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
