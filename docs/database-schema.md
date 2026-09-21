# Notification Hub Database Schema

## 1. Database Information

| Item | Value |
|---|---|
| Database Platform | Supabase |
| Database Engine | PostgreSQL |
| Project | Notification Hub Team20 |
| Region | Asia-Pacific |
| Schema | public |

The Notification Hub database consists of five main tables:

```text
users
preferences
event_receipts
notifications
deliveries
```

---

# 2. Users Table

Table name:

```text
users
```

Purpose:

Stores basic information about users.

| Column | Data Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| email | text | NO | - |
| display_name | text | NO | - |
| created_at | timestamp with time zone | NO | now() |

### Constraints

```text
PRIMARY KEY: users.id
UNIQUE: users.email
```

---

# 3. Preferences Table

Table name:

```text
preferences
```

Purpose:

Stores notification preferences for each user.

| Column | Data Type | Nullable | Default |
|---|---|---|---|
| user_id | uuid | NO | - |
| in_app_enabled | boolean | NO | true |
| email_enabled | boolean | NO | true |
| quiet_hours_start | time without time zone | YES | null |
| quiet_hours_end | time without time zone | YES | null |
| updated_at | timestamp with time zone | NO | now() |

### Constraints

```text
PRIMARY KEY: preferences.user_id
FOREIGN KEY: preferences.user_id → users.id
```

Foreign key delete behavior:

```text
ON DELETE CASCADE
```

---

# 4. Event Receipts Table

Table name:

```text
event_receipts
```

Purpose:

Stores events received from external services.

| Column | Data Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| event_id | text | NO | - |
| event_type | text | NO | - |
| source_service | text | NO | - |
| payload | jsonb | NO | {} |
| signature | text | YES | null |
| status | text | NO | accepted |
| received_at | timestamp with time zone | NO | now() |

### Constraints

```text
PRIMARY KEY: event_receipts.id
UNIQUE: event_receipts.event_id
```

### Status Check

The allowed values are:

```text
accepted
rejected
duplicate
```

The unique `event_id` is used for idempotency and duplicate event detection.

---

# 5. Notifications Table

Table name:

```text
notifications
```

Purpose:

Stores notifications generated from received events.

| Column | Data Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | - |
| event_receipt_id | uuid | YES | null |
| title | text | NO | - |
| message | text | NO | - |
| severity | text | NO | low |
| deadline | timestamp with time zone | YES | null |
| read_at | timestamp with time zone | YES | null |
| metadata | jsonb | NO | {} |
| created_at | timestamp with time zone | NO | now() |

### Constraints

```text
PRIMARY KEY: notifications.id
FOREIGN KEY: notifications.user_id → users.id
FOREIGN KEY: notifications.event_receipt_id → event_receipts.id
```

### Delete Behavior

For `user_id`:

```text
ON DELETE CASCADE
```

For `event_receipt_id`:

```text
ON DELETE SET NULL
```

### Severity Check

Allowed values:

```text
low
medium
high
critical
```

---

# 6. Deliveries Table

Table name:

```text
deliveries
```

Purpose:

Stores the delivery status of notifications.

| Column | Data Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NO | gen_random_uuid() |
| notification_id | uuid | NO | - |
| channel | text | NO | - |
| status | text | NO | pending |
| attempt_count | integer | NO | 0 |
| last_error | text | YES | null |
| delivered_at | timestamp with time zone | YES | null |
| created_at | timestamp with time zone | NO | now() |

### Constraints

```text
PRIMARY KEY: deliveries.id
FOREIGN KEY: deliveries.notification_id → notifications.id
```

Foreign key delete behavior:

```text
ON DELETE CASCADE
```

### Channel Check

Allowed values:

```text
in_app
email
```

### Status Check

Allowed values:

```text
pending
sent
failed
```

---

# 7. Relationship Summary

The database relationships are:

```text
USERS
 |
 +---- 1 : 1 ---- PREFERENCES
 |
 +---- 1 : N ---- NOTIFICATIONS
                    |
                    +---- 1 : N ---- DELIVERIES

EVENT_RECEIPTS
 |
 +---- 1 : N ---- NOTIFICATIONS
```

### Relationship Table

| Parent Table | Child Table | Relationship | Foreign Key | Delete Behavior |
|---|---|---|---|---|
| users | preferences | 1 : 1 | preferences.user_id | CASCADE |
| users | notifications | 1 : N | notifications.user_id | CASCADE |
| event_receipts | notifications | 1 : N | notifications.event_receipt_id | SET NULL |
| notifications | deliveries | 1 : N | deliveries.notification_id | CASCADE |

---

# 8. Constraints Summary

## Primary Keys

```text
users.id
preferences.user_id
event_receipts.id
notifications.id
deliveries.id
```

## Unique Constraints

```text
users.email
event_receipts.event_id
```

## Foreign Keys

```text
preferences.user_id → users.id

notifications.user_id → users.id

notifications.event_receipt_id → event_receipts.id

deliveries.notification_id → notifications.id
```

## Check Constraints

### Event Receipt Status

```text
accepted
rejected
duplicate
```

### Notification Severity

```text
low
medium
high
critical
```

### Delivery Channel

```text
in_app
email
```

### Delivery Status

```text
pending
sent
failed
```

---

# 9. JSONB Fields

The database uses PostgreSQL JSONB for flexible data.

## Event Payload

Table:

```text
event_receipts
```

Column:

```text
payload
```

Purpose:

Stores the original event payload received from an external service.

## Notification Metadata

Table:

```text
notifications
```

Column:

```text
metadata
```

Purpose:

Stores additional notification information that may vary between notification types.

---

# 10. Idempotency

The system prevents duplicate event processing using:

```text
event_receipts.event_id
```

The column has a unique constraint:

```text
UNIQUE(event_id)
```

When the same event ID is received again, the API can identify the event as a duplicate instead of creating another notification.

---

# 11. Database Deployment

The database schema was deployed to the Supabase project:

```text
Notification Hub Team20
```

Migration file:

```text
supabase/migrations/20260921_create_notification_hub_schema.sql
```

The migration creates the five tables and their related constraints.

---

# 12. Row Level Security

Row Level Security (RLS) is enabled on the database tables.

The backend communicates with Supabase using the configured service-role key.

The service-role key is stored in:

```text
.env
```

and is excluded from Git using:

```text
.gitignore
```

The service-role key must not be committed to the repository.

---

# 13. Schema Documentation

The Entity Relationship Diagram is available in:

```text
docs/ER-Diagram.md
```

The API examples are available in:

```text
docs/api-examples.md
```

The main Assignment #3 report is available in:

```text
docs/assignment-3.md
```