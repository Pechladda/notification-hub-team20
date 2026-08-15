# Product Requirements Document

## Group Members and Roles

| Name | Student ID | Role |
| ---- | ------ | ---------- |
| Nuttida Butthanoo | 6731503103 | Frontend UX/UI |
| Pechladda Duangkaew | 6731503112 | Backend API and Database |
| Montatip Khumphaithoon | 6731503028 | Quality and Security |
| Siriwimon Charoensirisoontorn | 6731503125 | Delivery and Document |
| Thanchanok Kakaew | 6731503105 | Product Manager |

---

## 1. Product Overview

### Product Name
Notification Hub

### Problem Statement
Users often receive notifications from different systems and applications,
which can make important information difficult to manage and track.
Notification Hub provides a centralized platform where users can receive,
view, and manage notifications in one place.

### Platform Integration
Notification Hub is one of 24 mini-projects that make up the shared **University Digital Campus Platform**. It does not manage its own user accounts or issue its own login tokens — per the platform's Required Flow #1, every service (including Notification Hub) authenticates End Users through the shared **Student Identity API** and keeps a local read-only copy of profile data in sync via the `profile.updated` event. Notification Hub's own responsibility in the ecosystem is narrow and specific: **receive events from its 17 registered source pods (Section 2) and deliver clear, preference-aware, in-app notifications.**

### Target Users
**End User**
Students who receive notifications through Notification Hub.

They can:
- View notifications (GET /notifications/me).
- Mark notifications as read (POST /notifications/{id}/read).
- View notification details (title, type, priority, source, read state).
- Manage notification preferences — category (PATCH /preferences).

**Administrator**
Operations staff who monitor and maintain notification delivery. They do not create or send notification content directly — notifications are generated only from events submitted by external platforms.

They can:
- View notification delivery status (GET /deliveries/{id}).
- Retry failed deliveries (POST /notifications/{id}/retry).
- Monitor system and integration health (GET /health).
- Review rejected/duplicate events to distinguish producer errors from delivery errors.

**External System**
The **17 registered source pods** of the Digital Campus Platform that actually submit events to Notification Hub — Student Identity, Enrollment, Timetable & Room, Attendance, Library, Maintenance, Transport/Parking, Events & Clubs, Advising, Scholarship, Wellbeing, Internship, Job Board, Alumni Network, Data & Analytics, Security & Compliance, and Campus Insights (see the full event-to-category table in Section 2). Not every pod in the platform submits events to us — e.g. Course Catalog, Assignment, Submission, Learning Assistant, Helpdesk, and API Gateway send their events to other teams, not to Notification Hub.

They can:
- Submit events (POST /events), each with a unique eventId.
- Rely on signature verification and deduplication before an event becomes a notification.
- Receive delivery outcomes via the `notification.delivered` webhook that Notification Hub sends to the Analytics system.

They cannot specify individual recipients, channels, or preferences directly — Notification Hub owns routing based on each student's saved preferences.

### Product Goal
To provide a centralized, reliable, and secure platform for managing user
notifications and making important information easier to access and track.

---

## 2. Scope

