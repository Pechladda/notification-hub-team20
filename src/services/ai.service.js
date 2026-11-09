/**
 * AI Summarization Service with Deterministic Fallback
 * Implements FR-09 & BR-05 per Notification Hub PRD requirements:
 * 
 * 1. AI-Assisted Flow:
 *    - Summarizes low-risk alerts (e.g. alumni announcements, career tips)
 *    - Uses Google Gemini API (or OpenAI API) with timeout protection
 * 
 * 2. Deterministic Fallback:
 *    - High-stakes categories (job interviews, approvals, deadlines, critical alerts)
 *      are STRICTLY PROTECTED by BR-05: AI is bypassed and original text is preserved verbatim.
 *    - On AI timeout, outage, rate limit, or missing API key, immediately falls back
 *      to deterministic rule-based summary without user delay.
 * 
 * 3. Deterministic Ordering:
 *    - Fallback inbox sorting rule: severity (critical -> high -> medium -> low)
 *      -> deadline (near -> far) -> received_at (newest -> oldest).
 */

const SEVERITY_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Checks whether an alert is high-stakes and must NOT be modified by AI (BR-05).
 */
function isHighStakes({ category = "", severity = "", title = "", message = "" }) {
  const normCategory = String(category).toLowerCase();
  const normSeverity = String(severity).toLowerCase();
  const content = `${title} ${message}`.toLowerCase();

  // Rule 1: Any critical severity alert
  if (normSeverity === "critical" || normSeverity === "urgent") {
    return true;
  }

  // Rule 2: Job interview schedules, application approvals, exam results, or legal/exam deadlines
  const highStakesKeywords = [
    "interview",
    "สัมภาษณ์",
    "approval",
    "อนุมัติ",
    "rejected",
    "ปฏิเสธ",
    "exam",
    "สอบ",
    "deadline",
    "กำหนดส่ง",
    "หมดเขต",
    "contract",
    "สัญญา",
  ];

  if (normCategory === "job_board" && (content.includes("interview") || content.includes("สัมภาษณ์"))) {
    return true;
  }

  return highStakesKeywords.some((kw) => content.includes(kw));
}

/**
 * Deterministic rule-based summary extractor (zero hallucinations).
 */
function deterministicSummarize({ title = "", message = "" }) {
  if (!message) return title;
  
  // Clean sentence splitting
  const sentences = message
    .split(/[\r\n\t]+|[.?!]\s+|(?<=[ก-๙])\s+(?=[ก-๙])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  if (sentences.length <= 1) {
    return message.length > 120 ? `${message.slice(0, 117)}...` : message;
  }

  const primary = sentences[0];
  return primary.length > 120 ? `${primary.slice(0, 117)}...` : primary;
}

/**
 * Executes AI-assisted summarization with deterministic fallback.
 * @param {Object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {string} [params.category='general']
 * @param {string} [params.severity='low']
 * @param {string} [params.deadline=null]
 * @param {string} [params.apiKey=null]
 * @returns {Promise<Object>} Outcome with flow metadata
 */
async function summarizeNotification({
  title = "",
  message = "",
  category = "general",
  severity = "low",
  deadline = null,
  apiKey = null,
}) {
  // Step 1: Check high-stakes safety rule (BR-05)
  if (isHighStakes({ category, severity, title, message })) {
    return {
      status: "success",
      flow: "deterministic_fallback",
      ai_applied: false,
      fallback_reason: "High-stakes event protected under BR-05 policy (interviews, approvals, or critical severity). Original verbatim text preserved.",
      summary: message,
      original_length: message.length,
      category,
      severity,
    };
  }

  // Step 2: AI-Assisted Flow for low-risk alerts
  const geminiKey = apiKey || process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3-second timeout

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
      const prompt = `สรุปข้อความแจ้งเตือนต่อไปนี้ให้สั้น กระชับ เข้าใจง่าย ภายใน 1-2 ประโยค (ตอบเป็นภาษาเดียวกับข้อความ):\nหัวข้อ: ${title}\nข้อความ: ${message}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 100, temperature: 0.2 },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (candidateText) {
          return {
            status: "success",
            flow: "ai_assisted",
            ai_applied: true,
            provider: "google-gemini",
            summary: candidateText,
            original_length: message.length,
            summary_length: candidateText.length,
            category,
            severity,
          };
        }
      }
    } catch (err) {
      console.warn("[AI Summarizer] Gemini API call skipped or timed out:", err.message);
    }
  } else if (openAiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a concise notification summarizer. Summarize in 1 sentence in the original language.",
            },
            { role: "user", content: `Title: ${title}\nMessage: ${message}` },
          ],
          max_tokens: 60,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const candidateText = data?.choices?.[0]?.message?.content?.trim();

        if (candidateText) {
          return {
            status: "success",
            flow: "ai_assisted",
            ai_applied: true,
            provider: "openai",
            summary: candidateText,
            original_length: message.length,
            summary_length: candidateText.length,
            category,
            severity,
          };
        }
      }
    } catch (err) {
      console.warn("[AI Summarizer] OpenAI API call skipped or timed out:", err.message);
    }
  }

  // Step 3: Deterministic Fallback Flow (when AI is unconfigured, timed out, or unavailable)
  const fallbackSummary = deterministicSummarize({ title, message });
  return {
    status: "success",
    flow: "deterministic_fallback",
    ai_applied: false,
    fallback_reason: geminiKey || openAiKey
      ? "AI provider timeout or unavailable; immediately triggered deterministic fallback."
      : "No external AI credentials configured; executed deterministic rule-based summarization.",
    summary: fallbackSummary,
    original_length: message.length,
    summary_length: fallbackSummary.length,
    category,
    severity,
  };
}

/**
 * Deterministic inbox sorting rule per PRD requirement:
 * 1. Severity (critical -> high -> medium -> low)
 * 2. Deadline (near -> far, items with deadline first)
 * 3. Received / Created at (newest -> oldest)
 */
function deterministicSortNotifications(items = []) {
  return [...items].sort((a, b) => {
    // 1. Severity weight
    const weightA = SEVERITY_WEIGHTS[String(a.severity).toLowerCase()] || 0;
    const weightB = SEVERITY_WEIGHTS[String(b.severity).toLowerCase()] || 0;
    if (weightA !== weightB) {
      return weightB - weightA;
    }

    // 2. Deadline proximity (near -> far)
    if (a.deadline && b.deadline) {
      const diff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (diff !== 0) return diff;
    } else if (a.deadline && !b.deadline) {
      return -1;
    } else if (!a.deadline && b.deadline) {
      return 1;
    }

    // 3. Received / Created timestamp (newest -> oldest)
    const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
    const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

module.exports = {
  isHighStakes,
  deterministicSummarize,
  summarizeNotification,
  deterministicSortNotifications,
};

