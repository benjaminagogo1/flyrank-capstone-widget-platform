const crypto = require("crypto");
const { state } = require("./store");
const postgres = require("./postgres");

const users = new Map([
["demo-token", { id: "tenant-demo" }],
["tenant-b-token", { id: "tenant-b" }],
]);

const limits = new Map();

function userFromRequest(req) {
const authorization = req.headers.authorization || "";
const token = authorization.replace(/^Bearer\s+/i, "");

return users.get(token);
}

function validateWidget(body) {
if (
!body ||
typeof body.title !== "string" ||
!body.title.trim() ||
body.title.length > 200
) {
return "title is required and must be <= 200 characters";
}

if (
body.description !== undefined &&
typeof body.description !== "string"
) {
return "description must be a string";
}

if (
body.fields !== undefined &&
(!Array.isArray(body.fields) || body.fields.length > 20)
) {
return "fields must be an array of at most 20 items";
}

return null;
}

function createWidget(body, user) {
const widget = {
id: crypto.randomUUID(),
tenantId: user.id,
type: body.type || "signup",
title: body.title.trim(),
description: body.description || "",
buttonText: body.buttonText || "Submit",
fields: body.fields || ["email"],
};

state.widgets[widget.id] = widget;

// persist();

return widget;
}

async function geo() {
if (process.env.GEO_DOWN === "both") {
return null;
}

if (process.env.GEO_DOWN === "primary") {
return {
provider: "ipapi.co",
country: "Fallback",
city: "Development",
};
}

return {
provider: "ip-api.com",
country: "Local",
city: "Development",
};
}

function allowedSubmission(ip, widgetId) {
const key = `${ip}:${widgetId}`;
const now = Date.now();

const recent = (limits.get(key) || []).filter(
(timestamp) => now - timestamp < 60000
);

if (recent.length >= 5) {
return false;
}

limits.set(key, [...recent, now]);

return true;
}

function reset() {
for (const key of Object.keys(state.widgets)) {
delete state.widgets[key];
}

state.submissions.length = 0;

state.idempotency = {};

limits.clear();

// persist();
}

async function submit(body, req) {
if (!state.idempotency) {
state.idempotency = {};
}

if (
!body ||
!body.widgetId ||
!body.data ||
typeof body.data !== "object" ||
Array.isArray(body.data)
) {
return {
httpStatus: 400,
error: "widgetId and data are required",
};
}

const widget = state.widgets[body.widgetId];

if (!widget) {
return {
httpStatus: 404,
error: "Widget not found",
};
}

if (body.data.website) {
return {
httpStatus: 400,
error: "Spam detected",
};
}

const email = body.data.email;

if (
typeof email !== "string" ||
!/^[^@\s]+@[^@\s]+.[^@\s]+$/.test(email)
) {
return {
httpStatus: 400,
error: "Valid email is required",
};
}

const ip = req.socket.remoteAddress || "unknown";

if (!allowedSubmission(ip, widget.id)) {
return {
httpStatus: 429,
error: "Rate limit exceeded",
};
}

const idempotencyKey = req.headers["idempotency-key"];

if (
idempotencyKey &&
state.idempotency[`${widget.id}:${idempotencyKey}`]
) {
return {
httpStatus: 200,
...state.idempotency[
`${widget.id}:${idempotencyKey}`
],
idempotent: true,
};
}

const submission = {
id: crypto.randomUUID(),
widgetId: widget.id,
tenantId: widget.tenantId,
data: body.data,
ip,
geo: await geo(),
createdAt: new Date().toISOString(),
};

state.submissions.push(submission);

const result = {
id: submission.id,
status: "accepted",
geo: submission.geo,
};

if (idempotencyKey) {
state.idempotency[
`${widget.id}:${idempotencyKey}`
] = result;
}

// persist();

if (postgres.enabled()) {
postgres
.insertSubmission(submission)
.catch((error) => {
console.error(
"postgres persistence failed",
error.message
);
});
}

setImmediate(() => {
if (process.env.SIDE_EFFECT_DOWN === "1") {
console.error(
"notification failed",
submission.id
);
} else {
console.log(
"notification",
submission.id
);
}
});

return {
httpStatus: 201,
...result,
};
}

module.exports = {
state,
users,
userFromRequest,
validateWidget,
createWidget,
submit,
reset,
};
