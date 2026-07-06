const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'database.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const JSON_DB_PATH = path.join(path.dirname(path.dirname(path.dirname(__dirname))), 'database.json');

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (!err) {
        db.run('PRAGMA foreign_keys = ON;');
    }
});

// Helper to run query as Promise
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

// Helper to get all query results
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Helper to get one row
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Initialize database schemas and run migration inside serialize to ensure sequential execution
function initDatabase() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            try {
                const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
                const cleanSql = schemaSql
                    .split('\n')
                    .filter(line => !line.trim().startsWith('--'))
                    .join('\n');
                const statements = cleanSql
                    .split(';')
                    .map(s => s.trim())
                    .filter(s => s.length > 0);

                for (const statement of statements) {
                    db.run(statement, (err) => {
                        if (err) {
                            console.error('[DB Manager] Schema init statement failed:', statement);
                            reject(err);
                        }
                    });
                }
                
                console.log('[DB Manager] SQLite database schemas verified.');

                // Perform import sequentially after schemas are created
                db.all('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table" AND name="nodes"', (err, rows) => {
                    if (err) {
                        return reject(err);
                    }
                    if (rows.length === 0 || rows[0].count === 0) {
                        return reject(new Error('Schema setup failed: nodes table does not exist.'));
                    }

                    runColumnMigrations()
                        .then(importFromJson)
                        .then(resolve)
                        .catch(reject);
                });

            } catch (e) {
                reject(e);
            }
        });
    });
}

// Add columns introduced after a table's initial CREATE TABLE IF NOT EXISTS,
// since that statement is a no-op on databases that already have the table.
async function ensureColumn(table, column, definition) {
    const columns = await dbAll(`PRAGMA table_info(${table})`);
    const exists = columns.some(c => c.name === column);
    if (!exists) {
        await dbRun(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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

// Traverse up tree to find project node ID
function findProjectOwner(nodeId, nodesMap) {
    let curr = nodesMap.get(nodeId);
    while (curr) {
        if (curr.type === 'project') {
            return curr.id;
        }
        curr = nodesMap.get(curr.parentId);
    }
    return null;
}

async function importFromJson() {
    try {
        const rows = await dbAll('SELECT COUNT(*) as count FROM nodes');
        if (rows[0].count > 0) {
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
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(jsonContent);

        const nodes = data.nodes || [];
        const testCasesMap = data.testCases || {};
        const snippets = data.snippets || [];

        const nodesMap = new Map(nodes.map(n => [n.id, n]));

        await dbRun('BEGIN TRANSACTION');

        try {
            // 1. Migrate Projects first (nodes of type 'project')
            for (const node of nodes) {
                if (node.type === 'project') {
                    await dbRun(
                        `INSERT OR IGNORE INTO projects (id, name, context, created_at) VALUES (?, ?, ?, ?)`,
                        [node.id, node.name, node.context || '', new Date().toISOString()]
                    );
                }
            }

            // 2. Migrate Nodes
            for (const node of nodes) {
                const projectId = findProjectOwner(node.id, nodesMap);
                await dbRun(
                    `INSERT OR IGNORE INTO nodes (id, project_id, parent_id, type, name, context, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        node.id,
                        projectId,
                        node.parentId || null,
                        node.type,
                        node.name,
                        node.context || '',
                        new Date().toISOString()
                    ]
                );
            }

            // 3. Migrate Test Cases & Revisions
            for (const [nodeId, tcs] of Object.entries(testCasesMap)) {
                if (!Array.isArray(tcs)) continue;
                for (const tc of tcs) {
                    const stepsJson = JSON.stringify(tc.steps || []);
                    const nowStr = new Date().toISOString();

                    await dbRun(
                        `INSERT OR IGNORE INTO test_cases (
                            id, node_id, external_id, module, name, type, priority, suite, 
                            automation_candidate, trace_to, preconditions, steps_json, 
                            test_data, expected_result, status, actual_result, related_bug, version, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                        [
                            tc.id,
                            nodeId,
                            tc.externalId || null,
                            tc.module || '',
                            tc.name,
                            tc.type || 'Positive',
                            tc.priority || 'Medium',
                            tc.suite || 'Regression',
                            tc.automationCandidate || 'Yes',
                            tc.traceTo || '',
                            tc.preconditions || '',
                            stepsJson,
                            tc.testData || '',
                            tc.expectedResult || '',
                            tc.status || '',
                            tc.actualResult || '',
                            tc.relatedBug || '',
                            nowStr
                        ]
                    );

                    // Save initial revision
                    await dbRun(
                        `INSERT INTO test_case_revisions (
                            test_case_id, version, change_type, name, type, priority, 
                            preconditions, steps_json, expected_result, test_data, updated_at
                        ) VALUES (?, 1, 'created', ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            tc.id,
                            tc.name,
                            tc.type || 'Positive',
                            tc.priority || 'Medium',
                            tc.preconditions || '',
                            stepsJson,
                            tc.expectedResult || '',
                            tc.testData || '',
                            nowStr
                        ]
                    );
                }
            }

            // 4. Migrate Snippets
            for (const snip of snippets) {
                await dbRun(
                    `INSERT OR IGNORE INTO snippets (id, title, content, tags_json, created_at) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        snip.id || 'snip_' + Date.now().toString(),
                        snip.title,
                        snip.content,
                        JSON.stringify(snip.tags || []),
                        new Date().toISOString()
                    ]
                );
            }

            await dbRun('COMMIT');
            console.log('[DB Manager] Migration completed successfully.');
            
            // Backup JSON DB
            if (fs.existsSync(JSON_DB_PATH)) {
                fs.renameSync(JSON_DB_PATH, JSON_DB_PATH + '.bak');
                console.log('[DB Manager] database.json backed up to database.json.bak');
            }

        } catch (err) {
            await dbRun('ROLLBACK');
            console.error('[DB Manager] Transaction failed, rolled back:', err);
            throw err;
        }

    } catch (e) {
        console.error('[DB Manager] Migration failed:', e);
        throw e;
    }
}

module.exports = {
    initDatabase,
    dbRun,
    dbAll,
    dbGet,
    db
};
