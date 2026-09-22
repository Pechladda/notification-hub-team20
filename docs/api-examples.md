# Notification Hub API Examples

## API Overview

Notification Hub provides REST APIs for receiving events, managing notification preferences, reading notifications, tracking deliveries, retrying failed deliveries, and deleting notifications.

Base URL for local development:

```text
http://localhost:3000
```

---

# 1. Receive Event

## POST `/events`

ใช้สำหรับรับ event จาก external service และสร้าง notification ให้กับผู้ใช้

### Request Headers

```http
Content-Type: application/json
x-event-signature: <HMAC-SHA256-SIGNATURE>
```

### Request Body

```json
{
  "eventId": "assignment-2026-001",
  "eventType": "assignment.created",
  "sourceService": "Assignment",
  "userId": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
  "title": "New Assignment",
  "message": "Assignment #3 Database Design is available.",
  "severity": "medium"
}
```

### Successful Response

HTTP Status:

```text
201 Created
```

Example:

```json
{
  "status": "accepted",
  "notificationId": "158dd74b-af54-4c5a-b158-f86a510efead",
  "deliveries": [
    {
      "id": "68778ac0-f9af-4dba-afae-2b2a44ff68a8",
      "channel": "in_app",
      "status": "pending"
    }
  ]
}
```

### Duplicate Event

ถ้า `eventId` ถูกส่งเข้ามาซ้ำ ระบบจะตรวจสอบ duplicate event

Example:

```json
{
  "status": "duplicate"
}
```

### Invalid Signature

หาก signature ไม่ถูกต้อง:

```json
{
  "error": "Invalid signature"
}
```

HTTP Status:

```text
401 Unauthorized
```

---

# 2. Get User Notifications

## GET `/notifications/me`

ใช้สำหรับเรียกดู notifications ของผู้ใช้

### Request

```http
GET /notifications/me?user_id=37ae3a0a-8032-4d67-9e65-f1b6cb50687b
```

### Example Response

```json
[
  {
    "id": "158dd74b-af54-4c5a-b158-f86a510efead",
    "user_id": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
    "title": "New Assignment",
    "message": "Assignment #3 Database Design is available.",
    "severity": "medium",
    "deadline": null,
    "read_at": null,
    "metadata": {},
    "created_at": "2026-09-21T10:00:00.000Z"
  }
]
```

HTTP Status:

```text
200 OK
```

---

# 3. Get Delivery

## GET `/deliveries/:id`

ใช้สำหรับตรวจสอบข้อมูลและสถานะของ delivery

### Request

```http
GET /deliveries/68778ac0-f9af-4dba-afae-2b2a44ff68a8
```

### Example Response

```json
{
  "id": "68778ac0-f9af-4dba-afae-2b2a44ff68a8",
  "notification_id": "158dd74b-af54-4c5a-b158-f86a510efead",
  "channel": "in_app",
  "status": "pending",
  "attempt_count": 0,
  "last_error": null,
  "delivered_at": null,
  "created_at": "2026-09-21T10:00:00.000Z"
}
```

HTTP Status:

```text
200 OK
```

---

# 4. Update Notification Preferences

## PATCH `/preferences`

ใช้สำหรับแก้ไข notification preferences ของผู้ใช้

### Request

```http
PATCH /preferences
Content-Type: application/json
```

### Request Body

```json
{
  "user_id": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
  "in_app_enabled": true,
  "email_enabled": false,
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "07:00"
}
```

### Example Response

```json
{
  "user_id": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
  "in_app_enabled": true,
  "email_enabled": false,
  "quiet_hours_start": "22:00:00",
  "quiet_hours_end": "07:00:00"
}
```

HTTP Status:

```text
200 OK
```

---

# 5. Mark Notification as Read

## POST `/notifications/:id/read`

ใช้สำหรับเปลี่ยน notification ให้เป็นสถานะอ่านแล้ว

### Request

```http
POST /notifications/158dd74b-af54-4c5a-b158-f86a510efead/read
```

### Example Response

```json
{
  "id": "158dd74b-af54-4c5a-b158-f86a510efead",
  "read_at": "2026-09-21T10:30:00.000Z"
}
```

