-- ============================================
-- Notification Hub - Cloudflare D1 Database Schema
-- Team 20
-- Primary Database Engine: SQLite at the Edge
-- ============================================

PRAGMA foreign_keys = ON;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Notification Preferences
CREATE TABLE IF NOT EXISTS preferences (
    user_id TEXT PRIMARY KEY,
    in_app_enabled INTEGER NOT NULL DEFAULT 1,
    email_enabled INTEGER NOT NULL DEFAULT 1,
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Event Receipts (Idempotency & Deduplication)
CREATE TABLE IF NOT EXISTS event_receipts (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    source_service TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    signature TEXT,
    status TEXT NOT NULL DEFAULT 'accepted'
        CHECK (status IN ('accepted', 'rejected', 'duplicate')),
    received_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_receipt_id TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'low'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    deadline TEXT,
    read_at TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (event_receipt_id) REFERENCES event_receipts(id) ON DELETE SET NULL
);

-- 5. Deliveries
CREATE TABLE IF NOT EXISTS deliveries (
    id TEXT PRIMARY KEY,
    notification_id TEXT NOT NULL,
    channel TEXT NOT NULL
        CHECK (channel IN ('in_app', 'email')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_deliveries_notification
    ON deliveries(notification_id);

CREATE INDEX IF NOT EXISTS idx_event_receipts_event_id
    ON event_receipts(event_id);
