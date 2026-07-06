function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function markdownToHtml(markdown) {
  return escapeHtml(markdown)
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
