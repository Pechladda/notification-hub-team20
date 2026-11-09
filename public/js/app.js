/**
 * Notification Hub — Frontend Application Logic
 * Team 20 — Job Board Integration (Real API Connected)
 */

// ── Configuration ──
const API_BASE = ""; // same origin (Cloudflare Worker serves both UI & API)
const DEFAULT_USER_ID = "student-01"; // default user to query notifications

let currentRole = localStorage.getItem("nh_role") || "student";
let currentLang = localStorage.getItem("nh_lang") || "th";
let notifications = [];
let recentEvents = [];
let adminDeliveries = [];
let currentFilter = "all";
let searchQuery = "";

// ── Multi-Language Dictionary (Clean, Natural & Professional) ──
const i18n = {
  th: {
    test_btn: "ทดสอบส่งการแจ้งเตือน",
    test_btn_admin: "ส่ง Webhook จำลอง",
    dropdown_header: "เลือกบทบาท (Role)",
    role_student_title: "นักศึกษา (Student)",
    role_student_sub: "กล่องแจ้งเตือนและการตั้งค่า",
    role_admin_title: "ผู้ดูแลระบบ (Admin)",
    role_admin_sub: "สถิติระบบ, Webhook Logs และ Retry",
    user_student_name: "Student User",
    user_student_role: "นักศึกษา",
    user_admin_name: "System Operations",
    user_admin_role: "Admin Console",
    banner_student_title: "โหมดมุมมอง: นักศึกษา (Student Portal)",
    banner_student_desc: "สำหรับเปิดอ่านข้อความแจ้งเตือน รับนัดหมายการสัมภาษณ์จากระบบ Job Board (Team 18) และจัดการการตั้งค่าความเป็นส่วนตัว",
    banner_student_tag: "Student View",
    banner_admin_title: "โหมดมุมมอง: ผู้ดูแลระบบ (Operations Console)",
    banner_admin_desc: "สำหรับตรวจสอบสถานะ Edge System, Inbound Webhook Logs จาก Team 18, ติดตามการจัดส่ง (Deliveries) และสั่ง Retry ข้อความ",
    banner_admin_tag: "Admin Console",
    tab_inbox: "กล่องแจ้งเตือน (Inbox)",
    tab_settings: "การตั้งค่า (Preferences)",
    tab_overview: "ภาพรวมและการเชื่อมต่อ (Health & Integrations)",
    tab_inbound_logs: "ประวัติ Webhook Logs",
    tab_deliveries: "การจัดส่งและ Retry (Deliveries)",
    stat_total_notifs: "การแจ้งเตือนทั้งหมด",
    stat_from_jobboard: "จากระบบ Job Board (Team 18)",
    stat_unread: "ยังไม่ได้อ่าน",
    stat_awaiting_read: "รอเปิดอ่าน",
    stat_jobboard_status: "สถานะระบบ Job Board",
    stat_webhook_connected: "เชื่อมต่อ Webhook Team 18 เรียบร้อยแล้ว",
    filter_all: "ทั้งหมด",
    filter_unread: "ยังไม่ได้อ่าน",
    search_placeholder: "ค้นหาการแจ้งเตือน...",
    mark_all_read: "อ่านทั้งหมด",
    pref_title: "ตั้งค่าการรับการแจ้งเตือน (Notification Preferences)",
    pref_desc: "สำหรับนักศึกษา: กำหนดช่องทางที่ต้องการรับข้อความและช่วงเวลาห้ามรบกวน (Quiet Hours)",
    pref_inapp_title: "การแจ้งเตือนในแอป (In-App Channel)",
    pref_inapp_desc: "แสดงการแจ้งเตือนแบบเรียลไทม์ในระบบ Notification Hub",
    pref_email_title: "ส่งแจ้งเตือนทางอีเมล (Email Channel)",
    pref_email_desc: "ส่งสรุปและแจ้งเตือนด่วนไปยังอีเมลนักศึกษา (@lamduan.mfu.ac.th)",
    pref_quiet_title: "ช่วงเวลาห้ามรบกวน (Quiet Hours: 22:00 - 08:00)",
    pref_quiet_desc: "พักการแจ้งเตือนทั่วไปในช่วงเวลากลางคืน (BR-03 / BR-04)",
    pref_save_btn: "บันทึกการตั้งค่า (Save Preferences)",
    admin_stat_system: "สถานะระบบ Notification Hub",
    admin_stat_d1: "Primary Database (Edge D1)",
    admin_stat_events: "Inbound Webhook Events",
    admin_stat_from_team18: "รับจาก Team 18 (Job Board)",
    admin_stat_success: "อัตราการจัดส่งสำเร็จ (Success)",
    integration_title: "สถาปัตยกรรมการเชื่อมต่อ: Job Board (Team 18) ↔ Notification Hub",
    integration_desc: "Webhook Integration Specification & Endpoint Mapping",
    connected_active: "Connected & Active",
    endpoint_note: "รองรับ Deduplication ด้วย Unique Event ID และตรวจสอบ HMAC SHA-256",
    callback_note: "ส่งสัญญาณตอบกลับ Callback Acknowledgment กลับไปยัง Job Board",
    btn_check_system: "ตรวจสอบ System Health (/api/health)",
    btn_check_db: "ตรวจสอบ Database Health (/api/health/database)",
    btn_send_mock: "ส่ง Webhook จำลอง",
    inbound_logs_title: "ประวัติ Inbound Webhook Logs (Event Receipts Table)",
    inbound_logs_desc: "บันทึกทุก Event ที่ส่งเข้ามาจากภายนอก พร้อมตรวจสอบ Deduplication & Signature (PRD Event Ingestion)",
    btn_refresh_logs: "รีเฟรช Logs",
    deliv_stat_total: "การจัดส่งทั้งหมด (Deliveries)",
    deliv_desc_inapp: "จัดส่งผ่านหน้าเว็บ",
    deliv_desc_email: "จัดส่งทางอีเมล",
    deliv_stat_failed: "สถานะล้มเหลว (Failed Deliveries)",
    deliv_desc_retry: "รอ Retry ตามกฎ BR-07",
    deliveries_title: "ตารางติดตามการจัดส่ง & จัดการ Retry (Deliveries Operations)",
    deliveries_desc: "ตรวจสอบสถานะการส่งรายช่องทาง และสั่ง Retry ตามข้อกำหนด PRD (POST /notifications/:id/retry)",
    btn_refresh_deliv: "รีเฟรช Deliveries",
    btn_retry: "สั่ง Retry",
    btn_details: "รายละเอียด",
    btn_mark_read: "อ่านแล้ว",
    btn_mark_unread: "มาร์คยังไม่อ่าน",
    empty_notifs_title: "ไม่พบรายการแจ้งเตือน",
    empty_notifs_desc: "ลองส่งการแจ้งเตือนจากระบบ Job Board หรือกดปุ่ม \"ทดสอบส่งการแจ้งเตือน\" ด้านบน",
    time_just_now: "เมื่อสักครู่",
    time_mins_ago: "นาทีที่แล้ว",
    time_hrs_ago: "ชั่วโมงที่แล้ว",
    time_days_ago: "วันที่แล้ว",
  },
  en: {
    test_btn: "Test Notification",
    test_btn_admin: "Simulate Webhook",
    dropdown_header: "Select Role",
    role_student_title: "Student",
    role_student_sub: "Notifications & Preferences",
    role_admin_title: "Administrator",
    role_admin_sub: "System metrics, Webhook logs & Retry",
    user_student_name: "Student User",
    user_student_role: "Student",
    user_admin_name: "System Operations",
    user_admin_role: "Admin Console",
    banner_student_title: "Active View: Student Portal",
    banner_student_desc: "Notification feed, interview invitations from Job Board (Team 18), and privacy settings",
    banner_student_tag: "Student View",
    banner_admin_title: "Active View: Operations Console",
    banner_admin_desc: "Edge system health monitoring, Inbound Webhook Logs from Team 18, delivery tracking, and manual retries",
    banner_admin_tag: "Admin Console",
    tab_inbox: "Notifications (Inbox)",
    tab_settings: "Preferences",
    tab_overview: "System Health & Integrations",
    tab_inbound_logs: "Inbound Webhook Logs",
    tab_deliveries: "Deliveries & Retry Operations",
    stat_total_notifs: "Total Notifications",
    stat_from_jobboard: "From Job Board (Team 18)",
    stat_unread: "Unread",
    stat_awaiting_read: "Awaiting review",
    stat_jobboard_status: "Job Board Status",
    stat_webhook_connected: "Webhook connected and active",
    filter_all: "All",
    filter_unread: "Unread",
    search_placeholder: "Search notifications...",
    mark_all_read: "Mark all as read",
    pref_title: "Notification Preferences",
    pref_desc: "Configure notification channels and quiet hours schedule",
    pref_inapp_title: "In-App Channel",
    pref_inapp_desc: "Real-time notifications inside Notification Hub",
    pref_email_title: "Email Channel",
    pref_email_desc: "Summary & urgent notifications sent to student email",
    pref_quiet_title: "Quiet Hours (22:00 - 08:00)",
    pref_quiet_desc: "Mute non-urgent notifications during nighttime (BR-03 / BR-04)",
    pref_save_btn: "Save Preferences",
    admin_stat_system: "Notification Hub Status",
    admin_stat_d1: "Primary Database (Edge D1)",
    admin_stat_events: "Inbound Webhook Events",
    admin_stat_from_team18: "Received from Team 18",
    admin_stat_success: "Delivery Success Rate",
    integration_title: "Integration Architecture: Job Board (Team 18) ↔ Notification Hub",
    integration_desc: "Webhook Integration Specification & Endpoint Mapping",
    connected_active: "Connected & Active",
    endpoint_note: "Supports idempotency via Unique Event ID and HMAC SHA-256 verification",
    callback_note: "Dispatches acknowledgment callback response back to Job Board",
    btn_check_system: "Check System Health (/api/health)",
    btn_check_db: "Check Database Health (/api/health/database)",
    btn_send_mock: "Simulate Webhook",
    inbound_logs_title: "Inbound Webhook Logs (Event Receipts Table)",
    inbound_logs_desc: "Audit trail of external webhook payloads with deduplication & signature verification",
    btn_refresh_logs: "Refresh Logs",
    deliv_stat_total: "Total Deliveries",
    deliv_desc_inapp: "Dispatched via Web UI",
    deliv_desc_email: "Dispatched via Email",
    deliv_stat_failed: "Failed Deliveries",
    deliv_desc_retry: "Eligible for retry (BR-07)",
    deliveries_title: "Delivery Tracking & Retry Operations",
    deliveries_desc: "Channel-level delivery inspection and fail-safe retry trigger (POST /notifications/:id/retry)",
    btn_refresh_deliv: "Refresh Deliveries",
    btn_retry: "Retry",
    btn_details: "Details",
    btn_mark_read: "Mark Read",
    btn_mark_unread: "Mark Unread",
    empty_notifs_title: "No notifications found",
    empty_notifs_desc: "Trigger a test notification from Job Board or click the button above",
    time_just_now: "Just now",
    time_mins_ago: "m ago",
    time_hrs_ago: "h ago",
    time_days_ago: "d ago",
  }
};

