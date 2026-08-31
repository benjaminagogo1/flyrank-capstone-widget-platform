const crypto = require("crypto");

const widgetRepository =
  require("./repositories/widget_repository");

const submissionRepository =
  require("./repositories/submission_repository");

const { enrichIp } =
  require("./geo");

const { enqueue } =
  require("./jobs");

const users = new Map([
  [
    "demo-token",
    {
      id: "tenant-demo",
      email: "demo@example.com"
    }
  ],
  [
    "tenant-b-token",
    {
      id: "tenant-b",
      email: "tenant-b@example.com"
    }
  ]
]);

const limits = new Map();

function userFromRequest(req) {
  const authorization =
    req.headers.authorization || "";

  const token =
    authorization.replace(/^Bearer\s+/i, "");

  return users.get(token) || null;
}

function validateOrigin(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateField(field) {
  if (
    !field ||
    typeof field !== "object"
  ) {
    return "Each field must be an object";
  }

  if (
    typeof field.name !== "string" ||
    !field.name.trim()
  ) {
    return "Each field requires a name";
  }

  if (
    field.type !== undefined &&
    typeof field.type !== "string"
  ) {
    return "Field type must be a string";
  }

  return null;
}

function validateWidget(body, partial = false) {
  if (!body || typeof body !== "object") {
    return "Widget body is required";
  }

  if (
    !partial ||
    Object.prototype.hasOwnProperty.call(body, "title")
  ) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.length > 200
    ) {
      return "title is required and must be <= 200 characters";
    }
  }

  if (
    body.description !== undefined &&
    (
      typeof body.description !== "string" ||
      body.description.length > 2000
    )
  ) {
    return "description must be a string of at most 2000 characters";
  }

  if (
    body.buttonText !== undefined &&
    (
      typeof body.buttonText !== "string" ||
      body.buttonText.length > 100
    )
  ) {
    return "buttonText must be a string of at most 100 characters";
  }

  if (
    body.type !== undefined &&
    !["signup", "contact", "cta", "popover"].includes(
      body.type
    )
  ) {
    return "type must be signup, contact, cta, or popover";
  }

  if (body.fields !== undefined) {
    if (
      !Array.isArray(body.fields) ||
      body.fields.length === 0 ||
      body.fields.length > 20
    ) {
      return "fields must contain between 1 and 20 fields";
    }

    for (const field of body.fields) {
      const error = validateField(field);

      if (error) return error;
    }
  }

  if (body.allowedOrigins !== undefined) {
    if (
      !Array.isArray(body.allowedOrigins) ||
      body.allowedOrigins.length > 50
    ) {
      return "allowedOrigins must be an array of at most 50 origins";
    }

    if (
      body.allowedOrigins.some(
        origin =>
          typeof origin !== "string" ||
          !validateOrigin(origin)
      )
    ) {
      return "allowedOrigins must contain valid origins";
    }
  }

  return null;
}

function normalizeWidgetInput(body, current = null) {
  return {
    type:
      body.type ??
      current?.type ??
      "signup",

    title:
      body.title?.trim() ??
      current?.title,

    description:
      body.description ??
      current?.description ??
      "",

    buttonText:
      body.buttonText ??
      current?.buttonText ??
      "Submit",

    fields:
      body.fields ??
      current?.fields ??
      [
        {
          name: "email",
          label: "Email",
          type: "email",
          required: true
        }
      ],

    allowedOrigins:
      body.allowedOrigins ??
      current?.allowedOrigins ??
      []
  };
}

function allowedSubmission(ip, widgetId) {
  const windowMs = Number(
    process.env.RATE_LIMIT_WINDOW_MS || 60000
  );

  const max = Number(
    process.env.RATE_LIMIT_MAX || 5
  );

  const key = `${ip}:${widgetId}`;
  const now = Date.now();

  const recent = (
    limits.get(key) || []
  ).filter(
    timestamp =>
      now - timestamp < windowMs
  );

  if (recent.length >= max) {
    limits.set(key, recent);
    return false;
  }

  recent.push(now);
  limits.set(key, recent);

  return true;
}

