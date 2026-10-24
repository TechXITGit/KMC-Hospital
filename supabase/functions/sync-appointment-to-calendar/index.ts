import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Convert PEM private key string to ArrayBuffer for WebCrypto
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleanPem = (pem || "").replace(/\\n/g, "\n");
  const b64 = cleanPem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, "")
    .replace(/-----END[ A-Z0-9_-]+-----/g, "")
    .replace(/\s+/g, "");
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate Google OAuth2 Access Token for Calendar API via WebCrypto RS256
 */
async function getGoogleCalendarAccessToken(serviceAccount: any): Promise<string> {
  const privateKeyPem = serviceAccount.private_key;
  const clientEmail = serviceAccount.client_email;
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";

  const keyBuffer = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const delegatedEmail = Deno.env.get("GOOGLE_DELEGATED_USER_EMAIL") || Deno.env.get("GOOGLE_WORKSPACE_ADMIN_EMAIL");
  const claim: Record<string, any> = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  };
  if (delegatedEmail) {
    claim.sub = delegatedEmail;
  }

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signatureInput = new TextEncoder().encode(`${encodedHeader}.${encodedClaim}`);

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signatureInput
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureString = String.fromCharCode.apply(null, signatureArray);
  const encodedSignature = base64UrlEncode(signatureString);

  const jwt = `${encodedHeader}.${encodedClaim}.${encodedSignature}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to exchange Google Calendar JWT: ${errText}`);
  }

  const tokenData = await res.json();
  return tokenData.access_token;
}

/**
 * Format Indian Standard Time (Asia/Kolkata, UTC+05:30) RFC3339 datetime
 */
function parseToRFC3339Date(dateStr: string, timeStr: string, addMinutes = 0): string {
  // Current time in IST
  const now = new Date();
  // Adjust to IST offset (+5.5 hours)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  let year = istNow.getUTCFullYear();
  let month = istNow.getUTCMonth() + 1; // 1-12
  let day = istNow.getUTCDate();

  const dLower = (dateStr || "").trim().toLowerCase();

  if (dLower === "today") {
    // Keep today's year, month, day
  } else if (dLower === "tomorrow") {
    const tomorrow = new Date(istNow.getTime() + 24 * 60 * 60 * 1000);
    year = tomorrow.getUTCFullYear();
    month = tomorrow.getUTCMonth() + 1;
    day = tomorrow.getUTCDate();
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parts = dateStr.split("-");
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else {
    // Match strings like "Wed 16", "16 Sep", etc.
    const dayMatch = dateStr.match(/\b(\d{1,2})\b/);
    if (dayMatch) {
      day = parseInt(dayMatch[1], 10);
    }
  }

  // Parse time: "09:00 AM", "02:30 PM"
  let hours = 10;
  let minutes = 0;
  if (timeStr) {
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const ampm = (timeMatch[3] || "").toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
    }
  }

  // Add minute offset (e.g. 30 minutes for consultation end time)
  minutes += addMinutes;
  if (minutes >= 60) {
    hours += Math.floor(minutes / 60);
    minutes = minutes % 60;
  }
  if (hours >= 24) {
    hours = hours % 24;
    day += 1;
  }

  const yStr = String(year);
  const mStr = String(month).padStart(2, "0");
  const dStr = String(day).padStart(2, "0");
  const hStr = String(hours).padStart(2, "0");
  const minStr = String(minutes).padStart(2, "0");

  return `${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:00+05:30`;
}

/**
 * Send Transactional Email via Resend API
 */
