const express = require("express");
const {
  summarizeNotification,
  deterministicSortNotifications,
} = require("../services/ai.service");

const router = express.Router();

// POST /api/notifications/ai-summarize
// AI-assisted summarization with deterministic fallback
router.post("/ai-summarize", async (req, res) => {
  try {
    const { title, message, category = "general", severity = "low", deadline = null } = req.body;

    if (!message && !title) {
      return res.status(400).json({
        error: "title or message is required for summarization",
      });
    }

    const result = await summarizeNotification({
      title,
      message,
      category,
      severity,
      deadline,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("AI summarization error:", error);
    return res.status(500).json({
      error: "Internal server error during summarization",
    });
  }
});

// POST /api/notifications/deterministic-sort
// Deterministic fallback ordering: severity -> deadline -> received_at
router.post("/deterministic-sort", (req, res) => {
  try {
    const { notifications = [] } = req.body;
    if (!Array.isArray(notifications)) {
      return res.status(400).json({
        error: "notifications must be an array",
      });
    }

    const sorted = deterministicSortNotifications(notifications);
    return res.status(200).json({
      status: "success",
      count: sorted.length,
      sorting_rule: "severity (critical -> high -> medium -> low) -> deadline (near -> far) -> created_at (newest -> oldest)",
      notifications: sorted,
    });
  } catch (error) {
    console.error("Deterministic sort error:", error);
    return res.status(500).json({
      error: "Internal server error during sorting",
    });
  }
});

module.exports = router;

