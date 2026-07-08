export function ManualPromptModal({ prompt, response, setResponse, onClose, onProcess }) {
  return (
    <div className="modal-overlay" style={{ display: 'flex' }}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>Manual AI Response</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="pf-field">
            <label className="pf-label">Prompt đã copy</label>
            <textarea className="pf-textarea manual-prompt-preview" value={prompt} readOnly />
          </div>
          <div className="pf-field">
            <label className="pf-label">Dán response JSON từ AI</label>
            <textarea
              className="pf-textarea"
              rows="10"
              value={response}
              onChange={e => setResponse(e.target.value)}
              placeholder="Dán toàn bộ kết quả JSON do AI sinh ra vào đây..."
            />
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={onProcess}>Xử lý kết quả</button>
          </div>
        </div>
      </div>
    </div>
  );
}
