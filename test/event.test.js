const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../src/app");

test("POST /events should reject request without signature", async () => {
  const response = await request(app)
    .post("/events")
    .send({
      eventId: "test-signature-missing",
      eventType: "assignment.created",
      sourceService: "Assignment",
      userId: "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
      title: "Test assignment",
      message: "Test message",
    })
    .expect(401);

  assert.strictEqual(response.body.error, "Missing event signature");
});

test("POST /events should accept a valid signed event", async () => {
  const crypto = require("crypto");

  const eventId = `test-automated-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId: "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
    title: "Automated test assignment",
    message: "This event was created by an automated test.",
    severity: "low",
  };

  const secret = process.env.EVENT_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  const response = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(201);

  assert.strictEqual(response.body.status, "accepted");
  assert.ok(response.body.eventReceiptId);
  assert.ok(response.body.notificationId);
  assert.ok(Array.isArray(response.body.deliveries));
});

test("POST /events should reject duplicate eventId", async () => {
  const crypto = require("crypto");

  const eventId = `test-duplicate-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId: "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
    title: "Duplicate test assignment",
    message: "This event tests deduplication.",
    severity: "low",
  };

  const secret = process.env.EVENT_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  // First request should be accepted
  const firstResponse = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(201);

  assert.strictEqual(firstResponse.body.status, "accepted");

  // Second request with the same eventId should be duplicate
  const secondResponse = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(200);

  assert.strictEqual(secondResponse.body.status, "duplicate");
  assert.strictEqual(
    secondResponse.body.eventId,
    eventId
  );
});