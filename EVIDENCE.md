# Evidence

Acceptance proof (run 2026-08-22):

```text
$ npm test
1..3
# tests 3
# pass 3
# fail 0
```

The automated tests cover unauthenticated CRUD rejection, widget creation/snippet generation, cached config, versioned widget rendering, CORS preflight, invalid email, honeypot spam rejection, successful storage, primary-to-fallback geo enrichment, all-provider degradation, dashboard totals, and 429 rate limiting.

Additional acceptance coverage now includes tenant A/B isolation, 413 oversized payload rejection, durable storage, idempotent submission retries, and isolated asynchronous notification failure. In the managed workspace, loopback binding is denied with `listen EPERM`; run `npm test` locally to execute the HTTP acceptance suite.
