const fs = require('fs');

const appContent = fs.readFileSync('app.js', 'utf8');

// We will split based on section headers
const sections = appContent.split(/\/\* ── (.+?) ─────────────────────────────────────── \*\//g);

const files = {
    'config.js': [],
    'ui.js': [],
    'api.js': [],
    'skills.js': [],
    'main.js': [],
    'tree.js': []
};

let currentFile = 'main.js';

if (sections[0].trim()) {
    files['main.js'].push(sections[0]);
}

for (let i = 1; i < sections.length; i += 2) {
    const header = sections[i].trim();
    const content = sections[i+1];
    
    let file = 'main.js';
    if (header.includes('STATE & CONSTANTS')) file = 'config.js';
    else if (header.includes('DOM Elements') || header.includes('UI Toggles') || header.includes('Toast') || header.includes('Modals') || header.includes('Markdown / Format')) file = 'ui.js';
    else if (header.includes('API Calls & LLM') || header.includes('Stream Reading')) file = 'api.js';
    else if (header.includes('SKILLS DEFINITION') || header.includes('Project Context')) file = 'skills.js';
    else if (header.includes('Tree Management')) file = 'tree.js';
    else file = 'main.js';
    
    files[file].push(`/* ── ${header} ─────────────────────────────────────── */\n` + content);
}

for (const [filename, parts] of Object.entries(files)) {
    if (parts.length > 0) {
        fs.writeFileSync(`js/${filename}`, parts.join('\n'));
        console.log(`Created js/${filename} with ${parts.length} sections`);
    }
}