function validateSubmission(body, widget) {
  if (
    !body ||
    typeof body !== "object"
  ) {
    return "Request body is required";
  }

  if (
    !body.widgetId ||
    typeof body.widgetId !== "string"
  ) {
    return "widgetId is required";
  }

  if (
    !body.data ||
    typeof body.data !== "object" ||
    Array.isArray(body.data)
  ) {
    return "data must be an object";
  }

  if (body.data.website) {
    return "Spam detected";
  }

  for (const field of widget.fields) {
    if (!field.required) continue;

    const value =
      body.data[field.name];

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {
      return `${field.name} is required`;
    }
  }

  if (
    body.data.email !== undefined
  ) {
    const email = body.data.email;

    if (
      typeof email !== "string" ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(
        email
      )
    ) {
      return "Valid email is required";
    }
  }

  return null;
}

function notificationJob(submission) {
  enqueue({
    name: `submission-notification-${submission.id}`,
    maxAttempts: 3,

    async run() {
      if (
        process.env.SIDE_EFFECT_DOWN === "1"
      ) {
        throw new Error(
          "Notification service unavailable"
        );
      }

      console.log(
        "notification sent:",
        submission.id
      );
    }
  });
}

async function createWidget(body, user) {
  const error =
    validateWidget(body);

  if (error) {
    const failure = new Error(error);
    failure.status = 400;
    throw failure;
  }

  return widgetRepository.create(
    normalizeWidgetInput(body),
    user.id
  );
}

async function updateWidget(
  id,
  tenantId,
  body
) {
  const current =
    await widgetRepository.findById(id);

  if (
    !current ||
    current.tenantId !== tenantId
  ) {
    return null;
  }

  const error =
    validateWidget(body, true);

  if (error) {
    const failure = new Error(error);
    failure.status = 400;
    throw failure;
  }

  return widgetRepository.update(
    id,
    tenantId,
    normalizeWidgetInput(
      body,
      current
    )
  );
}

async function submit(body, req, geoProviders) {
  const widget =
    await widgetRepository.findById(
      body?.widgetId
    );

  if (!widget) {
    return {
      httpStatus: 404,
      error: "Widget not found"
    };
  }

  const validationError =
    validateSubmission(body, widget);

  if (validationError) {
    return {
      httpStatus: 400,
      error: validationError
    };
  }

  const ip =
    (
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      "unknown"
    )
      .toString()
      .split(",")[0]
      .trim();

  if (
    !allowedSubmission(
      ip,
      widget.id
    )
  ) {
    return {
      httpStatus: 429,
      error: "Rate limit exceeded"
    };
  }

  const idempotencyKey =
    req.headers["idempotency-key"];

  if (idempotencyKey) {
    const previous =
      await submissionRepository
        .findByIdempotency(
          widget.id,
          idempotencyKey
        );

    if (previous) {
      return {
        httpStatus: 200,
        id: previous.id,
        status: "accepted",
        geo: previous.geo,
        idempotent: true
      };
    }
  }

  const geo =
    await enrichIp(
      ip,
      geoProviders
    );

  const submission = {
    id: crypto.randomUUID(),
    widgetId: widget.id,
    tenantId: widget.tenantId,
    data: body.data,
    ip,
    geo,
    createdAt:
      new Date().toISOString()
  };

  const stored =
    await submissionRepository.create(
      submission,
      idempotencyKey
    );

  notificationJob(stored);

  return {
    httpStatus: 201,
    id: stored.id,
    status: "accepted",
    geo: stored.geo
  };
}

function resetRateLimits() {
  limits.clear();
}

module.exports = {
  users,
  userFromRequest,
  validateWidget,
  createWidget,
  updateWidget,
  submit,
  allowedSubmission,
  resetRateLimits
};