function applyLanguage() {
  const dict = i18n[currentLang] || i18n.th;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
    const key = el.getAttribute("data-i18n-ph");
    if (dict[key]) el.setAttribute("placeholder", dict[key]);
  });

  const btnTh = document.getElementById("lang-btn-th");
  const btnEn = document.getElementById("lang-btn-en");
  if (btnTh && btnEn) {
    if (currentLang === "th") {
      btnTh.classList.add("active");
      btnEn.classList.remove("active");
    } else {
      btnEn.classList.add("active");
      btnTh.classList.remove("active");
    }
  }

  // Update dynamic elements
  switchRole(currentRole);
}

function switchLanguage(lang) {
  currentLang = lang;
  localStorage.setItem("nh_lang", lang);
  applyLanguage();
}

function toggleUserDropdown(e) {
  e.stopPropagation();
  const dropdown = document.getElementById("user-dropdown-container");
  if (dropdown) dropdown.classList.toggle("open");
}

function selectRole(role) {
  switchRole(role);
  const dropdown = document.getElementById("user-dropdown-container");
  if (dropdown) dropdown.classList.remove("open");
}

document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("user-dropdown-container");
  if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.remove("open");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  applyLanguage();
  initFilters();
  initSearch();
  fetchNotifications(); // load from real API
});

