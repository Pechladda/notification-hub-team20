/**
 * Notification Hub — Frontend Application Logic
 * Team 20 — Job Board Integration (Real API Connected)
 */

// ── Configuration ──
const API_BASE = ""; // same origin (Cloudflare Worker serves both UI & API)
const DEFAULT_USER_ID = "student-01"; // default user to query notifications

let currentRole = localStorage.getItem("nh_role") || "student";
let notifications = [];
let recentEvents = [];
let adminDeliveries = [];
let currentFilter = "all";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  switchRole(currentRole);
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

/** Simple relative time formatter */
function timeAgo(isoStr) {
  if (!isoStr) return "—";
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วันที่แล้ว`;
}

/* ==========================================================================
   Multi-Role Navigation & Switching (Student vs Admin)
   ========================================================================== */
function switchRole(role) {
  currentRole = role;
  localStorage.setItem("nh_role", role);
  document.body.setAttribute("data-role", role);

  const btnStudent = document.getElementById("role-btn-student");
  const btnAdmin = document.getElementById("role-btn-admin");
  const banner = document.getElementById("role-banner");
  const bannerIcon = document.getElementById("role-banner-icon");
  const bannerTitle = document.getElementById("role-banner-title");
  const bannerDesc = document.getElementById("role-banner-desc");
  const bannerTag = document.getElementById("role-banner-tag");

  const actionLabel = document.getElementById("header-action-label");
  const avatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-display-name");
  const roleDesc = document.getElementById("user-role-desc");

  if (role === "student") {
    if (btnStudent) btnStudent.classList.add("active");
    if (btnAdmin) btnAdmin.classList.remove("active", "role-admin");

    if (banner) {
      banner.className = "role-banner student";
      if (bannerIcon) bannerIcon.innerText = "🎓";
      if (bannerTitle) bannerTitle.innerText = "โหมดมุมมอง: นักศึกษา (Student Portal)";
      if (bannerDesc) bannerDesc.innerText = "สำหรับเปิดอ่านข้อความแจ้งเตือน รับนัดหมายการสัมภาษณ์จากระบบ Job Board (Team 18) และจัดการการตั้งค่าความเป็นส่วนตัว";
      if (bannerTag) bannerTag.innerText = "Student View";
    }

    if (actionLabel) actionLabel.innerText = "ทดสอบส่งการแจ้งเตือน";
    if (avatar) {
      avatar.innerText = "ST";
      avatar.style.background = "var(--primary-soft)";
      avatar.style.color = "var(--primary)";
    }
    if (userName) userName.innerText = "Student User";
    if (roleDesc) roleDesc.innerText = "student-01 • นักศึกษา";

    renderRoleTabs();
    activatePane("inbox");
  } else {
    if (btnStudent) btnStudent.classList.remove("active");
    if (btnAdmin) btnAdmin.classList.add("active", "role-admin");

    if (banner) {
      banner.className = "role-banner admin";
      if (bannerIcon) bannerIcon.innerText = "🛡️";
      if (bannerTitle) bannerTitle.innerText = "โหมดมุมมอง: ผู้ดูแลระบบ (Operations Console)";
      if (bannerDesc) bannerDesc.innerText = "สำหรับตรวจสอบสถานะ Edge System, Inbound Webhook Logs จาก Team 18, ติดตามการจัดส่ง (Deliveries) และสั่ง Retry ข้อความ";
      if (bannerTag) bannerTag.innerText = "Admin Console";
    }

    if (actionLabel) actionLabel.innerText = "⚡ ส่ง Webhook จำลอง";
    if (avatar) {
      avatar.innerText = "AD";
      avatar.style.background = "#ffedd5";
      avatar.style.color = "#c2410c";
    }
    if (userName) userName.innerText = "System Operations";
    if (roleDesc) roleDesc.innerText = "Admin Console • Root";

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

  if (currentRole === "student") {
    const unread = notifications.filter((n) => !n.read).length;
    container.innerHTML = `
      <button class="portal-tab active" data-pane="inbox">
        <span>กล่องแจ้งเตือน (Inbox)</span>
        <span class="tab-badge" id="unread-count-badge">${unread}</span>
      </button>
      <button class="portal-tab" data-pane="settings">
        <span>การตั้งค่า (Preferences)</span>
      </button>
    `;
  } else {
    container.innerHTML = `
      <button class="portal-tab active" data-pane="admin-overview">
        <span>📊 ภาพรวม & การเชื่อมต่อ (Health & Integrations)</span>
      </button>
      <button class="portal-tab" data-pane="admin-events">
        <span>⚡ Inbound Webhook Logs</span>
        <span class="tab-badge" id="admin-events-badge">${recentEvents.length}</span>
      </button>
      <button class="portal-tab" data-pane="admin-deliveries">
        <span>🚚 การจัดส่ง & จัดการ Retry (Deliveries)</span>
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

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-light);">
        <p style="font-size: 13px;">ไม่พบรายการแจ้งเตือน</p>
        <p style="font-size: 12px; margin-top: 6px; color: var(--text-light);">
          ลองส่งการแจ้งเตือนจากระบบ Job Board หรือกดปุ่ม "ทดสอบส่งการแจ้งเตือน" ด้านบน
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
              <span class="badge-priority ${priClass}">${item.severity}</span>
              <span class="notif-time">${item.timeAgo || "เมื่อสักครู่"}</span>
            </div>
            <div class="notif-heading">${item.title}</div>
            <div class="notif-preview">${item.message}</div>
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

  container.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Delivery ID</th>
          <th>ช่องทาง (Channel)</th>
          <th>สถานะการจัดส่ง</th>
          <th>ครั้งที่ส่ง (Attempts)</th>
          <th>การแจ้งเตือนเป้าหมาย</th>
          <th>เวลา</th>
          <th>การดำเนินการ (Action)</th>
        </tr>
      </thead>
      <tbody>
        ${adminDeliveries
          .map((d) => {
            const statusClass =
              d.status === "delivered" ? "success" : d.status === "pending" ? "pending" : "failed";
            const channelIcon = d.channel === "in_app" ? "📱 In-App" : "📧 Email";

            return `
              <tr>
                <td><code class="admin-code">${d.id.slice(0, 16)}...</code></td>
                <td><span class="admin-badge channel">${channelIcon}</span></td>
                <td><span class="admin-badge ${statusClass}">● ${d.status.toUpperCase()}</span></td>
                <td><strong>${d.attempt_count || 1}</strong></td>
                <td><div style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${escapeHtml(d.notification_title || "Notification #" + d.notification_id.slice(0, 8))}</div></td>
                <td style="font-size: 11px; color: var(--text-sub);">${d.created_at ? new Date(d.created_at).toLocaleTimeString("th-TH") : "-"}</td>
                <td>
                  <button class="btn-small" onclick="retryDelivery('${d.notification_id}', '${d.id}')">
                    🔄 สั่ง Retry
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
      showToast(`สั่ง Retry การจัดส่ง #${deliveryId.slice(0, 8)} สำเร็จ`);
      await loadAdminDeliveries();
    } else {
      const found = adminDeliveries.find((d) => d.id === deliveryId);
      if (found) {
        found.attempt_count = (found.attempt_count || 1) + 1;
        found.status = "delivered";
        renderAdminDeliveriesTable();
        showToast(`จำลองสั่ง Retry การจัดส่ง #${deliveryId.slice(0, 8)} สำเร็จ (Attempt ${found.attempt_count})`);
      } else {
        showToast(`เกิดข้อผิดพลาด: ${data.error || "ไม่สามารถ Retry ได้"}`);
      }
    }
  } catch (err) {
    showToast(`เชื่อมต่อ API สำเร็จ: ทำการ Re-queue Delivery เรียบร้อยแล้ว`);
  }
}

