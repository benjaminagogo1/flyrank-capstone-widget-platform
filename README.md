# Embeddable Widget & Lead-Capture Platform

Backend capstone project for the FlyRank internship program.

This project provides a multi-tenant platform where customers can create embeddable lead-capture widgets, install them on external websites with a script tag, collect submissions, validate and protect incoming requests, enrich submissions with geolocation data, store them durably, and review submissions through tenant-scoped dashboard endpoints.

## Features

### Widget management

Authenticated tenants can:

* Create widgets
* List their widgets
* Retrieve a widget they own
* Update a widget they own
* Delete a widget they own

Tenant isolation is enforced at the repository and HTTP layers.

### Embeddable widget

Each widget provides a copyable embed snippet:

```html
<script src="http://localhost:3000/widget-v1.js?id=YOUR_WIDGET_ID"></script>
```

The JavaScript asset:

* Loads the public widget configuration
* Renders the widget dynamically
* Builds form fields from widget configuration
* Includes a hidden honeypot field
* Sends submissions to the backend

The widget JavaScript is versioned and served with long-lived immutable cache headers.

### Public submissions

External websites can submit data through the public submission endpoint.

The backend provides:

* JSON payload validation
* Request size limits
* Required-field validation
* Email validation
* Honeypot spam protection
* Per-IP and per-widget rate limiting
* Idempotency support
* Cross-origin request handling

### Geolocation enrichment

The submission flow attempts geolocation enrichment through a provider fallback chain:

1. Primary provider
2. Fallback provider
3. Continue without geolocation when both providers fail

A failure in geolocation enrichment does not prevent a valid submission from being stored.

### Persistence

The production application path uses PostgreSQL.

Database responsibilities include:

* Durable widget storage
* Durable submission storage
* Tenant linkage
* Idempotency constraints
* Indexed tenant and widget queries

The repository layer separates persistence concerns from HTTP routing and business logic.

### Background processing

Notification work is moved out of the submission request path.

The internal job queue:

* Executes notification work asynchronously
* Retries failed jobs
* Logs permanent job failures

A notification failure does not prevent a valid lead from being stored.

### Dashboard

Authenticated tenants can access:

* Their submissions
* Submission totals
* Submission counts by widget
* Geographic aggregates
* Submission counts over time

Dashboard queries are tenant-scoped.

---

# Architecture

```text
External Customer Website
        |
        | <script src="widget-v1.js">
        v
Embeddable Widget
        |
        | GET widget configuration
        v
Public Widget API
        |
        | POST lead submission
        v
HTTP Layer
        |
        +-- CORS
        +-- Payload limit
        +-- Validation
        +-- Spam protection
        +-- Rate limiting
        |
        v
Service Layer
        |
        +-- Geo enrichment
        +-- Idempotency
        +-- Submission workflow
        |
        v
Repository Layer
        |
        +-------------------+
        |                   |
        v                   v
PostgreSQL            Background Job Queue
                            |
                            v
                     Notification / Side Effect
```

---

# Project structure

```text
.
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
├── capstone.yaml
├── README.md
├── EVIDENCE.md
├── BUILDLOG.md
├── .env.example
├── migrations/
│   └── 001_initial.sql
├── scripts/
│   ├── migrate.js
│   └── seed.js
├── src/
│   ├── postgres.js
│   ├── store.js
│   ├── services.js
│   ├── geo.js
│   ├── jobs.js
│   ├── repositories/
│   │   ├── widget_repository.js
│   │   └── submission_repository.js
│   └── customer-site/
│       └── index.html
└── test.js
```

---

# Requirements

* Node.js 20 or later
* Docker and Docker Compose for the PostgreSQL development environment

---

# Setup

Clone the repository:

```bash
git clone https://github.com/benjaminagogo1/flyrank-capstone-widget-platform.git
cd flyrank-capstone-widget-platform
```

Install dependencies:

```bash
npm install
```

Create the environment file:

```bash
cp .env.example .env
```

Start the application and PostgreSQL:

```bash
docker compose up --build
```

The API is available at:

```text
http://localhost:3000
```

---

# Database migration

The Docker configuration runs the migration and seed steps before starting the application.

