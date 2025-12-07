/**
 * Debug logging service for API requests and responses
 * Set LOGGING to false to disable logging
 */

export const LOGGING = true;

interface LogData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Generate timestamp string in format YYYYMMDDHHmmss
 */
function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Remove base64 data from object for logging
 */
function sanitizeForLogging(data: LogData): LogData {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogging(item));
  }

  if (typeof data === "object") {
    const sanitized: LogData = {};
    for (const key in data) {
      if (key === "data" && typeof data[key] === "string" && data[key].length > 1000) {
        // Likely base64 data, replace with placeholder
        sanitized[key] = `[BASE64_DATA_${data[key].length}_CHARS]`;
      } else if (key === "inlineData" && data[key]?.data) {
        sanitized[key] = {
          ...data[key],
          data: `[BASE64_DATA_${data[key].data.length}_CHARS]`,
        };
      } else if (key === "thoughtSignature" && typeof data[key] === "string" && data[key].length > 100) {
        // Thought signature is also base64 encoded
        sanitized[key] = `[THOUGHT_SIG_${data[key].length}_CHARS]`;
      } else {
        sanitized[key] = sanitizeForLogging(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Send log to server API
 */
async function sendLogToServer(sessionId: string, requestId: string, type: "request" | "response", data: LogData): Promise<void> {
  try {
    await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, requestId, type, data }),
    });
  } catch (error) {
    console.error("[DEBUG] Failed to send log to server:", error);
  }
}

/**
 * Debug logger that saves logs to server-side files
 */
class DebugLogger {
  private currentSessionId: string | null = null;

  constructor() {
    this.currentSessionId = null;
  }

  /**
   * Start a new log session
   */
  startSession(): string {
    this.currentSessionId = getTimestamp();
    console.log(`[DEBUG] Session started: ${this.currentSessionId}`);
    return this.currentSessionId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    if (!this.currentSessionId) {
      this.startSession();
    }
    return this.currentSessionId!;
  }

  /**
   * Log a request
   */
  logRequest(requestId: string, data: LogData): void {
    if (!LOGGING) return;

    const sanitizedData = sanitizeForLogging(data);
    console.log(`[DEBUG] Request ${requestId}:`, sanitizedData);

    const sessionId = this.getSessionId();
    sendLogToServer(sessionId, requestId, "request", sanitizedData);
  }

  /**
   * Log a response
   */
  logResponse(requestId: string, data: LogData): void {
    if (!LOGGING) return;

    const sanitizedData = sanitizeForLogging(data);
    console.log(`[DEBUG] Response ${requestId}:`, sanitizedData);

    const sessionId = this.getSessionId();
    sendLogToServer(sessionId, requestId, "response", sanitizedData);
  }

  /**
   * Clear session
   */
  clearSession(): void {
    this.currentSessionId = null;
  }
}

export const debugLogger = new DebugLogger();
