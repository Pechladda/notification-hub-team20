const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../src/app");

const userId = "37ae3a0a-8032-4d67-9e65-f1b6cb50687b";

test("PATCH /preferences should update notification preferences", async () => {
  const response = await request(app)
    .patch("/preferences")
    .send({
      user_id: userId,
      in_app_enabled: true,
      email_enabled: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "07:00",
    })
    .expect(200);

  assert.strictEqual(response.body.preference.user_id, userId);
  assert.strictEqual(response.body.preference.in_app_enabled, true);
  assert.strictEqual(response.body.preference.email_enabled, false);
  assert.strictEqual(
    response.body.preference.quiet_hours_start,
    "22:00:00"
  );
  assert.strictEqual(
    response.body.preference.quiet_hours_end,
    "07:00:00"
  );
});