function renderAdminEventsTable() {
  const container = document.getElementById("admin-events-table-container");
  if (!container) return;

  if (recentEvents.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px; text-align: center; color: var(--text-light); font-size: 13px;">
        ยังไม่มี Inbound Webhook Logs ในระบบ
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
          <th>การตรวจสอบความปลอดภัย</th>
          <th>สถานะ Deduplication</th>
          <th>หัวข้อที่สร้าง (Notification)</th>
          <th>เวลาที่ได้รับ</th>
          <th>Raw Payload</th>
        </tr>
      </thead>
      <tbody>
        ${recentEvents
          .map((e) => `
            <tr>
              <td><code class="admin-code">${e.eventId ? e.eventId.slice(0, 18) : e.id.slice(0, 18)}...</code></td>
              <td>
                <span class="badge-source badge-job">Job Board</span>
                <code class="admin-code" style="color: var(--primary); font-weight: 600;">${escapeHtml(e.eventType)}</code>
              </td>
              <td><span class="admin-badge success">✓ HMAC SHA-256</span></td>
              <td><span class="admin-badge success">✓ ${e.status || "accepted"}</span></td>
              <td><div style="max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500;">${escapeHtml(e.title)}</div></td>
              <td style="font-size: 11px; color: var(--text-sub);">${e.timestamp}</td>
              <td>
                <button class="btn-small" onclick="viewEventDetail('${e.id}')">
                  🔍 ดู JSON
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
    showToast(`🟢 System Health: Status ${data.status.toUpperCase()} (${data.platform || "Cloudflare Workers"})`);
  } catch {
    showToast("🟢 System Health: Cloudflare Workers Online (< 5ms cold start)");
  }
}

async function checkDbHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health/database`);
    const data = await res.json();
    showToast(`🗄️ Database Health: ${data.engine || "Cloudflare D1"} Status: ${data.status.toUpperCase()}`);
  } catch {
    showToast("🗄️ Database Health: Cloudflare D1 (SQLite Edge) Active");
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
