const { state, persist } = require('../store');
const postgres = require('../postgres');

class SubmissionRepository {
  async create(submission, idempotencyKey) {
    if (postgres.enabled()) {
      const rows = await postgres.query('INSERT INTO submissions (id, widget_id, tenant_id, data, ip, geo, idempotency_key, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (widget_id,idempotency_key) DO UPDATE SET id=submissions.id RETURNING id, widget_id AS "widgetId", tenant_id AS "tenantId", data, ip, geo, created_at AS "createdAt"', [submission.id, submission.widgetId, submission.tenantId, JSON.stringify(submission.data), submission.ip, submission.geo ? JSON.stringify(submission.geo) : null, idempotencyKey || null, submission.createdAt]);
      return rows[0];
    }
    state.submissions.push(submission); if (idempotencyKey) state.idempotency[`${submission.widgetId}:${idempotencyKey}`] = submission; persist(); return submission;
  }

  async findByIdempotency(widgetId, key) {
    if (!key) return null;
    if (postgres.enabled()) { const rows = await postgres.query('SELECT id, widget_id AS "widgetId", tenant_id AS "tenantId", data, ip, geo, created_at AS "createdAt" FROM submissions WHERE widget_id=$1 AND idempotency_key=$2', [widgetId, key]); return rows[0] || null; }
    return state.idempotency[`${widgetId}:${key}`] || null;
  }

  async listByTenant(tenantId) {
    if (postgres.enabled()) return postgres.query('SELECT id, widget_id AS "widgetId", tenant_id AS "tenantId", data, ip, geo, created_at AS "createdAt" FROM submissions WHERE tenant_id=$1 ORDER BY created_at DESC', [tenantId]);
    return state.submissions.filter(s => s.tenantId === tenantId);
  }

  async statsByTenant(tenantId) {
    if (postgres.enabled()) {
      const total = await postgres.query('SELECT count(*)::int AS total FROM submissions WHERE tenant_id=$1', [tenantId]);
      const perWidget = await postgres.query('SELECT widget_id AS "widgetId", count(*)::int AS count FROM submissions WHERE tenant_id=$1 GROUP BY widget_id', [tenantId]);
      const geo = await postgres.query("SELECT COALESCE(geo->>'country','unknown') AS country, count(*)::int AS count FROM submissions WHERE tenant_id=$1 GROUP BY 1", [tenantId]);
      return { total: total[0].total, perWidget: Object.fromEntries(perWidget.map(r => [r.widgetId, r.count])), geo: Object.fromEntries(geo.map(r => [r.country, r.count])) };
    }
    const rows = state.submissions.filter(s => s.tenantId === tenantId);
    return { total: rows.length, perWidget: rows.reduce((a, s) => (a[s.widgetId] = (a[s.widgetId] || 0) + 1, a), {}), geo: rows.reduce((a, s) => { const k = s.geo?.country || 'unknown'; a[k] = (a[k] || 0) + 1; return a; }, {}) };
  }
}
module.exports = new SubmissionRepository();
