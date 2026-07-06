import { useState } from 'react';
import { TreeNode } from '../tree/TreeNode';
import { useResizableWidth } from '../../state/useResizableWidth';

export function ProjectSidebar({ nodes, activeNodeId, onSelect, onAdd, onRename, onDelete, onExport, onImport }) {
  const [collapsed, setCollapsed] = useState(false);
  const { width, resizing, startResize } = useResizableWidth({ storageKey: 'sidebar-width-project', defaultWidth: 200, min: 160, max: 420 });

  return (
    <aside className={`project-sidebar ${collapsed ? 'collapsed' : ''} ${resizing ? 'resizing' : ''}`} style={collapsed ? undefined : { width }}>
      <div className="project-sidebar-header">
        <span className="project-sidebar-title">Projects</span>
        <div className="project-sidebar-header-actions">
          <button className="btn-new-project" onClick={() => onAdd(null, 'project')} title="Tạo project">+</button>
          <button className="btn-toggle-sidebar" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Mở rộng' : 'Thu gọn'}>‹</button>
        </div>
      </div>
      <div className="project-list">
        {nodes.filter(n => !n.parentId).map(node => (
          <TreeNode
            key={node.id}
            node={node}
            nodes={nodes}
            activeNodeId={activeNodeId}
            onSelect={onSelect}
            onAdd={onAdd}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
        {nodes.length === 0 && <div className="empty-state">Chưa có project. Bấm + để tạo.</div>}
      </div>
      <div className="project-sidebar-footer">
        <button className="btn-export-projects" onClick={onExport}>Export</button>
        <label className="btn-import-projects">
          Import
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
        </label>
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
