/**
 * Notification Hub — Frontend Application Logic
 * Team 20 — Job Board Integration (Real API Connected)
 */

// ── Configuration ──
const API_BASE = ""; // same origin (Cloudflare Worker serves both UI & API)
const DEFAULT_USER_ID = "student-01"; // default user to query notifications

let notifications = [];
let recentEvents = [];
let currentFilter = "all";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
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

  // Fetch recent events from event_receipts (optional — fallback to empty)
  try {
    const evtRes = await fetch(`${API_BASE}/api/events/recent`);
    if (evtRes.ok) {
      const evtData = await evtRes.json();
      recentEvents = (evtData.events || []).map((e) => ({
        eventId: e.event_id || e.id,
        service: e.source_service || "Job Board",
        eventType: e.event_type || "webhook.event",
        timestamp: e.received_at
          ? new Date(e.received_at).toLocaleTimeString("th-TH")
          : "-",
      }));
    }
  } catch {
    recentEvents = [];
  }

  renderAll();
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
   Tab Navigation
   ========================================================================== */
function initTabs() {
  document.querySelectorAll(".portal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".portal-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".pane").forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPane = tab.getAttribute("data-pane");
      const paneEl = document.getElementById(`pane-${targetPane}`);
      if (paneEl) paneEl.classList.add("active");

      if (targetPane === "systems") {
        renderConnectedSystems();
        renderEventsLog();
      }
    });
  });
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

function renderEventsLog() {
  const container = document.getElementById("events-log-container");
  if (!container) return;

  if (recentEvents.length === 0) {
    container.innerHTML = `
      <div style="padding: 16px 18px; font-size: 12px; color: var(--text-light);">
        ยังไม่มี Event เข้ามา — ข้อมูลจะแสดงเมื่อ Job Board ส่ง Webhook เข้ามา
      </div>
    `;
    return;
  }

  container.innerHTML = recentEvents
    .slice(0, 10)
    .map(
      (e) => `
      <div style="padding: 10px 18px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; font-size: 12px;">
        <div>
          <span style="font-weight: 600; color: var(--text-main); margin-right: 8px;">${e.service}</span>
          <code style="color: var(--primary); font-size: 11px;">${e.eventType}</code>
        </div>
        <div style="color: var(--text-light); font-size: 11px;">
          ${e.timestamp}
        </div>
      </div>
    `
    )
    .join("");
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
   Badges & Counters
   ========================================================================== */
function updateCounters() {
  const total = notifications.length;
  const unread = notifications.filter((n) => !n.read).length;

  const unreadBadge = document.getElementById("unread-count-badge");
  if (unreadBadge) unreadBadge.innerText = unread;

  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.innerText = total;

  const statUnread = document.getElementById("stat-unread");
  if (statUnread) statUnread.innerText = unread;
}

function renderAll() {
  updateCounters();
  renderNotifications();
}
