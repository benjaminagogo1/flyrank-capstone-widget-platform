const http = require("http");
const { URL } = require("url");

const postgres =
  require("./src/postgres");

const widgetRepository =
  require("./src/repositories/widget_repository");

const submissionRepository =
  require("./src/repositories/submission_repository");

const {
  userFromRequest,
  createWidget,
  updateWidget,
  submit
} = require("./src/services");

const PORT =
  Number(process.env.PORT || 3000);

const VERSION = "v1";

const MAX_BODY_BYTES = 10_000;

function json(
  response,
  status,
  body,
  headers = {}
) {
  response.writeHead(status, {
    "Content-Type":
      "application/json; charset=utf-8",
    ...headers
  });

  response.end(
    JSON.stringify(body)
  );
}

function readBody(request) {
  return new Promise(
    (resolve, reject) => {
      let chunks = [];
      let size = 0;
      let finished = false;

      request.on(
        "data",
        chunk => {
          if (finished) return;

          size += chunk.length;

          if (
            size > MAX_BODY_BYTES
          ) {
            finished = true;

            reject(
              Object.assign(
                new Error(
                  "Payload too large"
                ),
                {
                  status: 413
                }
              )
            );

            request.resume();
            return;
          }

          chunks.push(chunk);
        }
      );

      request.on(
        "end",
        () => {
          if (finished) return;

          const text =
            Buffer.concat(
              chunks
            ).toString("utf8");

          if (!text) {
            resolve({});
            return;
          }

          try {
            resolve(
              JSON.parse(text)
            );
          } catch {
            reject(
              Object.assign(
                new Error(
                  "Invalid JSON"
                ),
                {
                  status: 400
                }
              )
            );
          }
        }
      );

      request.on(
        "error",
        reject
      );
    }
  );
}

function globalAllowedOrigins() {
  return (
    process.env.ALLOWED_ORIGINS ||
    "http://localhost:4000,http://127.0.0.1:4000"
  )
    .split(",")
    .map(value =>
      value.trim()
    )
    .filter(Boolean);
}

function isOriginAllowed(
  origin,
  widget = null
) {
  if (!origin) return false;

  if (
    widget &&
    widget.allowedOrigins &&
    widget.allowedOrigins.length > 0
  ) {
    return widget.allowedOrigins.includes(
      origin
    );
  }

  return globalAllowedOrigins().includes(
    origin
  );
}

function applyCors(
  response,
  origin,
  widget
) {
  if (
    isOriginAllowed(
      origin,
      widget
    )
  ) {
    response.setHeader(
      "Access-Control-Allow-Origin",
      origin
    );

    response.setHeader(
      "Vary",
      "Origin"
    );
  }

  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key"
  );

  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
}

