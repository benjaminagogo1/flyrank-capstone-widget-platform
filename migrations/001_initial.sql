CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS widgets (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  type TEXT NOT NULL,

  title TEXT NOT NULL,

  description TEXT NOT NULL
    DEFAULT '',

  button_text TEXT NOT NULL,

  fields JSONB NOT NULL,

  allowed_origins JSONB NOT NULL
    DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT now()
);

CREATE INDEX IF NOT EXISTS
widgets_tenant_created_idx
ON widgets (
  tenant_id,
  created_at DESC
);

CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY,

  widget_id UUID NOT NULL
    REFERENCES widgets(id)
    ON DELETE CASCADE,

  tenant_id TEXT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  data JSONB NOT NULL,

  ip INET,

  geo JSONB,

  idempotency_key TEXT,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT now(),

  UNIQUE (
    widget_id,
    idempotency_key
  )
);

CREATE INDEX IF NOT EXISTS
submissions_tenant_created_idx
ON submissions (
  tenant_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
submissions_widget_created_idx
ON submissions (
  widget_id,
  created_at DESC
);