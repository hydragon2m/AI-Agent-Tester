const fs = require('fs');
let uiJS = fs.readFileSync('js/ui.js', 'utf8');

// Use regex to replace the entire renderProjectList function block
uiJS = uiJS.replace(/function renderProjectList\(\) \{[\s\S]*?\}\s*function selectProject/, 'function renderProjectList() { /* Disabled to prevent Tree View overwrite */ }\n\nfunction selectProject');

fs.writeFileSync('js/ui.js', uiJS, 'utf8');
console.log('Disabled renderProjectList in js/ui.js');
