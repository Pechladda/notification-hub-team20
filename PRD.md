# Product Requirements Document

## 1. Product Overview

### Product Name
Notification Hub

### Problem Statement
Users often receive notifications from different systems and applications,
which can make important information difficult to manage and track.
Notification Hub provides a centralized platform where users can receive,
view, and manage notifications in one place.

### Target Users
**End User**
Students who receive notifications through Notification Hub.

They can:
- View notifications (GET /notifications/me).
- Mark notifications as read (POST /notifications/{id}/read).
- View notification details (title, type, priority, source, read state).
- Manage notification preferences — channel and category (PATCH /preferences).

**Administrator**
Operations staff who monitor and maintain notification delivery. They do not create or send notification content directly — notifications are generated only from events submitted by external platforms.

They can:
- View notification delivery status (GET /deliveries/{id}).
- Retry failed deliveries (POST /notifications/{id}/retry).
- Monitor system and integration health (GET /health).
- Review rejected/duplicate events to distinguish producer errors from delivery errors.

**External System**
University platforms (Enrollment, Timetable, Assignment, Library, etc.) that submit events through Notification Hub.

They can:
- Submit events (POST /events), each with a unique eventId.
- Rely on signature verification and deduplication before an event becomes a notification.
- Receive delivery outcomes indirectly via the notification.delivered event published to Analytics.
They cannot specify individual recipients, channels, or preferences directly — Notification Hub owns routing based on each student's saved preferences.

### Product Goal
To provide a centralized, reliable, and secure platform for managing user
notifications and making important information easier to access and track.

---

## 2. Scope

### In Scope
- Receive events from source systems (Internship, Job Board, Alumni Network) via an API endpoint.
- Screens: notification inbox, delivery preferences, operations monitor.
- Send in-app notifications.
- Retry mechanism for failed delivery.
- Perform signature verification and prevent duplicate data (using eventId) before creating the Notification.
- Publish the event notification.delivered to the Analytics system.
- AI summarization for low-risk alerts, with fallback ordering (severity → deadline → time).
- Health check endpoint for monitoring.

### Out of Scope
- Sending notifications via SMS or push notifications on mobile phones.
- Smart ranking or AI-based relevance scoring.
- Deep analytics of reading behavior.
- Allowing the administrator to create/edit notification content themselves.

---

## 3. User Roles

### End User
- Read/view your own notification list
- Mark as read
- Set preferences by category and channel
**Access rights** : only own data (row-level scoped by user id)

### Administrator
- View the delivery status of every item in the system
- Order retry delivery that failed
- View health check and log of event reception (check signature rejection / duplicate)
**Access permissions** : System level delivery/health data. No more access to user private content than necessary.

### External System
- Send events into the system via POST /events only.
- No access to the UI or any other endpoints.
**Access** : Limited by API key/signature Only registered source systems

---

## 4. User Journey

### Main Journey
1. An event occurs in the source system (e.g., a student internship request is approved).
The source system sends the event to Notification Hub via POST /events.
2. Notification Hub validates the event (signature + dedupe) and checks the target user's preferences.
3. If the user has enabled that category, Notification Hub creates a notification record and displays it in the Notification Inbox (in-app).
4. The user opens the Notification Inbox, sees the new notification, and marks it as read (POST /notifications/{id}/read).

---

## 5. Functional Requirements

### FR-01 Receive Events from External Systems
- POST /events accepts events from the 16 registered source categories (Enrollment, Timetable, Assignment, Submission, Attendance, Library, Maintenance, Events, Advising, Scholarship, Health, Internship, Job Board, Alumni, Security, Insights)
- Verify the sender's identity using signature verification: each source system has a unique shared secret; the sender computes an HMAC-SHA256 signature over the raw request body and sends it in a header (e.g. X-Signature), and the backend recomputes and compares it before trusting the payload if the signature is missing or does not match, respond with 401 and do not create a notification. This is a required, independently testable check (see Section 13)
- Check for duplicate eventId using a unique constraint in the database — if it's a duplicate, return the original result instead of creating a new record (protects against a source system accidentally resending the same event)
- Validate that the payload has all required fields (userId, category, title, priority); if any are missing, reject with an error message stating which field is missing
- Log every rejected event into a single log table (the "Event Receipt" log) with a reject_reason field (invalid_signature / duplicate / invalid_payload), so it can later be checked which side the problem came from

### FR-02 Create and Route Notifications
- Once an event passes validation, the system checks the target user's preference for that category
- If the user has opted in to that category → create a notification record with status unread
- If the user has opted out → do not create a record the user can see, but log it as "suppressed" (useful for debugging during a demo, to confirm the system is working correctly rather than silently failing)
- If the userId does not exist in the system → reject and log separately from the "suppressed" case