async function sendResendConfirmationEmail(
  resendApiKey: string,
  appointment: any,
  meetLink: string,
  calendarLink: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "KMC Hospital <onboarding@resend.dev>";
    const patientEmail = appointment.patient_email;
    if (!patientEmail || !patientEmail.includes("@")) {
      return { success: false, error: "Patient email not provided" };
    }

    const doctorEmail = appointment.doctor_email;
    const ccList = (doctorEmail && doctorEmail.includes("@")) ? [doctorEmail] : [];

    const subject = `Confirmed: Video Consultation with ${appointment.doctor_name} [Token: ${appointment.token_number}]`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KMC Hospital Video Consultation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0E7490 0%, #0891B2 100%); padding: 32px 24px; text-align: center; color: #FFFFFF;">
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">KMC HOSPITAL LUCKNOW</h1>
      <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Excellence in Patient Healthcare & Telemedicine</p>
    </div>

    <!-- Status Banner -->
    <div style="background-color: #ECFDF5; border-bottom: 1px solid #A7F3D0; padding: 14px 24px; text-align: center;">
      <span style="display: inline-block; background-color: #059669; color: #FFFFFF; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 4px 12px; border-radius: 9999px;">
        Confirmed & Scheduled
      </span>
      <h2 style="color: #065F46; font-size: 18px; margin: 10px 0 4px; font-weight: 700;">
        Online Video Consultation Scheduled
      </h2>
      <p style="color: #047857; font-size: 13px; margin: 0;">
        Your doctor consultation room and Google Calendar schedule are ready.
      </p>
    </div>

    <!-- Token Box -->
    <div style="padding: 24px 24px 16px;">
      <div style="background-color: #F1F5F9; border-radius: 12px; padding: 16px; text-align: center; border: 1px dashed #CBD5E1;">
        <span style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 1px;">Appointment Token</span>
        <div style="font-size: 28px; font-weight: 900; color: #0E7490; margin-top: 4px;">${appointment.token_number}</div>
      </div>
    </div>

    <!-- Details Table -->
    <div style="padding: 0 24px 20px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Doctor:</td>
          <td style="padding: 10px 0; color: #0F172A; font-weight: 700; text-align: right;">${appointment.doctor_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Department:</td>
          <td style="padding: 10px 0; color: #0F172A; text-align: right;">${appointment.department || "General"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Patient Name:</td>
          <td style="padding: 10px 0; color: #0F172A; text-align: right;">${appointment.patient_name}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Date & Time:</td>
          <td style="padding: 10px 0; color: #0E7490; font-weight: 700; text-align: right;">${appointment.appointment_date} at ${appointment.start_time || appointment.appointment_time}</td>
        </tr>
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Consultation Fee:</td>
          <td style="padding: 10px 0; color: #059669; font-weight: 700; text-align: right;">₹${appointment.consultation_fee || 800} (${(appointment.payment_status || "Pending").toUpperCase()})</td>
        </tr>
        ${appointment.reason ? `
        <tr>
          <td style="padding: 10px 0; color: #64748B; font-weight: 600;">Reason:</td>
          <td style="padding: 10px 0; color: #0F172A; text-align: right;">${appointment.reason}</td>
        </tr>` : ''}
      </table>
    </div>

    <!-- Video CTA Button -->
    <div style="padding: 0 24px 24px; text-align: center;">
      <a href="${meetLink}" target="_blank" style="display: block; background-color: #059669; color: #FFFFFF; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 20px; border-radius: 12px; box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
        🎥 Join Video Consultation (Google Meet)
      </a>
      <p style="font-size: 12px; color: #64748B; margin-top: 8px;">
        Direct Link: <a href="${meetLink}" style="color: #0E7490;">${meetLink}</a>
      </p>
    </div>

    ${calendarLink ? `
    <div style="padding: 0 24px 20px; text-align: center;">
      <a href="${calendarLink}" target="_blank" style="display: inline-block; background-color: #F1F5F9; color: #0E7490; font-size: 13px; font-weight: 700; text-decoration: none; padding: 10px 18px; border-radius: 8px; border: 1px solid #CBD5E1;">
        📅 Open in Google Calendar
      </a>
    </div>` : ''}

    <!-- Footer -->
    <div style="background-color: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 24px; font-size: 12px; color: #64748B; text-align: center;">
      <p style="margin: 0 0 6px;"><strong>KMC Hospital, Jankipuram</strong></p>
      <p style="margin: 0 0 6px;">B-1/6 Sector G, Sahara State Road, Jankipuram, Lucknow, UP</p>
      <p style="margin: 0;">Emergency / Reception Hotline: <strong>+91 83036 66400</strong></p>
      <p style="margin: 12px 0 0; font-size: 11px; color: #94A3B8;">Powered by TechXIT Services · Realtime Hospital Platform</p>
    </div>
  </div>
</body>
</html>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [patientEmail],
        cc: ccList.length > 0 ? ccList : undefined,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.warn("[Resend] Failed to send email:", errBody);
      return { success: false, error: errBody };
    }

    const data = await res.json();
    return { success: true, id: data.id };
  } catch (err: any) {
    console.warn("[Resend] Exception while sending email:", err.message);
    return { success: false, error: err.message };
  }
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { appointment_id, action = "create" } = await req.json();

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Initialize Supabase Admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch appointment details
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .maybeSingle();

    if (aptError || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found in Supabase", details: aptError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Strict Mode Check:
    // If appointment is "Hospital Visit", DO NOT create Google Calendar event or Google Meet link!
    const isVideoConsultation =
      appointment.video_consultation === true ||
      (appointment.type && appointment.type.toLowerCase().includes("video"));

    if (!isVideoConsultation) {
      // Mark as not applicable and return immediately
      await supabase
        .from("appointments")
        .update({
          calendar_sync_status: "not_applicable",
          meeting_link: null,
          google_meet_link: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment_id);

      return new Response(
        JSON.stringify({
          success: true,
          action,
          skipped: true,
          mode: "Hospital Visit (OPD)",
          message: "In-Person Hospital Visit: Google Meet & Calendar sync skipped as requested.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Load Google Service Account Key
    const saSecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saSecret) {
      console.warn("[Calendar Sync] GOOGLE_SERVICE_ACCOUNT_KEY not configured.");
      // Provide high quality fallback video link
      const fallbackMeetLink = `https://meet.jit.si/kmc-hospital-${appointment.token_number}`;
      await supabase
        .from("appointments")
        .update({
          calendar_sync_status: "failed",
          calendar_error: "GOOGLE_SERVICE_ACCOUNT_KEY secret not found in Supabase Edge Functions.",
          meeting_link: fallbackMeetLink,
          google_meet_link: fallbackMeetLink,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment_id);

      return new Response(
        JSON.stringify({
          success: true,
          fallback: true,
          meeting_link: fallbackMeetLink,
          message: "Service Account key not configured; fallback video room activated.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(saSecret);
    } catch {
      throw new Error("Invalid JSON format in GOOGLE_SERVICE_ACCOUNT_KEY secret.");
    }

    // 5. Get Google Access Token
    const accessToken = await getGoogleCalendarAccessToken(serviceAccount);
    const calendarId = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

    // Format Start and End times in Asia/Kolkata timezone
    const startRfc = parseToRFC3339Date(
      appointment.appointment_date,
      appointment.start_time || appointment.appointment_time,
      0
    );
    const endRfc = parseToRFC3339Date(
      appointment.appointment_date,
      appointment.start_time || appointment.appointment_time,
      30
    );

    // ==========================================
    // ACTION: CANCEL
    // ==========================================
    if (action === "cancel") {
      if (appointment.calendar_event_id) {
        try {
          const delUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(appointment.calendar_event_id)}?sendUpdates=all`;
          await fetch(delUrl, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch (e: any) {
          console.warn("[Calendar Sync] Delete event failed:", e.message);
        }
      }

      await supabase
        .from("appointments")
        .update({
          calendar_sync_status: "cancelled",
          calendar_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appointment_id);

      return new Response(
        JSON.stringify({
          success: true,
          action: "cancel",
          message: "Calendar event cancelled successfully.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==========================================
    // ACTION: UPDATE
    // ==========================================
    if (action === "update" && appointment.calendar_event_id) {
      const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(appointment.calendar_event_id)}?sendUpdates=all`;
      const patchRes = await fetch(patchUrl, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: `Online Consultation: ${appointment.doctor_name} with ${appointment.patient_name} [${appointment.token_number}]`,
          start: { dateTime: startRfc, timeZone: "Asia/Kolkata" },
          end: { dateTime: endRfc, timeZone: "Asia/Kolkata" },
        }),
      });

      if (patchRes.ok) {
        await supabase
          .from("appointments")
          .update({
            calendar_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", appointment_id);

        return new Response(
          JSON.stringify({ success: true, action: "update", message: "Calendar event updated." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ==========================================
    // ACTION: CREATE (Default)
    // ==========================================
    // Check if event already exists (Idempotency)
    if (appointment.calendar_event_id && appointment.google_meet_link) {
      return new Response(
        JSON.stringify({
          success: true,
          already_synced: true,
          calendar_event_id: appointment.calendar_event_id,
          meeting_link: appointment.google_meet_link,
          message: "Calendar event already exists.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build attendees list
    const attendees: Array<{ email: string; displayName?: string }> = [];
    if (appointment.patient_email && appointment.patient_email.includes("@")) {
      attendees.push({ email: appointment.patient_email, displayName: appointment.patient_name });
    }
    if (appointment.doctor_email && appointment.doctor_email.includes("@")) {
      attendees.push({ email: appointment.doctor_email, displayName: appointment.doctor_name });
    }

    const eventPayload = {
      summary: `Online Consultation: ${appointment.doctor_name} with ${appointment.patient_name} [${appointment.token_number}]`,
      description: `KMC Hospital Online Video Consultation\n\n` +
        `Token Number: ${appointment.token_number}\n` +
        `Doctor: ${appointment.doctor_name} (${appointment.department || "General"})\n` +
        `Patient: ${appointment.patient_name}\n` +
        `Patient Phone: ${appointment.patient_phone || "N/A"}\n` +
        `Scheduled Time: ${appointment.appointment_date} at ${appointment.start_time || appointment.appointment_time}\n` +
        `Fee: ₹${appointment.consultation_fee || 800} (${(appointment.payment_status || "Pending").toUpperCase()})\n` +
        (appointment.reason ? `Reason: ${appointment.reason}\n` : "") +
        `\nKMC Hospital, Sector B, Jankipuram, Lucknow\nHotline: +918303666400`,
      start: {
        dateTime: startRfc,
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: endRfc,
        timeZone: "Asia/Kolkata",
      },
      conferenceData: {
        createRequest: {
          requestId: `kmc-apt-${appointment.id}-${Date.now()}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
      attendees: attendees.length > 0 ? attendees : undefined,
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    };

    const calendarApiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;

    const calRes = await fetch(calendarApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventPayload),
    });

    let calEventId: string | null = null;
    let meetLink: string | null = null;
    let calHtmlLink: string | null = null;
    let calError: string | null = null;
    const fallbackVideoRoom = `https://meet.jit.si/kmc-hospital-${appointment.token_number}`;

    if (calRes.ok) {
      const eventData = await calRes.json();
      calEventId = eventData.id;
      calHtmlLink = eventData.htmlLink;

      // Extract Meet Link
      if (eventData.hangoutLink) {
        meetLink = eventData.hangoutLink;
      } else if (eventData.conferenceData?.entryPoints) {
        const videoEntry = eventData.conferenceData.entryPoints.find(
          (ep: any) => ep.entryPointType === "video"
        );
        if (videoEntry?.uri) {
          meetLink = videoEntry.uri;
        }
      }
    } else {
      const errText = await calRes.text();
      console.warn("[Calendar Sync] Initial Google Calendar event attempt returned:", errText);
      calError = `Google Calendar Notice: ${errText}`;

      // If error is because account lacks Google Meet conference privileges (common for non-Workspace / standard accounts),
      // retry creating the event WITHOUT conferenceData so calendar event & invitations are still delivered!
      if (errText.includes("conference") || errText.includes("Invalid conference") || errText.includes("not allowed to create conferences")) {
        console.log("[Calendar Sync] Retrying calendar event creation without conferenceData...");
        const fallbackPayload: Record<string, any> = {
          ...eventPayload,
          location: fallbackVideoRoom,
          description: `${eventPayload.description}\n\nVideo Consultation Link:\n${fallbackVideoRoom}`,
        };
        delete fallbackPayload.conferenceData;

        const retryRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(fallbackPayload),
          }
        );

        if (retryRes.ok) {
          const retryData = await retryRes.json();
          calEventId = retryData.id;
          calHtmlLink = retryData.htmlLink;
          meetLink = fallbackVideoRoom;
          calError = null; // Successfully created on retry!
        } else {
          const retryErrText = await retryRes.text();
          console.warn("[Calendar Sync] Fallback event retry also returned error:", retryErrText);
          calError = `Google Calendar Error: ${retryErrText}`;
        }
      }
    }

    // Assign fallback video room if Google Meet link was not generated
    if (!meetLink) {
      meetLink = fallbackVideoRoom;
    }

    // 6. Send transactional email via Resend if API key is present
    let emailSent = false;
    let emailErr: string | null = null;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (resendApiKey && appointment.patient_email) {
      const emailResult = await sendResendConfirmationEmail(
        resendApiKey,
        appointment,
        meetLink,
        calHtmlLink || ""
      );
      emailSent = emailResult.success;
      if (!emailResult.success) {
        emailErr = emailResult.error || "Failed to send email via Resend";
      }
    }

    // 7. Update Supabase primary appointments table
    const updatePayload: Record<string, any> = {
      calendar_event_id: calEventId,
      google_meet_link: meetLink,
      meeting_link: meetLink,
      calendar_link: calHtmlLink,
      calendar_sync_status: calEventId ? "synced" : "failed",
      calendar_synced_at: new Date().toISOString(),
      calendar_error: calError,
      confirmation_email_sent: emailSent,
      confirmation_email_sent_at: emailSent ? new Date().toISOString() : null,
      email_error: emailErr,
      updated_at: new Date().toISOString(),
    };

    const { error: dbUpdateErr } = await supabase
      .from("appointments")
      .update(updatePayload)
      .eq("id", appointment_id);

    if (dbUpdateErr) {
      console.error("[Calendar Sync] Database update error:", dbUpdateErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        calendar_event_id: calEventId,
        google_meet_link: meetLink,
        calendar_link: calHtmlLink,
        calendar_sync_status: calEventId ? "synced" : "failed",
        email_sent: emailSent,
        calendar_error: calError,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[Calendar Sync] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to sync calendar" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
