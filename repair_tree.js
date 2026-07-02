const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const regex = /\/\* ── Tree Management ─────────────────────────────────────── \*\/[\s\S]*?const toggleIcon = div\.querySelector\('\.tree-toggle-icon'\);/;

const repairedTree = `/* ── Tree Management ─────────────────────────────────────── */
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
  div.className = \`tree-node level-\${level}\`;
  
  const children = treeData.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  
  const typeTextIcons = { project: 'P', module: 'M', screen: 'S', feature: 'F' };
  const isActive = activeNodeId === node.id;
  
  div.innerHTML = \`
    <div class="tree-node-content \${isActive ? 'active' : ''}" style="padding-left: \${10 + level * 16}px;">
      <div class="tree-node-left">
        <span class="tree-toggle-icon">
          \${hasChildren ? '▼' : ' '}
        </span>
        <span class="tree-node-icon icon-\${node.type}">
          \${typeTextIcons[node.type] || '-'}
        </span>
        <span class="tree-node-name" title="\${node.name}">\${node.name}</span>
      </div>
      <div class="tree-node-actions">
        <button class="tree-more-btn" title="Actions">⋮</button>
      </div>
    </div>
  \`;
  
  const contentDiv = div.querySelector('.tree-node-content');
  const moreBtn = div.querySelector('.tree-more-btn');
  const toggleIcon = div.querySelector('.tree-toggle-icon');`;

app = app.replace(regex, repairedTree);
fs.writeFileSync('app.js', app, 'utf8');
console.log('Tree management repaired');
