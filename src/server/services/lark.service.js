const { getActiveKey, saveProviderSetting } = require('./provider.service');
const { getTestCases, getTestCasesForScope, markLarkSynced, clearLarkSyncForProject } = require('./test-case.service');
const { getNodeById, getNodePath } = require('./node.service');
const { getLarkLink, saveLarkLink } = require('./project.service');

const LARK_API_BASE = 'https://open.larksuite.com/open-apis';
const PROVIDER_KEY = 'lark';
const BATCH_SIZE = 500;

let cachedToken = null; // { token, expiresAt }

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalize(value) {
  return String(value || '').trim();
}

async function getConfig() {
  const raw = await getActiveKey(PROVIDER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function saveConfig(patch) {
  const existing = (await getConfig()) || {};
  const next = { ...existing, ...patch };
  await saveProviderSetting(PROVIDER_KEY, JSON.stringify(next), true, 1);
  return next;
}

async function larkFetch(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${LARK_API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok || data.code !== 0) {
    throw new Error(`Lark API error [${path}]: ${data.msg || res.statusText}`);
  }
  return data.data;
}

async function getTenantAccessToken(config, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt - now > 10 * 60 * 1000) {
    return cachedToken.token;
  }
  const res = await fetch(`${LARK_API_BASE}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: config.app_id, app_secret: config.app_secret })
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(`Lark auth failed: ${data.msg}`);
  }
  cachedToken = { token: data.tenant_access_token, expiresAt: now + data.expire * 1000 };
  return cachedToken.token;
}

async function testConnection(config) {
  cachedToken = null;
  await getTenantAccessToken(config, { forceRefresh: true });
  return true;
}

async function requireConfig() {
  const config = await getConfig();
  if (!config || !config.app_id || !config.app_secret) {
    throw new Error('Chưa cấu hình Lark App ID/Secret. Vào Cài đặt > Lark Base để thêm.');
  }
  return config;
}

// Accepts either a direct Base link (.../base/{app_token}?table={table_id})
// or a Base embedded in a Wiki page (.../wiki/{node_token}?table={table_id}) —
// the latter needs an extra resolve step since the wiki node_token isn't the
// Bitable app_token the Open API expects.
function parseBaseUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new Error('Link Lark không hợp lệ');
  }
  const tableId = parsed.searchParams.get('table') || null;

  const baseMatch = parsed.pathname.match(/\/base\/([a-zA-Z0-9]+)/);
  if (baseMatch) {
    return { appToken: baseMatch[1], isWiki: false, tableId };
  }
  const wikiMatch = parsed.pathname.match(/\/wiki\/([a-zA-Z0-9]+)/);
  if (wikiMatch) {
    return { wikiNodeToken: wikiMatch[1], isWiki: true, tableId };
  }
  throw new Error('Không nhận diện được link Base hoặc Wiki trong URL này');
}

async function resolveAppToken(parsedUrl, token) {
  if (!parsedUrl.isWiki) return parsedUrl.appToken;
  const data = await larkFetch(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(parsedUrl.wikiNodeToken)}`, { token });
  const node = data.node;
  if (!node || node.obj_type !== 'bitable') {
    throw new Error('Link Wiki này không trỏ tới 1 Lark Base (Bitable)');
  }
  return node.obj_token;
}

async function findTableByName(appToken, token, name) {
  const data = await larkFetch(`/bitable/v1/apps/${appToken}/tables`, { token });
  const items = data.items || [];
  return items.find(t => (t.name || '').trim().toLowerCase() === name.toLowerCase()) || null;
}

async function ensureBugTable(appToken, token) {
  const existing = await findTableByName(appToken, token, 'Bugs');
  if (existing) return { tableId: existing.table_id, created: false };
  const table = await larkFetch(`/bitable/v1/apps/${appToken}/tables`, {
    method: 'POST',
    token,
    body: { table: { name: 'Bugs', fields: [{ field_name: 'Title', type: 1 }] } }
  });
  return { tableId: table.table_id || table.table?.table_id, created: true };
}

function selectOptions(names) {
  return { options: names.map(name => ({ name })) };
}

// Server-configured field set for the Test Cases table. Order here is what a
// brand-new table gets created with (ID/Screen/Module/Feature/Title first, then
// Type/Priority, các cột nội dung, và Status ở gần cuối — trước Related Bug);
// fields added later to an already-existing table via reconcileFields always get
// appended by Lark regardless of this order (bảng cũ giữ nguyên thứ tự cột sẵn có).
function buildRequiredFieldDefs(bugTableId) {
  return [
    { field_name: 'ID', type: 1 },
    { field_name: 'Screen', type: 1 },
    { field_name: 'Module', type: 3, property: { options: [] } },
    { field_name: 'Feature', type: 1 },
    { field_name: 'Title', type: 1 },
    { field_name: 'Type', type: 3, property: selectOptions(['Positive', 'Negative', 'Boundary', 'Edge Case', 'Security', 'UI/UX']) },
    { field_name: 'Priority', type: 3, property: selectOptions(['High', 'Medium', 'Low']) },
    { field_name: 'Preconditions', type: 1 },
    { field_name: 'Steps', type: 1 },
    { field_name: 'Expected Result', type: 1 },
    { field_name: 'Test Data', type: 1 },
    { field_name: 'Status', type: 3, property: selectOptions(['Pass', 'Fail', 'Pending', 'Block', 'Untest']) },
    { field_name: 'Related Bug', type: 18, property: { table_id: bugTableId } }
  ];
}

async function ensureTestCaseTable(appToken, token, explicitTableId, bugTableId, tableName = 'Test Cases') {
  if (explicitTableId) {
    return { tableId: explicitTableId, created: false };
  }
  const existing = await findTableByName(appToken, token, tableName);
  if (existing) {
    return { tableId: existing.table_id, created: false };
  }
  const table = await larkFetch(`/bitable/v1/apps/${appToken}/tables`, {
    method: 'POST',
    token,
    body: { table: { name: tableName, fields: buildRequiredFieldDefs(bugTableId) } }
  });
  return { tableId: table.table_id || table.table?.table_id, created: true };
}

// Type/Priority/Status are expected to be single select — if an existing
// table still has them as another type (or missing options), upgrade them in
// place. Lark preserves existing cell text as-is on a type change, and here
// we only ever add options (merge), never drop one — so no data is lost.
const SELECT_FIELD_OPTIONS = {
  Type: ['Positive', 'Negative', 'Boundary', 'Edge Case', 'Security', 'UI/UX'],
  Priority: ['High', 'Medium', 'Low'],
  Status: ['Pass', 'Fail', 'Pending', 'Block', 'Untest']
};

// Additive by default: creates whichever required fields are missing by
// exact name, never touches a field (or its records) that's already there —
// except the single-select upgrade above, which only ever merges options in.
async function reconcileFields(appToken, tableId, token, bugTableId) {
  const existingRes = await larkFetch(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, { token });
  const existingItems = existingRes.items || [];
  const existingByName = new Map(existingItems.map(f => [f.field_name, f]));
  const added = [];
  const upgraded = [];
  const renamed = [];

  // Lark always auto-generates its own default primary field when a table is
  // created via the API, regardless of the fields we asked for — it lands as
  // the leftmost column and nothing ever writes to it, so it's blank forever.
  // Repurpose it as the ID field instead of leaving a dead empty column.
  if (!existingByName.has('ID')) {
    const primary = existingItems.find(f => f.is_primary);
    if (primary) {
      await larkFetch(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${primary.field_id}`, {
        method: 'PUT',
        token,
        body: { field_name: 'ID', type: primary.type }
      });
      renamed.push(primary.field_name);
      existingByName.set('ID', { ...primary, field_name: 'ID' });
    }
  }

  for (const def of buildRequiredFieldDefs(bugTableId)) {
    const existing = existingByName.get(def.field_name);
    if (!existing) {
      await larkFetch(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
        method: 'POST',
        token,
        body: def
      });
      added.push(def.field_name);
      continue;
    }

    const wantedNames = SELECT_FIELD_OPTIONS[def.field_name];
    if (!wantedNames) continue;
    const currentOptions = existing.property?.options || [];
    const currentNames = new Set(currentOptions.map(o => o.name));
    const missingNames = wantedNames.filter(n => !currentNames.has(n));
    if (existing.type === 3 && missingNames.length === 0) continue;

    await larkFetch(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${existing.field_id}`, {
      method: 'PUT',
      token,
      body: {
        field_name: def.field_name,
        type: 3,
        property: { options: [...currentOptions, ...missingNames.map(name => ({ name }))] }
      }
    });
    upgraded.push(def.field_name);
  }

  return { added, upgraded, renamed };
}

async function linkProject(nodeId, url) {
  const config = await requireConfig();
  const node = await getNodeById(nodeId);
  if (!node || !node.project_id) {
    throw new Error('Không xác định được project cho node này');
  }

  const token = await getTenantAccessToken(config);
  const parsedUrl = parseBaseUrl(url);
  const appToken = await resolveAppToken(parsedUrl, token);

  const previousLink = await getLarkLink(node.project_id);
  const isNewBase = !previousLink?.appToken || previousLink.appToken !== appToken;

  const bugTable = await ensureBugTable(appToken, token);
  const tcTable = await ensureTestCaseTable(appToken, token, parsedUrl.tableId, bugTable.tableId);
  const { added: addedFields, upgraded: upgradedFields, renamed: renamedFields } = await reconcileFields(appToken, tcTable.tableId, token, bugTable.tableId);

  await saveLarkLink(node.project_id, {
    appToken,
    testcaseTableId: tcTable.tableId,
    bugTableId: bugTable.tableId,
    sourceUrl: url
  });

  const resyncedCount = isNewBase ? await clearLarkSyncForProject(node.project_id) : 0;

  return {
    createdTable: tcTable.created,
    createdBugTable: bugTable.created,
    addedFields,
    upgradedFields,
    renamedFields,
    resyncedCount,
    appToken,
    testcaseTableId: tcTable.tableId
  };
}

async function findOrCreateBugRecord(link, token, bugTitle) {
  const title = normalize(bugTitle);
  if (!title) return null;

  const searchRes = await larkFetch(`/bitable/v1/apps/${link.appToken}/tables/${link.bugTableId}/records/search`, {
    method: 'POST',
    token,
    body: {
      filter: {
        conjunction: 'and',
        conditions: [{ field_name: 'Title', operator: 'is', value: [title] }]
      }
    }
  });

  const found = (searchRes.items || [])[0];
  if (found) return found.record_id;

  const createRes = await larkFetch(`/bitable/v1/apps/${link.appToken}/tables/${link.bugTableId}/records/batch_create`, {
    method: 'POST',
    token,
    body: { records: [{ fields: { Title: title } }] }
  });
  return createRes.records[0].record_id;
}

function buildRecordFields(tc, nodePath = {}) {
  let steps = [];
  try {
    steps = JSON.parse(tc.steps_json || '[]');
  } catch (e) {
    steps = [];
  }
  return {
    ID: tc.id || '',
    Screen: normalize(nodePath.screen),
    Module: normalize(nodePath.module || tc.module),
    Feature: normalize(nodePath.feature),
    Title: tc.name || '',
    Type: tc.type || '',
    Priority: tc.priority || '',
    Status: normalize(tc.status),
    Preconditions: tc.preconditions || '',
    Steps: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    'Expected Result': tc.expected_result || '',
    'Test Data': tc.test_data || ''
  };
}

async function getProjectLink(nodeId) {
  const node = await getNodeById(nodeId);
  if (!node || !node.project_id) return null;
  return getLarkLink(node.project_id);
}

async function pushTestCases(nodeId) {
  const config = await requireConfig();
  const node = await getNodeById(nodeId);
  if (!node || !node.project_id) {
    throw new Error('Không xác định được project cho node này');
  }

  const link = await getLarkLink(node.project_id);
  if (!link || !link.testcaseTableId) {
    const err = new Error('Project chưa được gán link Lark Base');
    err.code = 'NOT_LINKED';
    throw err;
  }

  const token = await getTenantAccessToken(config);
  const nodePath = await getNodePath(nodeId);

  const testCases = await getTestCases(nodeId);
  const summary = { created: 0, updated: 0, bugsLinked: 0, errors: [] };
  if (testCases.length === 0) return summary;

  const toCreate = [];
  const toUpdate = [];

  for (const tc of testCases) {
    try {
      const fields = buildRecordFields(tc, nodePath);
      if (tc.related_bug && tc.related_bug.trim()) {
        const bugRecordId = await findOrCreateBugRecord(link, token, tc.related_bug);
        if (bugRecordId) {
          fields['Related Bug'] = [bugRecordId];
          summary.bugsLinked++;
        }
      }
      const entry = { tc, fields };
      if (tc.lark_record_id) toUpdate.push(entry);
      else toCreate.push(entry);
    } catch (e) {
      summary.errors.push(`${tc.external_id || tc.id}: ${e.message}`);
    }
  }

  for (const batch of chunk(toCreate, BATCH_SIZE)) {
    try {
      const res = await larkFetch(`/bitable/v1/apps/${link.appToken}/tables/${link.testcaseTableId}/records/batch_create`, {
        method: 'POST',
        token,
        body: { records: batch.map(e => ({ fields: e.fields })) }
      });
      const created = res.records || [];
      for (let i = 0; i < batch.length; i++) {
        const recordId = created[i]?.record_id;
        if (recordId) {
          await markLarkSynced(batch[i].tc.id, recordId);
          summary.created++;
        }
      }
    } catch (e) {
      summary.errors.push(`batch_create: ${e.message}`);
    }
  }

  for (const batch of chunk(toUpdate, BATCH_SIZE)) {
    try {
      await larkFetch(`/bitable/v1/apps/${link.appToken}/tables/${link.testcaseTableId}/records/batch_update`, {
        method: 'POST',
        token,
        body: { records: batch.map(e => ({ record_id: e.tc.lark_record_id, fields: e.fields })) }
      });
      for (const e of batch) {
        await markLarkSynced(e.tc.id, e.tc.lark_record_id);
        summary.updated++;
      }
    } catch (e) {
      summary.errors.push(`batch_update: ${e.message}`);
    }
  }

  return summary;
}

function sanitizeTableName(name) {
  // Lark table names can't be blank and are capped in length; strip newlines/tabs.
  const clean = String(name || '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, 100);
  return clean || 'Test Cases';
}

// Pushes a batch of raw test_cases rows (each carrying its own `_path` for the
// Screen/Feature columns) into one already-resolved Lark table. Mirrors the
// create/update+dedup logic of pushTestCases but works off explicit rows +
// per-row path so it can serve a whole scope. `link` = { appToken,
// testcaseTableId, bugTableId }.
async function syncRowsToTable(link, token, rows) {
  const summary = { created: 0, updated: 0, bugsLinked: 0, errors: [] };
  const toCreate = [];
  const toUpdate = [];

  for (const tc of rows) {
    try {
      const fields = buildRecordFields(tc, tc._path || {});
      if (tc.related_bug && tc.related_bug.trim()) {
        const bugRecordId = await findOrCreateBugRecord(link, token, tc.related_bug);
        if (bugRecordId) {
          fields['Related Bug'] = [bugRecordId];
          summary.bugsLinked++;
        }
      }
      const entry = { tc, fields };
      if (tc.lark_record_id) toUpdate.push(entry);
      else toCreate.push(entry);
    } catch (e) {
      summary.errors.push(`${tc.external_id || tc.id}: ${e.message}`);
    }
  }

  for (const batch of chunk(toCreate, BATCH_SIZE)) {
    try {
      const res = await larkFetch(`/bitable/v1/apps/${link.appToken}/tables/${link.testcaseTableId}/records/batch_create`, {
        method: 'POST',
        token,
        body: { records: batch.map(e => ({ fields: e.fields })) }
      });
      const created = res.records || [];
      for (let i = 0; i < batch.length; i++) {
        const recordId = created[i]?.record_id;
        if (recordId) {
          await markLarkSynced(batch[i].tc.id, recordId);
          summary.created++;
        }
      }
    } catch (e) {
      summary.errors.push(`batch_create: ${e.message}`);
    }
  }

  for (const batch of chunk(toUpdate, BATCH_SIZE)) {
    try {
      await larkFetch(`/bitable/v1/apps/${link.appToken}/tables/${link.testcaseTableId}/records/batch_update`, {
        method: 'POST',
        token,
        body: { records: batch.map(e => ({ record_id: e.tc.lark_record_id, fields: e.fields })) }
      });
      for (const e of batch) {
        await markLarkSynced(e.tc.id, e.tc.lark_record_id);
        summary.updated++;
      }
    } catch (e) {
      summary.errors.push(`batch_update: ${e.message}`);
    }
  }

  return summary;
}

// Pushes a whole scope to ONE Lark Base given by URL, one table per project
// (table named after the project). System scope → many tables in the same
// Base; project/module/screen/feature scope → a single table. When saveLink is
// true, each project's resolved table is persisted as its Lark link (so the
// per-node "Đẩy lên Lark" keeps working afterwards). Pure code + Lark API → 0 AI token.
async function pushTestCasesScope(scopeType, scopeId, larkUrl, saveLink) {
  const config = await requireConfig();
  const token = await getTenantAccessToken(config);
  const parsedUrl = parseBaseUrl(larkUrl);
  const appToken = await resolveAppToken(parsedUrl, token);
  const bugTable = await ensureBugTable(appToken, token);

  const { scopeName, groups } = await getTestCasesForScope(scopeType, scopeId);

  const result = { scopeName, appToken, tables: [], totals: { created: 0, updated: 0, bugsLinked: 0 }, errors: [] };
  const usedNames = new Map(); // sanitized table name -> projectId, so two distinct projects never merge

  for (const group of groups) {
    if (!group.rows.length) {
      result.tables.push({ projectName: group.projectName, created: 0, updated: 0, skipped: true, note: 'không có test case' });
      continue;
    }

    let name = sanitizeTableName(group.projectName);
    if (usedNames.has(name) && usedNames.get(name) !== group.projectId) {
      let i = 2;
      while (usedNames.has(`${name} (${i})`)) i++;
      name = `${name} (${i})`;
    }
    usedNames.set(name, group.projectId);

    try {
      const tcTable = await ensureTestCaseTable(appToken, token, null, bugTable.tableId, name);
      await reconcileFields(appToken, tcTable.tableId, token, bugTable.tableId);
      const link = { appToken, testcaseTableId: tcTable.tableId, bugTableId: bugTable.tableId };
      const summary = await syncRowsToTable(link, token, group.rows);

      result.tables.push({
        projectName: group.projectName,
        tableName: name,
        tableId: tcTable.tableId,
        createdTable: tcTable.created,
        created: summary.created,
        updated: summary.updated,
        bugsLinked: summary.bugsLinked
      });
      result.totals.created += summary.created;
      result.totals.updated += summary.updated;
      result.totals.bugsLinked += summary.bugsLinked;
      if (summary.errors.length) result.errors.push(...summary.errors.map(msg => `[${group.projectName}] ${msg}`));

      if (saveLink && group.projectId) {
        await saveLarkLink(group.projectId, {
          appToken,
          testcaseTableId: tcTable.tableId,
          bugTableId: bugTable.tableId,
          sourceUrl: larkUrl
        });
      }
    } catch (e) {
      result.errors.push(`[${group.projectName}] ${e.message}`);
      result.tables.push({ projectName: group.projectName, tableName: name, error: e.message });
    }
  }

  return result;
}

module.exports = {
  getConfig,
  saveConfig,
  testConnection,
  linkProject,
  getProjectLink,
  pushTestCases,
  pushTestCasesScope,
  getTenantAccessToken,
  reconcileFields,
  requireConfig
};
