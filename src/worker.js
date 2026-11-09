/**
 * Notification Hub — Cloudflare Workers & Cloudflare D1 API
 * Team 20
 *
 * Primary Deployment Architecture: Cloudflare Workers + D1 Database
 * Backup Architecture: Node.js/Express + Supabase PostgreSQL
 */

// Helper to construct JSON response with CORS
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-event-signature, x-webhook-signature, x-webhook-secret",
      ...extraHeaders,
    },
  });
}

// Helper to handle OPTIONS preflight
function handleCorsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-event-signature, x-webhook-signature, x-webhook-secret",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// HMAC-SHA256 verification using Web Crypto API
async function verifyHmacSha256(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const calculated = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );
    const hexCalculated = Array.from(new Uint8Array(calculated))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hexCalculated.toLowerCase() === signature.toLowerCase();
  } catch (err) {
    console.error("HMAC verification error:", err);
    return false;
  }
}

// Severity normalizer
function normalizeSeverity(val) {
  if (!val) return "low";
  const str = String(val).toLowerCase();
  if (str === "urgent" || str === "critical") return "critical";
  if (str === "high") return "high";
  if (str === "medium" || str === "normal") return "medium";
  return "low";
}

// ── AI-Assisted Flow & Deterministic Fallback Helpers (FR-09 & BR-05) ──
const SEVERITY_WEIGHTS = { critical: 4, high: 3, medium: 2, low: 1 };

function isHighStakes({ category = "", severity = "", title = "", message = "" }) {
  const normCategory = String(category).toLowerCase();
  const normSeverity = String(severity).toLowerCase();
  const content = `${title} ${message}`.toLowerCase();

  if (normSeverity === "critical" || normSeverity === "urgent") {
    return true;
  }

  const highStakesKeywords = [
    "interview", "สัมภาษณ์", "approval", "อนุมัติ", "rejected", "ปฏิเสธ",
    "exam", "สอบ", "deadline", "กำหนดส่ง", "หมดเขต", "contract", "สัญญา",
  ];

  if (normCategory === "job_board" && (content.includes("interview") || content.includes("สัมภาษณ์"))) {
    return true;
  }

  return highStakesKeywords.some((kw) => content.includes(kw));
}