### FR-03 Notification Inbox (End User)
- GET /notifications/me returns notifications belonging only to the logged-in user (filtered by user_id from the token)
Supports filtering by read/unread status and simple pagination (limit/offset)
- Displays title, type, priority, source, read status, and received time

### FR-04 Mark as Read
- POST /notifications/{id}/read changes the status to read
- Must be callable repeatedly without error (idempotent)
- Must verify that id actually belongs to the logged-in user before allowing the update (prevents marking another user's notification as read by guessing the id)

### FR-05 Manage Preferences
- PATCH /preferences lets a user set opt-in/opt-out per category, and choose a channel per category: in-app, email, or both
- Changes only take effect for notifications created after the change is saved not retroactively
- If a user has never set a preference for a given category, the system defaults to opted in, in-app only, so the user doesn't miss important information while avoiding unsolicited email by default

### FR-06 View Delivery Status (Admin)
- GET /deliveries/{id} shows the status of a single delivery attempt (one per channel): pending / delivered / failed / failed_permanent
- A notification with both in-app and email preferences enabled will have two Delivery records — admins can inspect each independently
- Restricted to admins only (checked via role in the token), and must not return more of the notification's content than necessary

### FR-07 Retry a Failed Delivery (Admin)
- POST /notifications/{id}/retry lets an admin trigger a retry for the notification's failed Delivery record(s) — if only the email channel failed, only that Delivery record is retried; in-app delivery (which cannot meaningfully "fail" once written to the database) is unaffected
- If a Delivery record was already delivered, the system must reject a further retry attempt for that record (check status first)
- Maximum of 5 retries per Delivery record — beyond that, change its status to failed_permanent and stop retrying automatically (prevents repeated retry attempts from overloading the system)

### FR-08 Health Check and Logs
- GET /health checks whether the database and core services are responsive (e.g., can it ping the DB successfully)
- Provide a page/endpoint for admins to view the event-reception log filtered by reject_reason (from FR-01), to distinguish invalid API key / duplicate event / delivery failure from one another

### FR-09 AI Summarization (Only for Designated Categories)
- Call an AI API (e.g., Claude/OpenAI API) to summarize notifications, but only for categories pre-designated as low-risk (e.g., general announcements, events) — not applied to every category
- Categories related to deadlines or important matters (e.g., exam results, application closing dates) must always show the full text; they must never be passed through AI summarization
- If the AI call errors out or times out, the system must immediately fall back to displaying the original text — do not make the user wait or retry the AI call
- The inbox display order must not depend on AI at all; use the following default sort as the fallback rule: severity (high → low) → deadline (near → far) → received time (newest → oldest)

### FR-10 Send Data to Analytics
- After a notification is marked delivered, write a record into an analytics_events table (instead of a real-time push through a full message-queue system, which is beyond the scope of this project)
- The Analytics side pulls data from this table periodically — if Analytics fails to pull the data, it does not affect the notification's existing delivered status

---

## 6. Non-Functional Requirements

### NFR-01 Performance
- The inbox page (GET /notifications/me) should load within a few seconds when a user has up to a few hundred notifications (no need to load-test at thousands of concurrent users)
- Use database indexes on user_id and eventId to speed up queries and duplicate checks

### NFR-02 Security
- Every user-facing endpoint (/notifications/me, /preferences) must require authentication before access (JWT or session)
- POST /events must validate the API key on every request — no shortcuts, even during development/demo
- Passwords and API keys must never be stored as plain text in the database (must be hashed/encrypted)
- Admin endpoints (/deliveries, /retry) must check role, not just whether the user is logged in

### NFR-03 Availability
- If Analytics or the AI summarization service is unreachable, the core system (receiving events, showing the inbox, marking as read) must continue to work normally — neither of these two components should be allowed to bring down the whole system
- The goal is for the system to stay usable throughout a demo/exam session, without needing production-grade SLAs

### NFR-04 Cost
- Limit AI summarization calls to only the pre-designated categories (per FR-09) to keep API costs within the project budget
- If using an AI API with a limited free tier/credits, cache summaries for events with identical or near-identical content to avoid unnecessary repeated calls

---

## 7. Business Rules

### BR-01 Deduplication via eventId
eventId must be unique per source system (enforced with a unique constraint in the DB). If duplicated, the system returns the original result without creating a new notification.

### BR-02 Authentication via API Key
Only accept events from source systems with a pre-registered API key.

### BR-03 User Preferences Override a Valid Event
Even if an event passes all validation steps, if the user has opted out of that category, the system must not create a visible notification for them.

### BR-04 Maximum of 5 Retries
A failed delivery that has been retried more than 5 times must be set to failed_permanent and stop retrying automatically; it must then be reviewed manually by an admin.

### BR-05 AI Summarization Restricted to Designated Categories
Categories related to deadlines or important matters must always be shown in full and must never pass through AI, to avoid the risk of misleading summarization on content that directly affects the user.

### BR-06 Data Access Scope
End Users can only see their own data. Administrators can only see delivery status/health information, not the private content of a user's notifications, beyond what is necessary.

### BR-07 External Systems Do Not Choose Recipients or Channels
A source system can only submit event content. The decision of who receives it and through which channel belongs solely to Notification Hub, based on the user's own preferences.

---

## 8. Data Model

### User
- userId
- name
- email
- role

### Entity A
**Notification**
- notificationId
- userId
- eventId
- category
- title
- type
- priority
- source
- status
- receivedAt
- deadline
### Entity B
**Preference**
- preferenceId
- userId
- category
- channel
- enabled
- updatedAt
**Other Entities**
- Delivery
- EventReceipt
- SourceSystem
- RejectedEventLog
- AnalyticsEvent
### Entity C
**Delivery**
-deliveryId
-notificationId
-status — pending / delivered / failed
-retryCount
-createdAt
-deliveredAt
### Entity D
**EventReceipt**
-eventId
-sourceSystemId
-userId
-category
-title
-priority
-receivedAt
-status
  

---

## 9. Architecture

### Architecture Overview
Notification Hub uses a centralized architecture. External systems send events through the POST /events API. The Backend validates the API key, checks required fields, prevents duplicate events using eventId, checks user preferences, and creates notifications. Users can view and manage notifications through the Frontend, while Administrators can monitor delivery status, retry failed deliveries, and check system health.

### Architecture Diagram
External Systems
        ↓
   POST /events
        ↓
Backend / API
        ↓
Signature / API Key Verification
        ↓
Payload Validation + Deduplication
        ↓
Check User Preferences
        ↓
Notification
        ↓
Database
        ↓
Notification Inbox
        ↓
Analytics
### Components

#### Frontend
- Notification Inbox
- Delivery Preferences
- Operations Monitor
#### Backend
- REST API
- Event Validation
- API Key Verification
- Event Deduplication
- Notification Routing
- Delivery Management
- Retry Mechanism
- AI Summarization
- Health Check
#### Database
- User
- Notification
- Preference
- Delivery
- EventReceipt
- SourceSystem
- RejectedEventLog
- AnalyticsEvent

#### Authentication
- JWT or Session for End Users
- API Key for External Systems
- Role-based access control for Administrators

#### Storage
- Database for users, notifications, preferences, deliveries, events, and logs
- analytics_events table for Analytics data
#### External Services
- External University Systems
- AI API for low-risk notification summarization
- Analytics System
---

## 10. Technology Stack
| Layer    | Technology | Reason        |
| -------- | ---------- | ------------- |
| Frontend | TBD        | Build Notification Inbox, Delivery Preferences, and Operations Monitor |
| Backend  | TBD        | Handle REST APIs, event validation, notification routing, delivery, and retry |
| Database | TBD        | Store users, notifications, preferences, deliveries, events, and logs |
| Auth     | JWT / Session / API Key | Authenticate users and external systems and control access |
| Hosting  | TBD        | Deploy and run the Notification Hub system |

---

## 11. API / Interfaces

### API-01
**POST /events**
- Receives events from registered external systems.
- Requires a valid API key.
- Validates required fields: userId, category, title, priority.
- Checks duplicate eventId.
- Returns an error if the API key is invalid, the event is duplicated, or required fields are missing.

### API-02
**GET /notifications/me**
- Returns notifications belonging only to the logged-in user.
- Supports read/unread filtering.
- Supports simple pagination using limit/offset.
- Displays title, type, priority, source, read status, and received time.
---

## 12. Security

### Authentication
- User-facing endpoints require JWT or session authentication.
- External systems must provide a registered API key when sending events.
- API keys must be validated on every request.
### Authorization
- End Users can access only their own notifications and preferences.
- Administrators can access delivery status, retry functions, health checks, and event logs.
- Admin endpoints must verify the user's role.
- External systems can access only POST /events.

### Data Protection
- Passwords and API keys must never be stored as plain text.
- API keys must be hashed or encrypted.
- User data must be restricted according to user ID.
- Administrators should not have access to private notification content beyond what is necessary.
---

## 13. Error Handling

### Expected Errors

### Failure Scenarios

---

## 14. Deployment

### Development

### Production

---

## 15. Constraints

- Budget
- Time
- Team
- Free Tier

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|

---

## 17. Acceptance Criteria

### MVP is complete when:

- [ ]
- [ ]
- [ ]

---

## 18. Future Improvements

-
