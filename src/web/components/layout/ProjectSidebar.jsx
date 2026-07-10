import { useState, useEffect, useCallback } from 'react';
import { TreeNode } from '../tree/TreeNode';
import { useResizableWidth } from '../../state/useResizableWidth';
import { fetchSystems, createSystemApi, updateSystemApi, deleteSystemApi } from '../../backend-api/systems.api';
import { DropdownMenu, DropdownMenuItem } from '../ui/DropdownMenu';
import { Button } from '../ui/Button';
import { SystemFormModal } from './SystemFormModal';
import {
  Plus, MoreVertical, FileSpreadsheet, Share2, Edit2, Trash2,
  FolderPlus, FolderOpen, Folder, ChevronLeft, ChevronRight, Settings,
} from 'lucide-react';
import hydraLogo from '../../hydra-logo.png';

export function ProjectSidebar({
  nodes, activeNodeId, onSelect, onAdd, onRename, onDelete,
  onExport, onImport, onCreateProject, onExportFile, onExportLark,
  onOpenSettings,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { width, resizing, startResize } = useResizableWidth({ storageKey: 'sidebar-width-project', defaultWidth: 220, min: 180, max: 460 });
  const [systems, setSystems] = useState([]);

  // Modal state: null | { mode: 'create' } | { mode: 'edit', system: {...} }
  const [modal, setModal] = useState(null);

  const reloadSystems = useCallback(() => {
    fetchSystems().then(setSystems).catch(() => {});
  }, []);
  useEffect(() => { reloadSystems(); }, [reloadSystems]);

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

  async function handleCreateSystem(payload) {
    await createSystemApi(payload);
    reloadSystems();
  }

  async function handleRenameSystem(sys, payload) {
    await updateSystemApi(sys.id, payload);
    reloadSystems();
  }

  async function handleDeleteSystem(sys) {
    if (!window.confirm(`Xóa hệ thống "${sys.name}"?\nCác project bên trong KHÔNG bị xóa — sẽ chuyển về nhóm "Chưa gán".`)) return;
    try { await deleteSystemApi(sys.id); reloadSystems(); }
    catch (e) { console.error('Xóa system thất bại:', e.message); }
  }

  function addProject(systemId, systemName) {
    if (onCreateProject) onCreateProject(systemId || null, systemName || null);
    else onAdd(null, 'project', systemId || null);
  }

  const treeProps = { nodes, activeNodeId, onSelect, onAdd, onRename, onDelete, onExportFile, onExportLark };

  return (
    <>
      <aside
        className={`project-sidebar ${collapsed ? 'collapsed' : ''} ${resizing ? 'resizing' : ''}`}
        style={collapsed ? undefined : { width }}
      >
        {/* Header — đồng bộ chiều cao 52px với workspace skills header */}
        <div className="project-sidebar-header flex items-center justify-between h-[52px] px-3 border-b border-zinc-800">
          {!collapsed && (
            <button
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
              onClick={() => setModal({ mode: 'create' })}
              title="Tạo hệ thống mới"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <div className={`flex items-center gap-1.5 ${collapsed ? 'mx-auto' : 'ml-auto'}`}>
            <button
              className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-white/5 text-zinc-500 hover:text-white transition-colors"
              onClick={() => setCollapsed(v => !v)}
              title={collapsed ? 'Mở rộng' : 'Thu gọn'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* System tree */}
        <div className="project-list flex-1 overflow-y-auto">
          {systems.map(sys => (
            <SystemGroup
              key={sys.id}
              system={sys}
              projects={projectsBySystem[sys.id] || []}
              treeProps={treeProps}
              onAddProject={() => addProject(sys.id, sys.name)}
              onEditSystem={() => setModal({ mode: 'edit', system: sys })}
              onDeleteSystem={() => handleDeleteSystem(sys)}
              onExportSystemFile={onExportFile ? () => onExportFile({ id: sys.id, name: sys.name, type: 'system' }) : undefined}
              onExportSystemLark={onExportLark ? () => onExportLark({ id: sys.id, name: sys.name, type: 'system' }) : undefined}
            />
          ))}

          {(ungrouped.length > 0 || systems.length === 0) && (
            <SystemGroup
              system={{ id: null, name: systems.length === 0 ? 'Projects' : 'Chưa gán' }}
              projects={ungrouped}
              treeProps={treeProps}
              onAddProject={() => addProject(null)}
            />
          )}

          {systems.length === 0 && projectNodes.length === 0 && (
            <button
              type="button"
              onClick={() => setModal({ mode: 'create' })}
              className="w-full text-[11px] text-zinc-600 hover:text-zinc-300 px-4 py-3 italic text-center transition-colors"
            >
              Bấm để tạo hệ thống đầu tiên...
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="project-sidebar-footer flex flex-col gap-2 p-3 border-t border-zinc-800 bg-zinc-950/40">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-[11px] h-7 border-zinc-800 hover:bg-zinc-800 hover:text-white" onClick={onExport}>
                  Export
                </Button>
                <label className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-[11px] h-7 border-zinc-800 hover:bg-zinc-800 hover:text-white cursor-pointer" asChild>
                    <span className="flex items-center justify-center">Import</span>
                  </Button>
                  <input type="file" accept=".json" className="hidden" onChange={onImport} />
                </label>
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-900">
                <div className="flex items-center gap-2 px-1">
                  <img src={hydraLogo} alt="Hydra Logo" className="h-6 w-auto block opacity-80" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] font-bold text-slate-200 truncate">AI QA Assistant</span>
                    <span className="text-[9px] text-slate-400 font-mono">Hanhdth</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] border-zinc-800 hover:bg-zinc-800 hover:text-white w-full"
                    onClick={onOpenSettings}
                  >
                    <Settings className="w-3.5 h-3.5 mr-1.5 text-zinc-400 inline-block" />
                    <span>Cấu hình AI</span>
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-1">
              <img src={hydraLogo} alt="Hydra Logo" className="h-6 w-auto block opacity-80" />
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                onClick={onOpenSettings}
                title="Cấu hình nhà cung cấp AI"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
              </Button>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className={`sidebar-resize-handle ${resizing ? 'resizing' : ''}`} onMouseDown={startResize} />
        )}
      </aside>

      {/* System Form Modal */}
      {modal?.mode === 'create' && (
        <SystemFormModal
          mode="create"
          onConfirm={handleCreateSystem}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === 'edit' && (
        <SystemFormModal
          mode="edit"
          initialData={{ name: modal.system.name, description: modal.system.description || '' }}
          onConfirm={(payload) => handleRenameSystem(modal.system, payload)}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ─── SystemGroup ────────────────────────────────────────────────────────────
function SystemGroup({ system, projects, treeProps, onAddProject, onEditSystem, onDeleteSystem, onExportSystemFile, onExportSystemLark }) {
  const [expanded, setExpanded] = useState(true);
  const isReal = system.id != null;

  return (
    <div style={{ marginBottom: 2 }}>
      <div className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 group cursor-default">
        <button
          type="button"
          className="flex items-center justify-center w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors"
          onClick={() => setExpanded(v => !v)}
        >
          <span className="text-[9px]">{expanded ? '▼' : '▶'}</span>
        </button>

        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden" onClick={() => setExpanded(v => !v)}>
          {isReal
            ? <FolderOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          }
          <span className="text-[11px] font-semibold text-slate-300 truncate tracking-wide" title={system.name}>
            {system.name}
          </span>
        </div>

        <DropdownMenu
          align="right"
          trigger={
            <button
              type="button"
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
              title="Thao tác"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          }
        >
          <DropdownMenuItem onClick={onAddProject}>
            <FolderPlus className="w-4 h-4 mr-2 text-indigo-400" />
            Tạo Project
          </DropdownMenuItem>
          {isReal && onExportSystemFile && (
            <DropdownMenuItem onClick={onExportSystemFile}>
              <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
              Export Excel/CSV
            </DropdownMenuItem>
          )}
          {isReal && onExportSystemLark && (
            <DropdownMenuItem onClick={onExportSystemLark}>
              <Share2 className="w-4 h-4 mr-2 text-cyan-400" />
              Export Lark Base
            </DropdownMenuItem>
          )}
          {isReal && (
            <>
              <DropdownMenuItem onClick={onEditSystem}>
                <Edit2 className="w-4 h-4 mr-2 text-amber-400" />
                Chỉnh sửa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDeleteSystem} destructive>
                <Trash2 className="w-4 h-4 mr-2" />
                Xóa hệ thống
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenu>
      </div>

      {expanded && (
        <div className="tree-children">
          {projects.map(p => (
            <TreeNode key={p.id} node={p} {...treeProps} level={1} />
          ))}
          {projects.length === 0 && (
            <div
              className="text-[10px] text-zinc-600 italic pl-8 py-1 cursor-pointer hover:text-zinc-400 transition-colors"
              onClick={onAddProject}
            >
              + Tạo project
            </div>
          )}
        </div>
      )}
    </div>
  );
}
