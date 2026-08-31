const postgres = require("../postgres");
const { state } = require("../store");

function normalize(row) {
  if (!row) return null;

  return {
    id: row.id,
    widgetId: row.widget_id ?? row.widgetId,
    tenantId: row.tenant_id ?? row.tenantId,
    data: typeof row.data === "string"
      ? JSON.parse(row.data)
      : row.data,
    ip: row.ip,
    geo: typeof row.geo === "string"
      ? JSON.parse(row.geo)
      : row.geo,
    createdAt: row.created_at ?? row.createdAt
  };
}

class SubmissionRepository {
  async findByIdempotency(widgetId, key) {
    if (!key) return null;

    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        SELECT *
        FROM submissions
        WHERE widget_id = $1
          AND idempotency_key = $2
        `,
        [widgetId, key]
      );

      return normalize(result.rows[0]);
    }

    return state.idempotency[`${widgetId}:${key}`] || null;
  }

  async create(submission, idempotencyKey = null) {
    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        INSERT INTO submissions (
          id,
          widget_id,
          tenant_id,
          data,
          ip,
          geo,
          idempotency_key,
          created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          submission.id,
          submission.widgetId,
          submission.tenantId,
          JSON.stringify(submission.data),
          submission.ip || null,
          submission.geo
            ? JSON.stringify(submission.geo)
            : null,
          idempotencyKey,
          submission.createdAt
        ]
      );

      return normalize(result.rows[0]);
    }

    state.submissions.push(submission);

    if (idempotencyKey) {
      state.idempotency[
        `${submission.widgetId}:${idempotencyKey}`
      ] = submission;
    }

    return submission;
  }

  async listByTenant(tenantId) {
    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        SELECT *
        FROM submissions
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        `,
        [tenantId]
      );

      return result.rows.map(normalize);
    }

    return state.submissions
      .filter(item => item.tenantId === tenantId);
  }

  async statsByTenant(tenantId) {
    const submissions = await this.listByTenant(tenantId);

    const perWidget = {};
    const geo = {};
    const overTime = {};

    for (const submission of submissions) {
      perWidget[submission.widgetId] =
        (perWidget[submission.widgetId] || 0) + 1;

      const country =
        submission.geo?.country || "unknown";

      geo[country] =
        (geo[country] || 0) + 1;

      const day =
        submission.createdAt.slice(0, 10);

      overTime[day] =
        (overTime[day] || 0) + 1;
    }

    return {
      total: submissions.length,
      perWidget,
      geo,
      overTime
    };
  }
}

module.exports = new SubmissionRepository();