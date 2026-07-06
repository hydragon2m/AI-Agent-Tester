function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TABLE_ROW_RE = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function parseTableRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

function renderTable(lines) {
  const header = parseTableRow(lines[0]);
  const rows = lines.slice(2).map(parseTableRow);
  const thead = `<thead><tr>${header.map(cell => `<th>${cell}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<table class="md-table">${thead}${tbody}</table>`;
}

// Bảng markdown phải được gộp thành 1 khối <table> trước khi áp các regex
// dòng-đơn khác, nếu không mỗi dòng "| a | b |" sẽ bị tách rời bởi \n -> <br/>.
function extractTables(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const isTableStart = TABLE_ROW_RE.test(lines[i]) && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1]);
    if (isTableStart) {
      const tableLines = [lines[i], lines[i + 1]];
      let j = i + 2;
      while (j < lines.length && TABLE_ROW_RE.test(lines[j])) {
        tableLines.push(lines[j]);
        j += 1;
      }
      out.push(renderTable(tableLines));
      i = j;
    } else {
      out.push(lines[i]);
      i += 1;
    }
  }
  return out;
}

function markdownToHtml(markdown) {
  const withTables = extractTables(escapeHtml(markdown).split('\n')).join('\n');
  return withTables
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^- \[ \] (.+)$/gm, '<div class="checklist-item"><input type="checkbox" /> <span>$1</span></div>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br />');
}

export function MarkdownOutput({ value }) {
  return <div className="markdown-output" dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }} />;
}
