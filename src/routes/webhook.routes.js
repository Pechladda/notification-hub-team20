const express = require("express");
const crypto = require("crypto");
const supabase = require("../config/supabase");

const router = express.Router();

/**
 * Normalizes priority/severity string to allowed enum values:
 * 'low' | 'medium' | 'high' | 'critical'
 */
function normalizeSeverity(val) {
  if (!val) return "low";
  const str = String(val).toLowerCase();
  if (str === "urgent" || str === "critical") return "critical";
  if (str === "high") return "high";
  if (str === "medium" || str === "normal") return "medium";
  return "low";
}

/**
 * Handles incoming webhook events for a given external service.
 */
async function handleServiceWebhook(serviceName, req, res) {
  try {
    const body = req.body || {};
    const signature =
      req.headers["x-event-signature"] || req.headers["x-webhook-signature"];
    const secret = process.env.EVENT_WEBHOOK_SECRET;

    // Verify HMAC if signature is sent
    if (signature && secret) {
      const rawBody = JSON.stringify(body);
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

      let signaturesMatch = false;
      try {
        signaturesMatch = crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expected)
        );
      } catch {
        signaturesMatch = false;
      }

      if (!signaturesMatch) {
        return res.status(401).json({
          error: "Invalid webhook signature",
        });
      }
    }

    // Flexible field mapping for external groups
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

    const title =
      body.title ||
      body.subject ||
      `New update from ${serviceName}`;

    const message =
      body.message ||
      body.description ||
      body.content ||
      body.body;

    if (!userId) {
      return res.status(400).json({
        error: "userId is required in webhook payload",
      });
    }

    if (!message) {
      return res.status(400).json({
        error: "message (or description/content) is required in webhook payload",
      });
    }

    const severity = normalizeSeverity(body.severity || body.priority);
    const deadline = body.deadline || null;
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

    // Check duplicate event if eventId provided in body
    if (body.eventId || body.event_id || body.id) {
      const { data: existingEvent, error: checkError } = await supabase
        .from("event_receipts")
        .select("id, event_id, status")
        .eq("event_id", eventId)
        .maybeSingle();

      if (checkError) {
        console.error("Failed to check duplicate event:", checkError);
      } else if (existingEvent) {
        return res.status(200).json({
          status: "duplicate",
          service: serviceName,
          eventReceiptId: existingEvent.id,
          eventId: existingEvent.event_id,
        });
      }
    }

    // Create event receipt
    const { data: eventReceipt, error: receiptError } = await supabase
      .from("event_receipts")
      .insert({
        event_id: eventId,
        event_type: eventType,
        source_service: serviceName,
        payload: body,
        signature: signature || null,
        status: "accepted",
      })
      .select()
      .single();

    if (receiptError) {
      console.error("Failed to record event receipt:", receiptError);
      return res.status(500).json({
        error: "Failed to record event receipt",
      });
    }

    // Check preferences
    const { data: preference } = await supabase
      .from("preferences")
      .select("in_app_enabled, email_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    const inAppEnabled = preference?.in_app_enabled ?? true;
    const emailEnabled = preference?.email_enabled ?? false;

    // Create notification
    const { data: notification, error: notifError } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        event_receipt_id: eventReceipt.id,
        title,
        message,
        severity,
        deadline,
        metadata: {
          ...notificationMeta,
          source_service: serviceName,
          event_type: eventType,
        },
      })
      .select()
      .single();

    if (notifError) {
      console.error("Failed to create notification from webhook:", notifError);
      return res.status(500).json({
        error: "Failed to create notification",
      });
    }

    // Create deliveries
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
      const { data: deliveryData } = await supabase
        .from("deliveries")
        .insert(deliveriesToCreate)
        .select();

      createdDeliveries = deliveryData || [];
    }

    // ── Webhook Callback to Job Board (Team 18) ──
    let callbackResult = null;
    const isJobBoard =
      serviceName.toLowerCase() === "jobboard" ||
      serviceName.toLowerCase() === "job_board" ||
      serviceName.toLowerCase() === "job-board";

    if (isJobBoard) {
      const JOBBOARD_CALLBACK_URL =
        "https://team18-job-board-api.tawee-dev.workers.dev/api/webhooks/notification";

      try {
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

        for (const [key, value] of Object.entries(incomingMeta)) {
          const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
          if (!SENSITIVE_KEYS.has(normalized) && callbackMetadata[key] === undefined) {
            callbackMetadata[key] = value;
          }
        }

        const callbackPayload = {
          eventId,
          eventType,
          userId: String(userId),
          title,
          message,
          timestamp: body.timestamp || new Date().toISOString(),
          metadata: callbackMetadata,
        };

        const webhookSecretHeader =
          req.headers["x-webhook-secret"] ||
          req.headers["x-event-signature"] ||
          req.headers["x-webhook-signature"];

        const callbackSecret =
          webhookSecretHeader ||
          (secret && secret !== "your-event-webhook-secret"
            ? secret
            : "a760ac43342d4f7094e0fd90f25f8036");

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        try {
          const callbackResponse = await fetch(JOBBOARD_CALLBACK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": callbackSecret,
            },
            body: JSON.stringify(callbackPayload),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          callbackResult = {
            sent: true,
            status: callbackResponse.status,
            ok: callbackResponse.ok,
          };
          console.log(
            `[Webhook Callback] Sent to Job Board: event_id=${eventId}, status=${callbackResponse.status}`
          );
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          callbackResult = {
            sent: false,
            error: fetchErr.name === "AbortError" ? "Request timed out" : fetchErr.message,
          };
          console.warn("[Webhook Callback] Job Board callback fetch:", fetchErr.message);
        }
      } catch (callbackErr) {
        callbackResult = {
          sent: false,
          error: callbackErr.message,
        };
        console.warn("[Webhook Callback] Failed to prepare Job Board callback:", callbackErr.message);
      }
    }

    return res.status(201).json({
      status: "accepted",
      service: serviceName,
      eventReceiptId: eventReceipt.id,
      notificationId: notification.id,
      notification,
      deliveries: createdDeliveries,
      ...(callbackResult ? { callback: callbackResult } : {}),
    });
  } catch (error) {
    console.error(`Unexpected webhook error for ${serviceName}:`, error);
    return res.status(500).json({
      error: "Internal server error processing webhook",
    });
  }
}

// POST /api/webhooks/jobboard
router.post("/jobboard", async (req, res) => {
  return handleServiceWebhook("JobBoard", req, res);
});

// POST /api/webhooks/:service (allows any partner system e.g. internship, alumni)
router.post("/:service", async (req, res) => {
  const serviceName = req.params.service;
  return handleServiceWebhook(serviceName, req, res);
});

module.exports = router;