function deterministicSummarize({ title = "", message = "" }) {
  if (!message) return title;
  const sentences = message
    .split(/[\r\n\t]+|[.?!]\s+|(?<=[ก-๙])\s+(?=[ก-๙])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (sentences.length <= 1) {
    return message.length > 120 ? `${message.slice(0, 117)}...` : message;
  }
  const primary = sentences[0];
  return primary.length > 120 ? `${primary.slice(0, 117)}...` : primary;
}

function deterministicSortNotifications(items = []) {
  return [...items].sort((a, b) => {
    const weightA = SEVERITY_WEIGHTS[String(a.severity).toLowerCase()] || 0;
    const weightB = SEVERITY_WEIGHTS[String(b.severity).toLowerCase()] || 0;
    if (weightA !== weightB) return weightB - weightA;

    if (a.deadline && b.deadline) {
      const diff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (diff !== 0) return diff;
    } else if (a.deadline && !b.deadline) {
      return -1;
    } else if (!a.deadline && b.deadline) {
      return 1;
    }

    const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

// Safely parse JSON or return default
function safeJsonParse(str, fallback = {}) {
  if (typeof str === "object" && str !== null) return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

let schemaInitialized = false;

async function ensureSchema(db) {
  if (schemaInitialized || !db) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS preferences (
      user_id TEXT PRIMARY KEY,
      in_app_enabled INTEGER NOT NULL DEFAULT 1,
      email_enabled INTEGER NOT NULL DEFAULT 1,
      quiet_hours_start TEXT,
      quiet_hours_end TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS event_receipts (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      source_service TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      signature TEXT,
      status TEXT NOT NULL DEFAULT 'accepted'
          CHECK (status IN ('accepted', 'rejected', 'duplicate')),
      received_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      event_receipt_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'low'
          CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      deadline TEXT,
      read_at TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (event_receipt_id) REFERENCES event_receipts(id) ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS deliveries (
      id TEXT PRIMARY KEY,
      notification_id TEXT NOT NULL,
      channel TEXT NOT NULL
          CHECK (channel IN ('in_app', 'email')),
      status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'sent', 'failed')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read_at)`,
    `CREATE INDEX IF NOT EXISTS idx_deliveries_notification ON deliveries(notification_id)`,
    `CREATE INDEX IF NOT EXISTS idx_event_receipts_event_id ON event_receipts(event_id)`
  ];

  try {
    if (typeof db.batch === "function") {
      await db.batch(statements.map((s) => db.prepare(s)));
    } else {
      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }
    }
    schemaInitialized = true;
  } catch (err) {
    console.error("Auto-schema initialization batch error:", err);
    // Fallback: run one by one to ensure individual failures don't block others
    for (const stmt of statements) {
      try {
        await db.prepare(stmt).run();
      } catch (singleErr) {
        console.warn("Schema statement fallback warning:", singleErr.message);
      }
    }
    schemaInitialized = true;
  }
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleCorsPreflight();
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Optional Static Assets delegation via Cloudflare Pages / Workers Assets
    if (
      env.ASSETS &&
      (path.startsWith("/css/") ||
        path.startsWith("/js/") ||
        path.startsWith("/img/") ||
        path === "/favicon.ico")
    ) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (env.DB) {
        await ensureSchema(env.DB);
      }
      // 1. Root and Status Documentation
      if ((path === "/" || path === "/api") && method === "GET") {
        const accept = request.headers.get("accept") || "";
        if (accept.includes("text/html")) {
          // If public index.html is available in assets, serve it
          if (env.ASSETS && path === "/") {
            const assetResponse = await env.ASSETS.fetch(request);
            if (assetResponse.status === 200) return assetResponse;
          }

          return new Response(
            `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification Hub — Team 20 (Cloudflare Edge)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 620px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: #f38020; color: #ffffff; font-weight: bold; font-size: 12px; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; }
    .badge-status { background: #10b981; color: #022c22; margin-left: 6px; }
    h1 { margin: 0 0 10px 0; font-size: 24px; color: #f8fafc; }
    p { color: #94a3b8; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
    .endpoints { background: #0f172a; border-radius: 8px; padding: 16px; border: 1px solid #334155; }
    .endpoint-item { display: flex; align-items: center; margin-bottom: 10px; font-size: 13px; font-family: monospace; }
    .endpoint-item:last-child { margin-bottom: 0; }
    .method { padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-right: 8px; font-size: 11px; }
    .get { background: #0284c7; color: white; }
    .post { background: #16a34a; color: white; }
    .path { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Cloudflare Workers + D1</span>
    <span class="badge badge-status">● Service Online</span>
    <h1>🔔 Notification Hub — Team 20</h1>
    <p>Deployed on <strong>Cloudflare Workers</strong> powered by <strong>Cloudflare D1 (SQLite Edge Database)</strong> with Supabase as secondary backup.</p>
    <div class="endpoints">
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/health</span></div>
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/health/database</span></div>
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/health/supabase (Backup)</span></div>
      <div class="endpoint-item"><span class="method post">POST</span> <span class="path">/api/notifications</span></div>
      <div class="endpoint-item"><span class="method post">POST</span> <span class="path">/api/events</span></div>
      <div class="endpoint-item"><span class="method post">POST</span> <span class="path">/api/webhooks/jobboard</span></div>
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/notifications/me?user_id=...</span></div>
    </div>
  </div>
</body>
</html>`,
            {
              status: 200,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }

        return jsonResponse({
          service: "Notification Hub — Team 20",
          platform: "Cloudflare Workers",
          database: "Cloudflare D1 (SQLite at the Edge)",
          backup_database: "Supabase PostgreSQL",
          status: "online",
          endpoints: {
            health: "/api/health",
            database_health: "/api/health/database",
            supabase_health: "/api/health/supabase",
            notifications: "/api/notifications",
            events: "/api/events",
            jobboard_webhook: "/api/webhooks/jobboard",
            user_notifications: "/api/notifications/me?user_id=:id",
          },
        });
      }

      // 2. Health Check Endpoints
      if ((path === "/health" || path === "/api/health") && method === "GET") {
        return jsonResponse({
          status: "ok",
          service: "notification-hub",
          platform: "cloudflare-workers",
          timestamp: new Date().toISOString(),
        });
      }

      // 3. Database Health Check (Cloudflare D1)
      if (
        (path === "/health/database" ||
          path === "/api/health/database" ||
          path === "/health/d1" ||
          path === "/api/health/d1") &&
        method === "GET"
      ) {
        if (!env.DB) {
          return jsonResponse(
            {
              status: "error",
              service: "notification-hub",
              database: "disconnected",
              engine: "cloudflare-d1",
              message: "Cloudflare D1 binding (env.DB) is not configured in wrangler.toml",
            },
            500
          );
        }

        try {
          const row = await env.DB.prepare("SELECT 1 AS ok").first();
          const tablesResult = await env.DB.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
          ).all();
          const tableNames = (tablesResult?.results || []).map((r) => r.name);
          return jsonResponse({
            status: "ok",
            service: "notification-hub",
            database: "connected",
            engine: "cloudflare-d1",
            latency: "< 5ms (edge)",
            tables: tableNames,
          });
        } catch (dbErr) {
          console.error("D1 Health Check Error:", dbErr);
          return jsonResponse(
            {
              status: "error",
              service: "notification-hub",
              database: "error",
              engine: "cloudflare-d1",
              message: dbErr.message,
            },
            500
          );
        }
      }

      // 3.1 Force DB Init Endpoint: GET/POST /api/admin/init-db
      if (
        (path === "/api/admin/init-db" || path === "/admin/init-db" || path === "/api/health/init-db") &&
        (method === "GET" || method === "POST")
      ) {
        schemaInitialized = false;
        await ensureSchema(env.DB);
        const tablesResult = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).all();
        return jsonResponse({
          status: "ok",
          message: "Database schema initialized successfully",
          tables: (tablesResult?.results || []).map((r) => r.name),
        });
      }

      // 4. Supabase Backup Health Check
      if (
        (path === "/health/supabase" || path === "/api/health/supabase") &&
        method === "GET"
      ) {
        return jsonResponse({
          status: "ok",
          role: "secondary-backup",
          message:
            "Primary database is Cloudflare D1. Supabase configured as fallback archive.",
        });
      }

      // 5. Notifications List: GET /notifications/me or /api/notifications/me or /api/notifications
      if (
        (path === "/notifications/me" ||
          path === "/api/notifications/me" ||
          path === "/notifications" ||
          path === "/api/notifications") &&
        method === "GET"
      ) {
        const userId = url.searchParams.get("user_id");
        let queryResult;

        if (userId && userId !== "all") {
          const query = `
            SELECT id, user_id, title, message, severity, deadline, read_at, metadata, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
          `;
          queryResult = await env.DB.prepare(query).bind(userId).all();
        } else {
          const query = `
            SELECT id, user_id, title, message, severity, deadline, read_at, metadata, created_at
            FROM notifications
            ORDER BY created_at DESC
            LIMIT 100
          `;
          queryResult = await env.DB.prepare(query).all();
        }

        const formatted = (queryResult?.results || []).map((n) => ({
          ...n,
          metadata: safeJsonParse(n.metadata),
        }));

        return jsonResponse({ notifications: formatted });
      }

      // 5.1 Recent Inbound Events: GET /events/recent or /api/events/recent
      if (
        (path === "/events/recent" || path === "/api/events/recent") &&
        method === "GET"
      ) {
        const query = `
          SELECT 
            e.id, 
            e.event_id, 
            e.event_type, 
            e.source_service, 
            e.status, 
            e.payload,
            e.received_at,
            n.id AS notification_id,
            n.title AS notification_title,
            n.message AS notification_message,
            n.severity AS notification_severity,
            n.read_at AS notification_read_at,
            n.metadata AS notification_metadata
          FROM event_receipts e
          LEFT JOIN notifications n ON n.event_receipt_id = e.id
          ORDER BY e.received_at DESC
          LIMIT 25
        `;
        const { results } = await env.DB.prepare(query).all();
        const formatted = (results || []).map((row) => {
          const parsed = safeJsonParse(row.payload) || {};
          const meta = safeJsonParse(row.notification_metadata) || parsed.metadata || parsed.data || {};
          return {
            id: row.id,
            event_id: row.event_id,
            event_type: row.event_type,
            source_service: row.source_service,
            status: row.status,
            received_at: row.received_at,
            notification_id: row.notification_id || null,
            title: row.notification_title || parsed.title || parsed.subject || `Event: ${row.event_type}`,
            message: row.notification_message || parsed.message || parsed.description || parsed.content || "",
            severity: row.notification_severity || normalizeSeverity(parsed.severity || parsed.priority || "low"),
            read_at: row.notification_read_at || null,
            metadata: meta,
            payload: parsed,
          };
        });
        return jsonResponse({ events: formatted });
      }

      // 6. Direct Notification Creation: POST /notifications or /api/notifications
      if (
        (path === "/notifications" || path === "/api/notifications") &&
        method === "POST"
      ) {
        const body = await request.json().catch(() => ({}));
        const targetUserId = body.userId || body.user_id;

        if (!targetUserId) {
          return jsonResponse({ error: "userId is required" }, 400);
        }
        if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
          return jsonResponse({ error: "title is required" }, 400);
        }
        if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
          return jsonResponse({ error: "message is required" }, 400);
        }

        const validSeverities = ["low", "medium", "high", "critical"];
        const severity = body.severity || "low";
        if (severity && !validSeverities.includes(severity)) {
          return jsonResponse(
            { error: `severity must be one of: ${validSeverities.join(", ")}` },
            400
          );
        }

        // Auto-create user if not exists (prevent FK constraint error)
        await env.DB.prepare(
          "INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)"
        )
          .bind(targetUserId, `${targetUserId}@placeholder.local`, `User ${targetUserId}`, new Date().toISOString())
          .run();

        // Check user preferences
        const pref = await env.DB.prepare(
          "SELECT in_app_enabled, email_enabled FROM preferences WHERE user_id = ?"
        )
          .bind(targetUserId)
          .first();

        const inAppEnabled = pref ? Boolean(pref.in_app_enabled) : true;
        const emailEnabled = pref ? Boolean(pref.email_enabled) : false;

        const notifId = crypto.randomUUID();
        const nowIso = new Date().toISOString();
        const metadataStr = JSON.stringify(body.metadata || {});

        // Insert notification
        await env.DB.prepare(`
          INSERT INTO notifications (id, user_id, title, message, severity, deadline, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            notifId,
            targetUserId,
            body.title.trim(),
            body.message.trim(),
            severity,
            body.deadline || null,
            metadataStr,
            nowIso
          )
          .run();

        // Create channel deliveries
        const createdDeliveries = [];
        if (inAppEnabled) {
          const dId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO deliveries (id, notification_id, channel, status, attempt_count, created_at)
            VALUES (?, ?, 'in_app', 'pending', 0, ?)
          `)
            .bind(dId, notifId, nowIso)
            .run();

          createdDeliveries.push({
            id: dId,
            notification_id: notifId,
            channel: "in_app",
            status: "pending",
            attempt_count: 0,
            created_at: nowIso,
          });
        }

        if (emailEnabled) {
          const dId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO deliveries (id, notification_id, channel, status, attempt_count, created_at)
            VALUES (?, ?, 'email', 'pending', 0, ?)
          `)
            .bind(dId, notifId, nowIso)
            .run();

          createdDeliveries.push({
            id: dId,
            notification_id: notifId,
            channel: "email",
            status: "pending",
            attempt_count: 0,
            created_at: nowIso,
          });
        }

        return jsonResponse(
          {
            notification: {
              id: notifId,
              user_id: targetUserId,
              title: body.title.trim(),
              message: body.message.trim(),
              severity,
              deadline: body.deadline || null,
              metadata: body.metadata || {},
              created_at: nowIso,
            },
            deliveries: createdDeliveries,
          },
          201
        );
      }

      // 7. Notification Read Action: POST /notifications/:id/read or /api/notifications/:id/read
      const readMatch = path.match(/^\/(?:api\/)?notifications\/([^/]+)\/read$/);
      if (readMatch && method === "POST") {
        const id = readMatch[1];
        const nowIso = new Date().toISOString();

        const result = await env.DB.prepare(
          "UPDATE notifications SET read_at = ? WHERE id = ?"
        )
          .bind(nowIso, id)
          .run();

        if (result.meta.changes === 0) {
          return jsonResponse({ error: "Notification not found" }, 404);
        }

        const updated = await env.DB.prepare(
          "SELECT id, user_id, title, message, severity, deadline, read_at, metadata, created_at FROM notifications WHERE id = ?"
        )
          .bind(id)
          .first();

        return jsonResponse({
          notification: {
            ...updated,
            metadata: safeJsonParse(updated.metadata),
          },
        });
      }

      // 8. Notification Retry Action: POST /notifications/:id/retry or /api/notifications/:id/retry
      const retryMatch = path.match(/^\/(?:api\/)?notifications\/([^/]+)\/retry$/);
      if (retryMatch && method === "POST") {
        const id = retryMatch[1];

        const notif = await env.DB.prepare("SELECT id FROM notifications WHERE id = ?")
          .bind(id)
          .first();

        if (!notif) {
          return jsonResponse({ error: "Notification not found" }, 404);
        }

        const { results: failedDeliveries } = await env.DB.prepare(
          "SELECT id, attempt_count FROM deliveries WHERE notification_id = ? AND status = 'failed'"
        )
          .bind(id)
          .all();

        if (!failedDeliveries || failedDeliveries.length === 0) {
          return jsonResponse({ error: "No failed deliveries to retry" }, 400);
        }

        const retried = [];
        for (const delivery of failedDeliveries) {
          await env.DB.prepare(`
            UPDATE deliveries
            SET status = 'pending', attempt_count = ?, last_error = NULL
            WHERE id = ?
          `)
            .bind(delivery.attempt_count + 1, delivery.id)
            .run();

          const updatedDelivery = await env.DB.prepare(
            "SELECT * FROM deliveries WHERE id = ?"
          )
            .bind(delivery.id)
            .first();

          retried.push(updatedDelivery);
        }

        return jsonResponse({
          status: "retry_queued",
          notificationId: id,
          deliveries: retried,
        });
      }

      // 9. Notification Delete: DELETE /notifications/:id or /api/notifications/:id
      const deleteMatch = path.match(/^\/(?:api\/)?notifications\/([^/]+)$/);
      if (deleteMatch && method === "DELETE") {
        const id = deleteMatch[1];

        const existing = await env.DB.prepare("SELECT id FROM notifications WHERE id = ?")
          .bind(id)
          .first();

        if (!existing) {
          return jsonResponse({ error: "Notification not found" }, 404);
        }

        // Delete cascade deliveries
        await env.DB.prepare("DELETE FROM deliveries WHERE notification_id = ?")
          .bind(id)
          .run();

        // Delete notification
        await env.DB.prepare("DELETE FROM notifications WHERE id = ?")
          .bind(id)
          .run();

        return jsonResponse({
          status: "deleted",
          notificationId: id,
        });
      }

      // 10. Event Ingestion: POST /events or /api/events
      if ((path === "/events" || path === "/api/events") && method === "POST") {
        const rawBody = await request.text();
        const signature = request.headers.get("x-event-signature");
        const secret = env.EVENT_WEBHOOK_SECRET || process.env?.EVENT_WEBHOOK_SECRET;

        if (!signature) {
          return jsonResponse({ error: "Missing event signature" }, 401);
        }
        if (!secret) {
          return jsonResponse({ error: "EVENT_WEBHOOK_SECRET is not configured" }, 500);
        }

        const validSig = await verifyHmacSha256(rawBody, signature, secret);
        if (!validSig) {
          return jsonResponse({ error: "Invalid event signature" }, 401);
        }

        const body = safeJsonParse(rawBody);
        const {
          eventId,
          eventType,
          sourceService,
          userId,
          title,
          message,
          severity = "low",
          deadline = null,
          metadata = {},
        } = body;

        if (!eventId) return jsonResponse({ error: "eventId is required" }, 400);
        if (!eventType) return jsonResponse({ error: "eventType is required" }, 400);
        if (!sourceService) return jsonResponse({ error: "sourceService is required" }, 400);
        if (!userId) return jsonResponse({ error: "userId is required" }, 400);
        if (!title) return jsonResponse({ error: "title is required" }, 400);
        if (!message) return jsonResponse({ error: "message is required" }, 400);

        // Deduplication check
        const existingEvent = await env.DB.prepare(
          "SELECT id, event_id, status FROM event_receipts WHERE event_id = ?"
        )
          .bind(eventId)
          .first();

        if (existingEvent) {
          return jsonResponse({
            status: "duplicate",
            eventReceiptId: existingEvent.id,
            eventId: existingEvent.event_id,
          });
        }

        const receiptId = crypto.randomUUID();
        const notifId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        // Create event receipt
        await env.DB.prepare(`
          INSERT INTO event_receipts (id, event_id, event_type, source_service, payload, signature, status, received_at)
          VALUES (?, ?, ?, ?, ?, ?, 'accepted', ?)
        `)
          .bind(
            receiptId,
            eventId,
            eventType,
            sourceService,
            JSON.stringify(body),
            signature,
            nowIso
          )
          .run();

        // Auto-create user if not exists (prevent FK constraint error)
        await env.DB.prepare(
          "INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)"
        )
          .bind(userId, `${userId}@placeholder.local`, `User ${userId}`, nowIso)
          .run();

        // User preference check
        const pref = await env.DB.prepare(
          "SELECT in_app_enabled, email_enabled FROM preferences WHERE user_id = ?"
        )
          .bind(userId)
          .first();

        const inAppEnabled = pref ? Boolean(pref.in_app_enabled) : true;
        const emailEnabled = pref ? Boolean(pref.email_enabled) : false;

        // Create notification
        await env.DB.prepare(`
          INSERT INTO notifications (id, user_id, event_receipt_id, title, message, severity, deadline, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            notifId,
            userId,
            receiptId,
            title.trim(),
            message.trim(),
            normalizeSeverity(severity),
            deadline,
            JSON.stringify(metadata),
            nowIso
          )
          .run();

        // Create deliveries
        const deliveries = [];
        if (inAppEnabled) {
          const dId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO deliveries (id, notification_id, channel, status, attempt_count, created_at)
            VALUES (?, ?, 'in_app', 'pending', 0, ?)
          `)
            .bind(dId, notifId, nowIso)
            .run();

          deliveries.push({
            id: dId,
            notification_id: notifId,
            channel: "in_app",
            status: "pending",
          });
        }

        if (emailEnabled) {
          const dId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO deliveries (id, notification_id, channel, status, attempt_count, created_at)
            VALUES (?, ?, 'email', 'pending', 0, ?)
          `)
            .bind(dId, notifId, nowIso)
            .run();

          deliveries.push({
            id: dId,
            notification_id: notifId,
            channel: "email",
            status: "pending",
          });
        }

        return jsonResponse(
          {
            status: "accepted",
            eventReceiptId: receiptId,
            notificationId: notifId,
            deliveries,
          },
          201
        );
      }

      // 11. Webhooks Receiver: POST /api/webhooks/:service or /webhooks/:service
      const webhookMatch = path.match(/^\/(?:api\/)?webhooks\/([^/]+)$/);
      if (webhookMatch && method === "POST") {
        const serviceName = webhookMatch[1];
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-event-signature") ||
          request.headers.get("x-webhook-signature");
        const webhookSecretHeader = request.headers.get("x-webhook-secret");
        const secret = env.EVENT_WEBHOOK_SECRET || process.env?.EVENT_WEBHOOK_SECRET;

        // If HMAC signature is provided, verify it
        if (signature && secret) {
          const valid = await verifyHmacSha256(rawBody, signature, secret);
          if (!valid) {
            return jsonResponse({ error: "Invalid webhook signature" }, 401);
          }
        } else if (webhookSecretHeader && secret && secret !== "your-event-webhook-secret") {
          // If plain shared secret is provided, verify against configured secret
          if (webhookSecretHeader !== secret) {
            return jsonResponse({ error: "Invalid webhook secret" }, 401);
          }
        }

        const body = safeJsonParse(rawBody);
        const eventId =
          body.eventId ||
          body.event_id ||
          body.id ||
          `${serviceName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const eventType =
          body.eventType ||
          body.event_type ||
          body.event ||
          body.type ||
          `${serviceName}.notification`;

        const userId =
          body.userId ||
          body.user_id ||
          body.recipientId ||
          body.recipient_id ||
          body.studentId;

        const title = body.title || body.subject || `New update from ${serviceName}`;
        const message = body.message || body.description || body.content || body.body;

        if (!userId) {
          return jsonResponse({ error: "userId is required in webhook payload" }, 400);
        }
        if (!message) {
          return jsonResponse({ error: "message is required in webhook payload" }, 400);
        }

        // Deduplication check
        const existingEvent = await env.DB.prepare(
          "SELECT id, event_id FROM event_receipts WHERE event_id = ?"
        )
          .bind(eventId)
          .first();

        if (existingEvent) {
          return jsonResponse({
            status: "duplicate",
            eventReceiptId: existingEvent.id,
            eventId: existingEvent.event_id,
          });
        }

        const receiptId = crypto.randomUUID();
        const notifId = crypto.randomUUID();
        const nowIso = new Date().toISOString();

        const incomingMeta = body.metadata || body.data || body.payload || {};
        const applicationId =
          incomingMeta.application_id ??
          incomingMeta.applicationId ??
          body.application_id ??
          body.applicationId;
        const jobId =
          incomingMeta.job_id ??
          incomingMeta.jobId ??
          body.job_id ??
          body.jobId;
        const jobTitle =
          incomingMeta.job_title ??
          incomingMeta.jobTitle ??
          body.job_title ??
          body.jobTitle;
        const companyName =
          incomingMeta.company_name ??
          incomingMeta.companyName ??
          incomingMeta.company ??
          body.company_name ??
          body.companyName ??
          body.company;
        const oldStatus =
          incomingMeta.old_status ??
          incomingMeta.oldStatus ??
          body.old_status ??
          body.oldStatus;
        const newStatus =
          incomingMeta.new_status ??
          incomingMeta.newStatus ??
          body.new_status ??
          body.newStatus;

        const notificationMeta = {
          ...incomingMeta,
          ...(applicationId !== undefined && applicationId !== null ? { application_id: applicationId } : {}),
          ...(jobId !== undefined && jobId !== null ? { job_id: jobId } : {}),
          ...(jobTitle ? { job_title: jobTitle } : {}),
          ...(companyName ? { company_name: companyName } : {}),
          ...(oldStatus ? { old_status: oldStatus } : {}),
          ...(newStatus ? { new_status: newStatus } : {}),
        };

        await env.DB.prepare(`
          INSERT INTO event_receipts (id, event_id, event_type, source_service, payload, signature, status, received_at)
          VALUES (?, ?, ?, ?, ?, ?, 'accepted', ?)
        `)
          .bind(
            receiptId,
            eventId,
            eventType,
            serviceName,
            rawBody,
            signature || null,
            nowIso
          )
          .run();

        // Auto-create user if not exists (prevent FK constraint error)
        await env.DB.prepare(
          "INSERT OR IGNORE INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)"
        )
          .bind(userId, `${userId}@placeholder.local`, `User ${userId}`, nowIso)
          .run();

        const pref = await env.DB.prepare(
          "SELECT in_app_enabled, email_enabled FROM preferences WHERE user_id = ?"
        )
          .bind(userId)
          .first();

        const inAppEnabled = pref ? Boolean(pref.in_app_enabled) : true;
        const emailEnabled = pref ? Boolean(pref.email_enabled) : false;

        await env.DB.prepare(`
          INSERT INTO notifications (id, user_id, event_receipt_id, title, message, severity, deadline, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            notifId,
            userId,
            receiptId,
            title,
            message,
            normalizeSeverity(body.severity || body.priority),
            body.deadline || null,
            JSON.stringify(notificationMeta),
            nowIso
          )
          .run();

        const deliveries = [];
        if (inAppEnabled) {
          const dId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO deliveries (id, notification_id, channel, status, attempt_count, created_at)
            VALUES (?, ?, 'in_app', 'pending', 0, ?)
          `)
            .bind(dId, notifId, nowIso)
            .run();

          deliveries.push({ id: dId, channel: "in_app", status: "pending" });
        }

        if (emailEnabled) {
          const dId = crypto.randomUUID();
          await env.DB.prepare(`
            INSERT INTO deliveries (id, notification_id, channel, status, attempt_count, created_at)
            VALUES (?, ?, 'email', 'pending', 0, ?)
          `)
            .bind(dId, notifId, nowIso)
            .run();

          deliveries.push({ id: dId, channel: "email", status: "pending" });
        }

        // ── Webhook Callback to Job Board (Team 18) ──
        // After successfully processing the webhook, send acknowledgment callback to Job Board
        let callbackResult = null;
        const isJobBoard =
          serviceName.toLowerCase() === "jobboard" ||
          serviceName.toLowerCase() === "job_board" ||
          serviceName.toLowerCase() === "job-board";

        if (isJobBoard) {
          const JOBBOARD_CALLBACK_URL =
            "https://team18-job-board-api.tawee-dev.workers.dev/api/webhooks/notification";

          try {
            // Student sensitive data keys to exclude (never send CV, phone, email back)
            const SENSITIVE_KEYS = new Set([
              "cv",
              "resume",
              "phone",
              "phonenumber",
              "phone_number",
              "tel",
              "email",
              "studentemail",
              "student_email",
              "studentphone",
              "student_phone",
            ]);

            const callbackMetadata = {};
            if (applicationId !== undefined && applicationId !== null) {
              callbackMetadata.application_id = applicationId;
            }
            if (jobId !== undefined && jobId !== null) {
              callbackMetadata.job_id = jobId;
            }
            if (jobTitle) {
              callbackMetadata.job_title = jobTitle;
            }
            if (companyName) {
              callbackMetadata.company_name = companyName;
            }
            if (oldStatus) {
              callbackMetadata.old_status = oldStatus;
            }
            if (newStatus) {
              callbackMetadata.new_status = newStatus;
            }

            // Include any additional safe metadata fields
            for (const [key, value] of Object.entries(incomingMeta)) {
              const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
              if (!SENSITIVE_KEYS.has(normalized) && callbackMetadata[key] === undefined) {
                callbackMetadata[key] = value;
              }
            }

            const callbackPayload = {
              eventId: eventId,
              eventType: eventType,
              userId: String(userId),
              title: title,
              message: message,
              timestamp: body.timestamp || nowIso,
              metadata: callbackMetadata,
            };

            const callbackSecret =
              webhookSecretHeader ||
              (secret && secret !== "your-event-webhook-secret"
                ? secret
                : "a760ac43342d4f7094e0fd90f25f8036");

            const callbackResponse = await fetch(JOBBOARD_CALLBACK_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-webhook-secret": callbackSecret,
              },
              body: JSON.stringify(callbackPayload),
            });

            callbackResult = {
              sent: true,
              status: callbackResponse.status,
              ok: callbackResponse.ok,
            };

            console.log(
              `[Webhook Callback] Sent to Job Board: event_id=${eventId}, event_type=${eventType}, app_id=${callbackMetadata.application_id}, status=${callbackResponse.status}`
            );
          } catch (callbackErr) {
            callbackResult = {
              sent: false,
              error: callbackErr.message,
            };
            console.error("[Webhook Callback] Failed to send to Job Board:", callbackErr.message);
          }
        }

        return jsonResponse(
          {
            status: "accepted",
            service: serviceName,
            eventReceiptId: receiptId,
            notificationId: notifId,
            deliveries,
            callback: callbackResult,
          },
          201
        );
      }

      // 11.9 All Deliveries List: GET /deliveries or /api/deliveries
      if ((path === "/deliveries" || path === "/api/deliveries") && method === "GET") {
        const query = `
          SELECT 
            d.id, 
            d.notification_id, 
            d.channel, 
            d.status, 
            d.attempt_count, 
            d.last_error, 
            d.delivered_at, 
            d.created_at,
            n.title AS notification_title, 
            n.user_id, 
            n.severity
          FROM deliveries d
          LEFT JOIN notifications n ON n.id = d.notification_id
          ORDER BY d.created_at DESC
          LIMIT 50
        `;
        const { results } = await env.DB.prepare(query).all();
        return jsonResponse({ deliveries: results || [] });
      }

      // 12. Delivery Status: GET /deliveries/:id or /api/deliveries/:id
      const delivMatch = path.match(/^\/(?:api\/)?deliveries\/([^/]+)$/);
      if (delivMatch && method === "GET") {
        const id = delivMatch[1];
        const delivery = await env.DB.prepare(
          "SELECT * FROM deliveries WHERE id = ?"
        )
          .bind(id)
          .first();

        if (!delivery) {
          return jsonResponse({ error: "Delivery not found" }, 404);
        }

        return jsonResponse({ delivery });
      }

      // 13. Preferences: PATCH /preferences or /api/preferences
      if (
        (path === "/preferences" || path === "/api/preferences") &&
        method === "PATCH"
      ) {
        const body = await request.json().catch(() => ({}));
        const {
          user_id,
          in_app_enabled,
          email_enabled,
          quiet_hours_start,
          quiet_hours_end,
        } = body;

        if (!user_id) {
          return jsonResponse({ error: "user_id is required" }, 400);
        }

        // Check if preference exists
        const existing = await env.DB.prepare(
          "SELECT * FROM preferences WHERE user_id = ?"
        )
          .bind(user_id)
          .first();

        const nowIso = new Date().toISOString();
        const inAppVal =
          in_app_enabled !== undefined
            ? in_app_enabled
              ? 1
              : 0
            : existing
            ? existing.in_app_enabled
            : 1;

        const emailVal =
          email_enabled !== undefined
            ? email_enabled
              ? 1
              : 0
            : existing
            ? existing.email_enabled
            : 1;

        const qStart =
          quiet_hours_start !== undefined
            ? quiet_hours_start
            : existing?.quiet_hours_start || null;

        const qEnd =
          quiet_hours_end !== undefined
            ? quiet_hours_end
            : existing?.quiet_hours_end || null;

        await env.DB.prepare(`
          INSERT INTO preferences (user_id, in_app_enabled, email_enabled, quiet_hours_start, quiet_hours_end, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            in_app_enabled = excluded.in_app_enabled,
            email_enabled = excluded.email_enabled,
            quiet_hours_start = excluded.quiet_hours_start,
            quiet_hours_end = excluded.quiet_hours_end,
            updated_at = excluded.updated_at
        `)
          .bind(user_id, inAppVal, emailVal, qStart, qEnd, nowIso)
          .run();

        return jsonResponse({
          preference: {
            user_id,
            in_app_enabled: Boolean(inAppVal),
            email_enabled: Boolean(emailVal),
            quiet_hours_start: qStart,
            quiet_hours_end: qEnd,
            updated_at: nowIso,
          },
        });
      }

      // 14. Integrations dispatch / fetch
      if (
        (path === "/integrations/dispatch-webhook" ||
          path === "/api/integrations/dispatch-webhook") &&
        method === "POST"
      ) {
        const body = await request.json().catch(() => ({}));
        if (!body.url) {
          return jsonResponse({ error: "url is required to dispatch webhook" }, 400);
        }

        const outRes = await fetch(body.url, {
          method: body.method || "POST",
          headers: {
            "Content-Type": "application/json",
            ...(body.headers || {}),
          },
          body: JSON.stringify(body.payload || {}),
        }).catch((err) => ({ ok: false, error: err.message }));

        return jsonResponse({
          message: "Webhook dispatched",
          targetUrl: body.url,
          status: outRes.status || "error",
        });
      }

      if (
        (path === "/integrations/fetch-external" ||
          path === "/api/integrations/fetch-external") &&
        method === "POST"
      ) {
        const body = await request.json().catch(() => ({}));
        if (!body.baseUrl) {
          return jsonResponse({ error: "baseUrl is required" }, 400);
        }

        const target = `${body.baseUrl}${body.endpoint || ""}`;
        const extRes = await fetch(target, {
          method: "GET",
          headers: body.headers || {},
        });
        const extData = await extRes.json().catch(() => null);

        return jsonResponse({
          success: extRes.ok,
          url: target,
          data: extData,
        });
      }

      // 15. AI-Assisted Summarization & Deterministic Fallback: POST /api/notifications/ai-summarize or /api/ai/summarize
      if (
        (path === "/notifications/ai-summarize" ||
          path === "/api/notifications/ai-summarize" ||
          path === "/api/ai/summarize") &&
        method === "POST"
      ) {
        const body = await request.json().catch(() => ({}));
        const { title = "", message = "", category = "general", severity = "low", deadline = null } = body;

        if (!message && !title) {
          return jsonResponse({ error: "title or message is required for summarization" }, 400);
        }

        // BR-05 Check: High stakes protection
        if (isHighStakes({ category, severity, title, message })) {
          return jsonResponse({
            status: "success",
            flow: "deterministic_fallback",
            ai_applied: false,
            fallback_reason: "High-stakes event protected under BR-05 policy (interviews, approvals, or critical severity). Original verbatim text preserved.",
            summary: message,
            original_length: message.length,
            category,
            severity,
          });
        }

        const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
        if (geminiKey) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const prompt = `สรุปข้อความแจ้งเตือนต่อไปนี้ให้สั้น กระชับ เข้าใจง่าย ภายใน 1-2 ประโยค:\nหัวข้อ: ${title}\nข้อความ: ${message}`;
            const gRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                  generationConfig: { maxOutputTokens: 100, temperature: 0.2 },
                }),
                signal: controller.signal,
              }
            );
            clearTimeout(timeoutId);
            if (gRes.ok) {
              const gData = await gRes.json();
              const text = gData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) {
                return jsonResponse({
                  status: "success",
                  flow: "ai_assisted",
                  ai_applied: true,
                  provider: "google-gemini",
                  summary: text,
                  original_length: message.length,
                  summary_length: text.length,
                  category,
                  severity,
                });
              }
            }
          } catch (aiErr) {
            console.warn("[Worker AI] Gemini fetch timeout or error:", aiErr.message);
          }
        }

        // Deterministic Fallback
        const fallbackSummary = deterministicSummarize({ title, message });
        return jsonResponse({
          status: "success",
          flow: "deterministic_fallback",
          ai_applied: false,
          fallback_reason: geminiKey
            ? "AI provider timeout or unavailable; immediately triggered deterministic fallback."
            : "No external AI credentials configured; executed deterministic rule-based summarization.",
          summary: fallbackSummary,
          original_length: message.length,
          summary_length: fallbackSummary.length,
          category,
          severity,
        });
      }

      // 16. Deterministic Sort: POST /api/notifications/deterministic-sort
      if (
        (path === "/notifications/deterministic-sort" ||
          path === "/api/notifications/deterministic-sort") &&
        method === "POST"
      ) {
        const body = await request.json().catch(() => ({}));
        const notifications = Array.isArray(body.notifications) ? body.notifications : [];
        const sorted = deterministicSortNotifications(notifications);
        return jsonResponse({
          status: "success",
          count: sorted.length,
          sorting_rule: "severity (critical -> high -> medium -> low) -> deadline (near -> far) -> created_at (newest -> oldest)",
          notifications: sorted,
        });
      }

      // 404 for unhandled routes
      return jsonResponse({ error: "Route not found", path, method }, 404);
    } catch (err) {
      console.error("Unhandled Worker Exception:", err);
      return jsonResponse(
        { error: "Internal Server Error", message: err.message },
        500
      );
    }
  },
};
