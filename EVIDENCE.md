# Capstone Evidence

This document records evidence for the Embeddable Widget & Lead-Capture Platform capstone requirements.

> Important: Evidence should reflect commands and behavior actually observed during development and final verification.

---

# Environment

## Application

Command:

```bash
docker compose up --build
```

Result:

```text
[PENDING: paste actual successful startup output]
```

## Health check

Command:

```bash
curl http://localhost:3000/health
```

Expected result:

```json
{
  "ok": true
}
```

Actual result:

```text
[PENDING: paste actual output]
```

---

# 1. Widget CRUD

## Create widget

Command:

```bash
curl -X POST http://localhost:3000/widgets \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

Actual result:

```text
[PENDING]
```

## List widgets

Command:

```bash
curl http://localhost:3000/widgets \
  -H "Authorization: Bearer demo-token"
```

Actual result:

```text
[PENDING]
```

## Update widget

Command:

```bash
curl -X PUT http://localhost:3000/widgets/WIDGET_ID \
  -H "Authorization: Bearer demo-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Newsletter"
  }'
```

Actual result:

```text
[PENDING]
```

## Delete widget

Command:

```bash
curl -X DELETE http://localhost:3000/widgets/WIDGET_ID \
  -H "Authorization: Bearer demo-token"
```

Actual result:

```text
[PENDING]
```

---

# 2. Tenant isolation

## Attempt to access another tenant's widget

Create a widget using:

```text
Authorization: Bearer tenant-b-token
```

Then attempt access using:

```text
Authorization: Bearer demo-token
```

Command:

```bash
curl http://localhost:3000/widgets/TENANT_B_WIDGET_ID \
  -H "Authorization: Bearer demo-token"
```

Expected result:

```text
HTTP 404
```

Actual result:

```text
[PENDING]
```

## Automated test evidence

Command:

```bash
npm test
```

Relevant test:

```text
tenant cannot access another tenant widget
```

Actual result:

```text
[PENDING]
```

---

# 3. Embed snippet

Create a widget and verify the response includes:

```html
<script src="http://localhost:3000/widget-v1.js?id=WIDGET_ID"></script>
```

Actual result:

```text
[PENDING]
```

---

# 4. Versioned widget delivery and caching

Command:

```bash
curl -I "http://localhost:3000/widget-v1.js?id=test"
```

Expected header:

```text
Cache-Control: public, max-age=31536000, immutable
```

Actual result:

```text
[PENDING]
```

---

# 5. Public widget configuration

Command:

```bash
curl "http://localhost:3000/widgets/WIDGET_ID/config" \
  -H "Origin: http://localhost:4000"
```

Expected behavior:

* Widget configuration is returned.
* Approved origin receives the appropriate CORS response header.

Actual result:

```text
[PENDING]
```

---

# 6. CORS and preflight

Command:

```bash
curl -i -X OPTIONS \
  http://localhost:3000/submissions \
  -H "Origin: http://localhost:4000" \
  -H "Access-Control-Request-Method: POST"
```

Expected behavior:

```text
HTTP 204
Access-Control-Allow-Origin: http://localhost:4000
```

Actual result:

```text
[PENDING]
```

## Disallowed origin

Command:

```bash
curl -i -X OPTIONS \
  http://localhost:3000/submissions \
  -H "Origin: https://evil.example" \
  -H "Access-Control-Request-Method: POST"
```

Expected behavior:

The server should not reflect the disallowed origin as an approved origin.

Actual result:

```text
[PENDING]
```

---

# 7. Valid submission

Command:

```bash
curl -X POST http://localhost:3000/submissions \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:4000" \
  -d '{
    "widgetId": "WIDGET_ID",
    "data": {
      "name": "Example User",
      "email": "user@example.com",
      "website": ""
    }
  }'
```

Expected result:

```text
HTTP 201
```

Actual result:

```text
[PENDING]
```

---

# 8. Invalid submission

Submit data without a required field.

Expected result:

```text
HTTP 400
```

Actual result:

```text
[PENDING]
```

---

# 9. Oversized payload

Send a request larger than the configured payload limit.

Expected result:

```text
HTTP 413
```

Automated test result:

```text
[PENDING]
```

---

# 10. Rate limiting

Submit requests repeatedly from the same IP address and widget.

Expected result after the configured limit:

```text
HTTP 429
```

Actual result:

```text
[PENDING]
```

---

# 11. Honeypot spam protection

Submit:

```json
{
  "data": {
    "website": "https://spam.example"
  }
}
```

Expected result:

```text
HTTP 400
```

Actual result:

```text
[PENDING]
```

---

# 12. Idempotency

Send the same request twice with:

```text
Idempotency-Key: test-key-123
```

Expected behavior:

* First request: HTTP 201
* Second request: HTTP 200
* Both responses refer to the same submission ID

Actual result:

```text
[PENDING]
```

---

# 13. Geolocation fallback

Verify the fallback behavior using the configured provider failure controls.

Expected behavior:

1. Primary provider succeeds when available.
2. Fallback provider is attempted when the primary provider fails.
3. Submission still succeeds when both providers fail.

Actual result:

```text
[PENDING]
```

---

# 14. Side-effect failure isolation

Configure:

```text
SIDE_EFFECT_DOWN=1
```

Submit a valid lead.

Expected behavior:

* Submission is accepted and stored.
* Notification processing may fail.
* Notification failure does not change the submission success response.

Actual result:

```text
[PENDING]
```

---

# 15. Dashboard isolation

Create a submission for Tenant A.

Request Tenant B dashboard:

```bash
curl http://localhost:3000/dashboard/submissions \
  -H "Authorization: Bearer tenant-b-token"
```

Expected behavior:

Tenant B does not receive Tenant A submissions.

Actual result:

```text
[PENDING]
```

---

# 16. Automated tests

Command:

```bash
npm test
```

Actual final result:

```text
[PENDING: paste the complete summary line from the test runner]
```

---

# Final verification

Before submission:

* [ ] Application starts successfully.
* [ ] Database migration completes successfully.
* [ ] Seed command completes successfully.
* [ ] All automated tests pass.
* [ ] Widget CRUD works.
* [ ] Tenant isolation is demonstrated.
* [ ] Embed script works from a second origin.
* [ ] Valid submissions are stored.
* [ ] Invalid submissions are rejected.
* [ ] Oversized payloads are rejected.
* [ ] Rate limiting is demonstrated.
* [ ] Honeypot spam protection is demonstrated.
* [ ] Geo failure does not block submission storage.
* [ ] Side-effect failure does not block submission storage.
* [ ] Dashboard is tenant-scoped.
* [ ] All evidence above contains real output.
