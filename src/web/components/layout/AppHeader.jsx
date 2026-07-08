import hydraLogo from '../../hydra-logo.png';
import { Button } from '../ui/Button';
import { Settings } from 'lucide-react';

export function AppHeader({ demoMode, setDemoMode, onOpenSettings }) {
  return (
    <header className="header border-b border-zinc-800 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-[100]">
      <div className="max-w-full h-full flex items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-3">
          <img src={hydraLogo} alt="Hydra Logo" className="h-9 w-auto block" />
          <div className="flex flex-col">
            <span className="text-[1.1rem] font-bold text-slate-100 tracking-wide">AI QA Assistant</span>
            <span className="text-[0.7rem] text-slate-400 font-mono">Hanhdth</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant={demoMode ? 'default' : 'secondary'} 
            size="sm"
            onClick={() => setDemoMode(v => !v)}
          >
            Demo
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={onOpenSettings} 
            title="Provider settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
