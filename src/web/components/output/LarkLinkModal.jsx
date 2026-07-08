export function LarkLinkModal({ url, setUrl, onClose, onConfirm, loading }) {
  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>Gán Lark Base cho project</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="pf-field">
            <label className="pf-label">Link Lark Base (hoặc Wiki chứa Base) bạn đã tạo sẵn</label>
            <input
              className="pf-input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xxx.larksuite.com/base/xxx hoặc .../wiki/xxx?table=xxx"
              autoFocus
            />
          </div>
          <p className="pf-hint">
            Nếu bảng Test Cases/Bugs chưa có, tool sẽ tự tạo với field cấu hình sẵn.
            Nếu đã có, tool chỉ thêm field còn thiếu — không sửa/xoá field hay bản ghi có sẵn.
          </p>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose} disabled={loading}>Huỷ</button>
            <button className="btn-primary" onClick={onConfirm} disabled={!url.trim() || loading}>
              {loading ? 'Đang gán...' : 'Gán & Đẩy lên Lark'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
