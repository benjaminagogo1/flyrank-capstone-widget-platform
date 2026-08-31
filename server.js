const http = require("http");
const { URL } = require("url");
const {
  state,
  userFromRequest,
  validateWidget,
  createWidget,
  submit,
} = require("./src/services");
const PORT = Number(process.env.PORT || 3000),
  V = "v1";
const json = (r, s, b, h = {}) => {
  r.writeHead(s, { "Content-Type": "application/json", ...h });
  r.end(JSON.stringify(b));
};
const body = (q) =>
  new Promise((ok, no) => {
    let x = "";
    q.on("data", (c) => {
      x += c;
      if (x.length > 10000)
        no(Object.assign(Error("Payload too large"), { status: 413 }));
    });
    q.on("end", () => {
      try {
        ok(x ? JSON.parse(x) : {});
      } catch {
        no(Object.assign(Error("Invalid JSON"), { status: 400 }));
      }
    });
  });
const cors = (r, o) => {
  if (o) r.setHeader("Access-Control-Allow-Origin", o);
  r.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key",
  );
  r.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
};
const auth = (q, r) => {
  const u = userFromRequest(q);
  if (!u) {
    json(r, 401, { error: "Unauthorized" });
    return null;
  }
  return u;
};
function script(id, origin) {
  return `(async()=>{const c=await fetch('${origin}/widgets/${id}/config').then(r=>r.json());const d=document.createElement('div');d.innerHTML='<h3>'+c.title+'</h3><p>'+c.description+'</p><form><input name="email" type="email" required><input name="name" required><input name="website" style="display:none"><button>'+c.buttonText+'</button></form>';document.getElementById('widget').append(d);d.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const r=await fetch('${origin}/submissions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({widgetId:'${id}',data:Object.fromEntries(f)})});e.target.innerHTML=r.ok?'<b>Thanks!</b>':'<b>Unable to submit</b>'}})()`;
}
function handler(q, r) {
  const u = new URL(q.url, `http://${q.headers.host || "localhost"}`),
    p = u.pathname;
  cors(r, q.headers.origin);
  if (q.method === "OPTIONS") return r.writeHead(204).end();
  if (p === "/health") return json(r, 200, { ok: true });
  if (p === "/customer.html") {
    r.writeHead(200, { "Content-Type": "text/html" });
    return r.end(
      `<!doctype html><main id="widget"></main><script src="/widget-v1.js?id=${u.searchParams.get("id") || ""}"></script>`,
    );
  }
  if (p === `/widget-${V}.js` || p === "/widget.js") {
    r.writeHead(200, {
      "Content-Type": "application/javascript",
      "Cache-Control": "public,max-age=31536000,immutable",
    });
    return r.end(
      script(
        u.searchParams.get("id"),
        `http://localhost:${q.headers.host || PORT}`,
      ),
    );
  }
  let m = p.match(/^\/widgets\/([^/]+)\/config$/);
  if (m && q.method === "GET") {
    const w = state.widgets[m[1]];
    return w
      ? json(
          r,
          200,
          {
            id: w.id,
            title: w.title,
            description: w.description,
            buttonText: w.buttonText,
            fields: w.fields,
          },
          { "Cache-Control": "public,max-age=60" },
        )
      : json(r, 404, { error: "Widget not found" });
  }
  if (p === "/widgets" && q.method === "GET") {
    const z = auth(q, r);
    if (!z) return;
    return json(
      r,
      200,
      Object.values(state.widgets).filter((w) => w.tenantId === z.id),
    );
  }
  if (p === "/widgets" && q.method === "POST")
    return body(q)
      .then((b) => {
        const z = auth(q, r);
        if (!z) return;
        const e = validateWidget(b);
        if (e) return json(r, 400, { error: e });
        const w = createWidget(b, z);
        json(r, 201, {
          ...w,
          snippet: `<script src="http://localhost:${PORT}/widget-${V}.js?id=${w.id}"></script>`,
        });
      })
      .catch((e) => json(r, e.status || 400, { error: e.message }));
  m = p.match(/^\/widgets\/([^/]+)$/);
  if (m) {
    const w = state.widgets[m[1]],
      z = auth(q, r);
    if (!z) return;
    if (!w || w.tenantId !== z.id)
      return json(r, 404, { error: "Widget not found" });
    if (q.method === "GET") return json(r, 200, w);
    if (q.method === "PUT")
      return body(q).then((b) => {
        Object.assign(w, b);
        require("./src/store").persist();
        json(r, 200, w);
      });
    if (q.method === "DELETE") {
      delete state.widgets[w.id];
      require("./src/store").persist();
      return r.writeHead(204).end();
    }
  }
  if (p === "/submissions" && q.method === "POST")
    return body(q)
      .then((b) => submit(b, q))
      .then((x) => json(r, x.httpStatus, { ...x, httpStatus: undefined }))
      .catch((e) => json(r, e.status || 400, { error: e.message }));
  if (p === "/dashboard/submissions" && q.method === "GET") {
    const z = auth(q, r);
    if (!z) return;
    return json(
      r,
      200,
      state.submissions.filter((s) => s.tenantId === z.id),
    );
  }
  if (p === "/dashboard/stats" && q.method === "GET") {
    const z = auth(q, r);
    if (!z) return;
    const a = state.submissions.filter((s) => s.tenantId === z.id);
    return json(r, 200, {
      total: a.length,
      perWidget: a.reduce(
        (x, s) => ((x[s.widgetId] = (x[s.widgetId] || 0) + 1), x),
        {},
      ),
      geo: a.reduce((x, s) => {
        const k = s.geo?.country || "unknown";
        x[k] = (x[k] || 0) + 1;
        return x;
      }, {}),
    });
  }
  json(r, 404, { error: "Not found" });
}
if (require.main === module)
  http
    .createServer(handler)
    .listen(PORT, () =>
      console.log(`Widget platform listening on http://localhost:${PORT}`),
    );
module.exports = { state, handler };
const db = {
  widgets: {
    clear() {
      state.widgets = {};
    },
    values() {
      return Object.values(state.widgets);
    },
  },
  submissions: state.submissions,
};
