const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// Replace the broken renderProjectList block with a proper disabled one
app = app.replace(/\/\* ── Render Project Sidebar List ────────────────────────── \*\/[\s\S]*?\/\* ── Select Project ─────────────────────────────────────── \*\//, `/* ── Render Project Sidebar List ────────────────────────── */
function renderProjectList() {
  /* Disabled to prevent Tree View overwrite */
}

/* ── Select Project ─────────────────────────────────────── */`);

fs.writeFileSync('app.js', app, 'utf8');
console.log('Fixed syntax error');
