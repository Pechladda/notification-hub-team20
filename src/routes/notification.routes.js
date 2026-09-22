const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// GET /notifications/me
router.get("/me", async (req, res) => {
  try {
    const { user_id } = req.query;

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({
        error: "user_id is required",
      });
    }

    // Get notifications for this user
    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        user_id,
        title,
        message,
        severity,
        deadline,
        read_at,
        metadata,
        created_at
      `)
      .eq("user_id", user_id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch notifications:", error);

      return res.status(500).json({
        error: "Failed to fetch notifications",
      });
    }

    return res.status(200).json({
      notifications: data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

// POST /notifications (and /api/notifications)
router.post("/", async (req, res) => {
  try {
    const {
      userId,
      user_id,
      title,
      message,
      severity = "low",
      deadline = null,
      metadata = {},
    } = req.body;

    const targetUserId = userId || user_id;

    if (!targetUserId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        error: "title is required",
      });
    }

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "message is required",
      });
    }

    const validSeverities = ["low", "medium", "high", "critical"];
    if (severity && !validSeverities.includes(severity)) {
      return res.status(400).json({
        error: `severity must be one of: ${validSeverities.join(", ")}`,
      });
    }

    // Check user preferences
    const { data: preference, error: preferenceError } = await supabase
      .from("preferences")
      .select("in_app_enabled, email_enabled")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (preferenceError) {
      console.error("Failed to check preferences:", preferenceError);
    }

    const inAppEnabled = preference?.in_app_enabled ?? true;
    const emailEnabled = preference?.email_enabled ?? false;

    // Create notification
    const { data: notification, error: notificationError } = await supabase
      .from("notifications")
      .insert({
        user_id: targetUserId,
        title: title.trim(),
        message: message.trim(),
        severity: severity || "low",
        deadline: deadline || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (notificationError) {
      console.error("Failed to create notification:", notificationError);
      return res.status(500).json({
        error: "Failed to create notification",
      });
    }

    // Create channel deliveries
    const deliveriesToCreate = [];
    if (inAppEnabled) {
      deliveriesToCreate.push({
        notification_id: notification.id,
        channel: "in_app",
        status: "pending",
        attempt_count: 0,
      });
    }
    if (emailEnabled) {
      deliveriesToCreate.push({
        notification_id: notification.id,
        channel: "email",
        status: "pending",
        attempt_count: 0,
      });
    }

    let createdDeliveries = [];
    if (deliveriesToCreate.length > 0) {
      const { data: deliveryData, error: deliveryError } = await supabase
        .from("deliveries")
        .insert(deliveriesToCreate)
        .select();

      if (deliveryError) {
        console.error("Failed to create deliveries:", deliveryError);
      } else {
        createdDeliveries = deliveryData || [];
      }
    }

    return res.status(201).json({
      status: "created",
      notification,
      deliveries: createdDeliveries,
    });
  } catch (error) {
    console.error("Unexpected error creating notification:", error);
    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;