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

# 10. CRUD API Summary

| Operation | Method | Endpoint | Description |
|---|---|---|---|
| Create | POST | `/events` | รับ event และสร้าง notification |
| Read | GET | `/notifications/me` | อ่าน notifications ของ user |
| Read | GET | `/deliveries/:id` | อ่าน delivery |
| Update | PATCH | `/preferences` | แก้ไข notification preferences |
| Update | POST | `/notifications/:id/read` | Mark notification as read |
| Update | POST | `/notifications/:id/retry` | Retry failed delivery |
| Delete | DELETE | `/notifications/:id` | ลบ notification |

---

# 11. Security

`POST /events` ใช้ HMAC SHA-256 signature เพื่อยืนยันว่า event มาจาก source ที่ได้รับอนุญาต

Request header:

```http
x-event-signature
```

Webhook secret:

```text
EVENT_WEBHOOK_SECRET
```

Supabase service-role key:

```text
SUPABASE_SERVICE_ROLE_KEY
```

ค่าความลับถูกเก็บไว้ใน `.env`

ไฟล์ `.env` ถูกเพิ่มใน `.gitignore` และไม่ควร commit ขึ้น GitHub

---

# 12. API Testing

สามารถรัน automated tests ได้ด้วย:

```powershell
npm test
```

ผลการทดสอบล่าสุด:

```text
tests 10
pass 10
fail 0
```

การทดสอบครอบคลุม:

- Event signature validation
- Event creation
- Duplicate event
- Notification preferences
- Delivery creation
- Delivery lookup
- Mark notification as read
- Retry failed delivery
- Delete notification
- Health check

---

# 13. API Flow

```text
External Service
       |
       | POST /events
       v
Event Receipt
       |
       v
Notification
       |
       +----------------+
       |                |
       v                v
    In-App            Email
    Delivery          Delivery
       |                |
       +-------+--------+
               |
               v
        Delivery Status
```