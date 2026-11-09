# Assignment #3 — Database Design

## Notification Hub — Team 20

---

## 1. Project Overview

Notification Hub is a centralized notification service for receiving events from other services and delivering notifications to users.

The system is designed to support:

- Receiving events from external services
- Preventing duplicate event processing
- Creating notifications
- Managing user notification preferences
- Supporting multiple notification channels
- Tracking notification delivery status
- Retrying failed deliveries
- Marking notifications as read
- Deleting notifications
- Checking backend and database health

The backend is implemented using Node.js and Express.js, while the database is hosted on Supabase PostgreSQL.

---

# 2. Database Selection

## Selected Primary Database: Cloudflare D1 (SQLite at the Edge)
### Backup Database: Supabase PostgreSQL

The project deploys on **Cloudflare D1** as the primary database platform, while maintaining **Supabase PostgreSQL** as a secondary backup database.

Cloudflare D1 is a serverless relational SQL database built on SQLite and distributed across Cloudflare's edge network, directly bound to Cloudflare Workers.

## Reasons for Choosing Cloudflare D1

### 2.1 Edge Performance & Near-Zero Cold Starts
Cloudflare D1 runs directly alongside Cloudflare Workers at the edge (< 5ms cold start), providing ultra-low query latency for incoming event webhooks.

### 2.2 Continuous Availability (No Inactivity Pauses)
Unlike free-tier managed cloud databases that auto-pause after 7 days of inactivity (e.g. Supabase free tier), Cloudflare D1 remains continuously accessible for automated tests, demonstrations, and grading.

### 2.3 Relational Data Model & Integrity
Notification Hub contains several entities with clear relationships:
- Users
- Preferences
- Event Receipts
- Notifications
- Deliveries

D1 provides full relational integrity via SQLite:
- Primary keys (`TEXT` UUIDs)
- Foreign keys with `ON DELETE CASCADE` and `ON DELETE SET NULL`
- Unique constraints (`event_id` and `email`)
- Check constraints (severities, statuses, delivery channels)

### 2.4 Built-in JSON Functions
The system stores flexible event payloads and notification metadata as JSON text, queryable using SQLite's native `json_extract()` functions.

### 2.5 Secondary Backup Resilience (Supabase PostgreSQL)
The project also retains Supabase PostgreSQL as a secondary backup database with full schema preservation (`supabase/migrations/20260921_create_notification_hub_schema.sql`).



---

# 3. System Architecture

The main data flow is:

```text
External Service
       |
       | POST /events
       v
Notification Hub API
       |
       v
Event Receipt
       |
       v
Notification
       |
       +-------------------+
       |                   |
       v                   v
    In-App              Email
    Delivery            Delivery
       |                   |
       +---------+---------+
                 |
                 v
          Delivery Status
```

The main technologies are:

```text
Node.js
Express.js
Supabase
PostgreSQL
REST API
```

The backend communicates with Supabase using the Supabase JavaScript client.

---

# 4. Database Schema

The Notification Hub database contains five main tables:

1. `users`
2. `preferences`
3. `event_receipts`
4. `notifications`
5. `deliveries`

---

## 4.1 Users

The `users` table stores basic user information.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| email | text | NO | - | UNIQUE |
| display_name | text | NO | - | - |
| created_at | timestamptz | NO | now() | - |

---

## 4.2 Preferences

The `preferences` table stores notification preferences for each user.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| user_id | uuid | NO | - | Primary Key, Foreign Key |
| in_app_enabled | boolean | NO | true | - |
| email_enabled | boolean | NO | true | - |
| quiet_hours_start | time | YES | null | - |
| quiet_hours_end | time | YES | null | - |
| updated_at | timestamptz | NO | now() | - |

Relationship:

```text
preferences.user_id → users.id
```

A user can have one preference record.

---

## 4.3 Event Receipts

The `event_receipts` table stores events received from external services.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| event_id | text | NO | - | UNIQUE |
| event_type | text | NO | - | - |
| source_service | text | NO | - | - |
| payload | jsonb | NO | {} | - |
| signature | text | YES | null | - |
| status | text | NO | accepted | CHECK |
| received_at | timestamptz | NO | now() | - |

