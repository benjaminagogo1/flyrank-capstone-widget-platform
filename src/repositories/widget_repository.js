const crypto = require('crypto');
const { state, persist } = require('../store');
const postgres = require('../postgres');

class WidgetRepository {
  async listByTenant(tenantId) {
    if (postgres.enabled()) {
      const rows = await postgres.query('SELECT id, tenant_id AS "tenantId", type, title, description, button_text AS "buttonText", fields FROM widgets WHERE tenant_id=$1 ORDER BY created_at DESC', [tenantId]);
      return rows;
    }
    return Object.values(state.widgets).filter(w => w.tenantId === tenantId);
  }

  async findById(id) {
    if (postgres.enabled()) {
      const rows = await postgres.query('SELECT id, tenant_id AS "tenantId", type, title, description, button_text AS "buttonText", fields FROM widgets WHERE id=$1', [id]);
      return rows[0] || null;
    }
    return state.widgets[id] || null;
  }

  async create(input, tenantId) {
    const widget = { id: crypto.randomUUID(), tenantId, type: input.type || 'signup', title: input.title.trim(), description: input.description || '', buttonText: input.buttonText || 'Submit', fields: input.fields || ['email'] };
    if (postgres.enabled()) {
      await postgres.query('INSERT INTO widgets (id, tenant_id, type, title, description, button_text, fields) VALUES ($1,$2,$3,$4,$5,$6,$7)', [widget.id, tenantId, widget.type, widget.title, widget.description, widget.buttonText, JSON.stringify(widget.fields)]);
      return widget;
    }
    state.widgets[widget.id] = widget; persist(); return widget;
  }

  async update(id, input) {
    const current = await this.findById(id); if (!current) return null;
    const next = { ...current, ...input, id: current.id, tenantId: current.tenantId };
    if (postgres.enabled()) {
      await postgres.query('UPDATE widgets SET type=$2,title=$3,description=$4,button_text=$5,fields=$6 WHERE id=$1', [id, next.type, next.title, next.description, next.buttonText, JSON.stringify(next.fields)]);
      return next;
    }
    state.widgets[id] = next; persist(); return next;
  }

  async remove(id) {
    if (postgres.enabled()) { await postgres.query('DELETE FROM widgets WHERE id=$1', [id]); return; }
    delete state.widgets[id]; persist();
  }
}

module.exports = new WidgetRepository();
