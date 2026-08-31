const crypto = require("crypto");
const postgres = require("../postgres");
const { state } = require("../store");

function normalize(row) {
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id ?? row.tenantId,
    type: row.type,
    title: row.title,
    description: row.description,
    buttonText: row.button_text ?? row.buttonText,
    fields: typeof row.fields === "string"
      ? JSON.parse(row.fields)
      : row.fields,
    allowedOrigins: typeof row.allowed_origins === "string"
      ? JSON.parse(row.allowed_origins)
      : (row.allowed_origins ?? row.allowedOrigins ?? [])
  };
}

class WidgetRepository {
  async listByTenant(tenantId) {
    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        SELECT
          id,
          tenant_id,
          type,
          title,
          description,
          button_text,
          fields,
          allowed_origins
        FROM widgets
        WHERE tenant_id = $1
        ORDER BY created_at DESC
        `,
        [tenantId]
      );

      return result.rows.map(normalize);
    }

    return Object.values(state.widgets)
      .filter(widget => widget.tenantId === tenantId);
  }

  async findById(id) {
    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        SELECT
          id,
          tenant_id,
          type,
          title,
          description,
          button_text,
          fields,
          allowed_origins
        FROM widgets
        WHERE id = $1
        `,
        [id]
      );

      return normalize(result.rows[0]);
    }

    return state.widgets[id] || null;
  }

  async create(input, tenantId) {
    const widget = {
      id: crypto.randomUUID(),
      tenantId,
      type: input.type,
      title: input.title,
      description: input.description,
      buttonText: input.buttonText,
      fields: input.fields,
      allowedOrigins: input.allowedOrigins
    };

    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        INSERT INTO widgets (
          id,
          tenant_id,
          type,
          title,
          description,
          button_text,
          fields,
          allowed_origins
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
        `,
        [
          widget.id,
          widget.tenantId,
          widget.type,
          widget.title,
          widget.description,
          widget.buttonText,
          JSON.stringify(widget.fields),
          JSON.stringify(widget.allowedOrigins)
        ]
      );

      return normalize(result.rows[0]);
    }

    state.widgets[widget.id] = widget;
    return widget;
  }

  async update(id, tenantId, input) {
    const current = await this.findById(id);

    if (!current || current.tenantId !== tenantId) {
      return null;
    }

    const next = {
      ...current,
      ...input,
      id: current.id,
      tenantId: current.tenantId
    };

    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        UPDATE widgets
        SET
          type = $3,
          title = $4,
          description = $5,
          button_text = $6,
          fields = $7,
          allowed_origins = $8
        WHERE id = $1 AND tenant_id = $2
        RETURNING *
        `,
        [
          id,
          tenantId,
          next.type,
          next.title,
          next.description,
          next.buttonText,
          JSON.stringify(next.fields),
          JSON.stringify(next.allowedOrigins)
        ]
      );

      return normalize(result.rows[0]);
    }

    state.widgets[id] = next;
    return next;
  }

  async remove(id, tenantId) {
    if (postgres.enabled()) {
      const result = await postgres.query(
        `
        DELETE FROM widgets
        WHERE id = $1 AND tenant_id = $2
        `,
        [id, tenantId]
      );

      return result.rowCount > 0;
    }

    const widget = state.widgets[id];

    if (!widget || widget.tenantId !== tenantId) {
      return false;
    }

    delete state.widgets[id];
    return true;
  }
}

module.exports = new WidgetRepository();