HTTP Status:

```text
200 OK
```

---

# 6. Retry Failed Delivery

## POST `/notifications/:id/retry`

ใช้สำหรับ retry delivery ที่มีสถานะ `failed`

### Request

```http
POST /notifications/158dd74b-af54-4c5a-b158-f86a510efead/retry
```

### Example Response

```json
{
  "status": "retry_queued"
}
```

HTTP Status:

```text
200 OK
```

หากไม่มี failed delivery สำหรับ notification นั้น ระบบจะตอบกลับด้วย HTTP `400 Bad Request`

---

# 7. Delete Notification

## DELETE `/notifications/:id`

ใช้สำหรับลบ notification

### Request

```http
DELETE /notifications/158dd74b-af54-4c5a-b158-f86a510efead
```

### Example Response

```json
{
  "status": "deleted",
  "notificationId": "158dd74b-af54-4c5a-b158-f86a510efead"
}
```

HTTP Status:

```text
200 OK
```

---

# 8. Health Check

## GET `/health`

ใช้ตรวจสอบว่า Notification Hub backend ทำงานอยู่หรือไม่

### Request

```http
GET /health
```

### Example Response

```json
{
  "status": "ok",
  "service": "notification-hub",
  "timestamp": "2026-09-21T10:00:00.000Z"
}
```

HTTP Status:

```text
200 OK
```

---

# 9. Supabase Health Check

## GET `/health/supabase`

ใช้ตรวจสอบว่า backend สามารถเชื่อมต่อกับ Supabase database ได้หรือไม่

### Request

```http
GET /health/supabase
```

### Example Response

```json
{
  "status": "ok",
  "service": "notification-hub",
  "database": "connected"
}
```

HTTP Status:

```text
200 OK
```

---

# 10. Direct Create Notification

## POST `/api/notifications`

ใช้สำหรับระบบภายนอกหรือกลุ่มอื่นที่ต้องการสร้าง Notification โดยตรงตาม contract โดยไม่ต้องผ่าน HMAC event signature

### Request

```http
POST /api/notifications
Content-Type: application/json
```

### Request Body

```json
{
  "userId": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
  "title": "Application Update",
  "message": "Your application was approved by the company.",
  "severity": "medium",
  "deadline": "2026-10-01T12:00:00.000Z",
  "metadata": {
    "source": "JobBoard",
    "jobId": "job-101"
  }
}
```

- `userId` (required): UUID ของผู้รับ
- `title` (required): หัวข้อการแจ้งเตือน
- `message` (required): ข้อความการแจ้งเตือน
- `severity` (optional): `"low" | "medium" | "high" | "critical"` (ค่าเริ่มต้น `"low"`)
- `deadline` (optional): วันหมดเวลา (ISO date string)
- `metadata` (optional): ข้อมูล JSON เพิ่มเติม

### Successful Response

HTTP Status: `201 Created`

```json
{
  "status": "created",
  "notification": {
    "id": "158dd74b-af54-4c5a-b158-f86a510efead",
    "user_id": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
    "title": "Application Update",
    "message": "Your application was approved by the company.",
    "severity": "medium",
    "deadline": "2026-10-01T12:00:00.000Z",
    "metadata": {
      "source": "JobBoard",
      "jobId": "job-101"
    },
    "created_at": "2026-09-22T10:00:00.000Z"
  },
  "deliveries": [
    {
      "id": "68778ac0-f9af-4dba-afae-2b2a44ff68a8",
      "notification_id": "158dd74b-af54-4c5a-b158-f86a510efead",
      "channel": "in_app",
      "status": "pending",
      "attempt_count": 0
    }
  ]
}
```

---

# 11. External Webhooks (Job Board & Partner Systems)

## POST `/api/webhooks/jobboard` (หรือ `/api/webhooks/:service`)

ใช้สำหรับรับ Webhook/Event จากระบบภายนอก (เช่น Job Board, Internship, Alumni Network) เพื่อแปลงเป็น Notification ให้อัตโนมัติ

### Request

```http
POST /api/webhooks/jobboard
Content-Type: application/json
```

