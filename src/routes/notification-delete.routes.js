const express = require("express");
const supabase = require("../config/supabase");

const router = express.Router();

// DELETE /notifications/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check whether notification exists
    const { data: notification, error: findError } =
      await supabase
        .from("notifications")
        .select("id, user_id, title")
        .eq("id", id)
        .maybeSingle();

    if (findError) {
      console.error(
        "Failed to find notification:",
        findError
      );

      return res.status(500).json({
        error: "Failed to find notification",
      });
    }

    if (!notification) {
      return res.status(404).json({
        error: "Notification not found",
      });
    }

    // Delete notification
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "Failed to delete notification:",
        deleteError
      );

      return res.status(500).json({
        error: "Failed to delete notification",
      });
    }

    return res.status(200).json({
      status: "deleted",
      notificationId: id,
    });
  } catch (error) {
    console.error(
      "Unexpected notification delete error:",
      error
    );

    return res.status(500).json({
      error: "Internal server error",
    });
  }
});

module.exports = router;