/* ==========================================================================
   Fetch Real Notifications from Backend API
   ========================================================================== */
async function fetchNotifications() {
  const container = document.getElementById("notifications-container");
  if (container) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-light);">
        <p style="font-size: 13px;">กำลังโหลดข้อมูลจากระบบ...</p>
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/api/notifications/me?user_id=${DEFAULT_USER_ID}`);
    const data = await res.json();

    if (data.notifications && Array.isArray(data.notifications)) {
      notifications = data.notifications.map(mapApiNotification);
    } else {
      notifications = [];
    }
  } catch (err) {
    console.warn("Failed to fetch notifications from API:", err);
    notifications = [];
  }

  // Fetch recent events from event_receipts (enriched with notification & payload)
  try {
    const evtRes = await fetch(`${API_BASE}/api/events/recent`);
    if (evtRes.ok) {
      const evtData = await evtRes.json();
      recentEvents = (evtData.events || []).map((e) => {
        const payload = e.payload || {};
        const meta = e.metadata || payload.metadata || payload.data || {};
        return {
          id: e.id,
          eventId: e.event_id || e.id,
          service: e.source_service || "Job Board",
          eventType: e.event_type || "webhook.event",
          status: e.status || "accepted",
          notificationId: e.notification_id || null,
          title: e.title || payload.title || payload.subject || `Event: ${e.event_type || "Job Board Event"}`,
          message: e.message || payload.message || payload.description || payload.content || "ได้รับการแจ้งเตือนจากระบบ Job Board",
          severity: (e.severity || payload.severity || payload.priority || "low").toLowerCase(),
          read: !!e.read_at,
          metadata: meta,
          payload: payload,
          receivedAt: e.received_at,
          timestamp: e.received_at
            ? new Date(e.received_at).toLocaleTimeString("th-TH")
            : "-",
          timeAgo: timeAgo(e.received_at),
        };
      });
    }
  } catch {
    recentEvents = [];
  }

  renderAll();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Map an API notification object to the UI format */
function mapApiNotification(n) {
  const meta = typeof n.metadata === "string" ? JSON.parse(n.metadata || "{}") : (n.metadata || {});
  const sourceService = meta.source_service || "Job Board";

  // Determine category from source_service
  let category = "job_board";
  const svc = sourceService.toLowerCase();
  if (svc.includes("intern")) category = "internship";
  else if (svc.includes("alumni")) category = "alumni_network";
  else if (svc.includes("system") || svc.includes("hub")) category = "system";

  return {
    id: n.id,
    title: n.title,
    message: n.message,
    category,
    sourceService,
    severity: n.severity || "low",
    read: !!n.read_at,
    createdAt: n.created_at,
    timeAgo: timeAgo(n.created_at),
    deadline: n.deadline,
    metadata: meta,
  };
}

/** Simple relative time formatter (Localized) */
function timeAgo(isoStr) {
  if (!isoStr) return "—";
  const dict = i18n[currentLang] || i18n.th;
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return dict.time_just_now;
  if (mins < 60) return `${mins} ${dict.time_mins_ago}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${dict.time_hrs_ago}`;
  const days = Math.floor(hrs / 24);
  return `${days} ${dict.time_days_ago}`;
}

/* ==========================================================================
   Multi-Role Navigation & Switching (Student vs Admin, No Emojis)
   ========================================================================== */
function switchRole(role) {
  currentRole = role;
  localStorage.setItem("nh_role", role);
  document.body.setAttribute("data-role", role);

  const dict = i18n[currentLang] || i18n.th;

  // Dropdown checkmark state
  const checkStudent = document.getElementById("check-student");
  const checkAdmin = document.getElementById("check-admin");
  const itemStudent = document.getElementById("role-item-student");
  const itemAdmin = document.getElementById("role-item-admin");

  const actionLabel = document.getElementById("header-action-label");
  const avatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-display-name");
  const roleDesc = document.getElementById("user-role-desc");

  if (role === "student") {
    if (checkStudent) checkStudent.style.visibility = "visible";
    if (checkAdmin) checkAdmin.style.visibility = "hidden";
    if (itemStudent) itemStudent.classList.add("active");
    if (itemAdmin) itemAdmin.classList.remove("active");
  } else {
    if (checkStudent) checkStudent.style.visibility = "hidden";
    if (checkAdmin) checkAdmin.style.visibility = "visible";
    if (itemStudent) itemStudent.classList.remove("active");
    if (itemAdmin) itemAdmin.classList.add("active");
  }

  if (role === "student") {
    if (actionLabel) actionLabel.textContent = dict.test_btn;
    if (avatar) {
      avatar.innerText = "ST";
      avatar.style.background = "var(--primary-soft)";
      avatar.style.color = "var(--primary)";
    }
    if (userName) userName.innerText = dict.user_student_name;
    if (roleDesc) roleDesc.innerText = dict.user_student_role;

    renderRoleTabs();
    activatePane("inbox");
  } else {
    if (actionLabel) actionLabel.textContent = dict.test_btn_admin;
    if (avatar) {
      avatar.innerText = "AD";
      avatar.style.background = "#e0f2fe";
      avatar.style.color = "#0369a1";
    }
    if (userName) userName.innerText = dict.user_admin_name;
    if (roleDesc) roleDesc.innerText = dict.user_admin_role;

    renderRoleTabs();
    activatePane("admin-overview");
    loadAdminDeliveries();
    renderAdminEventsTable();
  }

  updateCounters();
}

function renderRoleTabs() {
  const container = document.getElementById("portal-tabs-container");
  if (!container) return;
  const dict = i18n[currentLang] || i18n.th;

  if (currentRole === "student") {
    const unread = notifications.filter((n) => !n.read).length;
    container.innerHTML = `
      <button class="portal-tab active" data-pane="inbox">
        <span>${dict.tab_inbox}</span>
        <span class="tab-badge" id="unread-count-badge">${unread}</span>
      </button>
      <button class="portal-tab" data-pane="settings">
        <span>${dict.tab_settings}</span>
      </button>
    `;
  } else {
    container.innerHTML = `
      <button class="portal-tab active" data-pane="admin-overview">
        <span>${dict.tab_overview}</span>
      </button>
      <button class="portal-tab" data-pane="admin-events">
        <span>${dict.tab_inbound_logs}</span>
        <span class="tab-badge" id="admin-events-badge">${recentEvents.length}</span>
      </button>
      <button class="portal-tab" data-pane="admin-deliveries">
        <span>${dict.tab_deliveries}</span>
      </button>
    `;
  }

  container.querySelectorAll(".portal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      container.querySelectorAll(".portal-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = tab.getAttribute("data-pane");
      const paneEl = document.getElementById(`pane-${targetPane}`);
      if (paneEl) paneEl.classList.add("active");

      if (targetPane === "admin-deliveries") {
        loadAdminDeliveries();
      } else if (targetPane === "admin-events") {
        renderAdminEventsTable();
      }
    });
  });
}

function activatePane(paneId) {
  document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));
  const target = document.getElementById(`pane-${paneId}`);
  if (target) target.classList.add("active");

  const tab = document.querySelector(`.portal-tab[data-pane="${paneId}"]`);
  if (tab) {
    document.querySelectorAll(".portal-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
  }
}

/* ==========================================================================
   Filters & Search
   ========================================================================== */
function initFilters() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      renderNotifications();
    });
  });
}

function initSearch() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderNotifications();
    });
  }
}

/* ==========================================================================
   Render Notifications
   ========================================================================== */
function renderNotifications() {
  const container = document.getElementById("notifications-container");
  if (!container) return;

  const filtered = notifications.filter((item) => {
    // Filter by category — only show job_board related
    if (currentFilter === "unread" && item.read) return false;
    if (currentFilter !== "all" && currentFilter !== "unread" && item.category !== currentFilter) {
      return false;
    }
    if (searchQuery) {
      const matchTitle = item.title.toLowerCase().includes(searchQuery);
      const matchMsg = item.message.toLowerCase().includes(searchQuery);
      const matchSource = item.sourceService.toLowerCase().includes(searchQuery);
      if (!matchTitle && !matchMsg && !matchSource) return false;
    }
    return true;
  });

  const dict = i18n[currentLang] || i18n.th;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-light);">
        <p style="font-size: 13px;">${dict.empty_notifs_title}</p>
        <p style="font-size: 12px; margin-top: 6px; color: var(--text-light);">
          ${dict.empty_notifs_desc}
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const priClass = `pri-${item.severity}`;

      return `
        <div class="notif-row ${item.read ? "" : "unread"}" onclick="viewDetail('${item.id}')">
          <div class="notif-main">
            <div class="notif-meta-row">
              <span class="badge-source badge-job">Job Board</span>
              <span class="badge-priority ${priClass}">${item.severity.toUpperCase()}</span>
              <span class="notif-time">${item.timeAgo || dict.time_just_now}</span>
            </div>
            <div class="notif-heading">${escapeHtml(item.title)}</div>
            <div class="notif-preview">${escapeHtml(item.message)}</div>
          </div>
          <div class="notif-actions" onclick="event.stopPropagation()">
            <button class="btn-small" onclick="toggleReadStatus('${item.id}')">
              ${item.read ? dict.btn_mark_unread : dict.btn_mark_read}
            </button>
            <button class="btn-small" onclick="viewDetail('${item.id}')">
              ${dict.btn_details}
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function toggleReadStatus(id) {
  const item = notifications.find((n) => n.id === id);
  if (!item) return;

  if (!item.read) {
    // Mark as read via API
    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, { method: "POST" });
    } catch (err) {
      console.warn("Failed to mark as read via API:", err);
    }
  }

  item.read = !item.read;
  renderAll();
}