Valid values for `status` are:

```text
accepted
rejected
duplicate
```

The unique constraint on `event_id` helps prevent duplicate event processing.

---

## 4.4 Notifications

The `notifications` table stores notifications generated from events.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| user_id | uuid | NO | - | Foreign Key |
| event_receipt_id | uuid | YES | null | Foreign Key |
| title | text | NO | - | - |
| message | text | NO | - | - |
| severity | text | NO | low | CHECK |
| deadline | timestamptz | YES | null | - |
| read_at | timestamptz | YES | null | - |
| metadata | jsonb | NO | {} | - |
| created_at | timestamptz | NO | now() | - |

Valid values for `severity` are:

```text
low
medium
high
critical
```

---

## 4.5 Deliveries

The `deliveries` table stores delivery information for each notification channel.

| Column | Type | Null | Default | Constraint |
|---|---|---|---|---|
| id | uuid | NO | gen_random_uuid() | Primary Key |
| notification_id | uuid | NO | - | Foreign Key |
| channel | text | NO | - | CHECK |
| status | text | NO | pending | CHECK |
| attempt_count | integer | NO | 0 | - |
| last_error | text | YES | null | - |
| delivered_at | timestamptz | YES | null | - |
| created_at | timestamptz | NO | now() | - |

Valid values for `channel` are:

```text
in_app
email
```

Valid values for `status` are:

```text
pending
sent
failed
```

---

# 5. Database Relationships

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

## Relationship Details

### Users → Preferences

One user has one preference record.

```text
users.id
    |
    +---- preferences.user_id
```

### Users → Notifications

One user can receive many notifications.

```text
users.id
    |
    +---- notifications.user_id
```

### Event Receipts → Notifications

One event receipt can be associated with multiple notifications.

```text
event_receipts.id
    |
    +---- notifications.event_receipt_id
```

### Notifications → Deliveries

One notification can have multiple delivery records.

```text
notifications.id
    |
    +---- deliveries.notification_id
```

---

# 6. Foreign Key Delete Behavior

The database uses foreign key constraints to maintain referential integrity.

## Users → Preferences

```text
ON DELETE CASCADE
```

When a user is deleted, the user's preference record is also deleted.

## Users → Notifications

```text
ON DELETE CASCADE
```

When a user is deleted, the user's notifications are also deleted.

## Event Receipts → Notifications

```text
ON DELETE SET NULL
```

When an event receipt is deleted, the related notification remains and its `event_receipt_id` becomes NULL.

## Notifications → Deliveries

```text
ON DELETE CASCADE
```

When a notification is deleted, its delivery records are also deleted.

---

# 7. ER Diagram

The ER Diagram is documented separately in:

```text
docs/ER-Diagram.md
```

The diagram represents:

```text
USERS
  |
  +---- PREFERENCES
  |
  +---- NOTIFICATIONS
             |
             +---- DELIVERIES

EVENT_RECEIPTS
  |
  +---- NOTIFICATIONS
```

---

# 8. Database Deployment

## 8.1 Primary Deployment: Cloudflare D1 (Edge SQL Database)

The primary production database is deployed to **Cloudflare D1**:

```text
Database Name: notification-hub-db
Engine: SQLite at the Edge
Configuration: wrangler.toml
Migration Script: cloudflare/schema.sql (and cloudflare/migrations/0001_initial_schema.sql)
Seed Script: cloudflare/seed.sql
Deployment Tooling: Cloudflare Wrangler CLI
```

The migration creates the five relational tables with constraints and indexes:

```text
users (id, email, display_name, created_at)
preferences (user_id, in_app_enabled, email_enabled, quiet_hours_start, quiet_hours_end, updated_at)
event_receipts (id, event_id, event_type, source_service, payload, signature, status, received_at)
notifications (id, user_id, event_receipt_id, title, message, severity, deadline, read_at, metadata, created_at)
deliveries (id, notification_id, channel, status, attempt_count, last_error, delivered_at, created_at)
```

