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

## Selected Database: Supabase

The project uses **Supabase** as the database platform.

Supabase provides a PostgreSQL relational database with a web dashboard and Data API.

## Reasons for Choosing Supabase

### 2.1 Relational Data Model

Notification Hub contains several entities with clear relationships:

- Users
- Preferences
- Event Receipts
- Notifications
- Deliveries

A relational database is appropriate because these entities can be connected using primary keys and foreign keys.

### 2.2 Data Integrity

PostgreSQL supports database constraints such as:

- Primary keys
- Foreign keys
- Unique constraints
- Check constraints
- NOT NULL constraints

These constraints help maintain data consistency.

### 2.3 JSONB Support

The system needs to store flexible event and notification information.

PostgreSQL provides the JSONB data type, which is used for:

- Event payload
- Notification metadata

### 2.4 Remote Cloud Database

Supabase provides a remote PostgreSQL database that can be accessed by the backend application.

This allows the project to demonstrate an actual deployed database instead of only using a local database.

### 2.5 Easy Database Management

The Supabase dashboard provides tools for:

- Creating tables
- Running SQL queries
- Viewing table data
- Checking relationships
- Managing database constraints

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

The database was deployed to the remote Supabase project:

```text
Notification Hub Team20
```

Database:

```text
Supabase PostgreSQL
```

Region:

```text
Asia-Pacific
```

The database schema was created using the migration:

```text
supabase/migrations/20260921_create_notification_hub_schema.sql
```

The migration creates the following tables:

```text
users
preferences
event_receipts
notifications
deliveries
```

The deployed database was verified using the Supabase dashboard.

---

# 9. REST API

The Notification Hub backend provides REST APIs for database operations.

## Base URL

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

The Notification Hub database was designed and deployed using Supabase PostgreSQL.

The database contains five related tables:

```text
users
preferences
event_receipts
notifications
deliveries
```

The schema uses primary keys, foreign keys, unique constraints, check constraints, and JSONB fields to maintain data integrity.

The backend provides REST APIs for Create, Read, Update, and Delete operations.

The project also includes automated API tests, with the latest result showing:

```text
10 tests passed
0 tests failed
```

The project therefore includes the database design, ER Diagram, remote database deployment, REST APIs, API examples, and automated testing required for Assignment #3.