function authenticate(
  request,
  response
) {
  const user =
    userFromRequest(request);

  if (!user) {
    json(
      response,
      401,
      {
        error: "Unauthorized"
      }
    );

    return null;
  }

  return user;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function widgetScript(
  id,
  origin
) {
  return `
(async function () {
  const root = document.getElementById("widget");

  if (!root) {
    console.error("Widget root element #widget not found");
    return;
  }

  try {
    const configResponse =
      await fetch(
        "${origin}/widgets/${id}/config"
      );

    if (!configResponse.ok) {
      throw new Error(
        "Unable to load widget configuration"
      );
    }

    const config =
      await configResponse.json();

    const wrapper =
      document.createElement("div");

    const title =
      document.createElement("h3");

    title.textContent =
      config.title;

    wrapper.appendChild(title);

    if (config.description) {
      const description =
        document.createElement("p");

      description.textContent =
        config.description;

      wrapper.appendChild(
        description
      );
    }

    const form =
      document.createElement("form");

    for (
      const field of config.fields
    ) {
      const input =
        document.createElement(
          "input"
        );

      input.name =
        field.name;

      input.type =
        field.type ||
        "text";

      input.placeholder =
        field.label ||
        field.name;

      input.required =
        Boolean(field.required);

      form.appendChild(input);
    }

    const honeypot =
      document.createElement(
        "input"
      );

    honeypot.name =
      "website";

    honeypot.type =
      "text";

    honeypot.autocomplete =
      "off";

    honeypot.tabIndex =
      -1;

    honeypot.setAttribute(
      "aria-hidden",
      "true"
    );

    honeypot.style.display =
      "none";

    form.appendChild(
      honeypot
    );

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "submit";

    button.textContent =
      config.buttonText;

    form.appendChild(
      button
    );

    form.addEventListener(
      "submit",
      async function (event) {
        event.preventDefault();

        const data =
          Object.fromEntries(
            new FormData(form)
          );

        try {
          const response =
            await fetch(
              "${origin}/submissions",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body: JSON.stringify({
                  widgetId: config.id,
                  data
                })
              }
            );

          if (!response.ok) {
            throw new Error(
              "Submission failed"
            );
          }

          form.innerHTML =
            "<strong>Thanks! Your submission was received.</strong>";
        } catch (error) {
          form.innerHTML =
            "<strong>Unable to submit. Please try again.</strong>";
        }
      }
    );

    wrapper.appendChild(
      form
    );

    root.replaceChildren(
      wrapper
    );
  } catch (error) {
    root.textContent =
      "Widget unavailable";
  }
})();
`;
}

async function handler(
  request,
  response
) {
  try {
    const url =
      new URL(
        request.url,
        `http://${request.headers.host || "localhost"}`
      );

    const path =
      url.pathname;

    if (
      path === "/health"
    ) {
      return json(
        response,
        200,
        {
          ok: true,
          postgres:
            postgres.enabled()
              ? await postgres.health()
              : false
        }
      );
    }

    if (
      request.method === "OPTIONS"
    ) {
      const widgetId =
        url.searchParams.get(
          "widgetId"
        );

      const widget =
        widgetId
          ? await widgetRepository
            .findById(widgetId)
          : null;

      applyCors(
        response,
        request.headers.origin,
        widget
      );

      return response
        .writeHead(204)
        .end();
    }

    if (
      path === "/widget-v1.js" ||
      path === "/widget.js"
    ) {
      const id =
        url.searchParams.get(
          "id"
        );

      const origin =
        `http://${request.headers.host || `localhost:${PORT}`}`;

      response.writeHead(
        200,
        {
          "Content-Type":
            "application/javascript; charset=utf-8",

          "Cache-Control":
            "public, max-age=31536000, immutable"
        }
      );

      return response.end(
        widgetScript(
          id,
          origin
        )
      );
    }

    if (
      path === "/customer.html"
    ) {
      const id =
        url.searchParams.get(
          "id"
        ) || "";

      response.writeHead(
        200,
        {
          "Content-Type":
            "text/html; charset=utf-8"
        }
      );

      return response.end(
        `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Customer Site</title>
</head>
<body>
  <h1>Customer Website</h1>
  <main id="widget"></main>
  <script src="/widget-v1.js?id=${escapeHtml(id)}"></script>
</body>
</html>
`
      );
    }

    const configMatch = path.match(
      /^\/widgets\/([^/]+)\/config$/
    );
    if (
      configMatch &&
      request.method === "GET"
    ) {
      const widget =
        await widgetRepository
          .findById(
            configMatch[1]
          );

      if (!widget) {
        return json(
          response,
          404,
          {
            error:
              "Widget not found"
          }
        );
      }

      applyCors(
        response,
        request.headers.origin,
        widget
      );

      return json(
        response,
        200,
        {
          id: widget.id,
          type: widget.type,
          title: widget.title,
          description:
            widget.description,
          buttonText:
            widget.buttonText,
          fields:
            widget.fields
        },
        {
          "Cache-Control":
            "public, max-age=60"
        }
      );
    }

    if (
      path === "/widgets" &&
      request.method === "GET"
    ) {
      const user =
        authenticate(
          request,
          response
        );

      if (!user) return;

      const widgets =
        await widgetRepository
          .listByTenant(
            user.id
          );

      return json(
        response,
        200,
        widgets
      );
    }

    if (
      path === "/widgets" &&
      request.method === "POST"
    ) {
      const user =
        authenticate(
          request,
          response
        );

      if (!user) return;

      const body =
        await readBody(
          request
        );

      const widget =
        await createWidget(
          body,
          user
        );

      return json(
        response,
        201,
        {
          ...widget,
          snippet:
            `<script src="http://localhost:${PORT}/widget-${VERSION}.js?id=${widget.id}"></script>`
        }
      );
    }

    const widgetMatch = path.match(
      /^\/widgets\/([^/]+)$/
    );
    if (widgetMatch) {
      const user =
        authenticate(
          request,
          response
        );

      if (!user) return;

      const id =
        widgetMatch[1];

      if (
        request.method === "GET"
      ) {
        const widget =
          await widgetRepository
            .findById(id);

        if (
          !widget ||
          widget.tenantId !== user.id
        ) {
          return json(
            response,
            404,
            {
              error:
                "Widget not found"
            }
          );
        }

        return json(
          response,
          200,
          widget
        );
      }

      if (
        request.method === "PUT"
      ) {
        const body =
          await readBody(
            request
          );

        const widget =
          await updateWidget(
            id,
            user.id,
            body
          );

        if (!widget) {
          return json(
            response,
            404,
            {
              error:
                "Widget not found"
            }
          );
        }

        return json(
          response,
          200,
          widget
        );
      }

      if (
        request.method === "DELETE"
      ) {
        const deleted =
          await widgetRepository
            .remove(
              id,
              user.id
            );

        if (!deleted) {
          return json(
            response,
            404,
            {
              error:
                "Widget not found"
            }
          );
        }

        return response
          .writeHead(204)
          .end();
      }
    }

    if (
      path === "/submissions" &&
      request.method === "POST"
    ) {
      const body =
        await readBody(
          request
        );

      const widget =
        await widgetRepository
          .findById(
            body?.widgetId
          );

      applyCors(
        response,
        request.headers.origin,
        widget
      );

      const result =
        await submit(
          body,
          request
        );

      const {
        httpStatus,
        ...payload
      } = result;

      return json(
        response,
        httpStatus,
        payload
      );
    }

    if (
      path ===
        "/dashboard/submissions" &&
      request.method === "GET"
    ) {
      const user =
        authenticate(
          request,
          response
        );

      if (!user) return;

      const submissions =
        await submissionRepository
          .listByTenant(
            user.id
          );

      return json(
        response,
        200,
        submissions
      );
    }

    if (
      path ===
        "/dashboard/stats" &&
      request.method === "GET"
    ) {
      const user =
        authenticate(
          request,
          response
        );

      if (!user) return;

      const stats =
        await submissionRepository
          .statsByTenant(
            user.id
          );

      return json(
        response,
        200,
        stats
      );
    }

    return json(
      response,
      404,
      {
        error:
          "Not found"
      }
    );
  } catch (error) {
    console.error(
      "request failed:",
      error
    );

    return json(
      response,
      error.status || 500,
      {
        error:
          error.status
            ? error.message
            : "Internal server error"
      }
    );
  }
}

if (
  require.main === module
) {
  http
    .createServer(
      handler
    )
    .listen(
      PORT,
      () => {
        console.log(
          `Widget platform listening on http://localhost:${PORT}`
        );
      }
    );
}

module.exports = {
  handler
};