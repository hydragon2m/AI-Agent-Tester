const DEFAULT_LARK_MAPPING = {
  priority: { high: '', medium: '', low: '' },
  type: { positive: '', negative: '', edge: '', ui: '', security: '', performance: '' },
};

function mapPriority(priority, mapping = DEFAULT_LARK_MAPPING) {
  if (!priority) return '';
  const p = String(priority).toLowerCase().trim();
  if (p === 'high' && mapping.priority?.high) return mapping.priority.high;
  if ((p === 'medium' || p === 'med') && mapping.priority?.medium) return mapping.priority.medium;
  if (p === 'low' && mapping.priority?.low) return mapping.priority.low;
  return priority;
}

function mapType(type, mapping = DEFAULT_LARK_MAPPING) {
  if (!type) return '';
  const t = String(type).toLowerCase().trim();
  if (t === 'positive' && mapping.type?.positive) return mapping.type.positive;
  if (t === 'negative' && mapping.type?.negative) return mapping.type.negative;
  if ((t === 'edge case' || t === 'edge') && mapping.type?.edge) return mapping.type.edge;
  if (t === 'ui/ux' && mapping.type?.ui) return mapping.type.ui;
  if (t === 'security' && mapping.type?.security) return mapping.type.security;
  if (t === 'performance' && mapping.type?.performance) return mapping.type.performance;
  return type;
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function getAbbr(value) {
  if (!value) return 'TC';
  const clean = value.replace(/[^\w\sđĐ]/gi, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return clean.substring(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').substring(0, 4).toUpperCase();
}

export function toCsv(testCases, nodePath = {}, larkMapping = DEFAULT_LARK_MAPPING) {
  const header = 'TC ID,Module,Screen,Feature,Test Case Name,Type,Priority,Suite,Automation,Trace To,Preconditions,Steps,Expected Result,Test Data,Status,Actual Result,Related Bug\n';
  const rows = testCases.map(tc => [
    tc.id || '',
    nodePath.module || tc.module || '',
    nodePath.screen || '',
    nodePath.feature || '',
    tc.name || '',
    mapType(tc.type || '', larkMapping),
    mapPriority(tc.priority || '', larkMapping),
    tc.suite || '',
    tc.automationCandidate || '',
    tc.traceTo || '',
    tc.preconditions || '',
    (tc.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
    tc.expectedResult || '',
    tc.testData || '',
    tc.status || '',
    tc.actualResult || '',
    tc.relatedBug || '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  return `\uFEFF${header}${rows}`;
}

// Columns shared with toCsv (kept in the same order). Scope export prepends an
// optional "Project Name" column so a System-wide CSV can be filtered in Excel.
const SCOPE_COLS = [
  'TC ID', 'Module', 'Screen', 'Feature', 'Test Case Name', 'Type', 'Priority', 'Suite',
  'Automation', 'Trace To', 'Preconditions', 'Steps', 'Expected Result', 'Test Data',
  'Status', 'Actual Result', 'Related Bug',
];

function csvCell(v) {
  return `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
}

function scopeRowValues(tc) {
  const p = tc.nodePath || {};
  return [
    tc.id || '',
    p.module || tc.module || '',
    p.screen || '',
    p.feature || '',
    tc.name || '',
    mapType(tc.type || ''),
    mapPriority(tc.priority || ''),
    tc.suite || '',
    tc.automationCandidate || '',
    tc.traceTo || '',
    tc.preconditions || '',
    (tc.steps || []).map((s, idx) => `${idx + 1}. ${s}`).join('\n'),
    tc.expectedResult || '',
    tc.testData || '',
    tc.status || '',
    tc.actualResult || '',
    tc.relatedBug || '',
  ];
}

// Builds ONE CSV for a scope export. `groups` = [{ projectName, testCases[] }].
// includeProjectName=true (System scope) prepends the Project Name column so
// every project's rows land in a single file, filterable by project.
export function scopeToCsv(groups, { includeProjectName = false } = {}) {
  const cols = includeProjectName ? ['Project Name', ...SCOPE_COLS] : SCOPE_COLS;
  const header = cols.join(',') + '\n';
  const lines = [];
  for (const g of groups || []) {
    for (const tc of (g.testCases || [])) {
      const values = scopeRowValues(tc);
      const row = includeProjectName ? [g.projectName || '', ...values] : values;
      lines.push(row.map(csvCell).join(','));
    }
  }
  return `﻿${header}${lines.join('\n')}`;
}

// Markdown counterpart for a scope export. Sections per project when the scope
// spans several (System); otherwise a single flat list.
export function scopeToMarkdown(groups, { scopeName = 'Test Cases', includeProjectName = false } = {}) {
  let md = `# ${scopeName}\n\n`;
  const total = (groups || []).reduce((n, g) => n + (g.testCases?.length || 0), 0);
  md += `_${total} test case${includeProjectName ? ` · ${(groups || []).length} project` : ''}_\n\n---\n\n`;
  for (const g of groups || []) {
    if (includeProjectName) md += `# ${g.projectName || 'Project'}\n\n`;
    (g.testCases || []).forEach(tc => {
      const p = tc.nodePath || {};
      md += `## ${tc.id || ''}: ${tc.name || ''}\n\n`;
      md += `**Type:** ${tc.type || ''} | **Priority:** ${tc.priority || ''} | **Status:** ${tc.status || ''}\n\n`;
      const loc = [p.module || tc.module, p.screen, p.feature].filter(Boolean).join(' › ');
      if (loc) md += `**Vị trí:** ${loc}\n\n`;
      if (tc.preconditions) md += `**Preconditions:** ${tc.preconditions}\n\n`;
      md += `**Steps:**\n${(tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
      md += `**Expected Result:** ${tc.expectedResult || ''}\n\n`;
      if (tc.testData) md += `**Test Data:** ${tc.testData}\n\n`;
      md += `---\n\n`;
    });
  }
  return md;
}

export function toMarkdown(data) {
  let md = `# Test Cases\n\n_${data?.summary || ''}_\n\n---\n\n`;
  (data?.testCases || []).forEach(tc => {
    md += `## ${tc.id || ''}: ${tc.name || ''}\n\n`;
    md += `**Type:** ${tc.type || ''} | **Priority:** ${tc.priority || ''}\n\n`;
    if (tc.module) md += `**Module:** ${tc.module}\n\n`;
    if (tc.preconditions) md += `**Preconditions:** ${tc.preconditions}\n\n`;
    md += `**Steps:**\n${(tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
    md += `**Expected Result:** ${tc.expectedResult || ''}\n\n`;
    if (tc.testData) md += `**Test Data:** ${tc.testData}\n\n`;
    md += `---\n\n`;
  });
  return md;
}

export function toLarkClipboardPayload(data, path = [], larkMapping = DEFAULT_LARK_MAPPING) {
  let currentModule = '';
  let currentScreen = '';
  let currentFeature = '';
  for (const node of path) {
    if (node.type === 'module') currentModule = node.name;
    if (node.type === 'screen') currentScreen = node.name;
    if (node.type === 'feature') currentFeature = node.name;
  }

  const headers = [
    'TC ID', 'Module', 'Screen', 'Feature', 'Test Case Name', 'Type', 'Priority',
    'Preconditions', 'Steps', 'Expected Result', 'Test Data', 'Status', 'Actual Result', 'Related Bug',
  ];

  const headerHtml = headers
    .map(h => `<th style="background:#1e293b;color:#a5b4fc;padding:8px 12px;border:1px solid #334155;font-weight:600;white-space:nowrap;">${h}</th>`)
    .join('');

  const rowsHtml = (data?.testCases || []).map((tc, idx) => {
    const finalModule = currentModule || tc.module || '';
    const generatedId = `${getAbbr(finalModule)}-${String(idx + 1).padStart(4, '0')}`;
    const stepsHtml = (tc.steps || []).map((s, i) => `${i + 1}. ${escapeHtml(s)}`).join('<br>');
    const cells = [
      generatedId,
      finalModule,
      currentScreen || '',
      currentFeature || '',
      tc.name || '',
      mapType(tc.type || '', larkMapping),
      mapPriority(tc.priority || '', larkMapping),
      tc.preconditions || '',
      stepsHtml,
      tc.expectedResult || '',
      tc.testData || '',
      tc.status || '',
      tc.actualResult || '',
      tc.relatedBug || '',
    ];
    return `<tr>${cells.map((c, i) => `<td style="padding:8px 12px;border:1px solid #334155;vertical-align:top;">${i === 8 ? c : escapeHtml(c)}</td>`).join('')}</tr>`;
  }).join('');

  const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
  const text = (data?.testCases || []).map((tc, idx) => {
    const finalModule = currentModule || tc.module || '';
    const generatedId = `${getAbbr(finalModule)}-${String(idx + 1).padStart(4, '0')}`;
    return [
      generatedId,
      finalModule,
      currentScreen || '',
      currentFeature || '',
      tc.name || '',
      mapType(tc.type || '', larkMapping),
      mapPriority(tc.priority || '', larkMapping),
      tc.preconditions || '',
      (tc.steps || []).map((s, i) => `${i + 1}. ${s}`).join(' | '),
      tc.expectedResult || '',
      tc.testData || '',
      tc.status || '',
      tc.actualResult || '',
      tc.relatedBug || '',
    ].map(v => String(v).replace(/\t/g, ' ')).join('\t');
  }).join('\n');

  return { html, text };
}
