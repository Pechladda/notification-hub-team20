const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// PATCH /preferences
router.patch("/", async (req, res) => {
  try {
    const {
      user_id,
      in_app_enabled,
      email_enabled,
      quiet_hours_start,
      quiet_hours_end,
    } = req.body;

    // Validate user_id
    if (!user_id) {
      return res.status(400).json({
        error: "user_id is required",
      });
    }

    // Build update object with only provided fields
    const updates = {};

    if (in_app_enabled !== undefined) {
      if (typeof in_app_enabled !== "boolean") {
        return res.status(400).json({
          error: "in_app_enabled must be a boolean",
        });
      }

      updates.in_app_enabled = in_app_enabled;
    }

    if (email_enabled !== undefined) {
      if (typeof email_enabled !== "boolean") {
        return res.status(400).json({
          error: "email_enabled must be a boolean",
        });
      }

      updates.email_enabled = email_enabled;
    }

    if (quiet_hours_start !== undefined) {
      updates.quiet_hours_start = quiet_hours_start;
    }

    if (quiet_hours_end !== undefined) {
      updates.quiet_hours_end = quiet_hours_end;
    }

    // Always update the timestamp
    updates.updated_at = new Date().toISOString();

    // Upsert preference for this user
    const { data, error } = await supabase
      .from("preferences")
      .upsert(
        {
          user_id,
          ...updates,
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to update preferences:", error);

      return res.status(500).json({
        error: "Failed to update preferences",
      });
    }

    return res.status(200).json({
      preference: data,
    });
  } catch (error) {
    console.error("Unexpected error:", error);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;