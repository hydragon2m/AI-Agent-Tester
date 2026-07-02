const fs = require('fs');

// 1. Update index.html
let html = fs.readFileSync('index.html', 'utf8');
const oldModalBody = `<div class="modal-body">
        <div class="pf-field">
          <label class="pf-label">Tên <span class="required">*</span></label>
          <input type="text" id="tree-node-name" class="pf-input" />
          <input type="hidden" id="tree-node-parent-id" />
          <input type="hidden" id="tree-node-type" />
        </div>
        <div class="modal-actions" style="margin-top: 20px;">`;

const newModalBody = `<div class="modal-body">
        <div class="pf-field">
          <label class="pf-label" style="display:block; margin-bottom:6px;">Tên <span class="required">*</span></label>
          <input type="text" id="tree-node-name" class="pf-input" />
          <input type="hidden" id="tree-node-parent-id" />
          <input type="hidden" id="tree-node-type" />
        </div>
        <div class="pf-field" style="margin-top: 12px;">
          <label class="pf-label" style="display:block; margin-bottom:6px;">Mô tả ngắn, ngữ cảnh (Optional)</label>
          <textarea id="tree-node-context" class="pf-input" rows="2" placeholder="VD: Dự án ecom, y tế... (sẽ dùng để tăng độ hiểu của AI)"></textarea>
        </div>
        <div class="modal-actions" style="margin-top: 20px;">`;

html = html.replace(oldModalBody, newModalBody);
fs.writeFileSync('index.html', html, 'utf8');

// 2. Update app.js
let app = fs.readFileSync('app.js', 'utf8');
app = app.replace(
  `function openAddNodeModal(parentId, type) {
  document.getElementById('tree-node-parent-id').value = parentId || '';
  document.getElementById('tree-node-type').value = type;
  document.getElementById('tree-node-name').value = '';
  document.getElementById('modal-tree-node').style.display = 'flex';
  setTimeout(() => document.getElementById('tree-node-name').focus(), 100);
}`,
  `function openAddNodeModal(parentId, type) {
  document.getElementById('tree-node-parent-id').value = parentId || '';
  document.getElementById('tree-node-type').value = type;
  document.getElementById('tree-node-name').value = '';
  const contextEl = document.getElementById('tree-node-context');
  if (contextEl) contextEl.value = '';
  
  // Update Title dynamically
  const typeMap = { project: 'Project', module: 'Module', screen: 'Screen', feature: 'Feature' };
  const typeName = typeMap[type] || 'Node';
  document.getElementById('tree-node-title').textContent = 'Tạo mới ' + typeName;
  
  document.getElementById('modal-tree-node').style.display = 'flex';
  setTimeout(() => document.getElementById('tree-node-name').focus(), 100);
}`
);

app = app.replace(
  `body: JSON.stringify({ name, parentId: parentId || null, type })`,
  `body: JSON.stringify({ name, parentId: parentId || null, type, context: document.getElementById('tree-node-context')?.value || '' })`
);
fs.writeFileSync('app.js', app, 'utf8');

// 3. Update server_db.js
let server = fs.readFileSync('server_db.js', 'utf8');
server = server.replace(
  `const { parentId, name, type } = req.body;
    const newNode = {
        id: 'node_' + Date.now().toString(),
        parentId: parentId || null,
        name,
        type // 'project', 'module', 'screen', 'feature'
    };`,
  `const { parentId, name, type, context } = req.body;
    const newNode = {
        id: 'node_' + Date.now().toString(),
        parentId: parentId || null,
        name,
        type, // 'project', 'module', 'screen', 'feature'
        context: context || ''
    };`
);
fs.writeFileSync('server_db.js', server, 'utf8');

console.log('UI updated successfully');
