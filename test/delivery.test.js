const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const request = require("supertest");

const app = require("../src/app");

const userId = "37ae3a0a-8032-4d67-9e65-f1b6cb50687b";

test("POST /events should create only in-app delivery when email is disabled", async () => {
  const eventId = `test-delivery-preference-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId,
    title: "Delivery preference test",
    message: "This event tests delivery preferences.",
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
  assert.ok(response.body.notificationId);

  assert.strictEqual(response.body.deliveries.length, 1);
  assert.strictEqual(
    response.body.deliveries[0].channel,
    "in_app"
  );
  assert.strictEqual(
    response.body.deliveries[0].status,
    "pending"
  );
});

test("GET /deliveries/:id should return delivery details", async () => {
  const eventId = `test-delivery-get-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId,
    title: "Delivery GET test",
    message: "This event tests the delivery endpoint.",
    severity: "low",
  };

  const secret = process.env.EVENT_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  const eventResponse = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(201);

  const deliveryId = eventResponse.body.deliveries[0].id;

  const response = await request(app)
    .get(`/deliveries/${deliveryId}`)
    .expect(200);

  assert.strictEqual(
    response.body.delivery.id,
    deliveryId
  );

  assert.strictEqual(
    response.body.delivery.channel,
    "in_app"
  );

  assert.strictEqual(
    response.body.delivery.status,
    "pending"
  );

  assert.strictEqual(
    response.body.delivery.attempt_count,
    0
  );
});

test("POST /notifications/:id/read should mark notification as read", async () => {
  const eventId = `test-read-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId,
    title: "Read status test",
    message: "This notification tests read status.",
    severity: "low",
  };

  const secret = process.env.EVENT_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  const eventResponse = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(201);

  const notificationId = eventResponse.body.notificationId;

  const response = await request(app)
    .post(`/notifications/${notificationId}/read`)
    .expect(200);

  assert.strictEqual(
    response.body.notification.id,
    notificationId
  );

  assert.ok(
    response.body.notification.read_at
  );
});

test("POST /notifications/:id/retry should retry failed delivery", async () => {
  const eventId = `test-retry-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId,
    title: "Retry test",
    message: "This notification tests retry.",
    severity: "low",
  };

  const secret = process.env.EVENT_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  // Create notification and delivery
  const eventResponse = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(201);

  const notificationId = eventResponse.body.notificationId;
  const deliveryId = eventResponse.body.deliveries[0].id;

  // Simulate delivery failure directly in the database
  const supabase = require("../src/config/supabase");

  const { error: updateError } = await supabase
    .from("deliveries")
    .update({
      status: "failed",
      attempt_count: 1,
      last_error: "Simulated test failure",
    })
    .eq("id", deliveryId);

  assert.ifError(updateError);

  // Retry the failed delivery
  const retryResponse = await request(app)
    .post(`/notifications/${notificationId}/retry`)
    .expect(200);

  assert.strictEqual(
    retryResponse.body.status,
    "retry_queued"
  );

  assert.strictEqual(
    retryResponse.body.notificationId,
    notificationId
  );

  assert.strictEqual(
    retryResponse.body.deliveries.length,
    1
  );

  assert.strictEqual(
    retryResponse.body.deliveries[0].id,
    deliveryId
  );

  assert.strictEqual(
    retryResponse.body.deliveries[0].status,
    "pending"
  );

  assert.strictEqual(
    retryResponse.body.deliveries[0].attempt_count,
    2
  );

  assert.strictEqual(
    retryResponse.body.deliveries[0].last_error,
    null
  );
});

test("DELETE /notifications/:id should delete a notification", async () => {
  const eventId = `test-delete-${Date.now()}`;

  const body = {
    eventId,
    eventType: "assignment.created",
    sourceService: "Assignment",
    userId,
    title: "Delete test",
    message: "This notification tests delete.",
    severity: "low",
  };

  const secret = process.env.EVENT_WEBHOOK_SECRET;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  // Create notification
  const eventResponse = await request(app)
    .post("/events")
    .set("x-event-signature", signature)
    .send(body)
    .expect(201);

  const notificationId = eventResponse.body.notificationId;

  // Delete notification
  const deleteResponse = await request(app)
    .delete(`/notifications/${notificationId}`)
    .expect(200);

  assert.strictEqual(
    deleteResponse.body.status,
    "deleted"
  );

  assert.strictEqual(
    deleteResponse.body.notificationId,
    notificationId
  );

  // Verify notification no longer exists
  const getResponse = await request(app)
    .get(`/deliveries/${eventResponse.body.deliveries[0].id}`)
    .expect(404);

  assert.strictEqual(
    getResponse.body.error,
    "Delivery not found"
  );
});