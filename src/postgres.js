const { Pool } = require("pg");

let pool = null;

function enabled() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!enabled()) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
  }

  return pool;
}

async function query(text, params = []) {
  const db = getPool();

  if (!db) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence");
  }

  return db.query(text, params);
}

async function health() {
  if (!enabled()) return false;

  await query("SELECT 1");
  return true;
}

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  enabled,
  getPool,
  query,
  health,
  close
};