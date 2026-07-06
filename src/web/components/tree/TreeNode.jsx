import { useState, useRef, useEffect } from 'react';

const NODE_TYPES = ['project', 'module', 'screen', 'feature'];
const NEXT_TYPE = { project: 'module', module: 'screen', screen: 'feature', feature: 'feature' };

export function TreeNode({ node, nodes, activeNodeId, onSelect, onAdd, onRename, onDelete, level = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const children = nodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  const isActive = activeNodeId === node.id;
  const nextType = NEXT_TYPE[node.type] || 'feature';
  const canAdd = NODE_TYPES.indexOf(node.type) < NODE_TYPES.length - 1;

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
    <div>
      <div className={`tree-node-content ${isActive ? 'active' : ''}`} style={{ paddingLeft: 4 + level * 16 }}>
        <button
          type="button"
          className={`tree-toggle-icon ${hasChildren ? '' : 'is-empty'}`}
          onClick={e => { e.stopPropagation(); if (hasChildren) setExpanded(v => !v); }}
          title={hasChildren ? (expanded ? 'Thu gọn' : 'Mở rộng') : undefined}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (expanded ? '▾' : '▸') : ''}
        </button>
        <button className="tree-node-main" onClick={() => onSelect(node.id)}>
          <span className={`tree-node-icon icon-${node.type}`}>{node.type?.[0]?.toUpperCase() || '-'}</span>
          <span className="tree-node-name" title={node.name}>
            {node.name}{node.type === 'module' && node.abbreviation ? ` (${node.abbreviation})` : ''}
          </span>
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
              {canAdd && <button onClick={() => runAction(() => onAdd(node.id, nextType))}>+ Thêm {nextType}</button>}
              <button onClick={() => runAction(() => onRename(node))}>✎ Đổi tên</button>
              <button className="text-red" onClick={() => runAction(() => onDelete(node))}>× Xóa</button>
            </div>
          )}
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {children.map(child => (
            <TreeNode key={child.id} node={child} nodes={nodes} activeNodeId={activeNodeId} onSelect={onSelect} onAdd={onAdd} onRename={onRename} onDelete={onDelete} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
