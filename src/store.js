const fs = require('fs');
const path = require('path');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const file = path.join(dataDir, 'store.json');
const initial = () => ({ widgets: {}, submissions: [], idempotency: {} });

function load() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return initial(); }
}

const state = load();
function persist() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}
function reset() { state.widgets = {}; state.submissions = []; state.idempotency = {}; persist(); }
module.exports = { state, persist, reset };
