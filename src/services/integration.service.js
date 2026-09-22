/**
 * Integration Service
 * Handles outbound webhook dispatches and external API data fetching.
 */

/**
 * Sends an outbound webhook to an external service.
 * @param {Object} options
 * @param {string} options.url - Target webhook URL
 * @param {string} [options.method='POST'] - HTTP method (POST, PUT, etc.)
 * @param {Object} [options.headers={}] - Custom HTTP headers
 * @param {Object} [options.payload={}] - Request body / payload
 * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
 * @returns {Promise<Object>} Response outcome
 */
async function sendOutboundWebhook({
  url,
  method = "POST",
  headers = {},
  payload = {},
  timeoutMs = 10000,
}) {
  if (!url) {
    throw new Error("url is required for outbound webhook");
  }

  const requestHeaders = {
    "Content-Type": "application/json",
    "User-Agent": "Notification-Hub/1.0",
    ...headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: method.toUpperCase() !== "GET" ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
      data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      error: error.name === "AbortError" ? "Request timed out" : error.message,
    };
  }
}

/**
 * Fetches data from an external service via GET.
 * @param {Object} options
 * @param {string} options.baseUrl - Base URL of the external service
 * @param {string} options.endpoint - Endpoint path (e.g. /api/jobs)
 * @param {Object} [options.headers={}] - Custom headers (e.g. Authorization)
 * @param {Object} [options.params={}] - URL query parameters
 * @param {number} [options.timeoutMs=10000] - Request timeout in milliseconds
 * @returns {Promise<Object>}
 */
async function fetchExternalData({
  baseUrl,
  endpoint = "",
  headers = {},
  params = {},
  timeoutMs = 10000,
}) {
  if (!baseUrl) {
    throw new Error("baseUrl is required to fetch external data");
  }

  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const fullUrl = new URL(`${cleanBase}${cleanEndpoint}`);

  Object.entries(params).forEach(([key, val]) => {
    if (val !== undefined && val !== null) {
      fullUrl.searchParams.append(key, String(val));
    }
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Notification-Hub/1.0",
        ...headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    let data;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    return {
      success: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
      url: fullUrl.toString(),
      data,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return {
      success: false,
      url: fullUrl.toString(),
      error: error.name === "AbortError" ? "Request timed out" : error.message,
    };
  }
}

module.exports = {
  sendOutboundWebhook,
  fetchExternalData,
};