The database was verified locally with `wrangler d1 execute` and deployed globally to Cloudflare's edge network.

## 8.2 Secondary Backup Deployment: Supabase PostgreSQL

As a reliable backup architecture, the database is also configured for Supabase:

```text
Project: Notification Hub Team20
Database: Supabase PostgreSQL
Region: Asia-Pacific
Migration Script: supabase/migrations/20260921_create_notification_hub_schema.sql
```

The deployed backup was verified using the Supabase SQL dashboard.

---

# 9. REST API

The Notification Hub backend provides REST APIs for database operations.

## Base URL

For production (Cloudflare Workers):

```text
https://notification-hub-team20.siriwimonchst.workers.dev
```

For local development:

```text
http://localhost:3000
```

---

## 9.1 Create

### POST `/events`

Receives an event and creates a notification.

```http
POST /events
```

The API verifies the event signature before processing the request.

---

## 9.2 Read

### GET `/notifications/me`

Retrieves notifications for a user.

```http
GET /notifications/me?user_id=<user_id>
```

### GET `/deliveries/:id`

Retrieves delivery information.

```http
GET /deliveries/<delivery_id>
```

---

## 9.3 Update

### PATCH `/preferences`

Updates notification preferences.

```http
PATCH /preferences
```

### POST `/notifications/:id/read`

Marks a notification as read.

```http
POST /notifications/<notification_id>/read
```

### POST `/notifications/:id/retry`

Retries failed deliveries.

```http
POST /notifications/<notification_id>/retry
```

---

## 9.4 Delete

### DELETE `/notifications/:id`

Deletes a notification.

```http
DELETE /notifications/<notification_id>
```

---

# 10. API Examples

Detailed API examples are provided in:

```text
docs/api-examples.md
```

The document contains examples of:

- Creating an event
- Duplicate event handling
- Invalid signature
- Getting notifications
- Getting delivery status
- Updating preferences
- Marking notifications as read
- Retrying failed deliveries
- Deleting notifications
- Backend health check
- Supabase health check

---

# 11. Security

The `POST /events` endpoint uses HMAC SHA-256 to validate incoming event requests.

The signature is provided through:

```http
x-event-signature
```

The webhook secret is stored in:

```text
EVENT_WEBHOOK_SECRET
```

The Supabase service-role key is stored in:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Sensitive configuration values are stored in `.env`.

The `.env` file is excluded from Git using `.gitignore`.

Secret keys should not be committed to the GitHub repository.

---

# 12. Automated Testing

The project uses Node.js test runner and Supertest for automated API testing.

Run the tests using:

```powershell
npm test
```

Latest test result:

```text
tests 10
pass 10
fail 0
```

The tests cover:

- Event signature validation
- Event creation
- Duplicate event handling
- Notification preferences
- Delivery creation
- Delivery lookup
- Mark notification as read
- Retry failed delivery
- Delete notification
- Health check

---

# 13. Project Documentation

The database documentation is organized as follows:

```text
docs/
├── assignment-3.md
├── api-examples.md
├── database-schema.md
└── ER-Diagram.md
```

### assignment-3.md

Main Assignment #3 report.

### api-examples.md

REST API request and response examples.

### database-schema.md

Detailed database tables, columns, constraints, and relationships.

### ER-Diagram.md

Entity Relationship Diagram.

---

# 14. Conclusion

The Notification Hub database was designed and deployed with **Cloudflare D1** as the primary edge SQL database, and **Supabase PostgreSQL** maintained as the secondary backup database.

The database contains five related tables:

```text
users
preferences
event_receipts
notifications
deliveries
```

The schema uses primary keys, foreign keys, unique constraints, check constraints, and JSON/JSONB support to maintain data integrity across both Cloudflare D1 and Supabase.

The backend provides REST APIs for Create, Read, Update, and Delete operations.

The project also includes automated API tests, with the latest result showing:

```text
10 tests passed
0 tests failed
```

The project therefore includes the database design, ER Diagram, remote database deployment, REST APIs, API examples, and automated testing required for Assignment #3.