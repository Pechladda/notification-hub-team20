const express = require("express");
const crypto = require("crypto");
const supabase = require("../config/supabase");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const signature = req.headers["x-event-signature"];
    const secret = process.env.EVENT_WEBHOOK_SECRET;

    if (!signature) {
      return res.status(401).json({
        error: "Missing event signature",
      });
    }

    if (!secret) {
      return res.status(500).json({
        error: "EVENT_WEBHOOK_SECRET is not configured",
      });
    }

    const rawBody = JSON.stringify(req.body);

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const signaturesMatch = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!signaturesMatch) {
      return res.status(401).json({
        error: "Invalid event signature",
      });
    }

    const {
      eventId,
      eventType,
      sourceService,
      userId,
      title,
      message,
      severity,
      deadline,
      metadata,
    } = req.body;

    if (!eventId) {
      return res.status(400).json({
        error: "eventId is required",
      });
    }

    if (!eventType) {
      return res.status(400).json({
        error: "eventType is required",
      });
    }

    if (!sourceService) {
      return res.status(400).json({
        error: "sourceService is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        error: "userId is required",
      });
    }

    if (!title) {
      return res.status(400).json({
        error: "title is required",
      });
    }

    if (!message) {
      return res.status(400).json({
        error: "message is required",
      });
    }

    // Check duplicate event
    const { data: existingEvent, error: existingEventError } =
      await supabase
        .from("event_receipts")
        .select("id, event_id, status")
        .eq("event_id", eventId)
        .maybeSingle();

    if (existingEventError) {
      console.error(
        "Failed to check existing event:",
        existingEventError
      );

      return res.status(500).json({
        error: "Failed to check event receipt",
      });
    }

    if (existingEvent) {
      return res.status(200).json({
        status: "duplicate",
        eventReceiptId: existingEvent.id,
        eventId: existingEvent.event_id,
      });
    }

    // Create event receipt
    const { data: eventReceipt, error: eventReceiptError } =
  await supabase
    .from("event_receipts")
    .insert({
      event_id: eventId,
      event_type: eventType,
      source_service: sourceService,
      payload: req.body,
      signature,
      status: "accepted",
    })
    .select()
    .single();

    if (eventReceiptError) {
      console.error(
        "Failed to create event receipt:",
        eventReceiptError
      );

      return res.status(500).json({
        error: "Failed to create event receipt",
      });
    }

    // Check user preferences
    const { data: preference, error: preferenceError } =
      await supabase
        .from("preferences")
        .select(
          "user_id, in_app_enabled, email_enabled, quiet_hours_start, quiet_hours_end"
        )
        .eq("user_id", userId)
        .maybeSingle();

    if (preferenceError) {
      console.error(
        "Failed to fetch preferences:",
        preferenceError
      );

      return res.status(500).json({
        error: "Failed to fetch preferences",
      });
    }

    const inAppEnabled = preference?.in_app_enabled ?? true;
    const emailEnabled = preference?.email_enabled ?? false;

    // Create notification
    const { data: notification, error: notificationError } =
      await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          event_receipt_id: eventReceipt.id,
          title,
          message,
          severity: severity || "low",
          deadline: deadline || null,
          metadata: metadata || {},
        })
        .select()
        .single();

    if (notificationError) {
      console.error(
        "Failed to create notification:",
        notificationError
      );

      return res.status(500).json({
        error: "Failed to create notification",
      });
    }

    // Create deliveries according to preferences
    const deliveries = [];

    if (inAppEnabled) {
      deliveries.push({
        notification_id: notification.id,
        channel: "in_app",
        status: "pending",
        attempt_count: 0,
      });
    }

    if (emailEnabled) {
      deliveries.push({
        notification_id: notification.id,
        channel: "email",
        status: "pending",
        attempt_count: 0,
      });
    }

    let createdDeliveries = [];

    if (deliveries.length > 0) {
      const { data, error: deliveryError } = await supabase
        .from("deliveries")
        .insert(deliveries)
        .select();

      if (deliveryError) {
        console.error(
          "Failed to create deliveries:",
          deliveryError
        );

        return res.status(500).json({
          error: "Failed to create deliveries",
        });
      }

      createdDeliveries = data;
    }

    return res.status(201).json({
      status: "accepted",
      eventReceiptId: eventReceipt.id,
      notificationId: notification.id,
      deliveries: createdDeliveries,
    });
  } catch (error) {
    console.error("Unexpected event error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;