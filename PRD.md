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
1.View notifications (GET /notifications/me).
2.Mark notifications as read (POST /notifications/{id}/read).
3.View notification details (title, type, priority, source, read state).
4.Manage notification preferences — channel and category (PATCH /preferences).

**Administrator**
Operations staff who monitor and maintain notification delivery. They do not create or send notification content directly — notifications are generated only from events submitted by external platforms.

They can:
1.View notification delivery status (GET /deliveries/{id}).
2.Retry failed deliveries (POST /notifications/{id}/retry).
3.Monitor system and integration health (GET /health).
4.Review rejected/duplicate events to distinguish producer errors from delivery errors.

**External System**
University platforms (Enrollment, Timetable, Assignment, Library, etc.) that submit events through Notification Hub.

They can:
1.Submit events (POST /events), each with a unique eventId.
2.Rely on signature verification and deduplication before an event becomes a notification.
3.Receive delivery outcomes indirectly via the notification.delivered event published to Analytics.

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

### FR-01

### FR-02

### FR-03

---

## 6. Non-Functional Requirements

### NFR-01 Performance

### NFR-02 Security

### NFR-03 Availability

### NFR-04 Cost

---

## 7. Business Rules

### BR-01

### BR-02

---

## 8. Data Model

### User

### Entity A

### Entity B

---

## 9. Architecture

### Architecture Overview

### Architecture Diagram

### Components

#### Frontend

#### Backend

#### Database

#### Authentication

#### Storage

#### External Services

---

## 10. Technology Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | | |
| Backend | | |
| Database | | |
| Auth | | |
| Hosting | | |

---

## 11. API / Interfaces

### API-01

### API-02

---

## 12. Security

### Authentication

### Authorization

### Data Protection

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