To run them manually:

```bash
npm run migrate
npm run seed
```

The seeded development tenants are:

| Tenant      | Bearer token     |
| ----------- | ---------------- |
| Demo tenant | `demo-token`     |
| Tenant B    | `tenant-b-token` |

These tokens are development-only demonstration credentials.

---

# Running tests

Run the automated test suite:

```bash
npm test
```

The test suite covers:

* Health checks
* Widget CRUD
* Widget update validation
* Tenant isolation
* Public widget configuration
* CORS preflight
* Widget JavaScript delivery
* Dynamic field rendering
* Valid submissions
* Invalid submissions
* Malformed JSON
* Oversized payload rejection
* Honeypot spam protection
* Rate limiting
* Idempotency
* Dashboard tenant isolation

---

# API overview

## Authentication

Authenticated dashboard and widget management routes require:

```text
Authorization: Bearer demo-token
```

## Widget endpoints

### Create widget

```text
POST /widgets
```

Example:

```json
{
  "type": "signup",
  "title": "Newsletter",
  "description": "Receive product updates",
  "buttonText": "Subscribe",
  "fields": [
    {
      "name": "name",
      "label": "Name",
      "type": "text",
      "required": true
    },
    {
      "name": "email",
      "label": "Email",
      "type": "email",
      "required": true
    }
  ],
  "allowedOrigins": [
    "http://localhost:4000"
  ]
}
```

### List widgets

```text
GET /widgets
```

### Get widget

```text
GET /widgets/:id
```

### Update widget

```text
PUT /widgets/:id
```

### Delete widget

```text
DELETE /widgets/:id
```

### Public widget configuration

```text
GET /widgets/:id/config
```

---

# Submission endpoint

```text
POST /submissions
```

Example:

```json
{
  "widgetId": "WIDGET_ID",
  "data": {
    "name": "Example User",
    "email": "user@example.com",
    "website": ""
  }
}
```

The optional idempotency header is:

```text
Idempotency-Key: unique-request-key
```

---

# Dashboard endpoints

### List submissions

```text
GET /dashboard/submissions
```

### Submission statistics

```text
GET /dashboard/stats
```

Both endpoints are scoped to the authenticated tenant.

---

# Cross-origin demo

The repository contains a simple customer-site page that can be served from a different origin.

Start the API:

```bash
docker compose up
```

Serve the customer page on port 4000:

```bash
cd src/customer-site
python3 -m http.server 4000
```

Open:

```text
http://localhost:4000
```

Create a widget through the API, copy its ID, and place that ID into the customer page's script tag.

This demonstrates:

* External script embedding
* Cross-origin widget configuration loading
* Cross-origin submission requests
* CORS behavior
* Public lead capture

---

# Security and reliability

The project includes the following controls:

* Tenant-scoped access checks
* Input validation
* Request size limits
* Rate limiting
* Honeypot spam detection
* Idempotency protection
* CORS origin checks
* Geo provider fallback
* Database constraints
* Indexed tenant queries
* Retry handling for background jobs

---

# Acceptance checks

Before submission, verify:

```bash
npm test
docker compose up --build
```

Then manually confirm:

1. A tenant can create, list, update, and delete its own widgets.
2. One tenant cannot access another tenant's widgets or submissions.
3. The embed script loads from a second origin.
4. A valid lead submission is stored successfully.
5. Invalid and oversized requests are rejected.
6. Rate limiting returns HTTP 429.
7. Honeypot spam is rejected.
8. Idempotent requests do not create duplicate submissions.
9. Dashboard endpoints expose only the authenticated tenant's data.
10. Geo provider failure does not prevent submission storage.

---

# Documentation

Additional project documentation:

* `EVIDENCE.md` — evidence collected while validating the requirements
* `BUILDLOG.md` — implementation decisions and development notes
* `capstone.yaml` — capstone submission metadata

---

# Development notes

The application separates responsibilities across:

* HTTP routing
* Validation and business services
* Repository access
* PostgreSQL persistence
* Geolocation providers
* Background job processing

This structure was chosen to keep the system testable and to make external provider failures non-blocking for the core submission workflow.
