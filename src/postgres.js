let pool;
function enabled() {
  return Boolean(process.env.DATABASE_URL);
}
function getPool() {
  if (!enabled()) return null;
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}
async function health() {
  const p = getPool();
  if (!p) return false;
  await p.query("SELECT 1");
  return true;
}
async function insertSubmission(s) {
  const p = getPool();
  if (!p) return false;
  await p.query(
    "INSERT INTO submissions (id, widget_id, tenant_id, data, ip, geo, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [s.id, s.widgetId, s.tenantId, s.data, s.ip, s.geo, s.createdAt],
  );
  return true;
}
async function query(sql, params) {
  const p = getPool();
  if (!p) throw new Error("PostgreSQL is not configured");
  const result = await p.query(sql, params);
  return result.rows;
}
module.exports = { enabled, health, insertSubmission, query };
