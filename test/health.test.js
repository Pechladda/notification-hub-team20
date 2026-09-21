const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../src/app");

test("GET /health should return service health", async () => {
  const response = await request(app)
    .get("/health")
    .expect(200);

  assert.strictEqual(response.body.status, "ok");
  assert.strictEqual(response.body.service, "notification-hub");
});