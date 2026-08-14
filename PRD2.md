# Product Requirements Document

## Group Members and Roles

| Name | Student ID | Role | Core Responsibilities |
| ---- | ---------- | ---- | --------------------- |
| Nuttida Butthanoo | 6731503103 | Frontend UX/UI | Notification Inbox UI, Preference Settings, Operations Monitor UI[cite: 13] |
| Pechladda Duangkaew | 6731503112 | Backend API and Database | Supabase PostgreSQL schema, REST API Endpoints, Routing Logic[cite: 13] |
| Montatip Khumphaithoon | 6731503028 | Quality and Security | Signature verification, JWT Auth, RLS policies, Payload validation[cite: 13] |
| Siriwimon Charoensirisoontorn | 6731503125 | Delivery and Document | Analytics event export, Retry engine, Health check, API Docs[cite: 13] |
| Thanchanok Kakaew | 6731503105 | Product Manager | PRD ownership, Cross-module event alignment, Acceptance Criteria[cite: 13] |

---

## 1. Product Overview

### Product Name
Notification Hub (Central Event-Driven Notification Engine)[cite: 13]

### Problem Statement
In a multi-module university Career & Communication platform, important events occur across different domains (Internship Track, Job Board, Alumni Network)[cite: 13]. Without a centralized notification system, students miss critical updates such as internship approvals, job application status changes, or mentoring responses[cite: 13]. Notification Hub provides a centralized, preference-aware platform where students receive, view, and manage all career-related notifications in one unified place[cite: 13].

### Target Users

**End User (Student)**
Students who receive notifications through Notification Hub[cite: 13].
They can:
- View in-app notifications (`GET /notifications/me`)[cite: 13].
- Mark notifications as read (`POST /notifications/{id}/read`)[cite: 13].
- View notification details (title, category, priority, source, read state)[cite: 13].
- Manage notification preferences per category (`PATCH /preferences`)[cite: 13].

**Administrator**
Operations staff who monitor and maintain notification delivery and integration health[cite: 13]. They do not create or send notification content directly — notifications are generated only from events submitted by external platform modules[cite: 13].
They can:
- View notification delivery status (`GET /deliveries/{id}`)[cite: 13].
- Retry failed deliveries (`POST /notifications/{id}/retry`)[cite: 13].
- Monitor system and integration health (`GET /health`)[cite: 13].
- Review rejected/duplicate events log (`GET /events/log`)[cite: 13].

**External System (Platform Modules)**
Modules within the Career & Communication platform (**1. Internship Track**, **2. Job Board**, **3. Alumni Network**) that submit events through Notification Hub[cite: 13].
They can:
- Submit events (`POST /events`), each with a unique `eventId`[cite: 13].
- Rely on signature verification and deduplication before an event becomes a notification[cite: 13].
- Receive delivery outcomes indirectly via the `notification.delivered` event published to Analytics[cite: 13].
They cannot specify individual recipients, channels, or preferences directly — Notification Hub owns routing based on each student's saved preferences[cite: 13].

### Product Goal
To provide a centralized, reliable, and secure platform for managing user notifications and making important career information easier to access and track, built with zero budget within one university semester[cite: 13].

---

## 2. Scope

### In Scope
- Receive platform events from source systems (**Internship Track**, **Job Board**, **Alumni Network**) via a secure API endpoint (`POST /events`)[cite: 13].
- User Interface Screens: Notification Inbox, Delivery Preferences, and Operations Monitor[cite: 13].
- In-App Notification delivery and read/unread status management[cite: 13].
- Retry mechanism for failed internal delivery and processing[cite: 13].
- Signature verification (HMAC) and event deduplication (using unique `eventId`) before notification creation[cite: 13].
- Publishing `notification.delivered` records to an `analytics_events` table for external consumption[cite: 13].
- AI summarization for low-risk alerts (e.g., general alumni event announcements, job board career tips), with fallback ordering (`severity → deadline → time`)[cite: 13].
- Health check endpoint (`GET /health`) for monitoring database and service responsiveness[cite: 13].

### Out of Scope
- Mobile Push Notifications (APNS / FCM) and SMS channels[cite: 13].
- Smart ranking or AI-based relevance scoring for inbox ordering[cite: 13].
- Deep analytics of student reading behavior[cite: 13].
- Direct manual creation or editing of notification text by administrators[cite: 13].

---

## 3. User Roles

