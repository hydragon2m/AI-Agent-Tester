const { dbRun, dbAll } = require('../db/db_manager');

async function getSnippets() {
  return dbAll('SELECT * FROM snippets');
}

async function saveSnippets(snippets) {
  await dbRun('DELETE FROM snippets');
  for (const s of snippets) {
    await dbRun(
      'INSERT INTO snippets (id, title, content, tags_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [s.id || 'snip_' + Date.now().toString(), s.title, s.content, JSON.stringify(s.tags || []), new Date().toISOString()]
    );
  }
  return true;
}

module.exports = {
  getSnippets,
  saveSnippets
};
