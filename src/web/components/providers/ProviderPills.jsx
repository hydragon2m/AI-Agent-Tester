export function ProviderPills({ status, demoMode }) {
  if (demoMode) return <div className="provider-pill on">demo mode</div>;
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
