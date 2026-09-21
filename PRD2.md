# Product Requirements Document

## Group Members and Roles

| Name | Student ID | Role | Core Responsibilities |
| ---- | ---------- | ---- | --------------------- |
| Nuttida Butthanoo | 6731503103 | Frontend UX/UI | Notification Inbox UI, Preference Settings, Operations Monitor UI |
| Pechladda Duangkaew | 6731503112 | Backend API and Database | Supabase PostgreSQL schema, REST API Endpoints, Routing Logic|
| Montatip Khumphaithoon | 6731503028 | Quality and Security | Signature verification, JWT Auth, RLS policies, Payload validation |
| Siriwimon Charoensirisoontorn | 6731503125 | Delivery and Document | Analytics event export, Retry engine, Health check, API Docs |
| Thanchanok Kakaew | 6731503105 | Product Manager | PRD ownership, Cross-module event alignment, Acceptance Criteria |

---

## 1. Product Overview

### Product Name
Notification Hub 

### Problem Statement
In a multi-module university Career & Communication platform, important events occur across different domains (Internship Track, Job Board, Alumni Network). Without a centralized notification system, students miss critical updates such as internship approvals, job application status changes, or mentoring responses. Notification Hub provides a centralized, preference-aware platform where students receive, view, and manage all career-related notifications in one unified place.

### Target Users

**End User (Student)**
Students who receive notifications through Notification Hub.
They can:
- View in-app notifications (`GET /notifications/me`).
- Mark notifications as read (`POST /notifications/{id}/read`).
- View notification details (title, category, priority, source, read state).
- Manage notification preferences per category (`PATCH /preferences`).

**Administrator**
Operations staff who monitor and maintain notification delivery and integration health. They do not create or send notification content directly — notifications are generated only from events submitted by external platform modules.
They can:
- View notification delivery status (`GET /deliveries/{id}`).
- Retry failed deliveries (`POST /notifications/{id}/retry`).
- Monitor system and integration health (`GET /health`).
- Review rejected/duplicate events log (`GET /events/log`).

**External System (Platform Modules)**
Modules within the Career & Communication platform (**1. Internship Track**, **2. Job Board**, **3. Alumni Network**) that submit events through Notification Hub.
They can:
- Submit events (`POST /events`), each with a unique `eventId`.
- Rely on signature verification and deduplication before an event becomes a notification.
- Receive delivery outcomes indirectly via the `notification.delivered` event published to Analytics.
They cannot specify individual recipients, channels, or preferences directly — Notification Hub owns routing based on each student's saved preferences.

### Product Goal
To provide a centralized, reliable, and secure platform for managing user notifications and making important career information easier to access and track, built with zero budget within one university semester.

---

## 2. Scope

### In Scope
- Receive platform events from source systems (**Internship Track**, **Job Board**, **Alumni Network**) via a secure API endpoint (`POST /events`).
- User Interface Screens: Notification Inbox, Delivery Preferences, and Operations Monitor.
- In-App Notification delivery and read/unread status management.
- Retry mechanism for failed internal delivery and processing.
- Signature verification (HMAC) and event deduplication (using unique `eventId`) before notification creation.
- Publishing `notification.delivered` records to an `analytics_events` table for external consumption.
- AI summarization for low-risk alerts (e.g., general alumni event announcements, job board career tips), with fallback ordering (`severity → deadline → time`).
- Health check endpoint (`GET /health`) for monitoring database and service responsiveness.

### Out of Scope
- Mobile Push Notifications (APNS / FCM) and SMS channels.
- Smart ranking or AI-based relevance scoring for inbox ordering.
- Deep analytics of student reading behavior[cite: 13].
- Direct manual creation or editing of notification text by administrators.

---

## 3. User Roles

### End User (Student)
- Read/view personal notification list.
- Mark notifications as read.
- Set preferences by category.
- **Access Rights**: Row-Level Security (RLS) scoped strictly to own `user_id`.

### Administrator
- View delivery status of every item in the system.
- Trigger manual retries for failed deliveries.
- View health check metrics and event reception logs (check signature rejections / duplicate attempts).
- **Access Permissions**: System-level delivery and health data. No unauthorized access to private student notification content.

### External System (Platform Modules)
- Submit events via `POST /events` endpoint only.
- No access to the UI or user management endpoints.
- **Access Rights**: Restricted by API Key / Signature Verification. Only registered source systems are accepted.

