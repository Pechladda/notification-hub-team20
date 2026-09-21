const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// POST /notifications/:id/read
router.post("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("notifications")
      .update({
        read_at: new Date().toISOString(),
      })
      .eq("id", id)
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
      .maybeSingle();

    if (error) {
      console.error("Failed to mark notification as read:", error);

      return res.status(500).json({
        error: "Failed to mark notification as read",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    return res.status(200).json({
      notification: data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;