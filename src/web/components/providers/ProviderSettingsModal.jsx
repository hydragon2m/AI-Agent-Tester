export function ProviderSettingsModal({ form, setForm, larkMapping, setLarkMapping, larkConfig, setLarkConfig, onTestLarkConnection, testingLarkConnection, onClose, onSave, loading }) {
  function update(provider, patch) {
    setForm(prev => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  }

  function updateMapping(section, key, value) {
    setLarkMapping({
      ...larkMapping,
      [section]: {
        ...larkMapping[section],
        [key]: value,
      },
    });
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
                  <input type="checkbox" checked={value.enabled} onChange={e => update(provider, { enabled: e.target.checked })} />
                  <span className="toggle-slider" />
                </label>
              </div>
              <div className="provider-key-row">
                <input className="pf-input" type="password" value={value.key} onChange={e => update(provider, { key: e.target.value })} placeholder={value.hasKey ? 'Để trống để giữ key cũ' : 'Nhập API key'} />
                <input className="pf-input provider-priority-input" type="number" min="1" value={value.priority} onChange={e => update(provider, { priority: Number(e.target.value) })} />
              </div>
            </div>
          ))}
          <div className="provider-card">
            <div className="provider-card-header">
              <div className="provider-logo">L</div>
              <div className="provider-info">
                <span className="provider-name">Lark Base — Kết nối API</span>
                <span className="provider-tag">{larkConfig?.hasSecret ? 'Đã có App Secret trên server' : 'Chưa cấu hình'}</span>
              </div>
            </div>
            <div className="lark-mapping-grid">
              <label>App ID<input className="pf-input" value={larkConfig?.app_id || ''} onChange={e => setLarkConfig(prev => ({ ...prev, app_id: e.target.value }))} placeholder="cli_xxxxxxxx" /></label>
              <label>App Secret<input className="pf-input" type="password" value={larkConfig?.app_secret || ''} onChange={e => setLarkConfig(prev => ({ ...prev, app_secret: e.target.value }))} placeholder={larkConfig?.hasSecret ? 'Để trống để giữ secret cũ' : 'Nhập App Secret'} /></label>
              <label>Nhãn trạng thái "đã duyệt"<input className="pf-input" value={larkConfig?.approved_status_label || ''} onChange={e => setLarkConfig(prev => ({ ...prev, approved_status_label: e.target.value }))} placeholder="Approved" /></label>
            </div>
            <div className="provider-key-row">
              <button className="btn-secondary" type="button" onClick={onTestLarkConnection} disabled={testingLarkConnection}>
                {testingLarkConnection ? 'Đang kiểm tra...' : 'Lưu & kiểm tra kết nối'}
              </button>
            </div>
          </div>
          <div className="provider-card">
            <div className="provider-card-header">
              <div className="provider-logo">L</div>
              <div className="provider-info">
                <span className="provider-name">Lark Base Options Mapping</span>
                <span className="provider-tag">Ánh xạ single select khi copy/export</span>
              </div>
            </div>
            <div className="lark-mapping-grid">
              <label>High<input className="pf-input" value={larkMapping.priority.high} onChange={e => updateMapping('priority', 'high', e.target.value)} placeholder="Cao" /></label>
              <label>Medium<input className="pf-input" value={larkMapping.priority.medium} onChange={e => updateMapping('priority', 'medium', e.target.value)} placeholder="Trung bình" /></label>
              <label>Low<input className="pf-input" value={larkMapping.priority.low} onChange={e => updateMapping('priority', 'low', e.target.value)} placeholder="Thấp" /></label>
              <label>Positive<input className="pf-input" value={larkMapping.type.positive} onChange={e => updateMapping('type', 'positive', e.target.value)} placeholder="Positive" /></label>
              <label>Negative<input className="pf-input" value={larkMapping.type.negative} onChange={e => updateMapping('type', 'negative', e.target.value)} placeholder="Negative" /></label>
              <label>Edge Case<input className="pf-input" value={larkMapping.type.edge} onChange={e => updateMapping('type', 'edge', e.target.value)} placeholder="Edge Case" /></label>
              <label>UI/UX<input className="pf-input" value={larkMapping.type.ui} onChange={e => updateMapping('type', 'ui', e.target.value)} placeholder="UI/UX" /></label>
              <label>Security<input className="pf-input" value={larkMapping.type.security} onChange={e => updateMapping('type', 'security', e.target.value)} placeholder="Security" /></label>
              <label>Performance<input className="pf-input" value={larkMapping.type.performance} onChange={e => updateMapping('type', 'performance', e.target.value)} placeholder="Performance" /></label>
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={onSave} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
