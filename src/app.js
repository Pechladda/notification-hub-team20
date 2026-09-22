require("dotenv").config();

const express = require("express");
const cors = require("cors");
const supabase = require("./config/supabase");

const notificationRoutes = require("./routes/notification.routes");
const preferenceRoutes = require("./routes/preference.routes");
const eventRoutes = require("./routes/event.routes");
const deliveryRoutes = require("./routes/delivery.routes");
const notificationActionRoutes = require("./routes/notification-action.routes");
const retryRoutes = require("./routes/retry.routes");
const notificationDeleteRoutes = require("./routes/notification-delete.routes");
const webhookRoutes = require("./routes/webhook.routes");
const integrationRoutes = require("./routes/integration.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Legacy endpoints without /api (for backwards compatibility)
app.use("/notifications", notificationRoutes);
app.use("/preferences", preferenceRoutes);
app.use("/events", eventRoutes);
app.use("/deliveries", deliveryRoutes);
app.use("/notifications", notificationActionRoutes);
app.use("/notifications", retryRoutes);
app.use("/notifications", notificationDeleteRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/integrations", integrationRoutes);

// Public API endpoints with /api prefix
app.use("/api/notifications", notificationRoutes);
app.use("/api/preferences", preferenceRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/notifications", notificationActionRoutes);
app.use("/api/notifications", retryRoutes);
app.use("/api/notifications", notificationDeleteRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/integrations", integrationRoutes);

const rootHandler = (req, res) => {
  if (req.accepts("html")) {
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification Hub — Team 20</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 40px 20px; display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; max-width: 600px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: #10b981; color: #022c22; font-weight: bold; font-size: 12px; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; }
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
    <span class="badge">● Service Online</span>
    <h1>🔔 Notification Hub — Team 20</h1>
    <p>Centralized Notification Service for Campus Platforms. The service is active and ready to receive API requests and webhooks.</p>
    <div class="endpoints">
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/health</span></div>
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/health/supabase</span></div>
      <div class="endpoint-item"><span class="method post">POST</span> <span class="path">/api/notifications</span></div>
      <div class="endpoint-item"><span class="method post">POST</span> <span class="path">/api/webhooks/jobboard</span></div>
      <div class="endpoint-item"><span class="method post">POST</span> <span class="path">/api/events</span></div>
      <div class="endpoint-item"><span class="method get">GET</span> <span class="path">/api/notifications/me?user_id=...</span></div>
    </div>
  </div>
</body>
</html>`);
  }

  res.status(200).json({
    service: "Notification Hub — Team 20",
    status: "online",
    message: "Notification Hub Service API is active and healthy.",
    endpoints: {
      health: "/api/health",
      supabase_health: "/api/health/supabase",
      notifications: "/api/notifications",
      jobboard_webhook: "/api/webhooks/jobboard",
      events: "/api/events",
      user_notifications: "/api/notifications/me?user_id=:id",
    },
  });
};

app.get("/", rootHandler);
app.get("/api", rootHandler);

const healthHandler = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-hub",
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

const supabaseHealthHandler = async (req, res) => {
  try {
    const { error } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (error) throw error;

    res.status(200).json({
      status: "ok",
      service: "notification-hub",
      database: "connected",
    });
  } catch (error) {
    console.error("Supabase connection error:", error);

    res.status(500).json({
      status: "error",
      service: "notification-hub",
      database: "disconnected",
    });
  }
};

app.get("/health/supabase", supabaseHealthHandler);
app.get("/api/health/supabase", supabaseHealthHandler);

module.exports = app;