/**
 * Notification Hub — Frontend Application Logic (Clean & Human-Crafted)
 * Team 20 / POD 5
 */

let notifications = [...INITIAL_NOTIFICATIONS];
let recentEvents = [...RECENT_EVENTS];
let currentFilter = "all";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initFilters();
  initSearch();
  renderAll();
});

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
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((item) => {
      const sourceClass =
        item.category === "internship"
          ? "badge-internship"
          : item.category === "job_board"
          ? "badge-job"
          : item.category === "alumni_network"
          ? "badge-alumni"
          : "badge-system";

      const priClass = `pri-${item.severity}`;

      return `
        <div class="notif-row ${item.read ? "" : "unread"}" onclick="viewDetail('${item.id}')">
          <div class="notif-main">
            <div class="notif-meta-row">
              <span class="badge-source ${sourceClass}">${item.sourceService}</span>
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

function toggleReadStatus(id) {
  const item = notifications.find((n) => n.id === id);
  if (item) {
    item.read = !item.read;
    renderAll();
  }
}

function markAllAsRead() {
  notifications.forEach((n) => (n.read = true));
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
      name: "Internship Track",
      desc: "ระบบจัดการฝึกงาน บันทึกประจำสัปดาห์ และการประเมินผลอาจารย์",
      endpoint: "/api/webhooks/internship",
      events: "489 events",
    },
    {
      name: "Job Board",
      desc: "ระบบประกาศรับสมัครงาน ติดตามสถานะ และนัดหมายสัมภาษณ์",
      endpoint: "/api/webhooks/jobboard",
      events: "612 events",
    },
    {
      name: "Alumni Network",
      desc: "เครือข่ายศิษย์เก่า ระบบพี่เลี้ยง (Mentorship) และสัมมนา",
      endpoint: "/api/webhooks/alumni",
      events: "345 events",
    },
  ];

  container.innerHTML = services
    .map(
      (s) => `
      <div class="service-item">
        <div class="service-top">
          <span class="service-name">${s.name}</span>
          <span class="status-dot-wrap"><span class="status-dot"></span>เชื่อมต่อแล้ว</span>
        </div>
        <div class="service-desc">${s.desc}</div>
        <div style="margin-top: 10px; font-size: 11px; color: var(--text-light); font-family: monospace;">
          ${s.endpoint}
        </div>
      </div>
    `
    )
    .join("");
}

function renderEventsLog() {
  const container = document.getElementById("events-log-container");
  if (!container) return;

  container.innerHTML = recentEvents
    .slice(0, 6)
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
        <div style="font-size: 13px; font-weight: 600; color: var(--primary);">${item.sourceService}</div>
      </div>
      <div>
        <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 2px;">ระดับความสำคัญ</div>
        <div style="font-size: 13px; font-weight: 600;">${item.severity.toUpperCase()}</div>
      </div>
    </div>

    <div>
      <div style="font-size: 11px; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 4px;">ช่องทางที่ส่ง (Channels)</div>
      <div style="display: flex; gap: 6px;">
        <span style="font-size: 11px; background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-weight: 500;">In-App Notification</span>
        <span style="font-size: 11px; background: #ecfdf5; color: #065f46; padding: 2px 8px; border-radius: 4px; font-weight: 500;">Email Notification</span>
      </div>
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

function quickFill(type) {
  const source = document.getElementById("test-source");
  const title = document.getElementById("test-title");
  const msg = document.getElementById("test-message");
  const pri = document.getElementById("test-priority");

  if (type === "intern") {
    source.value = "internship";
    title.value = "บันทึกการฝึกงานสัปดาห์ที่ 5 ผ่านการตรวจแล้ว";
    msg.value = "อาจารย์ที่ปรึกษาได้ลงความเห็นและให้คะแนนบันทึกการฝึกงานเรียบร้อยแล้ว";
    pri.value = "high";
  } else if (type === "job") {
    source.value = "job_board";
    title.value = "บริษัท Shopee นัดสัมภาษณ์ตำแหน่ง Frontend Engineer";
    msg.value = "นัดสัมภาษณ์รอบแรกวันจันทร์หน้า เวลา 10:00 น. ผ่าน Google Meet";
    pri.value = "critical";
  } else if (type === "alumni") {
    source.value = "alumni_network";
    title.value = "พี่เลี้ยง (Mentor) ตอบรับคำขอแล้ว";
    msg.value = "พี่แอนนา (Alumni Batch 24) ตอบรับคำขอจับคู่พี่เลี้ยงของคุณแล้ว";
    pri.value = "high";
  }
}

function handleSendTest(e) {
  e.preventDefault();

  const sourceVal = document.getElementById("test-source").value;
  const titleVal = document.getElementById("test-title").value.trim();
  const msgVal = document.getElementById("test-message").value.trim();
  const priVal = document.getElementById("test-priority").value;

  const sourceName =
    sourceVal === "internship"
      ? "Internship Track"
      : sourceVal === "job_board"
      ? "Job Board"
      : "Alumni Network";

  const newNotif = {
    id: `notif-${Date.now()}`,
    title: titleVal,
    message: msgVal,
    category: sourceVal,
    sourceService: sourceName,
    severity: priVal,
    read: false,
    createdAt: new Date().toISOString(),
    timeAgo: "เมื่อสักครู่",
    deliveries: [
      { channel: "in_app", status: "delivered" },
      { channel: "email", status: "delivered" },
    ],
  };

  const newEvent = {
    eventId: `evt-${Date.now().toString().slice(-5)}`,
    service: sourceName,
    eventType: `${sourceVal}.event`,
    timestamp: new Date().toLocaleTimeString("th-TH"),
  };

  notifications.unshift(newNotif);
  recentEvents.unshift(newEvent);

  closeModal("test-modal");
  renderAll();
  showToast(`ส่งการแจ้งเตือนจาก ${sourceName} สำเร็จ`);
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
  const unread = notifications.filter((n) => !n.read).length;
  const unreadBadge = document.getElementById("unread-count-badge");
  if (unreadBadge) unreadBadge.innerText = unread;

  const statTotal = document.getElementById("stat-total");
  if (statTotal) statTotal.innerText = notifications.length;

  const statUnread = document.getElementById("stat-unread");
  if (statUnread) statUnread.innerText = unread;
}

function renderAll() {
  updateCounters();
  renderNotifications();
}
