const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../src/app");

const testUserId = "37ae3a0a-8032-4d67-9e65-f1b6cb50687b";

test("POST /api/notifications should reject request with missing fields", async () => {
  const resNoUser = await request(app)
    .post("/api/notifications")
    .send({ title: "Test", message: "Missing user" })
    .expect(400);

  assert.strictEqual(resNoUser.body.error, "userId is required");

  const resNoTitle = await request(app)
    .post("/api/notifications")
    .send({ userId: testUserId, message: "Missing title" })
    .expect(400);

  assert.strictEqual(resNoTitle.body.error, "title is required");

  const resNoMessage = await request(app)
    .post("/api/notifications")
    .send({ userId: testUserId, title: "Missing message" })
    .expect(400);

  assert.strictEqual(resNoMessage.body.error, "message is required");
});

test("POST /api/notifications should create notification directly", async () => {
  const payload = {
    userId: testUserId,
    title: "Internship Application Accepted",
    message: "Congratulations! Your application has been shortlisted.",
    severity: "high",
    metadata: {
      company: "Google",
      role: "Software Engineering Intern",
    },
  };

  const response = await request(app)
    .post("/api/notifications")
    .send(payload)
    .expect(201);

  assert.strictEqual(response.body.status, "created");
  assert.ok(response.body.notification);
  assert.strictEqual(response.body.notification.user_id, testUserId);
  assert.strictEqual(response.body.notification.title, payload.title);
  assert.strictEqual(response.body.notification.message, payload.message);
  assert.strictEqual(response.body.notification.severity, "high");
  assert.ok(Array.isArray(response.body.deliveries));
});
