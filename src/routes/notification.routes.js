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

module.exports = router;