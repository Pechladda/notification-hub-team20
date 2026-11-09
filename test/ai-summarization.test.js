const test = require("node:test");
const assert = require("node:assert");
const request = require("supertest");

const app = require("../src/app");
const {
  isHighStakes,
  deterministicSummarize,
  deterministicSortNotifications,
} = require("../src/services/ai.service");

test("Unit: isHighStakes should correctly identify high-stakes alerts (BR-05)", () => {
  // Critical severity is always high-stakes
  assert.strictEqual(
    isHighStakes({ category: "general", severity: "critical", title: "Notice", message: "Hello" }),
    true
  );

  // Job Board interview is high-stakes
  assert.strictEqual(
    isHighStakes({
      category: "job_board",
      severity: "medium",
      title: "นัดสัมภาษณ์งานตำแหน่ง Frontend Developer",
      message: "นัดสัมภาษณ์ผ่าน Google Meet",
    }),
    true
  );

  // Approval is high-stakes
  assert.strictEqual(
    isHighStakes({
      category: "internship",
      severity: "high",
      title: "คำขอฝึกงานได้รับการอนุมัติแล้ว",
      message: "เอกสารผ่านการอนุมัติแล้ว",
    }),
    true
  );

  // Low-risk alumni announcement is NOT high-stakes
  assert.strictEqual(
    isHighStakes({
      category: "alumni_network",
      severity: "low",
      title: "Alumni Gathering",
      message: "Join us for casual coffee chat this weekend.",
    }),
    false
  );
});

test("Unit: deterministicSummarize should produce clean, concise summary without hallucination", () => {
  const longText =
    "ยินดีต้อนรับสู่งานเสวนาศิษย์เก่าประจำปี 2026 พบกับวิทยากรผู้ทรงคุณวุฒิมากมายจากองค์กรชั้นนำที่จะมาร่วมแบ่งปันประสบการณ์การทำงานในสายเทคโนโลยี พร้อมเปิดโอกาสให้นักศึกษาได้ซักถามและสร้างเครือข่ายอย่างใกล้ชิดตลอดทั้งวัน";
  const summary = deterministicSummarize({ title: "งานเสวนา", message: longText });

  assert.ok(summary.length <= 120);
  assert.ok(summary.length > 0);
});

test("Unit: deterministicSortNotifications should order by severity -> deadline -> received_at", () => {
  const items = [
    { id: "1", severity: "low", deadline: null, created_at: "2026-11-01T10:00:00Z" },
    { id: "2", severity: "critical", deadline: null, created_at: "2026-11-01T08:00:00Z" },
    { id: "3", severity: "high", deadline: "2026-11-15T00:00:00Z", created_at: "2026-11-01T09:00:00Z" },
    { id: "4", severity: "high", deadline: "2026-11-10T00:00:00Z", created_at: "2026-11-01T09:30:00Z" },
    { id: "5", severity: "medium", deadline: null, created_at: "2026-11-01T11:00:00Z" },
  ];

  const sorted = deterministicSortNotifications(items);

  // 1st: Critical (id: 2)
  assert.strictEqual(sorted[0].id, "2");
  // 2nd: High with nearer deadline (id: 4 -> 2026-11-10)
  assert.strictEqual(sorted[1].id, "4");
  // 3rd: High with further deadline (id: 3 -> 2026-11-15)
  assert.strictEqual(sorted[2].id, "3");
  // 4th: Medium (id: 5)
  assert.strictEqual(sorted[3].id, "5");
  // 5th: Low (id: 1)
  assert.strictEqual(sorted[4].id, "1");
});

test("POST /api/notifications/ai-summarize should protect high-stakes alerts under BR-05 with verbatim fallback", async () => {
  const payload = {
    title: "นัดสัมภาษณ์งานตำแหน่ง Frontend Engineer",
    message: "บริษัท LINE MAN Wongnai ได้ทำการนัดหมายสัมภาษณ์รอบแรก วันพรุ่งนี้ เวลา 10:00 - 11:30 น. ผ่าน Google Meet",
    category: "job_board",
    severity: "critical",
  };

  const response = await request(app)
    .post("/api/notifications/ai-summarize")
    .send(payload)
    .expect(200);

  assert.strictEqual(response.body.status, "success");
  assert.strictEqual(response.body.flow, "deterministic_fallback");
  assert.strictEqual(response.body.ai_applied, false);
  assert.ok(response.body.fallback_reason.includes("BR-05"));
  // Must preserve exact verbatim text
  assert.strictEqual(response.body.summary, payload.message);
});

test("POST /api/notifications/ai-summarize should use deterministic fallback for low-risk alert when AI is unconfigured", async () => {
  const payload = {
    title: "Alumni Career Tips Webinar",
    message: "Join senior engineers from Google and Grab this Saturday at 2 PM to learn practical tips on crafting an impactful junior engineer resume and acing technical interviews.",
    category: "alumni_network",
    severity: "low",
  };

  const response = await request(app)
    .post("/api/notifications/ai-summarize")
    .send(payload)
    .expect(200);

  assert.strictEqual(response.body.status, "success");
  assert.ok(response.body.summary.length > 0);
  assert.strictEqual(response.body.category, "alumni_network");
});

test("POST /api/notifications/deterministic-sort should return sorted notification list", async () => {
  const notifications = [
    { id: "a", severity: "low", created_at: "2026-11-01T01:00:00Z" },
    { id: "b", severity: "critical", created_at: "2026-11-01T02:00:00Z" },
  ];

  const response = await request(app)
    .post("/api/notifications/deterministic-sort")
    .send({ notifications })
    .expect(200);

  assert.strictEqual(response.body.status, "success");
  assert.strictEqual(response.body.notifications[0].id, "b");
  assert.strictEqual(response.body.notifications[1].id, "a");
});

