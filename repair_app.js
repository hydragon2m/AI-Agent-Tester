const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// 1. Repair Tree Management block
const damagedBlock = `/* ── Tree Management ─────────────────────────────────────── */
  div.className = \`tree-node level-\${level}\`;`;

const repairedBlock = `/* ── Tree Management ─────────────────────────────────────── */
let treeData = [];
let activeNodeId = null;

async function fetchTree() {
  try {
    const res = await fetch('http://localhost:3001/tree');
    treeData = await res.json();
    renderTree();
  } catch (e) {
    console.error('Error fetching tree:', e);
  }
}

function renderTree() {
  const container = document.getElementById('project-list');
  if (!container) return;
  container.innerHTML = '';
  
  const roots = treeData.filter(n => !n.parentId);
  roots.forEach(root => {
    container.appendChild(createTreeNodeElement(root, 0));
  });
}

function createTreeNodeElement(node, level) {
  const div = document.createElement('div');
  div.className = \`tree-node level-\${level}\`;`;

if (app.includes(damagedBlock)) {
  app = app.replace(damagedBlock, repairedBlock);
  console.log('Repaired tree management block');
} else {
  console.log('Could not find damaged block, it might not be exactly as expected.');
}

// 2. Safely fix openAddNodeModal
const oldModalFunc = `function openAddNodeModal(parentId, type) {
  document.getElementById('tree-node-parent-id').value = parentId || '';
  document.getElementById('tree-node-type').value = type;
  document.getElementById('tree-node-name').value = '';
  document.getElementById('modal-tree-node').style.display = 'flex';
  setTimeout(() => document.getElementById('tree-node-name').focus(), 100);
}`;

const newModalFunc = `function openAddNodeModal(parentId, type) {
  document.getElementById('tree-node-parent-id').value = parentId || '';
  document.getElementById('tree-node-type').value = type;
  document.getElementById('tree-node-name').value = '';
  
  const contextEl = document.getElementById('tree-node-context');
  if (contextEl) contextEl.value = '';
  
  const typeMap = { project: 'Project', module: 'Module', screen: 'Screen', feature: 'Feature' };
  const typeName = typeMap[type] || 'Node';
  document.getElementById('tree-node-title').textContent = 'Create New ' + typeName;

  document.getElementById('modal-tree-node').style.display = 'flex';
  setTimeout(() => document.getElementById('tree-node-name').focus(), 100);
}`;

app = app.replace(oldModalFunc, newModalFunc);

fs.writeFileSync('app.js', app, 'utf8');
console.log('App.js patched successfully');
