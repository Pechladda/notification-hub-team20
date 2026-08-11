# Product Requirements Document

## 1. Product Overview

### Product Name
Notification Hub

### Problem Statement
Students using the Career & Communication platform (Internship, Job Board, and Alumni Network) currently must check each sub-system individually to know if anything has changed — for example, whether an internship application was approved, whether a new job posting matches their profile, or whether an alumnus accepted a mentoring request. As a result, students miss important updates or learn about them too late to act (e.g., missing an application deadline). At the same time, sending every event as a notification without filtering would overwhelm users and cause them to ignore notifications entirely. There is currently no central place that collects events from all sub-systems and delivers only the notifications that are relevant and timely to each user.

### Target Users
- **Student** — wants to know about internship status changes, matching job postings, and alumni responses without manually checking each system.
- **Admin** — wants to send broadcast announcements (e.g., "Interview day for Company X postponed") to relevant groups of users.
- *(Assumption — to confirm with team)* **Alumni/Employer** may also receive notifications (e.g., an alumnus is notified of a new mentoring request). To be confirmed whether this is in MVP scope.

### Product Goal
Ensure every user receives important updates from all connected sub-systems in a **timely, relevant (preference-aware), and non-overwhelming** way, through one reliable channel (in-app notification center as the primary MVP channel).

---

## 2. Scope

### In Scope
- Receive events from source systems (Internship, Job Board, Alumni Network) via an API endpoint
- Store notifications per user with read/unread status
- In-app notification center: list notifications, mark as read
- Basic preference settings: enable/disable notification categories (Internship / Job / Alumni / Announcement)
- Deliver notifications through the in-app channel
- Admin broadcast announcement feature
- *(Assumption — to confirm)* If source systems' APIs are not ready in time, the team will build a mock event generator to simulate events for testing

### Out of Scope
- Push notifications (mobile), LINE Notify, SMS
- Real-time delivery via WebSocket (MVP uses polling/refresh on page load)
- Daily/weekly digest emails
- Smart ranking or AI-based relevance scoring
- Email channel *(Assumption — to confirm: may move to In Scope if team decides to include it in MVP)*

---

## 3. User Roles

### User
A student who receives notifications relevant to their own activity across Internship, Job Board, and Alumni Network. Can view their own notifications, mark them as read, and set notification preferences. Cannot see other users' notifications.

### Admin
A university staff member who can create broadcast announcements sent to selected user groups, and view delivery logs for monitoring. Cannot read or modify individual users' personal notification content beyond what they broadcast.

---

## 4. User Journey

### Main Journey

