const test = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const request = require("supertest");

const app = require("../src/app");

test("GET /api/health and GET /health should both return status ok", async () => {
  const res1 = await request(app).get("/api/health").expect(200);
  assert.strictEqual(res1.body.status, "ok");

  const res2 = await request(app).get("/health").expect(200);
  assert.strictEqual(res2.body.status, "ok");
});

test("POST /api/integrations/dispatch-webhook should validate required url", async () => {
  const response = await request(app)
    .post("/api/integrations/dispatch-webhook")
    .send({})
    .expect(400);

  assert.strictEqual(response.body.error, "url is required to dispatch webhook");
});

test("POST /api/integrations/fetch-external should validate required baseUrl", async () => {
  const response = await request(app)
    .post("/api/integrations/fetch-external")
    .send({})
    .expect(400);

  assert.strictEqual(
    response.body.error,
    "baseUrl is required to fetch external data"
  );
});

test("POST /api/integrations/dispatch-webhook should successfully send HTTP request to target", async () => {
  // Start a mock external receiver server
  let receivedPayload = null;
  const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      receivedPayload = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ received: true }));
    });
  });

  await new Promise((resolve) => mockServer.listen(0, resolve));
  const port = mockServer.address().port;
  const targetUrl = `http://127.0.0.1:${port}/webhook-callback`;

  try {
    const payload = {
      event: "notification.delivered",
      notificationId: "12345",
    };

    const response = await request(app)
      .post("/api/integrations/dispatch-webhook")
      .send({
        url: targetUrl,
        payload,
      })
      .expect(200);

    assert.strictEqual(response.body.message, "Webhook dispatched successfully");
    assert.deepStrictEqual(receivedPayload, payload);
  } finally {
    await new Promise((resolve) => mockServer.close(resolve));
  }
});
