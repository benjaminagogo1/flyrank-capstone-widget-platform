const test = require("node:test"),
  assert = require("node:assert/strict"),
  http = require("node:http");
const { state, handler } = require("./server");
const { reset } = require("./src/services");
let s, base, wid;
function req(path, o = {}) {
  return new Promise((ok, no) => {
    const q = http.request(base + path, o, (r) => {
      let b = "";
      r.on("data", (c) => (b += c));
      r.on("end", () =>
        ok({
          status: r.statusCode,
          headers: r.headers,
          json: () => JSON.parse(b || "{}"),
        }),
      );
    });
    q.on("error", no);
    if (o.body) q.write(o.body);
    q.end();
  });
}
const post = (p, d, h = {}) =>
  req(p, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...h },
    body: JSON.stringify(d),
  });
test.before(async () => {
  reset();
  s = http.createServer(handler);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${s.address().port}`;
});
test.after(() => s.close());
test("widget CRUD, cache and tenant isolation", async () => {
  assert.equal((await req("/widgets")).status, 401);
  let r = await post(
    "/widgets",
    { title: "Join" },
    { Authorization: "Bearer demo-token" },
  );
  assert.equal(r.status, 201);
  wid = r.json().id;
  assert.equal(
    (
      await req(`/widgets/${wid}`, {
        headers: { Authorization: "Bearer tenant-b-token" },
      })
    ).status,
    404,
  );
  r = await req(`/widgets/${wid}/config`, {
    headers: { Origin: "https://customer.example" },
  });
  assert.equal(r.status, 200);
  assert.match(r.headers["cache-control"], /max-age=60/);
  r = await req(`/widget-v1.js?id=${wid}`);
  assert.match(r.headers["cache-control"], /immutable/);
});
test("validation, CORS, spam and oversized payload", async () => {
  assert.equal(
    (
      await req("/submissions", {
        method: "OPTIONS",
        headers: { Origin: "https://x" },
      })
    ).status,
    204,
  );
  assert.equal(
    (await post("/submissions", { widgetId: wid, data: { email: "bad" } }))
      .status,
    400,
  );
  assert.equal(
    (
      await post("/submissions", {
        widgetId: wid,
        data: { email: "a@example.com", website: "bot" },
      })
    ).status,
    400,
  );
  const huge = "x".repeat(11000);
  assert.equal(
    (
      await post("/submissions", {
        widgetId: wid,
        data: { email: "a@example.com", huge },
      })
    ).status,
    413,
  );
});
test("submission fallback, idempotency and dashboard", async () => {
  let r = await post(
    "/submissions",
    { widgetId: wid, data: { email: "a@example.com" } },
    { "Idempotency-Key": "one" },
  );
  assert.equal(r.status, 201);
  const id = r.json().id;
  r = await post(
    "/submissions",
    { widgetId: wid, data: { email: "a@example.com" } },
    { "Idempotency-Key": "one" },
  );
  assert.equal(r.json().id, id);
  process.env.GEO_DOWN = "both";
  assert.equal(
    (
      await post("/submissions", {
        widgetId: wid,
        data: { email: "b@example.com" },
      })
    ).status,
    201,
  );
  delete process.env.GEO_DOWN;
  r = await req("/dashboard/stats", {
    headers: { Authorization: "Bearer demo-token" },
  });
  assert.equal(r.json().total, 2);
});
