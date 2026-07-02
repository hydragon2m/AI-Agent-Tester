const fs = require('fs');

const lines = fs.readFileSync('app.js', 'utf8').split('\n');

const files = {
    'state.js': { start: 0, end: 71 }, // State and Project State
    'api.js': { start: 72, end: 349 }, // DOM helpers and API calls
    'skills.js': { start: 350, end: 715 }, // Prompts, Data, Context
    'ui.js': { start: 716, end: 1234 }, // UI rendering, Modals, Markdown, Error
    'main.js': { start: 1235, end: 1725 }, // Generators, Copy, Init
    'tree.js': { start: 1726, end: lines.length - 1 } // Tree
};

for (const [filename, range] of Object.entries(files)) {
    const content = lines.slice(range.start, range.end + 1).join('\n');
    fs.writeFileSync(`js/${filename}`, content);
    console.log(`Wrote js/${filename} (${range.end - range.start + 1} lines)`);
}
