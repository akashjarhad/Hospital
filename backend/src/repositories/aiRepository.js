const { query, memoryStore, getConnectionStatus } = require('../config/db');

const TABLES = {
  ai_handover_summaries: { json: ['original_content', 'edited_content', 'source_ids'] },
  ai_record_relevance: { json: [] },
  data_quality_issues: { json: ['source_ids', 'conflict_values', 'score_breakdown', 'authorized_categories'] },
  ai_search_logs: { json: ['answer', 'source_ids'] },
  security_anomalies: { json: ['feature_values'] },
  transfer_complexity_results: { json: ['factors', 'source_ids'] },
  ai_critical_information: { json: [] },
  ai_audit_events: { json: ['source_ids', 'approval_metadata', 'metadata'] },
  research_evaluation_runs: { json: [] },
  research_evaluation_entries: { json: [] }
};

function tableConfig(table) {
  const config = TABLES[table];
  if (!config) throw new Error(`Unsupported repository table: ${table}`);
  return config;
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function sameValue(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) return left == right;
  return String(left) === String(right);
}

function matches(row, criteria) {
  return Object.entries(criteria).every(([key, value]) => {
    if (Array.isArray(value)) return value.some(item => sameValue(row[key], item));
    return sameValue(row[key], value);
  });
}

function dbValue(table, key, value) {
  if (TABLES[table].json.includes(key) && value !== null && value !== undefined) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  return value;
}

async function insert(table, data) {
  tableConfig(table);
  if (!getConnectionStatus()) {
    const rows = memoryStore[table];
    const now = new Date();
    const record = { id: nextId(rows), ...data };
    if (!record.created_at) record.created_at = now;
    rows.push(record);
    return { ...record };
  }

  const keys = Object.keys(data);
  const values = keys.map(key => dbValue(table, key, data[key]));
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const result = await query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  return result.rows[0];
}

async function find(table, criteria = {}, options = {}) {
  tableConfig(table);
  if (!getConnectionStatus()) {
    let rows = memoryStore[table].filter(row => matches(row, criteria)).map(row => ({ ...row }));
    const sortField = options.sortField || 'created_at';
    rows.sort((a, b) => new Date(b[sortField] || 0) - new Date(a[sortField] || 0));
    if (options.limit) rows = rows.slice(0, options.limit);
    return rows;
  }

  const entries = Object.entries(criteria);
  const where = entries.length
    ? ` WHERE ${entries.map(([key], index) => `${key} = $${index + 1}`).join(' AND ')}`
    : '';
  const values = entries.map(([key, value]) => dbValue(table, key, value));
  const order = options.sortField ? ` ORDER BY ${options.sortField} DESC` : ' ORDER BY created_at DESC';
  const limit = options.limit ? ` LIMIT ${Math.max(1, Number(options.limit) || 1)}` : '';
  const result = await query(`SELECT * FROM ${table}${where}${order}${limit}`, values);
  return result.rows;
}

async function findOne(table, criteria = {}, options = {}) {
  const rows = await find(table, criteria, { ...options, limit: 1 });
  return rows[0] || null;
}

async function update(table, id, changes) {
  tableConfig(table);
  if (!getConnectionStatus()) {
    const record = memoryStore[table].find(row => sameValue(row.id, id));
    if (!record) return null;
    Object.assign(record, changes);
    return { ...record };
  }

  const keys = Object.keys(changes);
  if (!keys.length) return findOne(table, { id });
  const values = keys.map(key => dbValue(table, key, changes[key]));
  values.push(id);
  const assignments = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const result = await query(`UPDATE ${table} SET ${assignments} WHERE id = $${keys.length + 1} RETURNING *`, values);
  return result.rows[0] || null;
}

module.exports = { insert, find, findOne, update, TABLES };