### In Scope
- Receive events from all **17 registered source events** across the Digital Campus Platform (full list in the table below) via a single `POST /events` endpoint.
- Validate End User authentication tokens issued by the shared **Student Identity API** (Notification Hub does not issue its own login tokens).
- Receive `profile.updated` events from Student Identity to keep a local, read-only user cache (name, role) in sync.
- Screens: notification inbox, delivery preferences, operations monitor.
- Send in-app notifications.
- Retry mechanism for failed delivery.
- Perform signature verification and prevent duplicate data (using eventId) before creating the Notification.
- Send the **`notification.delivered` inter-team webhook** to the Analytics system (the platform's required inter-team webhook contract owned by this team).
- AI summarization for low-risk alerts, with fallback ordering (severity → deadline → time).
- Health check endpoint for monitoring.
- Automated test suite covering at least 7 core scenarios (Section 13).

### Out of Scope
- Sending notifications via SMS or push notifications on mobile phones (email is also out of scope for this MVP — in-app only).
- Smart ranking or AI-based relevance scoring.
- Deep analytics of reading behavior.
- Allowing the administrator to create/edit notification content themselves.
- Issuing or managing End User login credentials (owned entirely by Student Identity).

### Registered Source Events

| # | Category | Event Name | Source Pod |
|---|---|---|---|
| 1 | identity | `profile.updated` | Student Identity (Pod 1) |
| 2 | enrollment | `enrollment.changed` | Enrollment (Pod 1) |
| 3 | timetable | `schedule.changed` | Timetable & Room (Pod 1) |
| 4 | attendance | `attendance.flagged` | Attendance (Pod 2) |
| 5 | library | `loan.due` | Library (Pod 3) |
| 6 | maintenance | `maintenance.status_changed` | Maintenance (Pod 3) |
| 7 | transport | `route.delayed` | Transport / Parking (Pod 3) |
| 8 | events | `event.reminder` | Events & Clubs (Pod 3) |
| 9 | advising | `advising.booked` | Advising (Pod 4) |
| 10 | scholarship | `scholarship.status` | Scholarship (Pod 4) |
| 11 | wellbeing | `appointment.reminder` | Wellbeing (Pod 4) |
| 12 | internship | `internship.status` | Internship (Pod 5) |
| 13 | job_board | `job.recommended` | Job Board (Pod 5) |
| 14 | alumni | `alumni.event` | Alumni Network (Pod 5) |
| 15 | insights | `insight.updated` | Data & Analytics (Pod 6) |
| 16 | security | `security.alert` | Security & Compliance (Pod 6) |
| 17 | campus_insights | `campus.insight` | Campus Insights (Pod 6) |

This table is the contract other pods build against — event names must match exactly, since they are what other teams will actually send during integration testing.

---

## 3. User Roles

### End User
- Read/view your own notification list
- Mark as read
- Set preferences by category
**Access rights** : only own data (row-level scoped by user id, resolved from the Student Identity token)

### Administrator
- View the delivery status of every item in the system
- Order retry delivery that failed
- View health check and log of event reception (check signature rejection / duplicate)
**Access permissions** : System level delivery/health data. No more access to user private content than necessary.

### External System
- Send events into the system via POST /events only, using one of the 17 registered event names above.
- No access to the UI or any other endpoints.
**Access** : Limited by a per-source-system signing key; only registered source systems in the table above may submit events.

---

## 4. User Journey

### Main Journey
1. An event occurs in a source pod (e.g., a student internship request is approved in the Internship service).
The source system sends the event to Notification Hub via POST /events, using its registered event name (e.g. `internship.status`).
2. Notification Hub validates the request's signature, checks the event for duplicates (dedupe), and checks the target user's preferences.
3. If the user has enabled that category, Notification Hub creates a notification record and displays it in the Notification Inbox (in-app).
4. The user, already authenticated via the Student Identity API, opens the Notification Inbox, sees the new notification, and marks it as read (POST /notifications/{id}/read).
5. Once the notification is delivered, Notification Hub sends the `notification.delivered` webhook to Analytics.

---

## 5. Functional Requirements

### FR-01 Receive Events from External Systems
- POST /events accepts events using one of the **17 registered event names** in Section 2 (e.g. `enrollment.changed`, `maintenance.status_changed`, `profile.updated`) from their registered source pod
- Verify the sender's identity via signature verification, using a signing key bound to each source system (stored in a source_systems table) — if the signature is invalid or the source system is not registered, do not create a notification
- Check for duplicate eventId using a unique constraint in the database — if it's a duplicate, return the original result instead of creating a new record (protects against a source system accidentally resending the same event)
- Validate that the payload has all required fields (userId, category, title, priority); if any are missing, reject with an error message stating which field is missing
- Reject any event whose category is not one of the 17 registered categories, rather than silently accepting an unknown category
- Log every rejected event into a single log table with a reject_reason field (invalid_key / duplicate / invalid_payload / unknown_category), so it can later be checked which side the problem came from

### FR-02 Create and Route Notifications
- Once an event passes validation, the system checks the target user's preference for that category
- If the user has opted in to that category → create a notification record with status unread
- If the user has opted out → do not create a record the user can see, but log it as suppressed (useful for debugging during a demo, to confirm the system is working correctly rather than silently failing)
- If the userId does not exist in the local user cache → reject and log separately from the suppressed case, and trigger a one-off profile lookup from Student Identity in case the cache is simply out of date

### FR-03 Notification Inbox (End User)
- GET /notifications/me returns notifications belonging only to the logged-in user (filtered by user_id resolved from the Student Identity token)
- Supports filtering by read/unread status and simple pagination (limit/offset)
- Displays title, type, priority, source, read status, and received time

### FR-04 Mark as Read
- POST /notifications/{id}/read changes the status to read
- Must be callable repeatedly without error (idempotent)
- Must verify that id actually belongs to the logged-in user before allowing the update (prevents marking another user's notification as read by guessing the id)

### FR-05 Manage Preferences
- PATCH /preferences lets a user set opt-in/opt-out per category (one of the 17 in Section 2)
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
- GET /health checks whether the database and core services are responsive (e.g., can it ping the DB successfully), and reports whether the Student Identity API and the Analytics webhook endpoint are currently reachable
- Provide a page/endpoint for admins to view the event-reception log filtered by reject_reason (from FR-01), to distinguish invalid signature / duplicate event / invalid payload / unknown category from one another

### FR-09 AI Summarization (Only for Designated Categories)
- Call an AI API (e.g., Claude/OpenAI API) to summarize notifications, but only for categories pre-designated as low-risk (e.g., `events`, `campus_insights`) — not applied to every category
- Categories related to deadlines or important matters (e.g., `scholarship`, `enrollment`, `security`) must always show the full text; they must never be passed through AI summarization
- If the AI call errors out or times out, the system must immediately fall back to displaying the original text — do not make the user wait or retry the AI call
- The inbox display order must not depend on AI at all; use the following default sort as the fallback rule: severity (high → low) → deadline (near → far) → received time (newest → oldest)

### FR-10 Notify Analytics via Webhook (Inter-Team Webhook)
- After a notification is marked `delivered`, Notification Hub sends the **`notification.delivered` webhook** as an HTTP POST to Analytics's registered endpoint, signed with a shared secret agreed with the Analytics team — this is the platform's required inter-team webhook for this pod
- Payload includes at minimum: `notificationId`, `userId`, `category`, `sourceEvent`, `deliveredAt`
- If Analytics's endpoint does not respond, times out, or returns a 5xx, Notification Hub retries with the same backoff/limit rule as FR-07 (max 5 attempts) and logs the outcome — Analytics being unreachable must never block or roll back the notification's own `delivered` status shown to the user
- The payload schema, signing scheme, and retry policy for this webhook are documented jointly with the Analytics team as part of the platform integration contract, not decided unilaterally

### FR-11 Identity Integration
- Notification Hub does not authenticate End Users itself; every request from the frontend must carry a token issued by the **Student Identity API**, which Notification Hub verifies (signature/expiry) rather than trusting blindly
- Notification Hub subscribes to the `profile.updated` event (Section 2, row 1) to keep a local `User` cache (id, name, role) fresh; Student Identity remains the source of truth, and Notification Hub never writes back to it
- If a token references a `userId` not yet present in the local cache, Notification Hub may call Student Identity's read-profile endpoint on demand rather than rejecting the request outright

---

## 6. Non-Functional Requirements

### NFR-01 Performance
- The inbox page (GET /notifications/me) should load within a few seconds when a user has up to a few hundred notifications (no need to load-test at thousands of concurrent users)
- Use database indexes on user_id and eventId to speed up queries and duplicate checks

### NFR-02 Security
- Every user-facing endpoint (/notifications/me, /preferences) must require a valid Student Identity token before access — Notification Hub never accepts a self-issued or ad-hoc token
- POST /events must validate the signature on every request — no shortcuts, even during development/demo
- The outbound `notification.delivered` webhook (FR-10) must be signed on every call, so Analytics can verify it actually came from Notification Hub
- Passwords (if any are stored locally, e.g. for admin accounts) and signing keys must never be stored as plain text in the database (must be hashed/encrypted)
- Admin endpoints (/deliveries, /retry) must check role, not just whether the user is logged in

### NFR-03 Availability
- If Analytics, the AI summarization service, or the Student Identity API's non-authentication features are unreachable, the core system (receiving events, showing the inbox, marking as read) must continue to work normally — none of these external dependencies should be allowed to bring down the whole system
- Token *validation* against Student Identity is the one dependency that is allowed to block a request, since authentication cannot be safely skipped
- The goal is for the system to stay usable throughout a demo/exam session, without needing production-grade SLAs

### NFR-04 Cost
- Limit AI summarization calls to only the pre-designated categories (per FR-09) to keep API costs within the project budget
- If using an AI API with a limited free tier/credits, cache summaries for events with identical or near-identical content to avoid unnecessary repeated calls

---

## 7. Business Rules

### BR-01 Deduplication via eventId
eventId must be unique per source system (enforced with a unique constraint in the DB). If duplicated, the system returns the original result without creating a new notification.

### BR-02 Authentication via Signature Verification
Only accept events from the 17 registered source events (Section 2), submitted by a source system with a pre-registered signing key, verified via signature.

### BR-03 User Preferences Override a Valid Event
Even if an event passes all validation steps, if the user has opted out of that category, the system must not create a visible notification for them.

### BR-04 Maximum of 5 Retries
A failed delivery that has been retried more than 5 times must be set to failed_permanent and stop retrying automatically; it must then be reviewed manually by an admin. The same 5-attempt cap applies to the outbound Analytics webhook (FR-10).

### BR-05 AI Summarization Restricted to Designated Categories
Categories related to deadlines or important matters must always be shown in full and must never pass through AI, to avoid the risk of misleading summarization on content that directly affects the user.

### BR-06 Data Access Scope
End Users can only see their own data. Administrators can only see delivery status/health information, not the private content of a user's notifications, beyond what is necessary.

### BR-07 External Systems Do Not Choose Recipients
A source system can only submit event content. The decision of who receives it belongs solely to Notification Hub, based on the user's own preferences (in-app only).

### BR-08 Student Identity Is the Single Source of Truth for Identity
Notification Hub never creates, edits, or authenticates a user independently of Student Identity. Any conflict between the local user cache and Student Identity is resolved in favor of Student Identity.

---

## 8. Data Model

### User
- userId
- name
- role
- lastSyncedFromIdentityAt *(local cache only — Student Identity is the source of truth, per BR-08)*

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
- status (pending / delivered / failed / failed_permanent)
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
- **SourceSystem** — the 17 registered producer pods (Section 2) and their signing keys
- **RejectedEventLog** — rejected events with reject_reason (invalid_key / duplicate / invalid_payload / unknown_category)
- **WebhookDeliveryLog** — outbound `notification.delivered` webhook attempts to Analytics, their status, and retry count (FR-10)

---

## 9. Architecture

### Architecture Overview
Notification Hub uses a centralized architecture. External systems (any of the 17 registered source pods) send events through the POST /events API. The Backend validates the signature, checks required fields, prevents duplicate events using eventId, checks user preferences, and creates notifications. End User requests are authenticated by validating a token issued by the shared Student Identity API — Notification Hub never issues its own login tokens. Users view and manage notifications through the Frontend, while Administrators can monitor delivery status, retry failed deliveries, and check system health. On successful delivery, Notification Hub pushes the `notification.delivered` webhook to Analytics.

### Architecture Diagram
```
Student Identity API
        ↓ (token validation, profile.updated)
17 Source Pods (Enrollment, Library, Maintenance, ...)
        ↓
   POST /events
        ↓
Backend / API
        ↓
Signature Verification
        ↓
Payload Validation + Deduplication
        ↓
Check User Preferences
        ↓
Notification → Database
        ↓
Notification Inbox (Frontend)

Database → notification.delivered webhook → Analytics
```

### Components

#### Frontend
- Notification Inbox
- Delivery Preferences
- Operations Monitor

#### Backend
- REST API
- Event Validation
- Signature Verification
- Event Deduplication
- Notification Routing
- Delivery Management
- Retry Mechanism
- AI Summarization
- Outbound Webhook Sender (Analytics)
- Student Identity Token Validation
- Health Check

#### Database
- User (local cache)
- Notification
- Preference
- Delivery
- EventReceipt
- SourceSystem
- RejectedEventLog
- WebhookDeliveryLog

#### Authentication
- Tokens issued and owned by Student Identity; Notification Hub only validates them
- Signature-based auth for the 17 registered External Systems
- Role-based access control for Administrators

#### Storage
- Database for users (cache), notifications, preferences, deliveries, events, and logs
- WebhookDeliveryLog table for outbound Analytics webhook attempts

#### External Services
- Student Identity API (authentication + profile source of truth)
- 16 other producer pods (event sources)
- AI API for low-risk notification summarization
- Analytics System (webhook receiver)

---

## 10. Technology Stack
| Layer    | Technology | Reason        |
| -------- | ---------- | ------------- |
| Frontend | TBD        | Build Notification Inbox, Delivery Preferences, and Operations Monitor |
| Backend  | TBD        | Handle REST APIs, event validation, notification routing, delivery, retry, and the outbound Analytics webhook |
| Database | TBD        | Store users (cache), notifications, preferences, deliveries, events, and logs |
| Auth     | Student Identity token validation (JWT/JWKS) + signing keys for External Systems | Authenticate users via the shared Identity service and external systems via signature, and control access by role |
| Hosting  | TBD        | Deploy and run the Notification Hub system |

---

## 11. API / Interfaces

**API-01 POST /events**
Accepts events using one of the 17 registered event names (Section 2) from registered source systems. Verifies the signature, validates required payload fields, checks eventId for duplicates, and routes to notification creation per the user's preferences. Rejected events are logged with a reject_reason.

**API-02 GET /notifications/me**
Returns the logged-in user's own notifications, filtered by user_id resolved from the Student Identity token. Supports read/unread filtering and simple pagination (limit/offset).

**API-03 POST /notifications/{id}/read**
Marks a notification as read. Idempotent — safe to call repeatedly. Verifies the notification belongs to the calling user before updating.

**API-04 PATCH /preferences**
Updates a user's opt-in/opt-out setting per category. Takes effect only for notifications created after the change (not retroactive).

**API-05 GET /deliveries/{id}**
Admin-only. Returns the delivery status (pending / delivered / failed) of a single item, without exposing more notification content than necessary.

**API-06 POST /notifications/{id}/retry**
Admin-only. Triggers a retry for a failed delivery. Rejects the request if the notification is already delivered, or if the retry limit (5) has been reached (failed_permanent).

**API-07 GET /health**
Checks whether the database and core services are responsive, and whether the Student Identity API and Analytics webhook endpoint are currently reachable.

**API-08 GET /events/log (Admin)**
Returns the event-reception log filtered by reject_reason, so admins can distinguish invalid signature / duplicate event / invalid payload / unknown category issues from one another.

**API-09 (Outbound) POST {Analytics webhook URL} — `notification.delivered`**
The platform's required inter-team webhook for this pod. Sent by Notification Hub to Analytics on every successful delivery, signed with a shared secret. Schema and retry policy documented jointly with the Analytics team (FR-10).

**API-10 (External dependency) Student Identity API**
Notification Hub calls Student Identity to validate End User tokens and, when needed, to fetch a profile not yet present in the local cache. Notification Hub does not own this API — it is a consumer.

---

## 12. Security

### Authentication
- End Users authenticate via a token issued by the shared **Student Identity API**; Notification Hub validates it on every request and never issues its own login tokens
- External Systems authenticate via signature verification, using a per-source-system signing key
- Administrators authenticate the same way as End Users, with an elevated role claim carried in the Student Identity token

### Authorization
- End Users can only access their own notifications and preferences (row-level scoped by user_id)
- Administrators can access delivery/health/log data system-wide, but not more of a user's private notification content than necessary
- Admin-only endpoints (/deliveries, /retry, event log) check role explicitly, not just login status

### Data Protection
- Signing keys (for the 17 registered External Systems and the Analytics webhook) are never stored as plain text — must be hashed/encrypted
- POST /events validates the signature on every request, with no exceptions during development/demo
- The outbound Analytics webhook (FR-10) is signed on every call so the receiving team can verify authenticity
- Rejected/log data retains only what's needed to diagnose invalid_key / duplicate / invalid_payload / unknown_category issues, not full raw payloads beyond necessity
- Notification Hub stores only the minimal profile fields it needs locally (name, role) — it is not a secondary store of full Student Identity data

---

## 13. Test Plan

At least 7 automated test cases are required by the course; the following 9 cover both the core notification flow and the two integration points added in this revision (Student Identity and the Analytics webhook):

| # | Test Case | Covers | Expected Result |
|---|---|---|---|
| 1 | Event reception | FR-01, FR-02 | A valid, correctly signed event using a registered event name creates a `Notification` |
| 2 | Signature rejection | FR-01, BR-02 | A request with a missing or incorrect signature is rejected with 401, no `Notification` is created, and it is logged with `reject_reason = invalid_key` |
| 3 | Unknown category rejection | FR-01 | An event whose category is not one of the 17 registered categories is rejected and logged with `reject_reason = unknown_category` |
| 4 | Preference respected | FR-02, FR-05, BR-03 | An event for a category the user has opted out of does not produce a visible `Notification`, but is logged as suppressed |
| 5 | Deduplication | FR-01, BR-01 | Submitting the same `eventId` twice results in only one `Notification`; the second call returns the original result, not an error |
| 6 | Retry | FR-07, BR-04 | Retrying a `failed` delivery updates its `retryCount`; after 5 failed attempts it becomes `failed_permanent` and further retries are rejected |
| 7 | Read status | FR-04 | `POST /notifications/{id}/read` marks the notification as read, is idempotent on repeated calls, and fails if the notification does not belong to the calling user |
| 8 | Outbound Analytics webhook | FR-10 | On successful delivery, a signed `notification.delivered` webhook is sent to Analytics; a non-2xx response triggers a retry per BR-04, and Analytics being down does not change the notification's own `delivered` status |
| 9 | Identity token validation | FR-11, NFR-02 | A request with an expired or invalid Student Identity token is rejected on any End User endpoint; a valid token correctly resolves to the local user cache |

Additional case worth adding once time allows: AI summarization fallback (FR-09, when the AI call times out) — not required for the minimum 7, but directly testable with the same setup.

---

## 14. Error Handling

### Expected Errors
- 401 Unauthorized: Invalid or unregistered signing key, or an invalid/expired Student Identity token.
- Duplicate eventId: Return the original result without creating a duplicate notification.
- Invalid payload: Reject the event and identify the missing required field.
- Unknown category: Reject the event; only the 17 registered categories are accepted.
- Invalid userId: Reject the event and log the error.
- Notification already delivered: Reject retry request.
- Maximum retry exceeded: Set delivery status to failed_permanent.
- Analytics webhook failure: Retry per BR-04; never rolls back the notification's own delivered status.

### Failure Scenarios
- External system sends an invalid or missing signature.
- External system sends a duplicate event.
- External system sends an event with an unregistered category.
- Required event fields are missing.
- Target user does not exist in the local cache and cannot be resolved via Student Identity.
- Notification delivery fails.
- The outbound Analytics webhook fails or times out.
- AI summarization service is unavailable.
- Student Identity API is unreachable (authentication-blocking; see NFR-03).

---

## 15. Deployment

### Development
- Deploy and test the system using development environment settings.
- Use free-tier services where possible.
- Test API endpoints, database operations, Student Identity token validation, and notification delivery.
- AI summarization should be limited to designated low-risk categories.
- Coordinate a shared staging environment with the Analytics team to test the `notification.delivered` webhook end-to-end.

### Production
- Deploy the Notification Hub with secure authentication and signature validation.
- Ensure database indexes are configured for userId and eventId.
- Monitor system health using GET /health, including Student Identity and Analytics reachability.
- Ensure the core notification system continues to work if AI, Analytics, or non-auth Student Identity features are unavailable.

---

## 16. Constraints

**Budget**: Limited to the project/course budget; prioritize free or low-cost services
**Time**: Must be delivered within the course/project timeframe
**Team**: Small team — design choices favor simplicity and maintainability over scale
**Free Tier**: AI API usage is limited to a free tier/credit allowance (per NFR-04), so calls are restricted to low-risk categories only
**Dependency**: Delivery timing depends on Student Identity and Analytics teams' own availability for integration testing — this must be coordinated early, not left to the last week

---

## 17. Risks

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Invalid signature or unauthorized event | Event may be rejected | Validate signature on every request |
| Duplicate events | Duplicate notifications may be created | Use unique eventId constraint |
| Notification delivery failure | User may not receive important information | Provide retry mechanism with a maximum of 5 retries |
| AI service unavailable | Notification summarization may fail | Fall back to the original notification text |
| Analytics webhook unreachable | Analytics may miss delivery events | Retry with backoff; log failures for manual replay |
| Student Identity API unreachable | Users cannot authenticate at all | Treat as a hard dependency; monitor via GET /health and alert early |
| Unauthorized access | User or system data may be exposed | Use authentication, authorization, and role-based access control |
| High AI API cost | Project may exceed budget | Limit AI to low-risk categories and cache summaries |
| Event name/category mismatch with other pods | Valid events from other teams get rejected | Lock the event/category table in Section 2 early and communicate any change to all pods |

---

## 18. Acceptance Criteria

### MVP is complete when:
- [ ] External systems can submit valid events (using the 17 registered event names) through POST /events with signature verification and duplicate event checking.
- [ ] End User authentication is fully delegated to the Student Identity API; no local login exists.
- [ ] Users can view notifications, manage preferences, and mark notifications as read.
- [ ] Administrators can view delivery status, retry failed deliveries, and monitor system health.
- [ ] Failed events and deliveries are logged and handled correctly.
- [ ] The `notification.delivered` webhook to Analytics is implemented, signed, and retried on failure.
- [ ] AI summarization works only for designated low-risk categories and falls back to the original text when unavailable.
- [ ] Security and access control requirements are implemented for users, administrators, and external systems.
- [ ] At least 7 automated tests pass, covering the cases in Section 13.

---

## 19. Future Improvements

- Add email and SMS/push notification channels (currently in-app only)
- Introduce smart ranking or AI-based relevance scoring for the inbox (explicitly out of scope for MVP)
- Add deeper analytics for notification reading behavior
- Add configurable retry backoff strategy instead of a fixed retry count
- Add more notification channels based on user preferences
