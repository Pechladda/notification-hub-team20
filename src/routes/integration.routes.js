const express = require("express");
const {
  sendOutboundWebhook,
  fetchExternalData,
} = require("../services/integration.service");
const supabase = require("../config/supabase");

const router = express.Router();

// POST /api/integrations/dispatch-webhook
// Sends a webhook event to an external group's webhook URL
router.post("/dispatch-webhook", async (req, res) => {
  try {
    const { url, method = "POST", headers = {}, payload = {} } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "url is required to dispatch webhook",
      });
    }

    const result = await sendOutboundWebhook({
      url,
      method,
      headers,
      payload,
    });

    if (!result.success && result.error) {
      return res.status(502).json({
        error: "Failed to dispatch webhook to external target",
        details: result,
      });
    }

    return res.status(200).json({
      message: "Webhook dispatched successfully",
      targetUrl: url,
      response: result,
    });
  } catch (error) {
    console.error("Error dispatching outbound webhook:", error);
    return res.status(500).json({
      error: "Internal server error dispatching webhook",
    });
  }
});

// POST /api/integrations/fetch-external
// Pulls data from an external group's public GET endpoint
router.post("/fetch-external", async (req, res) => {
  try {
    const {
      baseUrl,
      endpoint = "",
      headers = {},
      params = {},
      createNotification = false,
      userId,
      title,
      message,
    } = req.body;

    if (!baseUrl) {
      return res.status(400).json({
        error: "baseUrl is required to fetch external data",
      });
    }

    const result = await fetchExternalData({
      baseUrl,
      endpoint,
      headers,
      params,
    });

    if (!result.success) {
      return res.status(502).json({
        error: "Failed to fetch data from external service",
        details: result,
      });
    }

    let createdNotification = null;

    // Optional: automatically convert fetched data into a notification
    if (createNotification && userId) {
      const { data: notification, error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: userId,
          title: title || "External System Data Sync",
          message:
            message ||
            `Successfully fetched data from ${baseUrl}${endpoint}`,
          severity: "low",
          metadata: {
            externalUrl: result.url,
            fetchedData: result.data,
          },
        })
        .select()
        .single();

      if (!notifError) {
        createdNotification = notification;
      }
    }

    return res.status(200).json({
      success: true,
      url: result.url,
      data: result.data,
      notification: createdNotification,
    });
  } catch (error) {
    console.error("Error fetching external data:", error);
    return res.status(500).json({
      error: "Internal server error fetching external data",
    });
  }
});

module.exports = router;