---

## 4. User Journey

### Main Journey
1. **Event Occurrence**: An event occurs in a source system (e.g., Internship Track approves a student's internship application, Job Board updates application status, or Alumni Network confirms a mentoring connection).
2. **Event Ingestion**: The source system sends the event to Notification Hub via `POST /events`.
3. **Validation & Filtering**: Notification Hub validates the signature, checks for duplicate `eventId`, and verifies the target student's category preference.
4. **Notification Creation**: If enabled, Notification Hub creates a notification record with status `unread` and routes it to the student's Notification Inbox.
5. **User Engagement**: The student opens their Notification Inbox, reviews the update, and marks it as read (`POST /notifications/{id}/read`).

---

## 5. Functional Requirements

### FR-01 Receive Events from External Systems
- `POST /events` accepts events from registered source systems (**Internship Track**, **Job Board**, **Alumni Network**).
- Verify sender identity via signature verification using a per-source signing key stored in `source_systems`. If invalid/unregistered, reject request.
- Check duplicate `eventId` using a DB unique constraint. If duplicate, return original result without creating a duplicate notification.
- Validate payload required fields (`userId`, `category`, `title`, `priority`). If missing, reject with field-specific error.
- Log all rejected events in `rejected_event_logs` with a `rejectReason` (`invalid_key`, `duplicate`, `invalid_payload`).

### FR-02 Create and Route Notifications
- Check target student's preference for the event category upon successful event validation.
- If user opted in → create notification record with `unread` status[cite: 13].
- If user opted out → log as `suppressed` (retains auditability without cluttering inbox).
- If `userId` does not exist → reject and log error.

### FR-03 Notification Inbox (End User)
- `GET /notifications/me` returns notifications belonging strictly to the logged-in user (from JWT token).
- Supports filtering by read/unread status and pagination (`limit`/`offset`).
- Displays title, category, priority, source, read status, received timestamp, and optional deadline.

### FR-04 Mark as Read
- `POST /notifications/{id}/read` updates notification status to `read`.
- Must be idempotent (safe for multiple calls).
- Verifies notification ownership (`recipient_id == auth.uid()`) before allowing updates.

### FR-05 Manage Preferences
- `PATCH /preferences` updates opt-in/opt-out settings per category (`internship`, `job_board`, `alumni_network`, `system`).
- Applies only to notifications created after settings are saved (not retroactive).
- Defaults to opted-in for all categories upon account creation.

### FR-06 View Delivery Status (Admin)
- `GET /deliveries/{id}` displays status (`pending`, `delivered`, `failed`, `failed_permanent`).
- Restricted to admin role; exposes operational status without revealing sensitive payload details.

### FR-07 Retry Failed Delivery (Admin)
- `POST /notifications/{id}/retry` triggers a manual delivery retry for a failed item.
- Rejects retries for already delivered items.
- Enforces a maximum limit of 5 retries. Beyond 5, updates status to `failed_permanent`.

### FR-08 Health Check and Logs
- `GET /health` tests DB connectivity and core service responsiveness.
- `GET /events/log` allows admins to view and filter rejected events by `rejectReason`.

### FR-09 AI Summarization (Low-Risk Categories Only)
- Calls an AI API (e.g., Claude/OpenAI) to summarize notifications in pre-designated low-risk categories (e.g., general alumni announcements, career tips).
- Critical categories (internship approvals, interview schedules, mentoring request status) **MUST NEVER** be passed to AI and must always display full text.
- Fallback: On AI error or timeout, immediately display original notification text.
- Fallback Inbox Sort Order: `severity (high → low)` → `deadline (near → far)` → `received time (newest → oldest)`.

### FR-10 Send Data to Analytics
- After a notification is processed/delivered, write a record to `analytics_events`.
- Analytics system pulls data asynchronously from this table without impacting core inbox performance.

---

## 6. Non-Functional Requirements

### NFR-01 Performance
- Inbox query (`GET /notifications/me`) must respond within 300ms for up to several hundred notifications per user.
- DB indexes on `userId`, `eventId`, and `category` to optimize lookup and deduplication.

### NFR-02 Security
- User endpoints require JWT authentication.
- `POST /events` requires signature verification on every request without exception.
- Secrets and signing keys must be stored in encrypted environment variables (`.env.local`).
- Admin endpoints enforce Role-Based Access Control (RBAC).

### NFR-03 Availability
- External service failures (AI API, Analytics) must not impact core notification receiving and inbox display.
- Core system must achieve high uptime during presentation and demonstration sessions.

### NFR-04 Cost
- **0 THB Deployment Cost**: Strict usage of free-tier services (Vercel Free Tier, Supabase Free Tier, OpenAI free credits/limited calls).

---

## 7. Business Rules

### BR-01 Deduplication via eventId
`eventId` is unique per source system. Duplicate event submissions return the existing processing status without creating duplicate notifications.

### BR-02 Signature Verification Required
Only requests with valid HMAC signatures matched against registered `source_systems` keys are processed.

### BR-03 User Preferences Override Events
User category opt-out overrides valid event payloads; no visible notification is created for opted-out categories.

### BR-04 Maximum 5 Retries
Failed delivery processing terminates auto-retry after 5 attempts and transitions to `failed_permanent.

### BR-05 Restricted AI Summarization
High-stakes career categories (internship approvals, job interviews, mentoring status) are strictly excluded from AI processing to prevent misleading summaries.

### BR-06 Data Isolation Scope
End Users access only their own data via Row-Level Security. Administrators access system health and status data only.

### BR-07 Routing Ownership
Source systems submit event payloads only; Notification Hub exclusively determines recipient routing based on user preferences.

---

## 8. Data Model

### User
- `userId` (UUID, Primary Key)
- `name` (VARCHAR)
- `email` (VARCHAR)
- `role` (ENUM: `'student'`, `'admin'`)

### Entity A: Notification
- `notificationId` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `eventId` (VARCHAR, Unique)
- `category` (ENUM: `'internship'`, `'job_board'`, `'alumni_network'`, `'system'`)
- `title` (VARCHAR)
- `type` (VARCHAR)
- `priority` (ENUM: `'low'`, `'medium'`, `'high'`)
- `source` (VARCHAR) -- e.g., `'InternshipTrack'`, `'JobBoard'`, `'AlumniNetwork'`
- `status` (ENUM: `'unread'`, `'read'`)
- `receivedAt` (TIMESTAMP)
- `deadline` (TIMESTAMP, Nullable)

### Entity B: Preference
- `preferenceId` (UUID, Primary Key)
- `userId` (UUID, Foreign Key)
- `category` (ENUM: `'internship'`, `'job_board'`, `'alumni_network'`, `'system'`)
- `enabled` (BOOLEAN, Default: `true`)
- `updatedAt` (TIMESTAMP)

### Entity C: Delivery
- `deliveryId` (UUID, Primary Key)
- `notificationId` (UUID, Foreign Key)
- `status` (ENUM: `'pending'`, `'delivered'`, `'failed'`, `'failed_permanent'`)
- `retryCount` (INT, Default: `0`)
- `createdAt` (TIMESTAMP)
- `deliveredAt` (TIMESTAMP, Nullable)

### Entity D: EventReceipt
- `eventId` (VARCHAR, Primary Key)
- `sourceSystemId` (UUID, Foreign Key)
- `userId` (UUID, Foreign Key)
- `category` (VARCHAR)
- `title` (VARCHAR)
- `priority` (VARCHAR)
- `receivedAt` (TIMESTAMP)
- `status` (ENUM: `'processed'`, `'rejected'`, `'suppressed'`)

### Other Entities
- **SourceSystem**: `sourceSystemId` (UUID, PK), `systemName` (VARCHAR), `signingKey` (VARCHAR), `isActive` (BOOLEAN)
- **RejectedEventLog**: `logId` (UUID, PK), `eventId` (VARCHAR), `sourceSystemId` (VARCHAR), `rejectReason` (ENUM: `'invalid_key'`, `'duplicate'`, `'invalid_payload'`), `payload` (JSONB), `createdAt` (TIMESTAMP)
- **AnalyticsEvent**: `eventId` (VARCHAR, PK), `notificationId` (UUID), `status` (VARCHAR), `loggedAt` (TIMESTAMP)

---

## 9. System Architecture & Evaluation

### 9.1 Evaluation of Deployment Options

---

#### Option 1: Vercel + Supabase (Selected)
* **Frontend:** Next.js (React) hosted on Vercel.
* **Backend/API:** Next.js Serverless API Routes (Node.js) hosted on Vercel.
* **Database:** Supabase PostgreSQL.
* **Authentication:** Supabase Auth (JWT) for users + Custom HMAC SHA-256 for external modules.
* **Storage:** Supabase PostgreSQL Database.
* **Deployment:** Automated Vercel CI/CD via GitHub integration.
* **Advantages:**
  * Single repository and unified TypeScript language for Frontend and Backend API Routes.
  * Relational database handles unique constraints (`eventId`), preference joins, and data consistency out of the box.
  * Native Row-Level Security (RLS) simplifies tenant/user data isolation at the DB level.
* **Disadvantages:**
  * Cold start overhead on serverless API routes.
  * Supabase free tier pauses databases after 7 days of inactivity (requires periodic keep-alive pings during active testing/grading).
* **Major Risks:**
  * Database connection pool exhaustion under high concurrent requests on free tier (mitigated via Supabase Transaction Pooler).

---

#### Option 2: Cloudflare Workers + D1
* **Frontend:** Cloudflare Pages (React / Static Site).
* **Backend/API:** Cloudflare Workers (V8 Edge Serverless Execution).
* **Database:** Cloudflare D1 (SQLite at the Edge).
* **Authentication:** Custom JWT Worker Verification + Custom HMAC Verification Worker.
* **Storage:** Cloudflare D1 (SQL storage) / R2.
* **Deployment:** Wrangler CLI / Cloudflare Pages GitHub Integration.
* **Advantages:**
  * Near-zero cold start latency (< 5ms) and extremely fast global execution.
  * Very high free-tier daily request quota.
* **Disadvantages:**
  * SQLite (D1) lacks advanced PostgreSQL features (e.g., native JSONB capabilities, built-in RLS policies).
  * Requires building custom Auth/JWT handling middleware or integrating extra auth services.
* **Major Risks:**
  * Writing custom access control without native DB-level RLS increases developer error risk in security enforcement.

---

#### Option 3: Firebase
* **Frontend:** Firebase Hosting (React SPA / Next.js Export).
* **Backend/API:** Firebase Cloud Functions (Node.js).
* **Database:** Cloud Firestore (NoSQL Document Store).
* **Authentication:** Firebase Authentication.
* **Storage:** Firebase Cloud Storage / Firestore Documents.
* **Deployment:** Firebase CLI / GitHub Actions workflow.
* **Advantages:**
  * Deeply integrated ecosystem with real-time sync out of the box.
  * Easy client-side integration and built-in Auth rules.
* **Disadvantages:**
  * NoSQL schema requires manual transaction management for atomic deduplication (`eventId`) and complex preference queries.
  * Cold starts on Cloud Functions on free tier.
* **Major Risks:**
  * Race conditions and potential duplicate notifications during concurrent webhook submissions if Firestore transactions are improperly written.

---

### 9.2 Final Architecture Recommendation & Diagram

**Selected Architecture: Option 1 (Vercel + Supabase)**

```
External Platform Modules (Internship / Job Board / Alumni)
                       │
               POST /events (HMAC Signed)
                       │
               Backend API (Next.js on Vercel)
                       │
        ┌──────────────┴──────────────┐
  HMAC Check                    Deduplication
        └──────────────┬──────────────┘
            User Preference Lookup
                       │
              Insert Notification
                       │
             Supabase DB (PostgreSQL)
                       │
        ┌──────────────┴──────────────┐
  Next.js Inbox UI             Analytics Event Log
```

#### Justification:
1. **Simplicity Over Theoretical Scalability:** Next.js allows a 5-student team to write both Frontend and API Routes in a single repository without cross-repo coordination overhead.
2. **Relational Integrity for Deduplication:** PostgreSQL strictly enforces unique constraints on `eventId` at the database level, completely preventing duplicate notifications from reaching students.
3. **Built-in Security (RLS):** Row-Level Security handles data isolation (`recipient_id == auth.uid()`) natively at the database level, preventing unauthorized access bugs.
4. **Strict 0 THB Alignment:** Runs entirely within Vercel and Supabase Free Tiers, fully meeting budget constraints.

---

## 10. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Rapid UI development for Inbox, Preferences, and Admin Operations |
| Backend | Next.js API Routes (Node.js) | Serverless execution, unified codebase with frontend, zero-server overhead |
| Database | Supabase (PostgreSQL) | Free tier, PostgreSQL reliability, built-in Row Level Security (RLS)|
| Auth | Supabase Auth (JWT) & HMAC | Standardized student auth and secure cross-module API signature validation |
| Hosting | Vercel (Free Tier) | Seamless integration with Next.js, zero deployment cost |

---

## 11. API / Interfaces

- **API-01 `POST /events`**: Receives events from external modules; performs HMAC signature verification, payload validation, and deduplication.
- **API-02 `GET /notifications/me`**: Returns paginated notifications for the authenticated student.
- **API-03 `POST /notifications/{id}/read`**: Idempotent endpoint marking a specific notification as read.
- **API-04 `PATCH /preferences`**: Updates category opt-in/opt-out settings for the calling student.
- **API-05 `GET /deliveries/{id}`**: Admin-only endpoint returning delivery status details.
- **API-06 `POST /notifications/{id}/retry`**: Admin-only endpoint triggering a retry for failed items (max 5 retries).
- **API-07 `GET /health`**: Health check returning status of database connection and service availability.
- **API-08 `GET /events/log`**: Admin-only endpoint returning filtered rejected event logs.

---

## 12. Security

### Authentication
- Students/Admins authenticate via JWT bearer tokens.
- External systems authenticate via HMAC SHA-256 signatures using pre-shared secret keys.

### Authorization
- Row-Level Security (RLS) policies enforce `recipient_id == auth.uid()` for all notification queries.
- Admin role verification required for delivery monitoring and retry APIs.

### Data Protection
- Signing keys and environment credentials stored strictly in server-side environment variables.
- Passwords hashed using standard cryptographic algorithms via Supabase Auth.

---

## 13. Error Handling

### Expected Errors
- `401 Unauthorized`: Missing or invalid JWT token / HMAC signature.
- `400 Bad Request`: Payload validation failure or duplicate `eventId`.
- `403 Forbidden`: Attempting to access another user's notifications or admin APIs without permissions.
- `422 Unprocessable Entity`: Retry limit exceeded (> 5 attempts).

### Failure Scenarios
- **AI API Timeout/Failure**: System immediately falls back to displaying original full text.
- **Database Connection Failure**: API returns `500 Internal Server Error`; logged for administrative review.

---

## 14. Deployment

### Development
- Local development environment using Node.js, `npm run dev`, and a shared Supabase PostgreSQL staging instance.

### Production
- Automated deployment from GitHub `main` branch directly to Vercel Free Tier.

---

## 15. Constraints

- **Budget**: 0 THB (100% Free-tier utilization).
- **Timeframe**: One university semester (approx. 12–14 weeks).
- **Team Size**: 5 student developers[cite: 13].
- **Free Tier Limits**: Supabase DB size limits and AI credit allowances.

---

## 16. Risks and Mitigation

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Invalid signature or unauthorized event submission | High | Strict HMAC signature verification on every incoming POST request |
| Duplicate event submissions from source modules | Medium | Enforce DB-level unique constraint on `eventId`|
| Internal delivery/processing failure | High | Automated/manual retry mechanism capped at 5 attempts |
| AI API service outage or rate-limit exhaustion | Medium | Immediate fallback to original notification text |
| Analytics export failure | Low | Asynchronous polling from `analytics_events` table; does not block core UI |
| Unauthorized access to student notifications | High | Supabase Row-Level Security (RLS) policies enforced at DB level |

---

## 17. Acceptance Criteria

### MVP is complete when:
- [ ] External modules (Internship, Job Board, Alumni) can submit events via `POST /events` with valid HMAC signatures.
- [ ] Duplicate events with existing `eventId` are rejected/handled gracefully without creating duplicate inbox items.
- [ ] Students can view in-app notifications, mark items as read, and customize category preferences.
- [ ] Opting out of a category successfully suppresses future notifications for that student.
- [ ] Administrators can view delivery status, execute retries (up to 5 max), and monitor system health.
- [ ] AI summarization applies only to low-risk categories and falls back to original text upon failure.

---

## 18. Future Improvements

- Support for Push Notifications (WebPush / Mobile Push) and Email integration.
- Batch digest notifications for low-priority career updates.
- Advanced retry backoff strategies (e.g., exponential backoff).
