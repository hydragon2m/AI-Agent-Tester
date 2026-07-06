import { ProviderPills } from '../providers/ProviderPills';

export function AppHeader({ demoMode, setDemoMode, providerStatus, onOpenSettings }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <div className="logo-icon">✓</div>
          <div className="logo-text">
            <span className="logo-title">AI QA Assistant</span>
            <span className="logo-sub">React Web Migration</span>
          </div>
        </div>
        <div className="header-actions">
          <button className={`btn-secondary ${demoMode ? 'active' : ''}`} onClick={() => setDemoMode(v => !v)}>
            Demo
          </button>
          <ProviderPills status={providerStatus} demoMode={demoMode} />
          <button className="btn-icon" onClick={onOpenSettings} title="Provider settings">⚙</button>
        </div>
      </div>
    </header>
  );
}
