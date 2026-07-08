import { Settings, History, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { SKILLS } from '../../features/skills/skill-registry';

export function ActivityBar({ 
  activeSkill, 
  setActiveSkill, 
  visibleSkillIds, 
  demoMode, 
  setDemoMode, 
  onOpenSettings,
  historyRunsCount,
  onOpenHistory,
  hasActiveNode
}) {
  return (
    <aside className="w-[60px] bg-zinc-950 border-r border-zinc-850 flex flex-col items-center py-4 justify-between shrink-0 select-none h-full z-45">
      {/* Top: Brand Logo & Skills list */}
      <div className="flex flex-col items-center gap-5 w-full">
        {/* Miniature Brand Icon */}
        <div className="w-9 h-9 rounded-lg bg-indigo-650 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/10 mb-2 border border-indigo-500/30" title="AI QA Assistant">
          <Layers className="w-4 h-4 text-indigo-100" />
        </div>

        {/* Skills list as vertical blocks */}
        <div className="flex flex-col items-center gap-3 w-full">
          {Object.entries(SKILLS)
            .filter(([key]) => key !== 'srsdecomposer' && key !== 'teststrategy')
            .filter(([key]) => !visibleSkillIds || visibleSkillIds.includes(key))
            .map(([key, item]) => {
              const active = activeSkill === key;
              // Extract a 2-3 char short name for the badge block
              const shortName = key === 'testcase' ? 'TC' : key === 'apitest' ? 'API' : key === 'uitest' ? 'UI' : key === 'buganalyzer' ? 'BUG' : 'SRS';
              
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSkill(key)}
                  className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center text-[10px] font-black transition-all duration-200 border relative group ${
                    active 
                      ? 'bg-slate-100 border-slate-100 text-zinc-950 shadow-md shadow-white/5 scale-105' 
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                  title={item.label}
                >
                  <span>{shortName}</span>
                  {/* Tooltip on hover */}
                  <span className="absolute left-[70px] bg-zinc-900 text-zinc-100 border border-zinc-850 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-xl opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50">
                    {item.label}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Bottom: History only */}
      <div className="flex flex-col items-center gap-4 w-full">
        {/* History Button */}
        {hasActiveNode && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-700 flex items-center justify-center transition-all duration-200 relative group"
            title="Lịch sử chạy"
          >
            <History className="w-4 h-4 text-indigo-400" />
            {historyRunsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-indigo-650 border border-zinc-950 rounded-full flex items-center justify-center text-[8px] font-bold text-white">
                {historyRunsCount}
              </span>
            )}
            <span className="absolute left-[70px] bg-zinc-900 text-zinc-100 border border-zinc-850 text-xs font-semibold px-2.5 py-1.5 rounded-md shadow-xl opacity-0 translate-x-[-10px] pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 whitespace-nowrap z-50">
              Lịch sử ({historyRunsCount})
            </span>
          </button>
        )}
      </div>
    </aside>
  );
}
