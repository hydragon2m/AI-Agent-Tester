import hydraLogo from '../../hydra-logo.png';

export function AppHeader({ demoMode, setDemoMode, onOpenSettings }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <img src={hydraLogo} alt="Hydra Logo" className="logo-img" style={{ height: '36px', width: 'auto', display: 'block' }} />
          <div className="logo-text">
            <span className="logo-title" style={{ fontSize: '1.2rem', letterSpacing: '0.05em' }}>HYDRA QA</span>
            <span className="logo-sub">AI QA Assistant</span>
          </div>
        </div>
        <div className="header-actions">
          <button className={`btn-secondary ${demoMode ? 'active' : ''}`} onClick={() => setDemoMode(v => !v)}>
            Demo
          </button>
          <button className="btn-icon" onClick={onOpenSettings} title="Provider settings">⚙</button>
        </div>
      </div>
    </header>
  );
}
