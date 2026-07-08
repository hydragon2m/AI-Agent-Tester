import { useState, useEffect, useCallback } from 'react';
import { TreeNode } from '../tree/TreeNode';
import { useResizableWidth } from '../../state/useResizableWidth';
import { fetchSystems, createSystemApi, updateSystemApi, deleteSystemApi } from '../../backend-api/systems.api';

// Sidebar phân cấp: System → Project → Module → Screen → Feature.
// - Systems lấy từ /api/systems (state nội bộ sidebar, tự reload khi CRUD system).
// - Project nhóm theo node.systemId; project không có system (hoặc system đã xóa) → nhóm "Chưa gán".
// - Tạo project dưới 1 system: onCreateProject(systemId) nếu có (modal — Step 8), else fallback prompt onAdd.
export function ProjectSidebar({ nodes, activeNodeId, onSelect, onAdd, onRename, onDelete, onExport, onImport, onCreateProject }) {
  const [collapsed, setCollapsed] = useState(false);
  const { width, resizing, startResize } = useResizableWidth({ storageKey: 'sidebar-width-project', defaultWidth: 220, min: 180, max: 460 });
  const [systems, setSystems] = useState([]);

  const reloadSystems = useCallback(() => {
    fetchSystems().then(setSystems).catch(() => { /* backend cũ chưa có route → coi như không có system */ });
  }, []);
  useEffect(() => { reloadSystems(); }, [reloadSystems]);

  // Nhóm project theo system. systemId null / trỏ tới system đã bị xóa → "Chưa gán".
  const projectNodes = nodes.filter(n => n.type === 'project');
  const knownSystemIds = new Set(systems.map(s => s.id));
  const projectsBySystem = {};
  const ungrouped = [];
  for (const p of projectNodes) {
    if (p.systemId && knownSystemIds.has(p.systemId)) {
      (projectsBySystem[p.systemId] = projectsBySystem[p.systemId] || []).push(p);
    } else {
      ungrouped.push(p);
    }
  }

  async function handleCreateSystem() {
    const name = window.prompt('Tên hệ thống (System):');
    if (!name?.trim()) return;
    const description = window.prompt('Mô tả hệ thống (tùy chọn):', '') || '';
    try { await createSystemApi({ name: name.trim(), description }); reloadSystems(); }
    catch (e) { window.alert(`Tạo system thất bại: ${e.message}`); }
  }
  async function handleRenameSystem(sys) {
    const name = window.prompt('Tên hệ thống mới:', sys.name);
    if (!name?.trim()) return;
    try { await updateSystemApi(sys.id, { name: name.trim() }); reloadSystems(); }
    catch (e) { window.alert(`Đổi tên system thất bại: ${e.message}`); }
  }
  async function handleDeleteSystem(sys) {
    if (!window.confirm(`Xóa hệ thống "${sys.name}"?\nCác project bên trong KHÔNG bị xóa — sẽ chuyển về nhóm "Chưa gán hệ thống".`)) return;
    try { await deleteSystemApi(sys.id); reloadSystems(); }
    catch (e) { window.alert(`Xóa system thất bại: ${e.message}`); }
  }
  function addProject(systemId, systemName) {
    if (onCreateProject) onCreateProject(systemId || null, systemName || null);
    else onAdd(null, 'project', systemId || null); // fallback: prompt-based (nếu chưa mắc wizard)
  }

  const treeProps = { nodes, activeNodeId, onSelect, onAdd, onRename, onDelete };

  return (
    <aside className={`project-sidebar ${collapsed ? 'collapsed' : ''} ${resizing ? 'resizing' : ''}`} style={collapsed ? undefined : { width }}>
      <div className="project-sidebar-header">
        <span className="project-sidebar-title">Systems</span>
        <div className="project-sidebar-header-actions">
          <button className="btn-new-project" onClick={handleCreateSystem} title="Tạo hệ thống (System)">+</button>
          <button className="btn-toggle-sidebar" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Mở rộng' : 'Thu gọn'}>‹</button>
        </div>
      </div>

      <div className="project-list">
        {systems.map(sys => (
          <SystemGroup
            key={sys.id}
            system={sys}
            projects={projectsBySystem[sys.id] || []}
            treeProps={treeProps}
            onAddProject={() => addProject(sys.id, sys.name)}
            onRenameSystem={() => handleRenameSystem(sys)}
            onDeleteSystem={() => handleDeleteSystem(sys)}
          />
        ))}

        {(ungrouped.length > 0 || systems.length === 0) && (
          <SystemGroup
            system={{ id: null, name: systems.length === 0 ? 'Projects' : 'Chưa gán hệ thống' }}
            projects={ungrouped}
            treeProps={treeProps}
            onAddProject={() => addProject(null)}
          />
        )}

        {systems.length === 0 && projectNodes.length === 0 && (
          <div className="empty-state">Chưa có gì. Bấm + để tạo System, hoặc tạo Project trong nhóm bên dưới.</div>
        )}
      </div>

      <div className="project-sidebar-footer">
        <button className="btn-export-projects" onClick={onExport}>Export</button>
        <label className="btn-import-projects">
          Import
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImport} />
        </label>
      </div>
      {!collapsed && (
        <div className={`sidebar-resize-handle ${resizing ? 'resizing' : ''}`} onMouseDown={startResize} />
      )}
    </aside>
  );
}

// 1 nhóm System (hoặc nhóm "Chưa gán" khi system.id === null → không có nút rename/delete).
function SystemGroup({ system, projects, treeProps, onAddProject, onRenameSystem, onDeleteSystem }) {
  const [expanded, setExpanded] = useState(true);
  const isReal = system.id != null;
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
          textTransform: 'uppercase', opacity: isReal ? 0.95 : 0.6,
        }}
      >
        <button
          type="button"
          className="tree-toggle-icon"
          onClick={() => setExpanded(v => !v)}
          title={expanded ? 'Thu gọn' : 'Mở rộng'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={system.name}>
          {isReal ? '🗂 ' : ''}{system.name}
        </span>
        <button type="button" title="Tạo Project trong nhóm này" onClick={onAddProject}
          style={sysBtnStyle}>+P</button>
        {isReal && (
          <>
            <button type="button" title="Đổi tên hệ thống" onClick={onRenameSystem} style={sysBtnStyle}>✎</button>
            <button type="button" title="Xóa hệ thống" onClick={onDeleteSystem} style={{ ...sysBtnStyle, color: '#e74c3c' }}>×</button>
          </>
        )}
      </div>
      {expanded && (
        <div>
          {projects.map(p => (
            <TreeNode key={p.id} node={p} {...treeProps} />
          ))}
          {projects.length === 0 && (
            <div className="empty-state" style={{ padding: '4px 10px', fontSize: 11, opacity: 0.55 }}>
              Chưa có project. Bấm +P để tạo.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const sysBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer', color: 'inherit',
  fontSize: 11, fontWeight: 700, padding: '0 4px', opacity: 0.8,
};
