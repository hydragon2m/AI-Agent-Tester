import { useEffect, useMemo, useState } from 'react';
import { createNodeApi, deleteNodeApi, fetchNodes, updateNodeApi } from '../backend-api/nodes.api';

export function buildNodePath(nodes, activeNodeId) {
  if (!Array.isArray(nodes)) return [];
  const path = [];
  let curr = nodes.find(n => n.id === activeNodeId);
  while (curr) {
    path.unshift(curr);
    curr = nodes.find(n => n.id === curr.parentId);
  }
  return path;
}

export function buildContext(path) {
  if (!path.length) return 'PROJECT CONTEXT:\nNo selected project node.';
  const lines = [`Selected tree path: ${path.map(n => `${n.type}:${n.name}`).join(' > ')}`];
  for (const node of path) {
    if (node.context) lines.push(`${node.type} context (${node.name}): ${node.context}`);
  }
  return `PROJECT CONTEXT:\n${lines.join('\n')}`;
}

export function useProjectTree(onToast) {
  const [nodes, setNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const activePath = useMemo(() => buildNodePath(nodes, activeNodeId), [nodes, activeNodeId]);
  const activeNode = activePath[activePath.length - 1] || null;

  async function refreshTree() {
    const data = await fetchNodes();
    if (Array.isArray(data)) {
      setNodes(data);
      setActiveNodeId(current => current || data[0]?.id || null);
    } else {
      throw new Error('Dữ liệu cây thư mục không hợp lệ');
    }
  }

  useEffect(() => {
    refreshTree().catch(e => onToast?.(`Lỗi tải tree: ${e.message}`));
  }, []);

  async function createNode(parentId, type) {
    const name = window.prompt(`Tên ${type}:`);
    if (!name?.trim()) return;
    const context = window.prompt('Context/description:', '') || '';
    let abbreviation = '';
    if (type === 'module') {
      abbreviation = (window.prompt('Viết tắt module (dùng để đánh số TC ID, ví dụ INV):', '') || '').trim().toUpperCase();
    }
    await createNodeApi({ parentId, type, name: name.trim(), context, abbreviation });
    await refreshTree();
    onToast?.('Đã tạo node');
  }

  async function importNodes(importedNodes) {
    if (!Array.isArray(importedNodes)) throw new Error('Invalid tree format');
    const byDepth = [...importedNodes].sort((a, b) => getDepth(a, importedNodes) - getDepth(b, importedNodes));
    const idMap = new Map();
    for (const node of byDepth) {
      const parentId = node.parentId ? idMap.get(node.parentId) : null;
      if (node.parentId && !parentId) continue;
      const created = await createNodeApi({
        parentId,
        type: node.type,
        name: node.name,
        context: node.context || '',
      });
      idMap.set(node.id, created.id);
    }
    await refreshTree();
    onToast?.(`Đã import ${idMap.size} node`);
  }

  async function renameNode(node) {
    const name = window.prompt('Tên mới:', node.name);
    if (!name?.trim()) return;
    const context = window.prompt('Context:', node.context || '') ?? node.context;
    let abbreviation = node.abbreviation;
    if (node.type === 'module') {
      abbreviation = (window.prompt('Viết tắt module (dùng để đánh số TC ID, ví dụ INV):', node.abbreviation || '') ?? node.abbreviation ?? '').trim().toUpperCase();
    }
    await updateNodeApi(node.id, { name: name.trim(), context, abbreviation });
    await refreshTree();
    onToast?.('Đã cập nhật node');
  }

  async function deleteNode(node) {
    if (!window.confirm(`Xóa "${node.name}" và toàn bộ node con?`)) return false;
    await deleteNodeApi(node.id);
    if (activeNodeId === node.id) setActiveNodeId(null);
    await refreshTree();
    onToast?.('Đã xóa node');
    return true;
  }

  return {
    nodes,
    activeNodeId,
    setActiveNodeId,
    activePath,
    activeNode,
    createNode,
    renameNode,
    deleteNode,
    importNodes,
  };
}

function getDepth(node, nodes) {
  if (!Array.isArray(nodes)) return 0;
  let depth = 0;
  let current = node;
  while (current?.parentId) {
    depth += 1;
    current = nodes.find(n => n.id === current.parentId);
  }
  return depth;
}
