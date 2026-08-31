# Embeddable Widget & Lead-Capture Platform

Run with `npm start` (Node 22+), then open `http://localhost:3000/customer.html?id=WIDGET_ID` after creating a widget. A Docker Compose file and PostgreSQL migration are included for the production persistence path; the zero-dependency demo defaults to the file-backed adapter.

Architecture:

```text
Owner --Bearer auth--> widget CRUD --> in-memory store
Customer site --widget-v1.js--> cached config --> public submissions
Visitor --> validation/honeypot/rate limit --> geo fallback --> dashboard
```

The implementation is split into an HTTP layer (`server.js`), domain services
(`src/services.js`), and a durable file-backed store (`src/store.js`). The store
is intentionally dependency-free for the capstone demo and can be replaced by
PostgreSQL behind the same service boundary. Submissions support an
`Idempotency-Key`, and notification work runs asynchronously so failures never
break the accepted submission.

The service provides authenticated widget CRUD (`Bearer demo-token`), a cacheable public config endpoint, a versioned-style widget script, CORS-enabled submissions, validation, honeypot spam protection, per-IP/widget rate limiting, geo-provider fallback simulation, non-blocking notifications, and owner dashboard stats. Data is intentionally in memory for a zero-dependency demo.

Create a widget:

```sh
curl -X POST http://localhost:3000/widgets -H 'Authorization: Bearer demo-token' -H 'Content-Type: application/json' -d '{"title":"Join us","description":"Get updates","buttonText":"Sign up"}'
```

Use the returned `snippet`, or visit `/customer.html?id=WIDGET_ID`. Submit with `{ "widgetId": "...", "data": {"email":"you@example.com","name":"You"} }`. Set `GEO_DOWN=primary` or `both` to demonstrate fallback/degradation. Run `npm test` for automated acceptance coverage.

API: authenticated `GET/POST /widgets`, authenticated `GET/PUT/DELETE /widgets/:id`, public `GET /widgets/:id/config`, public `POST /submissions`, and authenticated dashboard endpoints `/dashboard/submissions` and `/dashboard/stats`.

## Limitations

The demo uses file-backed JSON persistence, demo bearer tokens, and simulated geo providers. Replace these with PostgreSQL migrations, real identity, and provider clients before production use.
