const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const oldContextFunc = `function buildProjectContext(project) {
  if (!project) return '';
  const parts = [];
  if (project.stack)     parts.push(\`Tech stack: \${project.stack}\`);
  if (project.framework) parts.push(\`Test framework: \${project.framework}\`);
  if (project.url)       parts.push(\`Staging URL: \${project.url}\`);
  if (project.api)       parts.push(\`API base: \${project.api}\`);
  if (project.admin)     parts.push(\`Admin account: \${project.admin}\`);
  if (project.user)      parts.push(\`User account: \${project.user}\`);
  if (project.modules)   parts.push(\`Modules: \${project.modules}\`);
  if (project.prefix)    parts.push(\`Bug/TC ID prefix: \${project.prefix}\`);
  if (project.notes)     parts.push(\`Lưu ý đặc biệt: \${project.notes}\`);

  if (parts.length === 0) return '';
  return \`\\n=== PROJECT CONTEXT — \${project.name} ===\\n\${parts.join('\\n')}\\n=== END CONTEXT ===\\nMọi output PHẢI sử dụng thông tin project ở trên (URL, account, prefix, tech stack...).\\nKhông dùng placeholder giả chung chung.\\n\\n\`;
}`;

const newContextFunc = `function buildProjectContext() {
  if (typeof treeData === 'undefined' || typeof activeNodeId === 'undefined' || !activeNodeId) return '';
  
  let curr = treeData.find(n => n.id === activeNodeId);
  const path = [];
  const contexts = [];
  
  while (curr) {
    path.unshift(curr.name);
    if (curr.context && curr.context.trim()) {
      contexts.unshift(\`[\${curr.type.toUpperCase()}: \${curr.name}] \${curr.context.trim()}\`);
    }
    curr = treeData.find(n => n.id === curr.parentId);
  }
  
  if (contexts.length === 0 && path.length === 0) return '';
  
  let ctxStr = '\\n=== PROJECT & MODULE CONTEXT ===\\n';
  ctxStr += \`Path: \${path.join(' > ')}\\n\`;
  if (contexts.length > 0) {
    ctxStr += '\\nContext details:\\n' + contexts.join('\\n') + '\\n';
  }
  ctxStr += '=== END CONTEXT ===\\nMọi output PHẢI cân nhắc thông tin context ở trên.\\n\\n';
  return ctxStr;
}`;

app = app.replace(oldContextFunc, newContextFunc);

// Update all calls to buildProjectContext
app = app.replace(/buildProjectContext\(PROJECT_STATE\.active\)/g, 'buildProjectContext()');

fs.writeFileSync('app.js', app, 'utf8');
console.log('Context builder updated');