### Request Body Example

```json
{
  "eventId": "jb-evt-2026-001",
  "eventType": "job.application.status",
  "userId": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b",
  "title": "Job Interview Scheduled",
  "message": "You have been invited for an interview on Friday.",
  "severity": "high",
  "data": {
    "jobTitle": "Backend Developer",
    "company": "Tech Corp"
  }
}
```

### Successful Response

HTTP Status: `201 Created`

```json
{
  "status": "accepted",
  "service": "JobBoard",
  "eventReceiptId": "7d6d3701-08fa-4e7a-9a99-4c1264c7ad3f",
  "notificationId": "158dd74b-af54-4c5a-b158-f86a510efead",
  "notification": { ... },
  "deliveries": [ ... ]
}
```

*(หากส่ง `eventId` ซ้ำ ระบบจะตอบกลับด้วย `{ "status": "duplicate" }` HTTP 200)*

---

# 12. Outbound Integration Services

## POST `/api/integrations/dispatch-webhook`

ใช้สำหรับให้ Notification Hub ยิง Webhook ส่งต่อกลับไประบบภายนอกของกลุ่มอื่น

```json
{
  "url": "https://external-service.onrender.com/webhooks/listener",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer secret-token"
  },
  "payload": {
    "event": "notification.delivered",
    "notificationId": "158dd74b-af54-4c5a-b158-f86a510efead",
    "timestamp": "2026-09-22T10:00:00.000Z"
  }
}
```

## POST `/api/integrations/fetch-external`

ใช้สำหรับดึงข้อมูล (Pull) จาก Public Base URL และ GET Endpoint ของกลุ่มอื่น

```json
{
  "baseUrl": "https://external-service.onrender.com",
  "endpoint": "/api/v1/user-status",
  "headers": {
    "Authorization": "Bearer external-api-token"
  },
  "params": {
    "userId": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b"
  },
  "createNotification": true,
  "userId": "37ae3a0a-8032-4d67-9e65-f1b6cb50687b"
}
```

---

# 13. API Endpoint Summary

ทุก Endpoint รองรับทั้งการเรียกผ่าน prefix `/api/*` และ root `/*`:

| Method | Endpoint | Description | Category |
|---|---|---|---|
| POST | `/api/notifications` | สร้าง notification โดยตรงตาม contract | Notification (Create) |
| GET | `/api/notifications/me` | ดึง notifications ของ user | Notification (Read) |
| POST | `/api/notifications/:id/read` | Mark notification ว่าอ่านแล้ว | Notification (Update) |
| POST | `/api/notifications/:id/retry` | Retry failed delivery | Delivery Action (Update) |
| DELETE | `/api/notifications/:id` | ลบ notification | Notification (Delete) |
| POST | `/api/events` | รับ event พร้อมตรวจ HMAC signature & deduplication | Event Ingestion (Create) |
| POST | `/api/webhooks/jobboard` | รับ Webhook จาก Job Board เข้าสู่ระบบ Notification | Webhook Receiver |
| POST | `/api/webhooks/:service` | รับ Webhook จากระบบภายนอกอื่นๆ | Webhook Receiver |
| GET | `/api/deliveries/:id` | ตรวจสอบข้อมูลและสถานะ delivery | Delivery (Read) |
| PATCH | `/api/preferences` | แก้ไข notification preferences | Preference (Update) |
| POST | `/api/integrations/dispatch-webhook` | ยิง Webhook ส่งต่อกลับไประบบกลุ่มอื่น | Outbound Webhook |
| POST | `/api/integrations/fetch-external` | ดึงข้อมูล GET จากระบบกลุ่มอื่น | Outbound Data Fetch |
| GET | `/api/health` | ตรวจสอบสถานะการทำงานของเซิร์ฟเวอร์ | Health Check |
| GET | `/api/health/supabase` | ตรวจสอบการเชื่อมต่อฐานข้อมูล Supabase | Health Check |

---

# 14. Automated Testing

รัน Automated Test suite ด้วย:

```powershell
npm test
```

ผลการทดสอบ:

```text
tests 19
pass 19
fail 0
```