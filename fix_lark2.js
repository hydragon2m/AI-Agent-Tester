const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

const regex = /const headers = \[[\s\S]*?tc\.testData \|\| '',\s*'', '', ''\s*\];\s*return `<tr>\$\{cells\.map\(\(c, i\) => `<td.*?<\/td>`\)\.join\(''\)}<\/tr>`;\s*}\)\.join\(''\);/;

const newBlock = `const headers = [
    'TC ID','Module','Screen','Feature','Test Case Name','Type','Priority',
    'Preconditions','Steps','Expected Result','Test Data',
    'Status','Actual Result','Related Bug'
  ];

  const headerHtml = headers.map(h => \`<th style="background:#1e293b;color:#a5b4fc;padding:8px 12px;border:1px solid #334155;font-weight:600;white-space:nowrap;">\${h}</th>\`).join('');

  const getAbbr = (str) => {
    if (!str) return 'TC';
    const clean = str.replace(/[^\\w\\sđĐ]/gi, '').trim();
    const parts = clean.split(/\\s+/);
    if (parts.length === 1) return clean.substring(0, 3).toUpperCase();
    return parts.map(p => p[0]).join('').substring(0, 4).toUpperCase();
  };

  const rowsHtml = (data.testCases || []).map((tc, idx) => {
    const stepsHtml = (tc.steps || []).map((s, i) => \`\${i + 1}. \${esc(s)}\`).join('<br>');
    const finalModule = currentModule || tc.module || '';
    const abbr = getAbbr(finalModule);
    const generatedId = \`\${abbr}-\${String(idx + 1).padStart(4, '0')}\`;

    const cells = [
      generatedId,
      finalModule,
      currentScreen || '',
      currentFeature || '',
      tc.name || '',
      tc.type || '',
      tc.priority || '',
      tc.preconditions || '',
      stepsHtml,
      tc.expectedResult || '',
      tc.testData || '',
      '', '', ''
    ];
    return \`<tr>\${cells.map((c, i) => \`<td style="padding:8px 12px;border:1px solid #334155;vertical-align:top;">\${i === 8 ? c : esc(c)}</td>\`).join('')}</tr>\`;
  }).join('');`;

app = app.replace(regex, newBlock);
fs.writeFileSync('app.js', app, 'utf8');
console.log('Lark export updated');
