# Product Requirements Document
Group Members and Roles

Name	Student ID	Role
Nuttida Butthanoo	6731503103	Frontend UX/UI
Pechladda Duangkaew	6731503112	Backend API and Database
Montatip Khumphaithoon	6731503028	Quality and Security
Siriwimon Charoensirisoontorn	6731503125	Delivery and Document
Thanchanok Kakaew	6731503105	Product Manager

Group Members and Roles

|Name	| Student ID |	Role |
| ---- | ------ | ---------- |
|Nuttida Butthanoo |	6731503103	| Frontend UX/UI|
|Pechladda Duangkaew |	6731503112	| Backend API and Database|
|Montatip Khumphaithoon	| 6731503028	| Quality and Security |
|Siriwimon Charoensirisoontorn |	6731503125	| Delivery and Document |
|Thanchanok Kakaew |	6731503105	| Product Manager |

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
- POST /events accepts events from source systems (Internship, Job Board, Alumni Network)
- Verify the sender's identity via signature verification, using a signing key bound to each source system (stored in a source_systems table) — if the signature is invalid or the source system is not registered, do not create a notification
- Check for duplicate eventId using a unique constraint in the database — if it's a duplicate, return the original result instead of creating a new record (protects against a source system accidentally resending the same event)
- Validate that the payload has all required fields (userId, category, title, priority); if any are missing, reject with an error message stating which field is missing
- Log every rejected event into a single log table with a reject_reason field (invalid_key / duplicate / invalid_payload), so it can later be checked which side the problem came from

### FR-02 Create and Route Notifications
- Once an event passes validation, the system checks the target user's preference for that category
- If the user has opted in to that category → create a notification record with status unread
- If the user has opted out → do not create a record the user can see, but log it as suppressed (useful for debugging during a demo, to confirm the system is working correctly rather than silently failing)
- If the userId does not exist in the system → reject and log separately from the suppressed case

### FR-03 Notification Inbox (End User)
- GET /notifications/me returns notifications belonging only to the logged-in user (filtered by user_id from the token)
- Supports filtering by read/unread status and simple pagination (limit/offset)
- Displays title, type, priority, source, read status, and received time

