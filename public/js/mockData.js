/**
 * Mock Data for Notification Hub — Team 20 (POD 5)
 * Demonstrating integration across 4 POD 5 systems:
 * 1. Internship Track
 * 2. Job Board
 * 3. Alumni Network
 * 4. Notification Hub (Centralized Platform)
 *
 * NOTE: This is mock demonstration data as recommended in Step 2 & 3.
 */

const POD5_SYSTEMS = {
  internship: {
    id: "internship",
    name: "Internship Track",
    badge: "Internship",
    color: "#10b981", // Emerald
    bgColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    icon: "briefcase",
    description: "ระบบจัดการการฝึกงานและติดตามบันทึกฝึกงานของนักศึกษา",
    endpoint: "/api/webhooks/internship",
    status: "online",
    lastHeartbeat: "1 นาทีที่แล้ว",
    totalEvents: 489,
  },
  job_board: {
    id: "job_board",
    name: "Job Board",
    badge: "Job Board",
    color: "#0ea5e9", // Sky Blue
    bgColor: "rgba(14, 165, 233, 0.12)",
    borderColor: "rgba(14, 165, 233, 0.3)",
    icon: "layers",
    description: "ระบบประกาศรับสมัครงานและติดตามสถานะการสมัครงาน",
    endpoint: "/api/webhooks/jobboard",
    status: "online",
    lastHeartbeat: "30 วินาทีที่แล้ว",
    totalEvents: 612,
  },
  alumni_network: {
    id: "alumni_network",
    name: "Alumni Network",
    badge: "Alumni Network",
    color: "#f59e0b", // Amber
    bgColor: "rgba(245, 158, 11, 0.12)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    icon: "users",
    description: "เครือข่ายศิษย์เก่า ระบบพี่เลี้ยง (Mentorship) และกิจกรรมเครือข่าย",
    endpoint: "/api/webhooks/alumni",
    status: "online",
    lastHeartbeat: "2 นาทีที่แล้ว",
    totalEvents: 345,
  },
  system: {
    id: "system",
    name: "Notification Hub Core",
    badge: "Hub System",
    color: "#8b5cf6", // Purple
    bgColor: "rgba(139, 92, 246, 0.12)",
    borderColor: "rgba(139, 92, 246, 0.3)",
    icon: "bell",
    description: "ระบบศูนย์กลางกระจายการแจ้งเตือนและการจัดการช่องทางส่ง",
    endpoint: "/api/events",
    status: "online",
    lastHeartbeat: "Realtime",
    totalEvents: 1446,
  },
};

const INITIAL_NOTIFICATIONS = [
  {
    id: "notif-001",
    title: "นัดสัมภาษณ์งานตำแหน่ง Frontend Engineer",
    message: "บริษัท LINE MAN Wongnai ได้ทำการนัดหมายสัมภาษณ์รอบแรก วันพรุ่งนี้ เวลา 10:00 - 11:30 น. ผ่าน Google Meet",
    category: "job_board",
    sourceService: "Job Board",
    severity: "critical", // critical, high, medium, low
    read: false,
    createdAt: "2026-11-01T19:45:00+07:00",
    timeAgo: "15 นาทีที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "19:45:01" },
      { channel: "email", status: "delivered", sentAt: "19:45:05" },
    ],
    metadata: {
      company: "LINE MAN Wongnai",
      position: "Frontend Engineer (Intern / Junior)",
      meetingLink: "https://meet.google.com/xyz-mock",
      scheduledAt: "2026-11-02 10:00:00",
    },
  },
  {
    id: "notif-002",
    title: "คำขอฝึกงานได้รับการอนุมัติแล้ว",
    message: "ฝ่ายบุคคลและอาจารย์ที่ปรึกษาได้อนุมัติเอกสารขอฝึกงานที่ SCB TechX ภาคฤดูร้อนเรียบร้อยแล้ว กรุณาดาวน์โหลดหนังสือส่งตัว",
    category: "internship",
    sourceService: "Internship Track",
    severity: "high",
    read: false,
    createdAt: "2026-11-01T18:30:00+07:00",
    timeAgo: "1 ชั่วโมงที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "18:30:02" },
      { channel: "email", status: "delivered", sentAt: "18:30:10" },
    ],
    metadata: {
      company: "SCB TechX",
      department: "Software Engineering",
      documentId: "DOC-2026-SCB-998",
    },
  },
  {
    id: "notif-003",
    title: "พี่แอนนา (Alumni Batch 24) ตอบรับ Mentorship",
    message: "พี่แอนนา (Senior Product Manager at Grab) ได้ตอบรับคำขอจับคู่พี่เลี้ยงของคุณ พร้อมส่งข้อความทักทายแรก",
    category: "alumni_network",
    sourceService: "Alumni Network",
    severity: "high",
    read: false,
    createdAt: "2026-11-01T16:15:00+07:00",
    timeAgo: "3 ชั่วโมงที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "16:15:00" },
      { channel: "email", status: "delivered", sentAt: "16:15:15" },
    ],
    metadata: {
      mentorName: "Anna Wong (Batch 24)",
      company: "Grab Thailand",
      topic: "Tech Career & Product Management",
    },
  },
  {
    id: "notif-004",
    title: "เตือนกำหนดส่งบันทึกการฝึกงานสัปดาห์ที่ 6",
    message: "อย่าลืมส่งบันทึกรายงานการฝึกงานประจำสัปดาห์ที่ 6 ภายในวันอาทิตย์นี้ ก่อนเวลา 23:59 น.",
    category: "internship",
    sourceService: "Internship Track",
    severity: "medium",
    read: true,
    createdAt: "2026-11-01T14:00:00+07:00",
    timeAgo: "6 ชั่วโมงที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "14:00:03" },
      { channel: "email", status: "delivered", sentAt: "14:00:08" },
    ],
    metadata: {
      week: 6,
      deadline: "2026-11-01 23:59:59",
    },
  },
  {
    id: "notif-005",
    title: "มีงานใหม่ตรงกับทักษะที่คุณบันทึกไว้",
    message: "ตำแหน่ง 'Junior Cloud & DevOps Specialist' เปิดรับสมัครใหม่ มีคุณสมบัติตรงกับโปรไฟล์ของคุณ 94%",
    category: "job_board",
    sourceService: "Job Board",
    severity: "low",
    read: true,
    createdAt: "2026-11-01T11:20:00+07:00",
    timeAgo: "8 ชั่วโมงที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "11:20:02" },
      { channel: "email", status: "skipped_preference", sentAt: null },
    ],
    metadata: {
      matchScore: "94%",
      tags: ["Docker", "Kubernetes", "Node.js"],
    },
  },
  {
    id: "notif-006",
    title: "กิจกรรม Alumni Talk: Scaling Systems to Millions",
    message: "ชมรมศิษย์เก่าจัดสัมมนาออนไลน์หัวข้อ System Architecture ในวันที่ 7 พฤศจิกายน ลงทะเบียนเข้าร่วมได้ฟรี",
    category: "alumni_network",
    sourceService: "Alumni Network",
    severity: "low",
    read: true,
    createdAt: "2026-10-31T20:00:00+07:00",
    timeAgo: "1 วันที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "20:00:01" },
      { channel: "email", status: "delivered", sentAt: "20:00:12" },
    ],
    metadata: {
      eventType: "Webinar",
      speaker: "Alumni Batch 18 (Principal Architect)",
    },
  },
  {
    id: "notif-007",
    title: "ป้องกันการประมวลผล Event ซ้ำ (Idempotency Active)",
    message: "ระบบตรวจพบ Event ID 'job-event-8821' ส่งซ้ำมาจาก Job Board ระบบได้บันทึกสถานะ Duplicate และข้ามการส่งซ้ำอัตโนมัติ",
    category: "system",
    sourceService: "Notification Hub Core",
    severity: "medium",
    read: true,
    createdAt: "2026-10-31T15:10:00+07:00",
    timeAgo: "1 วันที่แล้ว",
    deliveries: [
      { channel: "in_app", status: "delivered", sentAt: "15:10:00" },
    ],
    metadata: {
      eventId: "job-event-8821",
      action: "deduped",
      reason: "duplicate_receipt_found",
    },
  },
];

