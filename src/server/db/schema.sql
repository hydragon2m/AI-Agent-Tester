-- AI QA Assistant SQLite Schema

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    context TEXT,
    stack TEXT,
    framework TEXT,
    url TEXT,
    api_base_url TEXT,
    tc_prefix TEXT,
    modules TEXT,
    lark_base_app_token TEXT DEFAULT '',
    lark_testcase_table_id TEXT DEFAULT '',
    lark_bug_table_id TEXT DEFAULT '',
    lark_source_url TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

-- Nodes Table (Project, Module, Screen, Feature tree nodes)
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    parent_id TEXT,
    type TEXT NOT NULL CHECK(type IN ('project', 'module', 'screen', 'feature')),
    name TEXT NOT NULL,
    context TEXT,
    abbreviation TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(parent_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Test Cases Table
CREATE TABLE IF NOT EXISTS test_cases (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    external_id TEXT,
    module TEXT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('Positive', 'Negative', 'Boundary', 'Edge Case', 'Security', 'UI/UX')),
    priority TEXT CHECK(priority IN ('High', 'Medium', 'Low')),
    suite TEXT CHECK(suite IN ('Smoke', 'Regression', 'New Feature', 'Exploratory')),
    automation_candidate TEXT CHECK(automation_candidate IN ('Yes', 'No')),
    trace_to TEXT,
    preconditions TEXT,
    steps_json TEXT, -- JSON array of steps
    test_data TEXT,
    expected_result TEXT,
    status TEXT DEFAULT '',
    actual_result TEXT DEFAULT '',
    related_bug TEXT DEFAULT '',
    lark_record_id TEXT DEFAULT '',
    lark_synced_at TEXT,
    version INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Test Case Revisions Table (for audit trail and history)
CREATE TABLE IF NOT EXISTS test_case_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_case_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    change_type TEXT, -- 'created', 'updated', 'restored'
    name TEXT,
    type TEXT,
    priority TEXT,
    preconditions TEXT,
    steps_json TEXT,
    expected_result TEXT,
    test_data TEXT,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

-- AI Generation Runs log
CREATE TABLE IF NOT EXISTS ai_runs (
    id TEXT PRIMARY KEY,
    node_id TEXT,
    skill TEXT NOT NULL,
    provider TEXT NOT NULL,
    prompt TEXT NOT NULL,
    output TEXT NOT NULL,
    parsed_output_json TEXT,
    status TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL
);

-- Skill Execution History (per node + skill: requirement input, output, test case snapshot)
CREATE TABLE IF NOT EXISTS skill_runs (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    title TEXT,
    input TEXT,
    output_json TEXT,
    raw_output TEXT,
    provider TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_skill_runs_node_skill ON skill_runs(node_id, skill);

-- Snippets Table
CREATE TABLE IF NOT EXISTS snippets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
);

-- Provider Settings Table (managed via environment variables first, but ready for DB fallback)
CREATE TABLE IF NOT EXISTS provider_settings (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL UNIQUE,
    encrypted_key TEXT,
    enabled INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT
);
