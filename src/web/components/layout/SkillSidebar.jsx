import { useState } from 'react';
import { SKILLS } from '../../features/skills/skill-registry';
import { useResizableWidth } from '../../state/useResizableWidth';
import { HistoryItem } from './HistoryItem';
import { Button } from '../ui/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function SkillSidebar({
  activeSkill,
  setActiveSkill,
  history,
  historyLoading,
  activeHistoryId,
  hasActiveNode,
  visibleSkillIds,
  onViewHistory,
  onRenameHistory,
  onDeleteHistory,
  onRestoreHistory,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { width, resizing, startResize } = useResizableWidth({ storageKey: 'sidebar-width-skill', defaultWidth: 240, min: 180, max: 420 });

  return (
    <aside className={`sidebar skill-sidebar-react ${collapsed ? 'collapsed' : ''} ${resizing ? 'resizing' : ''}`} style={collapsed ? undefined : { width }}>
      <div className="sidebar-title-row flex items-center justify-between p-3 border-b border-border">
        {!collapsed && <span className="sidebar-title text-xs font-bold tracking-wider text-slate-400 uppercase">Skills</span>}
        <button 
          className="flex items-center justify-center w-6 h-6 mx-auto rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors" 
          onClick={() => setCollapsed(v => !v)} 
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      <nav className="skill-nav flex flex-col gap-1 p-2">
        {Object.entries(SKILLS)
          .filter(([key]) => key !== 'srsdecomposer' && key !== 'teststrategy')
          .filter(([key]) => !visibleSkillIds || visibleSkillIds.includes(key))
          .map(([key, item]) => (
          <button 
            key={key} 
            className={`skill-btn flex items-center gap-3 p-2 rounded-md text-left transition-colors ${activeSkill === key ? 'bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 font-semibold' : 'bg-transparent border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`} 
            onClick={() => setActiveSkill(key)} 
            title={`${item.label} — ${item.desc}`}
          >
            <span className="skill-icon-text text-base flex-shrink-0">{item.icon}</span>
            {!collapsed && (
              <span className="skill-info flex-1 min-w-0">
                <span className="block text-xs font-semibold truncate">{item.label}</span>
                <span className="block text-[10px] text-slate-500 truncate mt-0.5">{item.desc}</span>
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-divider border-t border-border my-2" />
      {!collapsed && <div className="sidebar-title px-3 text-xs font-bold tracking-wider text-slate-400 uppercase mb-2">History</div>}
      <div className="history-list flex flex-col gap-1.5 px-2">
        {!hasActiveNode && !collapsed && <div className="history-empty text-center text-xs text-slate-500 py-4">Chọn một node để xem lịch sử</div>}
        {hasActiveNode && historyLoading && !collapsed && <div className="history-empty text-center text-xs text-slate-500 py-4">Đang tải...</div>}
        {hasActiveNode && !historyLoading && history.length === 0 && !collapsed && <div className="history-empty text-center text-xs text-slate-500 py-4">Chưa có lịch sử</div>}
        {hasActiveNode && history.map(item => (
          <HistoryItem
            key={item.id}
            item={item}
            active={item.id === activeHistoryId}
            onView={onViewHistory}
            onRename={onRenameHistory}
            onDelete={onDeleteHistory}
            onRestore={onRestoreHistory}
          />
        ))}
      </div>
      {!collapsed && (
        <div
          className={`sidebar-resize-handle ${resizing ? 'resizing' : ''}`}
          onMouseDown={startResize}
        />
      )}
    </aside>
  );
}