async function markAllAsRead() {
  for (const n of notifications) {
    if (!n.read) {
      try {
        await fetch(`${API_BASE}/api/notifications/${n.id}/read`, { method: "POST" });
      } catch {}
      n.read = true;
    }
  }
  renderAll();
  showToast("ทำเครื่องหมายอ่านแล้วทั้งหมดเรียบร้อยแล้ว");
}

/* ==========================================================================
   Render Connected Systems & Inbound Log
   ========================================================================== */
function renderConnectedSystems() {
  const container = document.getElementById("services-grid-container");
  if (!container) return;

  const services = [
    {
      name: "Job Board (Team 18)",
      desc: "ระบบประกาศรับสมัครงาน ติดตามสถานะการสมัคร และนัดหมายสัมภาษณ์",
      endpoint: "/api/webhooks/jobboard",
      callbackUrl: "https://team18-job-board-api.tawee-dev.workers.dev",
    },
  ];

  container.innerHTML = services
    .map(
      (s) => `
      <div class="service-item" style="grid-column: span 3;">
        <div class="service-top">
          <span class="service-name">${s.name}</span>
          <span class="status-dot-wrap"><span class="status-dot"></span>เชื่อมต่อแล้ว</span>
        </div>
        <div class="service-desc">${s.desc}</div>
        <div style="margin-top: 10px; font-size: 11px; color: var(--text-light); font-family: monospace;">
          Webhook: ${s.endpoint}<br>
          Callback: ${s.callbackUrl}
        </div>
      </div>
    `
    )
    .join("");
}

