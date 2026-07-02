const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Fix broken characters
html = html.replace(/title="Copy Prompt chu\?n.*?ChatGPT"/g, 'title="Copy Prompt for manual use"');
html = html.replace(/title="C\?p nh\?t.*?d\?u"/g, 'title="Update test case based on new rules"');
html = html.replace(/\?\? Tip: Type/g, '💡 Tip: Type');
html = html.replace(/\?\? Copy Manual/g, '📋 Copy Manual');

fs.writeFileSync('index.html', html, 'utf8');
console.log('Fixed buttons');
