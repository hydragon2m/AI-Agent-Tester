import { useState } from 'react';
import { SKILLS } from '../../features/skills/skill-registry';
import { useResizableWidth } from '../../state/useResizableWidth';
import { HistoryItem } from './HistoryItem';

export function SkillSidebar({
  activeSkill,
  setActiveSkill,
  history,
  historyLoading,
  activeHistoryId,
  hasActiveNode,
  onViewHistory,
  onRenameHistory,
  onDeleteHistory,
  onRestoreHistory,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { width, resizing, startResize } = useResizableWidth({ storageKey: 'sidebar-width-skill', defaultWidth: 240, min: 180, max: 420 });

  return (
    <aside className={`sidebar skill-sidebar-react ${collapsed ? 'collapsed' : ''} ${resizing ? 'resizing' : ''}`} style={collapsed ? undefined : { width }}>
      <div className="sidebar-title-row">
        <span className="sidebar-title">Skills</span>
        <button className="btn-toggle-sidebar" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Mở rộng' : 'Thu gọn'}>‹</button>
      </div>
      <nav className="skill-nav">
        {Object.entries(SKILLS).filter(([key]) => key !== 'srsdecomposer').map(([key, item]) => (
          <button key={key} className={`skill-btn ${activeSkill === key ? 'active' : ''}`} onClick={() => setActiveSkill(key)} title={`${item.label} — ${item.desc}`}>
            <span className="skill-icon-text">{item.icon}</span>
            <span className="skill-info">
              <span className="skill-name">{item.label}</span>
              <span className="skill-desc">{item.desc}</span>
            </span>
          </button>
        ))}
      </nav>
      <div className="sidebar-divider" />
      <div className="sidebar-title">History</div>
      <div className="history-list">
        {!hasActiveNode && <div className="history-empty">Chọn một node để xem lịch sử</div>}
        {hasActiveNode && historyLoading && <div className="history-empty">Đang tải...</div>}
        {hasActiveNode && !historyLoading && history.length === 0 && <div className="history-empty">Chưa có lịch sử</div>}
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
