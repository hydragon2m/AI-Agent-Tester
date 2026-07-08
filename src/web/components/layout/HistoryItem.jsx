import { useEffect, useRef, useState } from 'react';

export function HistoryItem({ item, active, onView, onRename, onDelete, onRestore }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const runAction = fn => { setMenuOpen(false); fn(); };

  return (
    <div className={`history-item-row ${active ? 'active' : ''}`}>
      <button
        className="history-item"
        title={`${item.title || item.input || 'Không có tiêu đề'} — ${new Date(item.createdAt).toLocaleString('vi-VN')}`}
        onClick={() => onView(item)}
      >
        <span className="history-item-title">{item.title || item.input || '(Không có tiêu đề)'}</span>
        <span className="history-item-time">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
      </button>
      <div className={`tree-node-menu ${menuOpen ? 'open' : ''}`} ref={menuRef}>
        <button
          type="button"
          className="tree-more-btn"
          title="Chức năng"
          onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
        >⋯</button>
        {menuOpen && (
          <div className="tree-context-menu">
            <button onClick={() => runAction(() => onRestore(item))}>↺ Reset về bản này</button>
            <button onClick={() => runAction(() => onRename(item))}>✎ Đổi tên</button>
            <button className="text-red" onClick={() => runAction(() => onDelete(item))}>× Xóa</button>
          </div>
        )}
      </div>
    </div>
  );
}
