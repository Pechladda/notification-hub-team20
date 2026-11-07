-- ============================================
-- Notification Hub - Cloudflare D1 Seed Data
-- Team 20
-- ============================================

-- Insert Test & Team Users
INSERT OR IGNORE INTO users (id, email, display_name) VALUES
    ('37ae3a0a-8032-4d67-9e65-f1b6cb50687b', 'test.student@university.ac.th', 'Somchai Jaidee (Test Student)'),
    ('6731503103-uuid', '6731503103@university.ac.th', 'Nuttida Butthanoo'),
    ('6731503112-uuid', '6731503112@university.ac.th', 'Pechladda Duangkaew'),
    ('6731503028-uuid', '6731503028@university.ac.th', 'Montatip Khumphaithoon'),
    ('6731503125-uuid', '6731503125@university.ac.th', 'Siriwimon Charoensirisoontorn'),
    ('6731503105-uuid', '6731503105@university.ac.th', 'Thanchanok Kakaew');

-- Insert Initial Preferences
INSERT OR IGNORE INTO preferences (user_id, in_app_enabled, email_enabled, quiet_hours_start, quiet_hours_end) VALUES
    ('37ae3a0a-8032-4d67-9e65-f1b6cb50687b', 1, 0, '22:00:00', '07:00:00'),
    ('6731503103-uuid', 1, 1, '23:00:00', '06:00:00'),
    ('6731503112-uuid', 1, 1, '23:00:00', '06:00:00'),
    ('6731503028-uuid', 1, 1, '23:00:00', '06:00:00'),
    ('6731503125-uuid', 1, 1, '23:00:00', '06:00:00'),
    ('6731503105-uuid', 1, 1, '23:00:00', '06:00:00');

-- Insert Sample Event Receipt
INSERT OR IGNORE INTO event_receipts (id, event_id, event_type, source_service, payload, status) VALUES
    ('seed-evt-receipt-001', 'evt-seed-sample-001', 'job_board.interview.scheduled', 'Job Board', '{"company":"Tech Corp","role":"Software Engineer Intern"}', 'accepted');

-- Insert Sample Notification
INSERT OR IGNORE INTO notifications (id, user_id, event_receipt_id, title, message, severity, metadata) VALUES
    ('seed-notif-001', '37ae3a0a-8032-4d67-9e65-f1b6cb50687b', 'seed-evt-receipt-001', 'สัมภาษณ์งานได้รับการยืนยัน', 'คุณได้รับนัดหมายสัมภาษณ์ตำแหน่ง Software Engineer Intern จาก Tech Corp', 'high', '{"source":"Job Board","interviewDate":"2026-11-15"}');

-- Insert Sample Delivery
INSERT OR IGNORE INTO deliveries (id, notification_id, channel, status, attempt_count, delivered_at) VALUES
    ('seed-del-001', 'seed-notif-001', 'in_app', 'sent', 1, datetime('now'));
