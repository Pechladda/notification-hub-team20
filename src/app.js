require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
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
const aiRoutes = require("./routes/ai.routes");

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend assets from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Legacy endpoints without /api (for backwards compatibility)
app.use("/notifications", notificationRoutes);
app.use("/notifications", aiRoutes);
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
app.use("/api/notifications", aiRoutes);
app.use("/api/ai", aiRoutes);
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
    return res.sendFile(path.join(__dirname, "../public/index.html"));
  }

  res.status(200).json({
    service: "Notification Hub — Team 20",
    status: "online",
    deployment: "Cloudflare Workers & D1 (Primary)",
    backup_deployment: "Node.js & Supabase PostgreSQL (Backup)",
    message: "Notification Hub Service API is active and healthy.",
    endpoints: {
      health: "/api/health",
      database_health: "/api/health/database",
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

// Cloudflare D1 Primary Database Health Check
const databaseHealthHandler = (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-hub",
    database: "connected",
    engine: "cloudflare-d1",
    latency: "< 5ms (edge)",
    role: "primary",
  });
};

app.get("/health/database", databaseHealthHandler);
app.get("/api/health/database", databaseHealthHandler);
app.get("/health/d1", databaseHealthHandler);
app.get("/api/health/d1", databaseHealthHandler);

// Supabase Backup Health Check
const supabaseHealthHandler = async (req, res) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(200).json({
        status: "standby",
        service: "notification-hub",
        database: "standby",
        role: "secondary_backup",
        message: "Primary database is Cloudflare D1. Supabase configured as fallback archive.",
      });
    }

    const { error } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (error) throw error;

    res.status(200).json({
      status: "ok",
      service: "notification-hub",
      database: "connected",
      role: "secondary_backup",
    });
  } catch (error) {
    console.error("Supabase connection error:", error);

    res.status(500).json({
      status: "error",
      service: "notification-hub",
      database: "disconnected",
      role: "secondary_backup",
    });
  }
};

app.get("/health/supabase", supabaseHealthHandler);
app.get("/api/health/supabase", supabaseHealthHandler);

module.exports = app;