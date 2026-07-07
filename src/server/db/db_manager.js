/**
 * db_manager.js
 * Database layer — dùng better-sqlite3 (synchronous, bundle-friendly).
 * API công khai vẫn trả về Promise để tương thích với toàn bộ code hiện có.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Đường dẫn ────────────────────────────────────────────────────────────────

const APP_DATA_DIR = path.join(os.homedir(), '.hydra-qa');
if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(APP_DATA_DIR, 'database.sqlite');

// Khi chạy trong môi trường đã bundle (pkg), __dirname trỏ vào snapshot ảo.
// Dùng process.pkg để phát hiện và lấy đường dẫn thực tế.
const SCHEMA_PATH = process.pkg
    ? path.join(path.dirname(process.execPath), 'server', 'db', 'schema.sql')
    : path.join(__dirname, 'schema.sql');

const JSON_DB_PATH = process.pkg
    ? path.join(os.homedir(), '.hydra-qa', 'database.json')
    : path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'database.json');

// ── Kết nối DB ───────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');   // tốt hơn cho concurrent reads
db.pragma('foreign_keys = ON');

// ── Helpers (vẫn trả Promise để tương thích toàn bộ code cũ) ────────────────

function dbRun(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        const result = stmt.run(params);
        return Promise.resolve({ lastID: result.lastInsertRowid, changes: result.changes });
    } catch (err) {
        return Promise.reject(err);
    }
}

function dbAll(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        return Promise.resolve(stmt.all(params));
    } catch (err) {
        return Promise.reject(err);
    }
}

function dbGet(sql, params = []) {
    try {
        const stmt = db.prepare(sql);
        return Promise.resolve(stmt.get(params));
    } catch (err) {
        return Promise.reject(err);
    }
}

// ── Khởi tạo schema ──────────────────────────────────────────────────────────

async function initDatabase() {
    try {
        const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
        const statements = schemaSql
            .split('\n')
            .filter(line => !line.trim().startsWith('--'))
            .join('\n')
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const stmt of statements) {
            db.prepare(stmt).run();
        }

        console.log('[DB Manager] SQLite database schemas verified.');

        await runColumnMigrations();
        await importFromJson();

    } catch (e) {
        console.error('[DB Manager] initDatabase error:', e);
        throw e;
    }
}

// ── Column migrations ─────────────────────────────────────────────────────────

async function ensureColumn(table, column, definition) {
    const columns = db.pragma(`table_info(${table})`);
    const exists = columns.some(c => c.name === column);
    if (!exists) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
        console.log(`[DB Manager] Added column ${table}.${column}`);
    }
}

async function runColumnMigrations() {
    await ensureColumn('test_cases', 'lark_record_id', "TEXT DEFAULT ''");
    await ensureColumn('test_cases', 'lark_synced_at', 'TEXT');
    await ensureColumn('projects', 'lark_base_app_token', "TEXT DEFAULT ''");
    await ensureColumn('projects', 'lark_testcase_table_id', "TEXT DEFAULT ''");
    await ensureColumn('projects', 'lark_bug_table_id', "TEXT DEFAULT ''");
    await ensureColumn('projects', 'lark_source_url', "TEXT DEFAULT ''");
    await ensureColumn('nodes', 'abbreviation', "TEXT DEFAULT ''");
}

// ── Import từ JSON (migration một lần) ───────────────────────────────────────

function findProjectOwner(nodeId, nodesMap) {
    let curr = nodesMap.get(nodeId);
    while (curr) {
        if (curr.type === 'project') return curr.id;
        curr = nodesMap.get(curr.parentId);
    }
    return null;
}

async function importFromJson() {
    try {
        const count = db.prepare('SELECT COUNT(*) as count FROM nodes').get().count;
        if (count > 0) {
            console.log('[DB Manager] Database already populated. Skipping JSON import.');
            return;
        }

        let jsonPath = JSON_DB_PATH;
        if (!fs.existsSync(jsonPath) && fs.existsSync(JSON_DB_PATH + '.bak')) {
            jsonPath = JSON_DB_PATH + '.bak';
        }
        if (!fs.existsSync(jsonPath)) {
            console.log('[DB Manager] JSON database source not found, skipping migration.');
            return;
        }

        console.log(`[DB Manager] Importing ${path.basename(jsonPath)} to SQLite...`);
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        const nodes          = data.nodes || [];
        const testCasesMap   = data.testCases || {};
        const snippets       = data.snippets || [];
        const nodesMap       = new Map(nodes.map(n => [n.id, n]));
        const now            = new Date().toISOString();

        // Dùng better-sqlite3 transaction — nhanh hơn nhiều so với BEGIN/COMMIT thủ công
        const migrate = db.transaction(() => {
            // 1. Projects
            const insProject = db.prepare(
                `INSERT OR IGNORE INTO projects (id, name, context, created_at) VALUES (?, ?, ?, ?)`
            );
            for (const node of nodes) {
                if (node.type === 'project') {
                    insProject.run(node.id, node.name, node.context || '', now);
                }
            }

            // 2. Nodes
            const insNode = db.prepare(
                `INSERT OR IGNORE INTO nodes (id, project_id, parent_id, type, name, context, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`
            );
            for (const node of nodes) {
                insNode.run(
                    node.id,
                    findProjectOwner(node.id, nodesMap),
                    node.parentId || null,
                    node.type,
                    node.name,
                    node.context || '',
                    now
                );
            }

            // 3. Test cases & revisions
            const insTc = db.prepare(
                `INSERT OR IGNORE INTO test_cases (
                    id, node_id, external_id, module, name, type, priority, suite,
                    automation_candidate, trace_to, preconditions, steps_json,
                    test_data, expected_result, status, actual_result, related_bug, version, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
            );
            const insRev = db.prepare(
                `INSERT INTO test_case_revisions (
                    test_case_id, version, change_type, name, type, priority,
                    preconditions, steps_json, expected_result, test_data, updated_at
                ) VALUES (?, 1, 'created', ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            for (const [nodeId, tcs] of Object.entries(testCasesMap)) {
                if (!Array.isArray(tcs)) continue;
                for (const tc of tcs) {
                    const stepsJson = JSON.stringify(tc.steps || []);
                    insTc.run(
                        tc.id, nodeId, tc.externalId || null,
                        tc.module || '', tc.name,
                        tc.type || 'Positive', tc.priority || 'Medium',
                        tc.suite || 'Regression', tc.automationCandidate || 'Yes',
                        tc.traceTo || '', tc.preconditions || '', stepsJson,
                        tc.testData || '', tc.expectedResult || '',
                        tc.status || '', tc.actualResult || '', tc.relatedBug || '',
                        now
                    );
                    insRev.run(
                        tc.id, tc.name, tc.type || 'Positive', tc.priority || 'Medium',
                        tc.preconditions || '', stepsJson, tc.expectedResult || '',
                        tc.testData || '', now
                    );
                }
            }

            // 4. Snippets
            const insSnip = db.prepare(
                `INSERT OR IGNORE INTO snippets (id, title, content, tags_json, created_at) VALUES (?, ?, ?, ?, ?)`
            );
            for (const snip of snippets) {
                insSnip.run(
                    snip.id || 'snip_' + Date.now(),
                    snip.title, snip.content,
                    JSON.stringify(snip.tags || []),
                    now
                );
            }
        });

        migrate();
        console.log('[DB Manager] Migration completed successfully.');

        // Backup JSON
        if (fs.existsSync(JSON_DB_PATH)) {
            fs.renameSync(JSON_DB_PATH, JSON_DB_PATH + '.bak');
            console.log('[DB Manager] database.json backed up.');
        }

    } catch (e) {
        console.error('[DB Manager] Migration failed:', e);
        throw e;
    }
}

module.exports = { initDatabase, dbRun, dbAll, dbGet, db };
