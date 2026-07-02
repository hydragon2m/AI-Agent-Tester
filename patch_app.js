const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Disable old project render
app = app.replace(/function renderProjectList\(\) \{[\s\S]*?\}\s*function selectProject/, 'function renderProjectList() { /* Disabled to prevent Tree View overwrite */ }\n\nfunction selectProject');

// Fix button (removing old handler and adding new one)
app = app.replace(/\$\('#btn-new-project'\)\.addEventListener\('click', \(\) => openProjectModal\(null\)\);/g, `$('#btn-new-project').addEventListener('click', () => {
  if (typeof openAddNodeModal === 'function') {
    openAddNodeModal(null, 'project');
  } else {
    openProjectModal(null);
  }
});`);

// Ensure fetchTree is called
if (!app.includes('document.addEventListener(\'DOMContentLoaded\', fetchTree);')) {
  app += '\n// Auto load tree\ndocument.addEventListener(\'DOMContentLoaded\', fetchTree);\n';
}

fs.writeFileSync('app.js', app, 'utf8');
console.log('App.js patched');