const RECENT_EVENTS = [
  {
    eventId: "evt-job-20261101-091",
    service: "Job Board",
    category: "job_board",
    eventType: "job_board.interview.scheduled",
    status: "accepted",
    timestamp: "19:45:00",
    payloadPreview: '{"company": "LINE MAN Wongnai", "role": "Frontend Eng"}',
    idempotent: true,
  },
  {
    eventId: "evt-intern-20261101-084",
    service: "Internship Track",
    category: "internship",
    eventType: "internship.application.approved",
    status: "accepted",
    timestamp: "18:30:00",
    payloadPreview: '{"company": "SCB TechX", "status": "approved"}',
    idempotent: true,
  },
  {
    eventId: "evt-alumni-20261101-042",
    service: "Alumni Network",
    category: "alumni_network",
    eventType: "alumni.mentorship.accepted",
    status: "accepted",
    timestamp: "16:15:00",
    payloadPreview: '{"mentor": "Anna Wong", "action": "accept"}',
    idempotent: true,
  },
  {
    eventId: "evt-intern-20261101-039",
    service: "Internship Track",
    category: "internship",
    eventType: "internship.weekly_log.reminder",
    status: "accepted",
    timestamp: "14:00:00",
    payloadPreview: '{"week": 6, "target": "all_active_interns"}',
    idempotent: true,
  },
  {
    eventId: "evt-job-20261101-018",
    service: "Job Board",
    category: "job_board",
    eventType: "job_board.new_match.broadcast",
    status: "accepted",
    timestamp: "11:20:00",
    payloadPreview: '{"skillMatch": 94, "tag": "DevOps"}',
    idempotent: true,
  },
  {
    eventId: "evt-job-20261031-992",
    service: "Job Board",
    category: "job_board",
    eventType: "job_board.interview.scheduled",
    status: "duplicate",
    timestamp: "10:05:00",
    payloadPreview: '{"duplicateOf": "evt-job-20261031-990"}',
    idempotent: true,
  },
];

const PREFERENCES_MOCK = {
  inAppEnabled: true,
  emailEnabled: true,
  quietHours: {
    enabled: true,
    start: "22:00",
    end: "08:00",
  },
  categories: {
    internship: { enabled: true, title: "Internship Track", desc: "การอนุมัติ, ตรวจรายงาน, แจ้งเตือนฝึกงาน" },
    job_board: { enabled: true, title: "Job Board", desc: "นัดสัมภาษณ์, ผลการสมัครงาน, ตำแหน่งงานใหม่" },
    alumni_network: { enabled: true, title: "Alumni Network", desc: "คำขอพี่เลี้ยง (Mentorship), อีเวนต์ศิษย์เก่า" },
    system: { enabled: true, title: "System Alerts", desc: "ความปลอดภัย, สถานะระบบ, การจัดการช่องทางส่ง" },
  },
};
