const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// GET /deliveries/:id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
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
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch delivery:", error);

      return res.status(500).json({
        error: "Failed to fetch delivery",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "Delivery not found",
      });
    }

    return res.status(200).json({
      delivery: data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;