### FR-04 Mark as Read
- POST /notifications/{id}/read changes the status to read
- Must be callable repeatedly without error (idempotent)
- Must verify that id actually belongs to the logged-in user before allowing the update (prevents marking another user's notification as read by guessing the id)

### FR-05 Manage Preferences
- PATCH /preferences lets a user set opt-in/opt-out per category
- Changes only take effect for notifications created after the change is saved — not retroactively
- If a user has never set a preference for a given category, the system defaults to opted in for all categories, so the user doesn't miss important information

### FR-06 View Delivery Status (Admin)
- GET /deliveries/{id} shows status: pending / delivered / failed
- Restricted to admins only (checked via role in the token), and must not return more of the notification's content than necessary

### FR-07 Retry a Failed Delivery (Admin)
- POST /notifications/{id}/retry lets an admin trigger a retry for a single item
- If the notification was already delivered successfully, the system must reject a further retry attempt (check status first)
- Maximum of 5 retries per notification — beyond that, change the status to failed_permanent and stop retrying automatically (prevents repeated retry attempts from overloading the system)

### FR-08 Health Check and Logs
- GET /health checks whether the database and core services are responsive (e.g., can it ping the DB successfully)
- Provide a page/endpoint for admins to view the event-reception log filtered by reject_reason (from FR-01), to distinguish invalid signature / duplicate event / delivery failure from one another

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
- POST /events must validate the signature on every request — no shortcuts, even during development/demo
- Passwords and signing keys must never be stored as plain text in the database (must be hashed/encrypted)
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

### BR-02 Authentication via Signature Verification
Only accept events from source systems with a pre-registered signing key, verified via signature.

### BR-03 User Preferences Override a Valid Event
Even if an event passes all validation steps, if the user has opted out of that category, the system must not create a visible notification for them.

### BR-04 Maximum of 5 Retries
A failed delivery that has been retried more than 5 times must be set to failed_permanent and stop retrying automatically; it must then be reviewed manually by an admin.

### BR-05 AI Summarization Restricted to Designated Categories
Categories related to deadlines or important matters must always be shown in full and must never pass through AI, to avoid the risk of misleading summarization on content that directly affects the user.

### BR-06 Data Access Scope
End Users can only see their own data. Administrators can only see delivery status/health information, not the private content of a user's notifications, beyond what is necessary.

### BR-07 External Systems Do Not Choose Recipients
A source system can only submit event content. The decision of who receives it belongs solely to Notification Hub, based on the user's own preferences (in-app only).

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
- enabled (in-app only — no channel field, since email/SMS are out of scope)
- updatedAt

### Entity C
**Delivery**
- deliveryId
- notificationId
- status (pending / delivered / failed)
- retryCount
- createdAt
- deliveredAt

### Entity D
**EventReceipt**
- eventId
- sourceSystemId
- userId
- category
- title
- priority
- receivedAt
- status
  
### Other Entities
SourceSystem — registered producer systems and their signing keys
RejectedEventLog — rejected events with reject_reason (invalid_key / duplicate / invalid_payload)
AnalyticsEvent — records pulled periodically by the Analytics system

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

**API-01 POST /events**
Accepts events from registered source systems. Verifies the signature, validates required payload fields, checks eventId for duplicates, and routes to notification creation per the user's preferences. Rejected events are logged with a reject_reason.

**API-02 GET /notifications/me**
Returns the logged-in user's own notifications, filtered by user_id from the token. Supports read/unread filtering and simple pagination (limit/offset).

**API-03 POST /notifications/{id}/read**
Marks a notification as read. Idempotent — safe to call repeatedly. Verifies the notification belongs to the calling user before updating.

**API-04 PATCH /preferences**
Updates a user's opt-in/opt-out setting per category. Takes effect only for notifications created after the change (not retroactive).

**API-05 GET /deliveries/{id}**
Admin-only. Returns the delivery status (pending / delivered / failed) of a single item, without exposing more notification content than necessary.

**API-06 POST /notifications/{id}/retry**
Admin-only. Triggers a retry for a failed delivery. Rejects the request if the notification is already delivered, or if the retry limit (5) has been reached (failed_permanent).

**API-07 GET /health**
Checks whether the database and core services are responsive (e.g., DB ping).

**API-08 GET /events/log (Admin)**
Returns the event-reception log filtered by reject_reason, so admins can distinguish invalid signature / duplicate event / invalid payload issues from one another.

---

## 12. Security

## Authentication
- End Users authenticate via JWT or session
- External Systems authenticate via signature verification, using a per-source-system signing key
- Administrators authenticate the same way as End Users, with an elevated role claim

## Authorization
- End Users can only access their own notifications and preferences (row-level scoped by user_id)
- Administrators can access delivery/health/log data system-wide, but not more of a user's private notification content than necessary
- Admin-only endpoints (/deliveries, /retry, event log) check role explicitly, not just login status

## Data Protection
- Passwords and signing keys are never stored as plain text — must be hashed/encrypted
- POST /events validates the signature on every request, with no exceptions during development/demo
- Rejected/log data retains only what's needed to diagnose invalid_key / duplicate / invalid_payload issues, not full raw payloads beyond necessity

---

## 13. Error Handling

### Expected Errors
- 401 Unauthorized: Invalid or unregistered API key.
- Duplicate eventId: Return the original result without creating a duplicate notification.
- Invalid payload: Reject the event and identify the missing required field.
- Invalid userId: Reject the event and log the error.
- Notification already delivered: Reject retry request.
- Maximum retry exceeded: Set delivery status to failed_permanent.

### Failure Scenarios
- External system sends an invalid API key.
- External system sends a duplicate event.
- Required event fields are missing.
- Target user does not exist.
- Notification delivery fails.
- AI summarization service is unavailable.
- Analytics service is unavailable.
---

## 14. Deployment

### Development
- Deploy and test the system using development environment settings.
- Use free-tier services where possible.
- Test API endpoints, database operations, authentication, and notification delivery.
- AI summarization should be limited to designated low-risk categories.
### Production
- Deploy the Notification Hub with secure authentication and API key validation.
- Ensure database indexes are configured for userId and eventId.
- Monitor system health using GET /health.
- Ensure the core notification system continues to work if AI or Analytics services are unavailable.

---

## 15. Constraints

**Budget**: Limited to the project/course budget; prioritize free or low-cost services
**Time**: Must be delivered within the course/project timeframe
**Team**: Small team — design choices favor simplicity and maintainability over scale
**Free Tier**: AI API usage is limited to a free tier/credit allowance (per NFR-04), so calls are restricted to low-risk categories only
---

## 16. Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Invalid API key or unauthorized event | Event may be rejected | Validate API key on every request |
| Duplicate events | Duplicate notifications may be created | Use unique eventId constraint |
| Notification delivery failure | User may not receive important information | Provide retry mechanism with a maximum of 5 retries |
| AI service unavailable | Notification summarization may fail | Fall back to the original notification text |
| Analytics service unavailable | Analytics data may not be processed immediately | Store data in analytics_events table and allow Analytics to pull it later |
| Unauthorized access | User or system data may be exposed | Use authentication, authorization, and role-based access control |
| High AI API cost | Project may exceed budget | Limit AI to low-risk categories and cache summaries |

---

## 17. Acceptance Criteria

### MVP is complete when:
- [ ] External systems can submit valid events through POST /events with API key verification and duplicate event checking.
- [ ] Users can view notifications, manage preferences, and mark notifications as read.
- [ ] Administrators can view delivery status, retry failed deliveries, and monitor system health.
- [ ] Failed events and deliveries are logged and handled correctly.
- [ ] AI summarization works only for designated low-risk categories and falls back to the original text when unavailable.
- [ ] Security and access control requirements are implemented for users, administrators, and external systems.

---

## 18. Future Improvements

- Add email and SMS/push notification channels (currently in-app only)
- Introduce smart ranking or AI-based relevance scoring for the inbox (explicitly out of scope for MVP)
- Add deeper analytics for notification reading behavior.
- Add configurable retry backoff strategy instead of a fixed retry count
- Add more notification channels based on user preferences.