1. An event occurs in a source system (e.g., a student's internship application is approved).
2. The source system sends the event to Notification Hub via the event-receiving API.
3. Notification Hub validates the event and checks the target user's notification preferences.
4. If the user has this category enabled, Notification Hub creates a notification record and makes it available in the in-app notification center.
5. The user opens the notification center, sees the new notification, and marks it as read.

---

## 5. Functional Requirements

### FR-01 — Receive Event
The system shall provide an API endpoint that accepts event data from source systems (Internship, Job Board, Alumni Network), including event type, target user, message content, and timestamp.

### FR-02 — Validate Event
The system shall validate incoming events for required fields and reject malformed or duplicate events with a clear error response.

### FR-03 — Check User Preference
The system shall check the target user's notification preferences before creating a notification, and shall not create a notification for a category the user has disabled.

### FR-04 — Create Notification
The system shall create and store a notification record linked to the target user, including category, message, source event reference, and read/unread status.

### FR-05 — View Notifications
The system shall allow a user to view a list of their own notifications, ordered by most recent first, showing read/unread status.

### FR-06 — Mark as Read
The system shall allow a user to mark one or all of their notifications as read.

### FR-07 — Manage Preferences
The system shall allow a user to enable or disable notifications by category (Internship, Job Board, Alumni, Announcement).

### FR-08 — Admin Broadcast
The system shall allow an admin to create a broadcast notification and deliver it to a selected group of users (e.g., all students, or students in a specific program).

---

## 6. Non-Functional Requirements

### NFR-01 Performance
The notification center shall load a user's notification list within an acceptable time (target: under 2 seconds) for a typical list size (e.g., up to 100 notifications) on the free-tier database and hosting used in this project.

### NFR-02 Security
The backend shall verify that a user can only read or modify their own notifications and preferences; the event-receiving API shall only accept requests from authenticated/trusted source systems.

### NFR-03 Availability
The system shall queue or safely reject events if the database is temporarily unavailable, rather than silently losing them, so that source systems receive a clear success/failure response.

### NFR-04 Cost
The production deployment shall operate entirely within free-tier limits of the chosen hosting, database, and (if used) email services, with no required paid billing during the course.

---

## 7. Business Rules

### BR-01
A notification shall only be created for a user if the corresponding category is enabled in that user's preferences (default: all categories enabled unless the user changes them).

### BR-02
A duplicate event (same source event ID received more than once) shall not create duplicate notifications for the same user.

### BR-03
Only an Admin may create broadcast notifications; a Student may only manage their own notifications and preferences.

---

## 8. Data Model

### User
- id, name, email, role (student/admin)
- Relationships: has many Notifications, has one Preference set
- Access: user reads/updates own profile; admin reads all

### Notification
- id, user_id, category (internship/job/alumni/announcement), message, source_event_id, status (read/unread), created_at
- Relationships: belongs to User
- Access: user creates none directly (system-created from events); user reads/updates (mark read) own only; admin reads all for monitoring

### Preference
- id, user_id, category, channel_enabled (in-app), is_enabled (boolean)
- Relationships: belongs to User
- Access: user creates/reads/updates own only

### EventLog *(for auditing/debugging duplicate and failed events)*
- id, source_system, event_type, payload, received_at, status (processed/rejected/duplicate)
- Relationships: may relate to a Notification if successfully processed
- Access: admin reads only; created by system when an event is received

---

## 9. Architecture

### Architecture Overview
The simplest architecture that satisfies the requirements: source systems call the Notification Hub API to submit events; the backend validates the event, checks preferences, and stores notifications; the frontend polls/fetches the notification list for the logged-in user.

### Architecture Diagram
```text
Internship / Job Board / Alumni Network (source systems)
        │  (event API call)
        ▼
   Notification Hub Backend / API
        ├── validate event
        ├── check user preference
        ├── store notification  ──► Database
        └── (future) send email/push
        ▲
   Frontend (Notification Center)
        ▲
      Browser / User
```

### Components

#### Frontend
Displays the notification center (list, unread count, mark as read) and the preference settings page. Calls the backend API for all data; does not talk to the database directly.

#### Backend
Exposes: (1) an event-receiving API for source systems, (2) user-facing APIs for listing notifications, marking as read, and managing preferences, (3) an admin API for broadcasting. Enforces all authorization and business rules (BR-01 to BR-03) server-side, not just in the frontend.

#### Database
Stores User, Notification, Preference, and EventLog records. Enforces uniqueness on source_event_id to prevent duplicate processing (supports BR-02).

#### Authentication
Verifies user identity for both students and admins before any notification or preference data is returned.

#### Storage
*(Not required for MVP — no file/media storage identified in current scope.)*

#### External Services
Internship, Job Board, and Alumni Network systems act as event producers calling the Notification Hub event API. *(Assumption — to confirm: whether these APIs will be available for real integration during the semester, or whether a mock event generator will be used instead.)*

---

## 10. Technology Stack

*(Proposed — pending Phase 4 team decision and requirement mapping)*

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js | Fast to build, free hosting on Vercel, supports both UI and API routes |
| Backend | Next.js API Routes | Avoids running a separate backend service; keeps stack simple for a student team |
| Database | Supabase PostgreSQL | Free tier, supports unique constraints (needed for BR-02), relational data fits the model |
| Auth | Supabase Auth | Free, integrates directly with the database, avoids building auth from scratch |
| Hosting | Vercel | Free tier, simple deployment for Next.js |

---

## 11. API / Interfaces

### API-01 — POST /api/events
Receives an event from a source system. Validates required fields, checks for duplicate source_event_id, and processes it into a notification if valid.

### API-02 — GET /api/notifications
Returns the authenticated user's own notifications, most recent first, with read/unread status.

### API-03 — PATCH /api/notifications/:id/read
Marks a specific notification (or all, via a bulk variant) as read for the authenticated user.

### API-04 — GET/PUT /api/preferences
Retrieves or updates the authenticated user's category preferences.

### API-05 — POST /api/admin/broadcast
Allows an authenticated admin to create a broadcast notification for a selected user group.

---

## 12. Security

### Authentication
All endpoints except the event-receiving API require a logged-in user session. The event-receiving API requires a trusted source (e.g., API key or service credential) so arbitrary clients cannot inject fake notifications.

### Authorization
The backend shall verify on every request that a user can only access or modify their own notifications and preferences (NFR-02); admin-only actions (broadcast, viewing EventLog) require the admin role, verified server-side.

### Data Protection
Notification messages should avoid storing sensitive personal data beyond what is needed to display the update; access to the EventLog (which may contain raw event payloads) is restricted to admins only.

---

## 13. Error Handling

### Expected Errors
- Malformed event payload → API returns a clear validation error, event is logged as "rejected" in EventLog.
- Duplicate event → API returns a "duplicate, not reprocessed" response rather than creating a second notification.
- User has no preference record yet → system applies default preferences (all categories enabled) rather than failing.

### Failure Scenarios
- **Source system sends an event but the database is temporarily unavailable:** the API should return a failure response so the source system can retry, rather than silently dropping the event.
- **Two events for the same source_event_id arrive at nearly the same time:** the database unique constraint prevents two notifications from being created (supports BR-02).
- **A user requests another user's notifications:** the backend must reject the request based on ownership check (supports NFR-02), regardless of what the frontend allows.

---

## 14. Deployment

### Development
Local development using the same Next.js + Supabase stack, with a local `.env` file for Supabase project credentials; a mock event script/tool used to simulate events from source systems during development if their real APIs are not yet available.

### Production
Deployed on Vercel (frontend + API routes) connected to a Supabase production project, both on free-tier plans, with environment variables configured in Vercel's dashboard.

---

## 15. Constraints

- Budget: 0 THB — must remain within free-tier limits of all chosen services
- Time: One semester
- Team: 5 developers
- Free Tier: Vercel and Supabase free tiers only; no paid add-ons

---

## 16. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Other 3 sub-systems' APIs are not ready in time to send real events | Cannot test real end-to-end integration | Build a mock event generator/script to simulate events for development and demo |
| Notification categories/payload format not agreed upon across all 4 groups | Integration breaks or requires rework late in semester | Agree on a shared event schema (type, user_id, message, event_id, timestamp) early with all groups |
| Free-tier database or hosting limits reached (e.g., rows, bandwidth) | Service degradation near demo/deadline | Monitor usage, keep data model minimal, avoid storing unnecessary history |
| Users disable too many categories and miss important updates | Reduced product value | Set sensible defaults (all enabled) and clearly label what each category means |

---

## 17. Acceptance Criteria

### MVP is complete when:

- [ ] A source system can send an event via the API and it results in a notification for the correct user (when their preference allows it)
- [ ] Duplicate events do not create duplicate notifications
- [ ] A user can view only their own notifications and mark them as read
- [ ] A user can enable/disable notification categories and the system respects this before creating new notifications
- [ ] An admin can send a broadcast notification to a selected group
- [ ] A user cannot access another user's notifications or preferences (verified server-side)
- [ ] The system is deployed and runs entirely within free-tier limits

---

## 18. Future Improvements

- Additional delivery channels: Email, LINE Notify, mobile push
- Real-time delivery via WebSocket instead of polling
- Daily/weekly digest notifications
- Smarter relevance ranking of notifications
