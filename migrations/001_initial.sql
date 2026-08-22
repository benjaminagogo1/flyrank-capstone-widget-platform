CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL);
CREATE TABLE widgets (id UUID PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', button_text TEXT NOT NULL, fields JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE submissions (id UUID PRIMARY KEY, widget_id UUID NOT NULL REFERENCES widgets(id), tenant_id TEXT NOT NULL REFERENCES users(id), data JSONB NOT NULL, ip INET, geo JSONB, idempotency_key TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(widget_id, idempotency_key));
CREATE INDEX submissions_tenant_created_idx ON submissions (tenant_id, created_at DESC);
