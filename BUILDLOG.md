# Build Log

## Project

Embeddable Widget & Lead-Capture Platform

## Purpose

Build a multi-tenant backend platform that allows customers to configure lead-capture widgets, embed them on external websites, receive public submissions, protect the submission endpoint, enrich leads, persist data, and review tenant-scoped results.

---

# Implementation phases

## Phase 1 — Project foundation

Implemented:

* Node.js HTTP application
* Project structure
* Environment configuration
* Health endpoint
* Docker development environment
* PostgreSQL service configuration

Key decision:

Keep the HTTP layer lightweight and move business logic into services and repositories.

---

## Phase 2 — Widget management

Implemented:

* Widget creation
* Widget listing
* Widget retrieval
* Widget updates
* Widget deletion
* Tenant ownership checks

Validation covers:

* Widget title
* Widget type
* Description
* Button text
* Form fields
* Allowed origins

Security decision:

Protected fields such as widget identity and tenant ownership are not changed by update requests.

---

## Phase 3 — Embeddable widget

Implemented:

* Public widget configuration endpoint
* Versioned JavaScript widget asset
* Copyable script snippet
* Dynamic field rendering
* Honeypot field
* Browser-side form submission

Caching strategy:

* Long-lived immutable cache for the versioned JavaScript asset
* Shorter cache lifetime for widget configuration

---

## Phase 4 — Public submission pipeline

Implemented:

* Public submission endpoint
* Request-body size limit
* JSON validation
* Required-field validation
* Email validation
* Honeypot spam protection
* Rate limiting

Reliability decision:

Validation and protection failures return appropriate HTTP errors without affecting unrelated tenants.

---

## Phase 5 — Persistence

Implemented:

* PostgreSQL migration
* Widgets table
* Submissions table
* Tenant linkage
* Idempotency constraint
* Tenant and widget query indexes

Architecture decision:

Repositories are responsible for persistence operations so that the HTTP and service layers do not directly contain database queries.

---

## Phase 6 — Idempotency

Implemented support for:

```text
Idempotency-Key
```

Behavior:

* The first request creates the submission.
* A repeated request with the same widget and idempotency key returns the existing submission.
* Duplicate lead records are avoided.

---

## Phase 7 — Geo enrichment

Implemented a provider chain:

```text
Primary provider
        ↓ failure
Fallback provider
        ↓ failure
Continue without geo data
```

Reliability decision:

Geolocation is enrichment, not a requirement for accepting a valid lead.

---

## Phase 8 — Background work

Implemented an internal asynchronous job queue for side effects.

Behavior:

* Submission is stored first.
* Notification work is queued.
* Failed jobs are retried.
* Permanent failures are logged.

Reliability decision:

A notification failure must not cause a successfully stored lead to be reported as failed.

---

## Phase 9 — Dashboard

Implemented tenant-scoped endpoints for:

* Submission listing
* Total submission count
* Per-widget counts
* Geographic aggregates
* Submission counts over time

Security decision:

Dashboard data is filtered by the authenticated tenant.

---

## Phase 10 — Testing

Automated tests cover:

* Health checks
* Widget CRUD
* Validation
* Tenant isolation
* CORS preflight
* Widget rendering behavior
* Valid submissions
* Invalid submissions
* Malformed JSON
* Oversized payloads
* Rate limiting
* Spam protection
* Idempotency
* Dashboard isolation

Final test command:

```bash
npm test
```

Final result:

```text
[PASTE ACTUAL RESULT HERE]
```

---

# Problems encountered

## Persistence architecture

Initial implementation had multiple storage approaches that could make the authoritative persistence path unclear.

Resolution:

The repository layer was consolidated around PostgreSQL for the configured production path.

---

## Cross-origin behavior

The public submission flow requires browser requests from customer websites hosted on different origins.

Resolution:

Origin handling was restricted rather than reflecting arbitrary origins.

---

## Geo provider reliability

External geo providers can fail or become temporarily unavailable.

Resolution:

The enrichment workflow uses a fallback chain and does not block submission storage when all providers fail.

---

## Side-effect failures

Notification delivery should not determine whether a lead is successfully captured.

Resolution:

Notifications were moved into asynchronous background processing with retry behavior.

---

# Final review checklist

Before submitting:

* [ ] `npm install` succeeds.
* [ ] `docker compose up --build` succeeds.
* [ ] Database migration succeeds.
* [ ] Database seed succeeds.
* [ ] `npm test` passes.
* [ ] Evidence document contains actual outputs.
* [ ] No secrets are committed.
* [ ] `.env.example` contains configuration placeholders only.
* [ ] Repository documentation is up to date.
* [ ] Capstone metadata is complete.