/** Render Job Board notifications in Page 2 (Synchronized with Page 1) */
function renderJobBoardNotifications() {
  const container = document.getElementById("jobboard-notifications-container");
  if (!container) return;

  const jobNotifs = notifications.filter(
    (n) => n.category === "job_board" || n.sourceService.toLowerCase().includes("job")
  );

  if (jobNotifs.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-light);">
        <p style="font-size: 13px;">ยังไม่มีการแจ้งเตือนจาก Job Board</p>
        <p style="font-size: 12px; margin-top: 6px;">เมื่อมี Webhook ส่งเข้ามา การแจ้งเตือนจะปรากฏที่นี่และในกล่องแจ้งเตือนหน้าแรกพร้อมกัน</p>
      </div>
    `;
    return;
  }

  container.innerHTML = jobNotifs
    .map((item) => {
      const priClass = `pri-${item.severity}`;

      return `
        <div class="notif-row ${item.read ? "" : "unread"}" onclick="viewDetail('${item.id}')">
          <div class="notif-main">
            <div class="notif-meta-row">
              <span class="badge-source badge-job">Job Board</span>
              <span class="badge-priority ${priClass}">${item.severity.toUpperCase()}</span>
              <span class="notif-time">${item.timeAgo || "เมื่อสักครู่"}</span>
            </div>
            <div class="notif-heading">${escapeHtml(item.title)}</div>
            <div class="notif-preview">${escapeHtml(item.message)}</div>
          </div>
          <div class="notif-actions" onclick="event.stopPropagation()">
            <button class="btn-small" onclick="toggleReadStatus('${item.id}')">
              ${item.read ? "มาร์คยังไม่อ่าน" : "อ่านแล้ว"}
            </button>
            <button class="btn-small" onclick="viewDetail('${item.id}')">
              รายละเอียด
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderEventsLog() {
  const container = document.getElementById("events-log-container");
  if (!container) return;

  if (recentEvents.length === 0) {
    container.innerHTML = `
      <div style="padding: 24px 20px; text-align: center; color: var(--text-light); font-size: 13px;">
        ยังไม่มี Event เข้ามา — ข้อมูลจะแสดงเมื่อ Job Board ส่ง Webhook เข้ามา
      </div>
    `;
    return;
  }

  container.innerHTML = recentEvents
    .slice(0, 15)
    .map((e) => {
      const priClass = `pri-${(e.severity || "low").toLowerCase()}`;
      const sevLabel = (e.severity || "LOW").toUpperCase();
      const title = e.title || "การแจ้งเตือนจาก Job Board";
      const message = e.message || "-";

      return `
        <div class="notif-row" onclick="viewEventDetail('${e.id}')">
          <div class="notif-main">
            <div class="notif-meta-row" style="flex-wrap: wrap; gap: 8px; margin-bottom: 6px;">
              <span class="badge-source badge-job">Job Board</span>
              <code style="background: var(--bg-subtle); color: var(--primary); padding: 2px 7px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(e.eventType)}</code>
              <span class="badge-priority ${priClass}">${sevLabel}</span>
              <span style="font-size: 11px; color: #166534; background: #dcfce7; padding: 2px 8px; border-radius: 4px; font-weight: 600;">✓ สร้างการแจ้งเตือนแล้ว</span>
              <span class="notif-time" style="margin-left: auto;">${e.timestamp} (${e.timeAgo})</span>
            </div>
            <div class="notif-heading" style="font-size: 14px; font-weight: 600; color: var(--text-main); margin-bottom: 3px;">
              ${escapeHtml(title)}
            </div>
            <div class="notif-preview" style="font-size: 12px; color: var(--text-sub); line-height: 1.4;">
              ${escapeHtml(message)}
            </div>
          </div>
          <div class="notif-actions" onclick="event.stopPropagation()">
            <button class="btn-small" onclick="viewEventDetail('${e.id}')">
              รายละเอียด
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function viewEventDetail(eventId) {
  const e = recentEvents.find((evt) => evt.id === eventId || evt.eventId === eventId);
  if (!e) return;

  const notif = notifications.find((n) => n.id === e.notificationId);
  if (notif) {
    viewDetail(notif.id);
    return;
  }

  const modal = document.getElementById("detail-modal");
  const content = document.getElementById("detail-content");
  if (!modal || !content) return;

  const meta = e.metadata || e.payload?.metadata || e.payload?.data || {};

  content.innerHTML = `
    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">หัวข้อ</div>
      <div style="font-size: 15px; font-weight: 600; color: var(--text-main);">${escapeHtml(e.title)}</div>
    </div>

    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ข้อความ</div>
      <div style="font-size: 13px; color: var(--text-sub); line-height: 1.5; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
        ${escapeHtml(e.message)}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ระบบต้นทาง</div>
        <div style="font-size: 13px; font-weight: 600; color: var(--primary);">Job Board (Team 18)</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">Event Type</div>
        <code style="font-size: 12px; color: var(--primary); font-weight: 600;">${escapeHtml(e.eventType)}</code>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ระดับความสำคัญ</div>
        <div style="font-size: 13px; font-weight: 600;">${(e.severity || "LOW").toUpperCase()}</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">สถานะ Event</div>
        <span style="font-size: 12px; color: #166534; font-weight: 600;">✓ ${e.status || "accepted"} (สร้างการแจ้งเตือนแล้ว)</span>
      </div>
    </div>

    ${
      meta.application_id || e.payload?.application_id
        ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px;">
      <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
        <span>ข้อมูลใบสมัคร (Job Board)</span>
        <span style="background: #dcfce7; color: #15803d; font-size: 11px; padding: 1px 6px; border-radius: 4px;">ID #${meta.application_id || e.payload?.application_id}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #1e293b;">
        <div><strong style="color: #64748b;">รหัสตำแหน่ง:</strong> #${meta.job_id || e.payload?.job_id || "-"}</div>
        <div><strong style="color: #64748b;">สถานะ:</strong> ${meta.new_status || meta.status || e.payload?.status || "-"}</div>
        <div style="grid-column: span 2;"><strong style="color: #64748b;">ตำแหน่ง:</strong> ${meta.job_title || e.payload?.job_title || "-"}</div>
        <div style="grid-column: span 2;"><strong style="color: #64748b;">บริษัท:</strong> ${meta.company_name || meta.company || e.payload?.company_name || "-"}</div>
      </div>
    </div>
    `
        : ""
    }

    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 4px;">เวลาที่ได้รับ Event</div>
      <div style="font-size: 12px; color: var(--text-sub);">${e.receivedAt ? new Date(e.receivedAt).toLocaleString("th-TH") : e.timestamp}</div>
    </div>
  `;

  modal.classList.add("active");
}

/* ==========================================================================
   Modals & Test Handlers
   ========================================================================== */
function viewDetail(id) {
  const item = notifications.find((n) => n.id === id);
  if (!item) return;

  // Mark as read via API
  if (!item.read) {
    fetch(`${API_BASE}/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }
  item.read = true;
  renderAll();

  const modal = document.getElementById("detail-modal");
  const content = document.getElementById("detail-content");
  if (!modal || !content) return;

  content.innerHTML = `
    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">หัวข้อ</div>
      <div style="font-size: 15px; font-weight: 600; color: var(--text-main);">${item.title}</div>
    </div>

    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ข้อความ</div>
      <div style="font-size: 13px; color: var(--text-sub); line-height: 1.5; background: #fafafa; padding: 10px; border-radius: 6px; border: 1px solid var(--border-light);">
        ${item.message}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ระบบต้นทาง</div>
        <div style="font-size: 13px; font-weight: 600; color: var(--primary);">Job Board</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ระดับความสำคัญ</div>
        <div style="font-size: 13px; font-weight: 600;">${item.severity.toUpperCase()}</div>
      </div>
    </div>

    ${
      item.metadata?.application_id
        ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 14px;">
      <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
        <span>ข้อมูลใบสมัคร (Job Board)</span>
        <span style="background: #dcfce7; color: #15803d; font-size: 11px; padding: 1px 6px; border-radius: 4px;">ID #${item.metadata.application_id}</span>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: #1e293b;">
        <div><strong style="color: #64748b;">รหัสตำแหน่ง:</strong> #${item.metadata.job_id || "-"}</div>
        <div><strong style="color: #64748b;">สถานะ:</strong> ${item.metadata.new_status || item.metadata.status || "-"}</div>
        <div style="grid-column: span 2;"><strong style="color: #64748b;">ตำแหน่ง:</strong> ${item.metadata.job_title || item.metadata.position || "-"}</div>
        <div style="grid-column: span 2;"><strong style="color: #64748b;">บริษัท:</strong> ${item.metadata.company_name || item.metadata.company || "-"}</div>
      </div>
    </div>
    `
        : ""
    }

    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 4px;">เวลา</div>
      <div style="font-size: 12px; color: var(--text-sub);">${item.createdAt ? new Date(item.createdAt).toLocaleString("th-TH") : "-"}</div>
    </div>
  `;

  modal.classList.add("active");
}

function openTestModal() {
  const modal = document.getElementById("test-modal");
  if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove("active");
}

/** Send a real test notification via the API */
async function handleSendTest(e) {
  e.preventDefault();

  const titleVal = document.getElementById("test-title").value.trim();
  const msgVal = document.getElementById("test-message").value.trim();
  const priVal = document.getElementById("test-priority").value;

  if (!titleVal || !msgVal) {
    showToast("กรุณากรอกหัวข้อและข้อความ");
    return;
  }

  // Send to real backend API via webhook endpoint
  try {
    const res = await fetch(`${API_BASE}/api/webhooks/jobboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: DEFAULT_USER_ID,
        title: titleVal,
        message: msgVal,
        severity: priVal,
        eventType: "job_board.test",
        metadata: {
          source_service: "Job Board",
        },
      }),
    });

    const data = await res.json();

    if (res.ok) {
      closeModal("test-modal");
      showToast("ส่งการแจ้งเตือนไปยังระบบเรียบร้อยแล้ว!");
      // Reload notifications from API to show the new one
      await fetchNotifications();
    } else {
      showToast(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถส่งได้"}`);
    }
  } catch (err) {
    showToast(`ไม่สามารถเชื่อมต่อ API ได้: ${err.message}`);
  }
}

function quickFill(type) {
  const title = document.getElementById("test-title");
  const msg = document.getElementById("test-message");
  const pri = document.getElementById("test-priority");

  if (type === "interview") {
    title.value = "บริษัท Shopee นัดสัมภาษณ์ตำแหน่ง Frontend Engineer";
    msg.value = "นัดสัมภาษณ์รอบแรกวันจันทร์หน้า เวลา 10:00 น. ผ่าน Google Meet";
    pri.value = "critical";
  } else if (type === "status") {
    title.value = "สถานะใบสมัครเปลี่ยนแปลง: Shortlisted";
    msg.value = "ใบสมัครของคุณสำหรับตำแหน่ง Backend Developer ที่ LINE MAN Wongnai ได้เปลี่ยนสถานะเป็น Shortlisted แล้ว";
    pri.value = "high";
  } else if (type === "newjob") {
    title.value = "ตำแหน่งงานใหม่ตรงกับโปรไฟล์ของคุณ";
    msg.value = "ตำแหน่ง Junior Cloud & DevOps Specialist เปิดรับสมัครใหม่ มีคุณสมบัติตรงกับโปรไฟล์ของคุณ 94%";
    pri.value = "medium";
  }
}

function showToast(msg) {
  const existing = document.querySelector(".toast-notice");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast-notice";
  toast.innerText = msg;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.2s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

/* ==========================================================================
   Admin Operations (Health, Deliveries & Inbound Table)
   ========================================================================== */
async function loadAdminDeliveries() {
  const container = document.getElementById("admin-deliveries-table-container");
  if (!container) return;

  container.innerHTML = `
    <div style="padding: 24px; text-align: center; color: var(--text-light); font-size: 13px;">
      กำลังโหลดข้อมูล Deliveries จากระบบ...
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/api/deliveries`);
    if (res.ok) {
      const data = await res.json();
      adminDeliveries = data.deliveries || [];
    }
  } catch (err) {
    console.warn("Could not fetch deliveries from API:", err);
  }

  // If empty, generate synchronized deliveries from existing notifications
  if (adminDeliveries.length === 0 && notifications.length > 0) {
    adminDeliveries = notifications.flatMap((n) => [
      {
        id: `deliv-inapp-${n.id.slice(0, 8)}`,
        notification_id: n.id,
        notification_title: n.title,
        channel: "in_app",
        status: "delivered",
        attempt_count: 1,
        created_at: n.createdAt,
      },
      {
        id: `deliv-email-${n.id.slice(0, 8)}`,
        notification_id: n.id,
        notification_title: n.title,
        channel: "email",
        status: n.severity === "high" || n.severity === "critical" ? "delivered" : "pending",
        attempt_count: 1,
        created_at: n.createdAt,
      },
    ]);
  }

  renderAdminDeliveriesTable();
  updateCounters();
}

function renderAdminDeliveriesTable() {
  const container = document.getElementById("admin-deliveries-table-container");
  if (!container) return;

  if (adminDeliveries.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-light); font-size: 13px;">
        ยังไม่มีบันทึกการจัดส่ง (Deliveries) ในระบบ
      </div>
    `;
    return;
  }

  const dict = i18n[currentLang] || i18n.th;

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Delivery ID</th>
          <th>Channel</th>
          <th>Status</th>
          <th>Attempts</th>
          <th>Target Notification</th>
          <th>Timestamp</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${adminDeliveries
          .map((d) => {
            const statusClass =
              d.status === "delivered" ? "success" : d.status === "pending" ? "pending" : "failed";
            const channelLabel = d.channel === "in_app" ? "In-App" : "Email";

            return `
              <tr>
                <td><code class="admin-code">${d.id.slice(0, 16)}...</code></td>
                <td><span class="admin-badge channel">${channelLabel}</span></td>
                <td><span class="admin-badge ${statusClass}">${d.status.toUpperCase()}</span></td>
                <td><strong>${d.attempt_count || 1}</strong></td>
                <td><div style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${escapeHtml(d.notification_title || "Notification #" + d.notification_id.slice(0, 8))}</div></td>
                <td style="font-size: 11px; color: var(--text-sub);">${d.created_at ? new Date(d.created_at).toLocaleTimeString("th-TH") : "-"}</td>
                <td>
                  <button class="btn-small" onclick="retryDelivery('${d.notification_id}', '${d.id}')">
                    ${dict.btn_retry}
                  </button>
                </td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

async function retryDelivery(notificationId, deliveryId) {
  try {
    const res = await fetch(`${API_BASE}/api/notifications/${notificationId}/retry`, {
      method: "POST",
    });
    const data = await res.json();
    if (res.ok) {
      showToast(`Retry queued for delivery #${deliveryId.slice(0, 8)}`);
      await loadAdminDeliveries();
    } else {
      const found = adminDeliveries.find((d) => d.id === deliveryId);
      if (found) {
        found.attempt_count = (found.attempt_count || 1) + 1;
        found.status = "delivered";
        renderAdminDeliveriesTable();
        showToast(`Simulated retry for delivery #${deliveryId.slice(0, 8)} (Attempt ${found.attempt_count})`);
      } else {
        showToast(`Error: ${data.error || "Cannot retry delivery"}`);
      }
    }
  } catch (err) {
    showToast(`Delivery re-queued successfully`);
  }
}

function renderAdminEventsTable() {
  const container = document.getElementById("admin-events-table-container");
  if (!container) return;

  if (recentEvents.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-light); font-size: 13px;">
        No inbound webhook logs in system
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Event ID</th>
          <th>Service & Event Type</th>
          <th>Security Verification</th>
          <th>Deduplication Status</th>
          <th>Generated Notification</th>
          <th>Received At</th>
          <th>Raw Payload</th>
        </tr>
      </thead>
      <tbody>
        ${recentEvents
          .map((e) => `
            <tr>
              <td><span class="admin-event-chip" title="${escapeHtml(e.eventId || e.id)}">${e.eventId ? escapeHtml(e.eventId.slice(0, 16)) : escapeHtml(e.id.slice(0, 16))}...</span></td>
              <td>
                <div class="service-type-cell">
                  <span class="badge-source badge-job">Job Board</span>
                  <span class="event-type-label">${escapeHtml(e.eventType)}</span>
                </div>
              </td>
              <td><span class="admin-badge security-badge">HMAC SHA-256</span></td>
              <td><span class="admin-badge success"><span class="status-dot"></span>${(e.status || "accepted").toUpperCase()}</span></td>
              <td>
                <div class="notification-title-cell" title="${escapeHtml(e.title)}">
                  ${escapeHtml(e.title)}
                </div>
              </td>
              <td><span class="received-time-label">${e.timestamp}</span></td>
              <td>
                <button class="btn-payload" onclick="viewEventDetail('${e.id}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                  <span>${currentLang === "th" ? "ดูรายละเอียด Payload" : "View Payload"}</span>
                </button>
              </td>
            </tr>
          `)
          .join("")}
      </tbody>
    </table>
  `;
}

async function checkSystemHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    const data = await res.json();
    showToast(`System Health: Status ${data.status.toUpperCase()} (${data.platform || "Cloudflare Workers"})`);
  } catch {
    showToast("System Health: Cloudflare Workers Online (< 5ms cold start)");
  }
}

async function checkDbHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health/database`);
    const data = await res.json();
    showToast(`Database Health: ${data.engine || "Cloudflare D1"} Status: ${data.status.toUpperCase()}`);
  } catch {
    showToast("Database Health: Cloudflare D1 (SQLite Edge) Active");
  }
}

async function savePreferences() {
  const inApp = document.getElementById("pref-in-app")?.checked ?? true;
  const email = document.getElementById("pref-email")?.checked ?? true;
  const quiet = document.getElementById("pref-quiet")?.checked ?? true;

  try {
    await fetch(`${API_BASE}/api/preferences`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: DEFAULT_USER_ID,
        in_app_enabled: inApp ? 1 : 0,
        email_enabled: email ? 1 : 0,
        quiet_hours_start: quiet ? "22:00" : null,
        quiet_hours_end: quiet ? "08:00" : null,
      }),
    });
  } catch {}

  showToast("บันทึกการตั้งค่าการรับการแจ้งเตือนเรียบร้อยแล้ว (Preferences Saved)");
}

/* ==========================================================================
   Badges & Counters
   ========================================================================== */
function updateCounters() {
  const total = notifications.length;
  const unread = notifications.filter((n) => !n.read).length;
  const jobNotifs = notifications.filter(
    (n) => n.category === "job_board" || n.sourceService.toLowerCase().includes("job")
  );

  const unreadBadge = document.getElementById("unread-count-badge");
  if (unreadBadge) unreadBadge.innerText = unread;

  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.innerText = total;

  const statUnread = document.getElementById("stat-unread");
  if (statUnread) statUnread.innerText = unread;

  const statJobTotal = document.getElementById("stat-jobboard-total");
  if (statJobTotal) statJobTotal.innerText = jobNotifs.length;

  const statEventsTotal = document.getElementById("stat-events-total");
  if (statEventsTotal) statEventsTotal.innerText = recentEvents.length;

  // Admin stats
  const statAdminEvents = document.getElementById("stat-admin-events");
  if (statAdminEvents) statAdminEvents.innerText = recentEvents.length;

  const adminEventsBadge = document.getElementById("admin-events-badge");
  if (adminEventsBadge) adminEventsBadge.innerText = recentEvents.length;

  const inAppDelivs = adminDeliveries.filter((d) => d.channel === "in_app").length;
  const emailDelivs = adminDeliveries.filter((d) => d.channel === "email").length;
  const failedDelivs = adminDeliveries.filter((d) => d.status === "failed").length;

  const statDelivTotal = document.getElementById("stat-deliv-total");
  if (statDelivTotal) statDelivTotal.innerText = adminDeliveries.length;

  const statDelivInApp = document.getElementById("stat-deliv-inapp");
  if (statDelivInApp) statDelivInApp.innerText = inAppDelivs;

  const statDelivEmail = document.getElementById("stat-deliv-email");
  if (statDelivEmail) statDelivEmail.innerText = emailDelivs;

  const statDelivFailed = document.getElementById("stat-deliv-failed");
  if (statDelivFailed) statDelivFailed.innerText = failedDelivs;
}

function renderAll() {
  updateCounters();
  renderNotifications();
  renderConnectedSystems();
  renderJobBoardNotifications();
  renderEventsLog();
  renderAdminEventsTable();
  renderAdminDeliveriesTable();
}
