import { useState } from 'react';
import { getTemplate, templateShort } from '../../features/skills/strategy-templates';
import { DropdownMenu, DropdownMenuItem } from '../ui/DropdownMenu';
import { Plus, Edit2, FileSpreadsheet, Share2, Trash2, MoreHorizontal, ChevronDown, ChevronRight } from 'lucide-react';

const NODE_TYPES = ['project', 'module', 'screen', 'feature'];
const NEXT_TYPE = { project: 'module', module: 'screen', screen: 'feature', feature: 'feature' };

// Màu riêng cho từng template → phân biệt tag bằng màu (không cần dấu tick).
const TEMPLATE_COLORS = {
  new_feature: '#3b82f6',      // blue
  feature_addition: '#10b981', // green
  hotfix: '#f59e0b',           // amber
  new_version: '#a855f7',      // purple
  full_product: '#06b6d4',     // cyan
};

// Badge Test Plan cho node project — GỌN (mã ngắn, không dấu tick), phân biệt bằng MÀU
// theo template; chưa cấu hình → "Draft" xám. Nhãn đầy đủ ở tooltip.
function PlanBadge({ template, status }) {
  const configured = status === 'configured' || status === 'approved';
  const fullLabel = getTemplate(template)?.label || 'Test plan';
  const color = configured ? (TEMPLATE_COLORS[template] || '#6366f1') : '#94a3b8';
  return (
    <span
      title={configured ? `Test plan: ${fullLabel}` : 'Chưa cấu hình kế hoạch test'}
      style={{
        marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6,
        border: `1px solid ${color}`, color, background: `${color}1a`, whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {configured ? templateShort(template) : 'Draft'}
    </span>
  );
}

export function TreeNode({ node, nodes, activeNodeId, onSelect, onAdd, onRename, onDelete, onExportFile, onExportLark, level = 0 }) {
  const [expanded, setExpanded] = useState(true);
  const children = nodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  const isActive = activeNodeId === node.id;
  const nextType = NEXT_TYPE[node.type] || 'feature';
  const canAdd = NODE_TYPES.indexOf(node.type) < NODE_TYPES.length - 1;

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
          {hasChildren ? (expanded ? '▼' : '▶') : ''}
        </button>
        <button className="tree-node-main" onClick={() => onSelect(node.id)}>
          <span className={`tree-node-icon icon-${node.type}`}>{node.type?.[0]?.toUpperCase() || '-'}</span>
          <span className="tree-node-name" title={node.name}>
            {node.name}{node.type === 'module' && node.abbreviation ? ` (${node.abbreviation})` : ''}
          </span>
          {node.type === 'project' && <PlanBadge template={node.planTemplate} status={node.planStatus} />}
        </button>

        <div className="tree-node-menu">
          <DropdownMenu 
            align="right"
            trigger={
              <button
                type="button"
                className="tree-more-btn flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                title="Chức năng"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            }
          >
            {canAdd && (
              <DropdownMenuItem onClick={() => onAdd(node.id, nextType)}>
                <Plus className="w-4 h-4 mr-2 text-indigo-400" />
                Thêm {nextType}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRename(node)}>
              <Edit2 className="w-4 h-4 mr-2 text-amber-400" />
              Đổi tên
            </DropdownMenuItem>
            {onExportFile && (
              <DropdownMenuItem onClick={() => onExportFile({ id: node.id, name: node.name, type: node.type })}>
                <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
                Export Excel/CSV
              </DropdownMenuItem>
            )}
            {onExportLark && (
              <DropdownMenuItem onClick={() => onExportLark({ id: node.id, name: node.name, type: node.type })}>
                <Share2 className="w-4 h-4 mr-2 text-cyan-400" />
                Export to Lark
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onDelete(node)} destructive>
              <Trash2 className="w-4 h-4 mr-2" />
              Xóa
            </DropdownMenuItem>
          </DropdownMenu>
        </div>
      </div>
      {hasChildren && expanded && (
        <div className="tree-children">
          {children.map(child => (
            <TreeNode key={child.id} node={child} nodes={nodes} activeNodeId={activeNodeId} onSelect={onSelect} onAdd={onAdd} onRename={onRename} onDelete={onDelete} onExportFile={onExportFile} onExportLark={onExportLark} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
