const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../src/app");

const testUserId = "37ae3a0a-8032-4d67-9e65-f1b6cb50687b";

test("POST /api/webhooks/jobboard should accept Job Board webhook event", async () => {
  const eventId = `jb-test-${Date.now()}`;
  const payload = {
    eventId,
    eventType: "job.application.updated",
    userId: testUserId,
    title: "Job Application Update",
    message: "Your application for Senior Frontend Dev was reviewed.",
    severity: "medium",
    data: {
      jobId: "job-101",
      company: "Acme Corp",
      status: "interview_scheduled",
    },
  };

  const response = await request(app)
    .post("/api/webhooks/jobboard")
    .send(payload)
    .expect(201);

  assert.strictEqual(response.body.status, "accepted");
  assert.strictEqual(response.body.service, "JobBoard");
  assert.ok(response.body.eventReceiptId);
  assert.ok(response.body.notificationId);
  assert.strictEqual(response.body.notification.title, payload.title);
  assert.strictEqual(response.body.notification.message, payload.message);
});

test("POST /api/webhooks/jobboard should detect duplicate eventId", async () => {
  const duplicateId = `jb-dup-${Date.now()}`;
  const payload = {
    eventId: duplicateId,
    eventType: "job.application.status",
    userId: testUserId,
    title: "Duplicate Check",
    message: "Checking duplicate prevention",
  };

  // First request
  const res1 = await request(app)
    .post("/api/webhooks/jobboard")
    .send(payload)
    .expect(201);

  assert.strictEqual(res1.body.status, "accepted");

  // Second request
  const res2 = await request(app)
    .post("/api/webhooks/jobboard")
    .send(payload)
    .expect(200);

  assert.strictEqual(res2.body.status, "duplicate");
  assert.strictEqual(res2.body.eventId, duplicateId);
});

test("POST /api/webhooks/:service should support other partner services (e.g. internship)", async () => {
  const payload = {
    userId: testUserId,
    title: "Internship Log Approved",
    message: "Your mentor approved your weekly internship log.",
    priority: "normal",
  };

  const response = await request(app)
    .post("/api/webhooks/internship")
    .send(payload)
    .expect(201);

  assert.strictEqual(response.body.status, "accepted");
  assert.strictEqual(response.body.service, "internship");
  assert.ok(response.body.notificationId);
});
