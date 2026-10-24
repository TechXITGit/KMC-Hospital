/**
 * KMC Hospital Centralized Date & Time Formatter
 * Formats all user-facing times to 12-hour AM/PM format (Asia/Kolkata timezone)
 */

/**
 * Convert any time string (e.g. "14:30", "14:30:00", "09:00", "2:30 PM") into standard 12-hour AM/PM format
 * Example: "14:30" -> "2:30 PM", "09:15" -> "9:15 AM"
 */
export const formatTimeTo12Hour = (rawTime) => {
  if (!rawTime) return "10:00 AM";

  const str = String(rawTime).trim();

  // If already in 12-hour AM/PM format
  if (/(am|pm)$/i.test(str)) {
    return str.toUpperCase();
  }

  // If ISO datetime string
  if (str.includes("T") || str.includes("Z")) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
    } catch {
      // fallback to regex parse
    }
  }

  // Parse "HH:MM" or "HH:MM:SS"
  const match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 hour should be 12
    return `${hours}:${minutes} ${ampm}`;
  }

  return str;
};

/**
 * Convert any 24-hour time references inside notification or announcement text to 12-hour format
 * e.g., "Consultation at 14:00" -> "Consultation at 2:00 PM"
 * "Doctor slot 18:30 confirmed" -> "Doctor slot 6:30 PM confirmed"
 */
export const formatNotificationTime = (text) => {
  if (!text) return "";

  // Regex matching "HH:MM" not already followed by AM or PM
  return String(text).replace(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b(?!\s*(?:am|pm))/gi, (match, h, m) => {
    let hours = parseInt(h, 10);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${m} ${ampm}`;
  });
};

/**
 * Format a Date or date string to Indian Standard Time (Asia/Kolkata)
 */
export const formatDateToIST = (dateInput, options = {}) => {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput);

    const defaultOptions = {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      ...options,
    };

    return new Intl.DateTimeFormat("en-IN", defaultOptions).format(d);
  } catch {
    return String(dateInput);
  }
};

/**
 * Check if a meeting/appointment is expired or completed
 */
export const isMeetExpired = (dateStr, timeStr, status) => {
  const s = String(status || "").toLowerCase().trim();
  if (s === "completed" || s === "expired") return true;
  if (s === "cancelled") return false;
  if (!dateStr) return false;

  const dStr = String(dateStr).trim().toLowerCase();
  if (dStr === "today" || dStr === "aaj") {
    return false;
  }

  try {
    const meetDate = new Date(dateStr);
    if (!isNaN(meetDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      meetDate.setHours(0, 0, 0, 0);
      if (meetDate < today) return true;
    }
  } catch {}

  return false;
};

/**
 * Compare two meetings by date and time for tracking by date
 */
export const compareMeetsByDate = (a, b) => {
  const isExpA = isMeetExpired(a.date || a.appointment_date, a.time || a.appointment_time, a.status || a.dbStatus);
  const isExpB = isMeetExpired(b.date || b.appointment_date, b.time || b.appointment_time, b.status || b.dbStatus);

  if (isExpA !== isExpB) {
    return isExpA ? 1 : -1;
  }

  const dateA = String(a.date || a.appointment_date || "").toLowerCase();
  const dateB = String(b.date || b.appointment_date || "").toLowerCase();

  const isTodayA = dateA === "today";
  const isTodayB = dateB === "today";

  if (isTodayA && !isTodayB) return -1;
  if (!isTodayA && isTodayB) return 1;

  const timeA = new Date(a.date || a.appointment_date || a.created_at || 0).getTime();
  const timeB = new Date(b.date || b.appointment_date || b.created_at || 0).getTime();
  return timeB - timeA;
};
