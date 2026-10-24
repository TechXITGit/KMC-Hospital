/**
 * KMC Hospital Appointment & Consultation Reference Formatter
 * Formats appointment tokens into clean, professional hospital identifiers
 */

/**
 * Format raw token or reference into a clean hospital consultation ID
 * e.g., "KMC-2026-1042" -> "#KMC-V1042" (Video) or "#KMC-1042" (OPD)
 */
export const formatAppointmentRef = (tokenNumber, type) => {
  if (!tokenNumber) return "#KMC-1001";

  // Clean raw token string
  let str = String(tokenNumber).trim();
  str = str.replace(/^Token\s*#?\s*/i, "");
  str = str.replace(/^#/, "");

  const isVideo = (type || "").toLowerCase().includes("video");

  // Extract number suffix if standard KMC format
  const match = str.match(/(\d{3,5})$/);
  const suffix = match ? match[1] : str;

  if (isVideo) {
    return `#KMC-V${suffix}`;
  }
  return `#KMC-${suffix}`;
};

/**
 * Clean reference display label based on appointment type and language
 */
export const getAppointmentRefLabel = (type, language = "en") => {
  const isVideo = (type || "").toLowerCase().includes("video");
  if (language === "hi") {
    return isVideo ? "डिजिटल कंसल्टेशन आईडी" : "ओपीडी पर्ची संख्या";
  }
  return isVideo ? "Teleconsult ID" : "OPD Queue No";
};

/**
 * Standardized appointment mode / type badge label
 */
export const getAppointmentTypeBadge = (type, language = "en") => {
  const isVideo = (type || "").toLowerCase().includes("video");
  if (language === "hi") {
    return isVideo ? "📹 ऑनलाइन वीडियो परामर्श" : "🏥 अस्पताल ओपीडी परामर्श";
  }
  return isVideo ? "📹 Online Video Consult" : "🏥 Hospital OPD Visit";
};
