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