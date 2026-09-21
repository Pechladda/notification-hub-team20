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

const app = express();

app.use(cors());
app.use(express.json());

app.use("/notifications", notificationRoutes);
app.use("/preferences", preferenceRoutes);
app.use("/events", eventRoutes);
app.use("/deliveries", deliveryRoutes);
app.use("/notifications", notificationActionRoutes);
app.use("/notifications", retryRoutes);
app.use("/notifications", notificationDeleteRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "notification-hub",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health/supabase", async (req, res) => {
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
});

module.exports = app;