/**
 * Notification Hub — Team 20
 * Configuration & Constants for Job Board Integration
 *
 * NOTE: Mock data removed. Frontend now fetches real data from backend API.
 */

const POD5_SYSTEMS = {
  job_board: {
    id: "job_board",
    name: "Job Board",
    badge: "Job Board",
    color: "#0ea5e9",
    bgColor: "rgba(14, 165, 233, 0.12)",
    borderColor: "rgba(14, 165, 233, 0.3)",
    icon: "layers",
    description: "ระบบประกาศรับสมัครงานและติดตามสถานะการสมัครงาน (Team 18)",
    endpoint: "/api/webhooks/jobboard",
    status: "online",
    lastHeartbeat: "Realtime",
    totalEvents: "-",
  },
};

// Empty arrays — will be populated from API
const INITIAL_NOTIFICATIONS = [];
const RECENT_EVENTS = [];
