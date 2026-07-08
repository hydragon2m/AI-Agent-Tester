-- AI QA Assistant SQLite Schema

-- Systems Table (cấp ngoài cùng của cây: System -> Project -> Module -> Screen -> Feature)
-- Không FK để tránh cascade; project trỏ về system qua projects.system_id (nullable = chưa gán / legacy)
CREATE TABLE IF NOT EXISTS systems (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    system_id TEXT,
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
    stage TEXT DEFAULT '', -- activity/stage của Test Plan (api/smoke/manual/regression/performance/security) — dùng cho release-check
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

-- Test Strategies Table (F6/F7 — 1 strategy per project node, kế thừa xuống module/screen)
-- stages_json: array of { key, activity, stageType, enabled, trigger, skills[], entryCriteria, exitCriteria }
-- execution_plan_json: { sprintMap[], ownerMap[], priorityOrder[] }
CREATE TABLE IF NOT EXISTS test_strategies (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    node_id TEXT,
    template TEXT,
    summary TEXT DEFAULT '',
    stages_json TEXT,
    execution_plan_json TEXT,
    release_gate TEXT DEFAULT '',
    status TEXT DEFAULT 'draft',
    approved_by TEXT DEFAULT '',
    approved_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_test_strategies_project ON test_strategies(project_id, created_at);

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