### End User (Student)
- Read/view personal notification list[cite: 13].
- Mark notifications as read[cite: 13].
- Set preferences by category[cite: 13].
- **Access Rights**: Row-Level Security (RLS) scoped strictly to own `user_id`[cite: 13].

### Administrator
- View delivery status of every item in the system[cite: 13].
- Trigger manual retries for failed deliveries[cite: 13].
- View health check metrics and event reception logs (check signature rejections / duplicate attempts)[cite: 13].
- **Access Permissions**: System-level delivery and health data. No unauthorized access to private student notification content[cite: 13].

### External System (Platform Modules)
- Submit events via `POST /events` endpoint only[cite: 13].
- No access to the UI or user management endpoints[cite: 13].
- **Access Rights**: Restricted by API Key / Signature Verification. Only registered source systems are accepted[cite: 13].

---

## 4. User Journey

### Main Journey
1. **Event Occurrence**: An event occurs in a source system (e.g., Internship Track approves a student's internship application, Job Board updates application status, or Alumni Network confirms a mentoring connection)[cite: 13].
2. **Event Ingestion**: The source system sends the event to Notification Hub via `POST /events`[cite: 13].
3. **Validation & Filtering**: Notification Hub validates the signature, checks for duplicate `eventId`, and verifies the target student's category preference[cite: 13].
4. **Notification Creation**: If enabled, Notification Hub creates a notification record with status `unread` and routes it to the student's Notification Inbox[cite: 13].
5. **User Engagement**: The student opens their Notification Inbox, reviews the update, and marks it as read (`POST /notifications/{id}/read`)[cite: 13].

---

## 5. Functional Requirements

### FR-01 Receive Events from External Systems
- `POST /events` accepts events from registered source systems (**Internship Track**, **Job Board**, **Alumni Network**)[cite: 13].
- Verify sender identity via signature verification using a per-source signing key stored in `source_systems`. If invalid/unregistered, reject request[cite: 13].
- Check duplicate `eventId` using a DB unique constraint. If duplicate, return original result without creating a duplicate notification[cite: 13].
- Validate payload required fields (`userId`, `category`, `title`, `priority`). If missing, reject with field-specific error[cite: 13].
- Log all rejected events in `rejected_event_logs` with a `rejectReason` (`invalid_key`, `duplicate`, `invalid_payload`)[cite: 13].

### FR-02 Create and Route Notifications
- Check target student's preference for the event category upon successful event validation[cite: 13].
- If user opted in → create notification record with `unread` status[cite: 13].
- If user opted out → log as `suppressed` (retains auditability without cluttering inbox)[cite: 13].
- If `userId` does not exist → reject and log error[cite: 13].

### FR-03 Notification Inbox (End User)
- `GET /notifications/me` returns notifications belonging strictly to the logged-in user (from JWT token)[cite: 13].
- Supports filtering by read/unread status and pagination (`limit`/`offset`)[cite: 13].
- Displays title, category, priority, source, read status, received timestamp, and optional deadline[cite: 13].

### FR-04 Mark as Read
- `POST /notifications/{id}/read` updates notification status to `read`[cite: 13].
- Must be idempotent (safe for multiple calls)[cite: 13].
- Verifies notification ownership (`recipient_id == auth.uid()`) before allowing updates[cite: 13].

### FR-05 Manage Preferences
- `PATCH /preferences` updates opt-in/opt-out settings per category (`internship`, `job_board`, `alumni_network`, `system`)[cite: 13].
- Applies only to notifications created after settings are saved (not retroactive)[cite: 13].
- Defaults to opted-in for all categories upon account creation[cite: 13].

### FR-06 View Delivery Status (Admin)
- `GET /deliveries/{id}` displays status (`pending`, `delivered`, `failed`, `failed_permanent`)[cite: 13].
- Restricted to admin role; exposes operational status without revealing sensitive payload details[cite: 13].

### FR-07 Retry Failed Delivery (Admin)
- `POST /notifications/{id}/retry` triggers a manual delivery retry for a failed item[cite: 13].
- Rejects retries for already delivered items[cite: 13].
- Enforces a maximum limit of 5 retries. Beyond 5, updates status to `failed_permanent`[cite: 13].

### FR-08 Health Check and Logs
- `GET /health` tests DB connectivity and core service responsiveness[cite: 13].
- `GET /events/log` allows admins to view and filter rejected events by `rejectReason`[cite: 13].

### FR-09 AI Summarization (Low-Risk Categories Only)
- Calls an AI API (e.g., Claude/OpenAI) to summarize notifications in pre-designated low-risk categories (e.g., general alumni announcements, career tips)[cite: 13].
- Critical categories (internship approvals, interview schedules, mentoring request status) **MUST NEVER** be passed to AI and must always display full text[cite: 13].
- Fallback: On AI error or timeout, immediately display original notification text[cite: 13].
- Fallback Inbox Sort Order: `severity (high → low)` → `deadline (near → far)` → `received time (newest → oldest)`[cite: 13].

### FR-10 Send Data to Analytics
- After a notification is processed/delivered, write a record to `analytics_events`[cite: 13].
- Analytics system pulls data asynchronously from this table without impacting core inbox performance[cite: 13].

---

## 6. Non-Functional Requirements

### NFR-01 Performance
- Inbox query (`GET /notifications/me`) must respond within 300ms for up to several hundred notifications per user[cite: 13].
- DB indexes on `userId`, `eventId`, and `category` to optimize lookup and deduplication[cite: 13].

### NFR-02 Security
- User endpoints require JWT authentication[cite: 13].
- `POST /events` requires signature verification on every request without exception[cite: 13].
- Secrets and signing keys must be stored in encrypted environment variables (`.env.local`)[cite: 13].
- Admin endpoints enforce Role-Based Access Control (RBAC)[cite: 13].

### NFR-03 Availability
- External service failures (AI API, Analytics) must not impact core notification receiving and inbox display[cite: 13].
- Core system must achieve high uptime during presentation and demonstration sessions[cite: 13].

### NFR-04 Cost
- **0 THB Deployment Cost**: Strict usage of free-tier services (Vercel Free Tier, Supabase Free Tier, OpenAI free credits/limited calls)[cite: 13].

---

## 7. Business Rules

### BR-01 Deduplication via eventId
`eventId` is unique per source system. Duplicate event submissions return the existing processing status without creating duplicate notifications[cite: 13].

### BR-02 Signature Verification Required
Only requests with valid HMAC signatures matched against registered `source_systems` keys are processed[cite: 13].

### BR-03 User Preferences Override Events
User category opt-out overrides valid event payloads; no visible notification is created for opted-out categories[cite: 13].

### BR-04 Maximum 5 Retries
Failed delivery processing terminates auto-retry after 5 attempts and transitions to `failed_permanent`[cite: 13].

### BR-05 Restricted AI Summarization
High-stakes career categories (internship approvals, job interviews, mentoring status) are strictly excluded from AI processing to prevent misleading summaries[cite: 13].

### BR-06 Data Isolation Scope
End Users access only their own data via Row-Level Security. Administrators access system health and status data only[cite: 13].

### BR-07 Routing Ownership
Source systems submit event payloads only; Notification Hub exclusively determines recipient routing based on user preferences[cite: 13].

---

## 8. Data Model

### User
- `userId` (UUID, Primary Key)[cite: 13]
- `name` (VARCHAR)[cite: 13]
- `email` (VARCHAR)[cite: 13]
- `role` (ENUM: `'student'`, `'admin'`)[cite: 13]

### Entity A: Notification
- `notificationId` (UUID, Primary Key)[cite: 13]
- `userId` (UUID, Foreign Key)[cite: 13]
- `eventId` (VARCHAR, Unique)[cite: 13]
- `category` (ENUM: `'internship'`, `'job_board'`, `'alumni_network'`, `'system'`)[cite: 13]
- `title` (VARCHAR)[cite: 13]
- `type` (VARCHAR)[cite: 13]
- `priority` (ENUM: `'low'`, `'medium'`, `'high'`)[cite: 13]
- `source` (VARCHAR) -- e.g., `'InternshipTrack'`, `'JobBoard'`, `'AlumniNetwork'`[cite: 13]
- `status` (ENUM: `'unread'`, `'read'`)[cite: 13]
- `receivedAt` (TIMESTAMP)[cite: 13]
- `deadline` (TIMESTAMP, Nullable)[cite: 13]

### Entity B: Preference
- `preferenceId` (UUID, Primary Key)[cite: 13]
- `userId` (UUID, Foreign Key)[cite: 13]
- `category` (ENUM: `'internship'`, `'job_board'`, `'alumni_network'`, `'system'`)[cite: 13]
- `enabled` (BOOLEAN, Default: `true`)[cite: 13]
- `updatedAt` (TIMESTAMP)[cite: 13]

### Entity C: Delivery
- `deliveryId` (UUID, Primary Key)[cite: 13]
- `notificationId` (UUID, Foreign Key)[cite: 13]
- `status` (ENUM: `'pending'`, `'delivered'`, `'failed'`, `'failed_permanent'`)[cite: 13]
- `retryCount` (INT, Default: `0`)[cite: 13]
- `createdAt` (TIMESTAMP)[cite: 13]
- `deliveredAt` (TIMESTAMP, Nullable)[cite: 13]

### Entity D: EventReceipt
- `eventId` (VARCHAR, Primary Key)[cite: 13]
- `sourceSystemId` (UUID, Foreign Key)[cite: 13]
- `userId` (UUID, Foreign Key)[cite: 13]
- `category` (VARCHAR)[cite: 13]
- `title` (VARCHAR)[cite: 13]
- `priority` (VARCHAR)[cite: 13]
- `receivedAt` (TIMESTAMP)[cite: 13]
- `status` (ENUM: `'processed'`, `'rejected'`, `'suppressed'`)[cite: 13]

### Other Entities
- **SourceSystem**: `sourceSystemId` (UUID, PK), `systemName` (VARCHAR), `signingKey` (VARCHAR), `isActive` (BOOLEAN)[cite: 13]
- **RejectedEventLog**: `logId` (UUID, PK), `eventId` (VARCHAR), `sourceSystemId` (VARCHAR), `rejectReason` (ENUM: `'invalid_key'`, `'duplicate'`, `'invalid_payload'`), `payload` (JSONB), `createdAt` (TIMESTAMP)[cite: 13]
- **AnalyticsEvent**: `eventId` (VARCHAR, PK), `notificationId` (UUID), `status` (VARCHAR), `loggedAt` (TIMESTAMP)[cite: 13]

---

## 9. System Architecture & Evaluation

### 9.1 Evaluation of Deployment Options

---

#### Option 1: Vercel + Supabase (Selected)
* **Frontend:** Next.js (React) hosted on Vercel[cite: 13].
* **Backend/API:** Next.js Serverless API Routes (Node.js) hosted on Vercel[cite: 13].
* **Database:** Supabase PostgreSQL[cite: 13].
* **Authentication:** Supabase Auth (JWT) for users + Custom HMAC SHA-256 for external modules[cite: 13].
* **Storage:** Supabase PostgreSQL Database[cite: 13].
* **Deployment:** Automated Vercel CI/CD via GitHub integration[cite: 13].
* **Advantages:**
  * Single repository and unified TypeScript language for Frontend and Backend API Routes[cite: 13].
  * Relational database handles unique constraints (`eventId`), preference joins, and data consistency out of the box[cite: 13].
  * Native Row-Level Security (RLS) simplifies tenant/user data isolation at the DB level[cite: 13].
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

**Selected Architecture: Option 1 (Vercel + Supabase)**[cite: 13]

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
1. **Simplicity Over Theoretical Scalability:** Next.js allows a 5-student team to write both Frontend and API Routes in a single repository without cross-repo coordination overhead[cite: 13].
2. **Relational Integrity for Deduplication:** PostgreSQL strictly enforces unique constraints on `eventId` at the database level, completely preventing duplicate notifications from reaching students[cite: 13].
3. **Built-in Security (RLS):** Row-Level Security handles data isolation (`recipient_id == auth.uid()`) natively at the database level, preventing unauthorized access bugs[cite: 13].
4. **Strict 0 THB Alignment:** Runs entirely within Vercel and Supabase Free Tiers, fully meeting budget constraints[cite: 13].

---

## 10. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Rapid UI development for Inbox, Preferences, and Admin Operations[cite: 13] |
| Backend | Next.js API Routes (Node.js) | Serverless execution, unified codebase with frontend, zero-server overhead[cite: 13] |
| Database | Supabase (PostgreSQL) | Free tier, PostgreSQL reliability, built-in Row Level Security (RLS)[cite: 13] |
| Auth | Supabase Auth (JWT) & HMAC | Standardized student auth and secure cross-module API signature validation[cite: 13] |
| Hosting | Vercel (Free Tier) | Seamless integration with Next.js, zero deployment cost[cite: 13] |

---

## 11. API / Interfaces

- **API-01 `POST /events`**: Receives events from external modules; performs HMAC signature verification, payload validation, and deduplication[cite: 13].
- **API-02 `GET /notifications/me`**: Returns paginated notifications for the authenticated student[cite: 13].
- **API-03 `POST /notifications/{id}/read`**: Idempotent endpoint marking a specific notification as read[cite: 13].
- **API-04 `PATCH /preferences`**: Updates category opt-in/opt-out settings for the calling student[cite: 13].
- **API-05 `GET /deliveries/{id}`**: Admin-only endpoint returning delivery status details[cite: 13].
- **API-06 `POST /notifications/{id}/retry`**: Admin-only endpoint triggering a retry for failed items (max 5 retries)[cite: 13].
- **API-07 `GET /health`**: Health check returning status of database connection and service availability[cite: 13].
- **API-08 `GET /events/log`**: Admin-only endpoint returning filtered rejected event logs[cite: 13].

---

## 12. Security

### Authentication
- Students/Admins authenticate via JWT bearer tokens[cite: 13].
- External systems authenticate via HMAC SHA-256 signatures using pre-shared secret keys[cite: 13].

### Authorization
- Row-Level Security (RLS) policies enforce `recipient_id == auth.uid()` for all notification queries[cite: 13].
- Admin role verification required for delivery monitoring and retry APIs[cite: 13].

### Data Protection
- Signing keys and environment credentials stored strictly in server-side environment variables[cite: 13].
- Passwords hashed using standard cryptographic algorithms via Supabase Auth[cite: 13].

---

## 13. Error Handling

### Expected Errors
- `401 Unauthorized`: Missing or invalid JWT token / HMAC signature[cite: 13].
- `400 Bad Request`: Payload validation failure or duplicate `eventId`[cite: 13].
- `403 Forbidden`: Attempting to access another user's notifications or admin APIs without permissions[cite: 13].
- `422 Unprocessable Entity`: Retry limit exceeded (> 5 attempts)[cite: 13].

### Failure Scenarios
- **AI API Timeout/Failure**: System immediately falls back to displaying original full text[cite: 13].
- **Database Connection Failure**: API returns `500 Internal Server Error`; logged for administrative review[cite: 13].

---

## 14. Deployment

### Development
- Local development environment using Node.js, `npm run dev`, and a shared Supabase PostgreSQL staging instance[cite: 13].

### Production
- Automated deployment from GitHub `main` branch directly to Vercel Free Tier[cite: 13].

---

## 15. Constraints

- **Budget**: 0 THB (100% Free-tier utilization)[cite: 13].
- **Timeframe**: One university semester (approx. 12–14 weeks)[cite: 13].
- **Team Size**: 5 student developers[cite: 13].
- **Free Tier Limits**: Supabase DB size limits and AI credit allowances[cite: 13].

---

## 16. Risks and Mitigation

| Risk | Impact | Mitigation |
| ---- | ------ | ---------- |
| Invalid signature or unauthorized event submission | High | Strict HMAC signature verification on every incoming POST request[cite: 13] |
| Duplicate event submissions from source modules | Medium | Enforce DB-level unique constraint on `eventId`[cite: 13] |
| Internal delivery/processing failure | High | Automated/manual retry mechanism capped at 5 attempts[cite: 13] |
| AI API service outage or rate-limit exhaustion | Medium | Immediate fallback to original notification text[cite: 13] |
| Analytics export failure | Low | Asynchronous polling from `analytics_events` table; does not block core UI[cite: 13] |
| Unauthorized access to student notifications | High | Supabase Row-Level Security (RLS) policies enforced at DB level[cite: 13] |

---

## 17. Acceptance Criteria

### MVP is complete when:
- [ ] External modules (Internship, Job Board, Alumni) can submit events via `POST /events` with valid HMAC signatures[cite: 13].
- [ ] Duplicate events with existing `eventId` are rejected/handled gracefully without creating duplicate inbox items[cite: 13].
- [ ] Students can view in-app notifications, mark items as read, and customize category preferences[cite: 13].
- [ ] Opting out of a category successfully suppresses future notifications for that student[cite: 13].
- [ ] Administrators can view delivery status, execute retries (up to 5 max), and monitor system health[cite: 13].
- [ ] AI summarization applies only to low-risk categories and falls back to original text upon failure[cite: 13].

---

## 18. Future Improvements

- Support for Push Notifications (WebPush / Mobile Push) and Email integration[cite: 13].
- Batch digest notifications for low-priority career updates[cite: 13].
- Advanced retry backoff strategies (e.g., exponential backoff)[cite: 13].
