const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// POST /notifications/:id/retry
router.post("/:id/retry", async (req, res) => {
  try {
    const { id } = req.params;

    // Find the notification
    const { data: notification, error: notificationError } =
      await supabase
        .from("notifications")
        .select("id")
        .eq("id", id)
        .maybeSingle();

    if (notificationError) {
      console.error(
        "Failed to fetch notification:",
        notificationError
      );

      return res.status(500).json({
        error: "Failed to fetch notification",
      });
    }

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    // Find failed deliveries
    const { data: failedDeliveries, error: deliveryError } =
      await supabase
        .from("deliveries")
        .select(`
          id,
          notification_id,
          channel,
          status,
          attempt_count,
          last_error,
          delivered_at,
          created_at
        `)
        .eq("notification_id", id)
        .eq("status", "failed");

    if (deliveryError) {
      console.error(
        "Failed to fetch failed deliveries:",
        deliveryError
      );

      return res.status(500).json({
        error: "Failed to fetch deliveries",
      });
    }

    if (!failedDeliveries || failedDeliveries.length === 0) {
      return res.status(400).json({
        error: "No failed deliveries to retry",
      });
    }

    const retriedDeliveries = [];

    for (const delivery of failedDeliveries) {
      const { data: updatedDelivery, error: updateError } =
        await supabase
          .from("deliveries")
          .update({
            status: "pending",
            attempt_count: delivery.attempt_count + 1,
            last_error: null,
          })
          .eq("id", delivery.id)
          .select()
          .single();

      if (updateError) {
        console.error(
          "Failed to retry delivery:",
          updateError
        );

        return res.status(500).json({
          error: "Failed to retry delivery",
        });
      }

      retriedDeliveries.push(updatedDelivery);
    }

    return res.status(200).json({
      status: "retry_queued",
      notificationId: id,
      deliveries: retriedDeliveries,
    });
  } catch (error) {
    console.error("Unexpected retry error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;