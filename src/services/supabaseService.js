import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase.js";
export { supabase };

/**
 * Generate a consistent slot identifier key
 */
export const buildSlotKey = (doctorId, date, time) => {
  const cleanDoc = String(doctorId || "doc").replace(/[^a-zA-Z0-9]/g, "");
  const cleanDate = String(date || "date").replace(/[^a-zA-Z0-9]/g, "");
  const cleanTime = String(time || "time").replace(/[^a-zA-Z0-9]/g, "");
  return `${cleanDoc}_${cleanDate}_${cleanTime}`;
};

/**
 * Generate a video teleconsult / Google Meet link & Google Calendar invite
 */
export const generateMeetingDetails = ({
  tokenNumber,
  doctorName,
  department,
  date,
  time,
  patientName,
}) => {
  const cleanToken = (tokenNumber || `KMC-${Date.now()}`).replace(/[^a-zA-Z0-9]/g, "-");
  
  // Real working high-definition WebRTC video room hosted on Jitsi / KMC Telehealth
  const meetingLink = `https://meet.jit.si/kmc-hospital-${cleanToken}`;

  // Google Calendar prefilled event link
  const title = encodeURIComponent(`KMC Hospital Consultation - ${doctorName}`);
  const details = encodeURIComponent(
    `Consultation with ${doctorName} (${department || "Specialist"})\n` +
    `Patient: ${patientName || "Self"}\n` +
    `Token: ${tokenNumber}\n` +
    `Video Teleconsult Link: ${meetingLink}\n` +
    `Hospital: KMC Hospital, Sector G, Jankipuram, Lucknow\n` +
    `Helpline: +91 8303666400`
  );
  const location = encodeURIComponent("KMC Hospital, Jankipuram, Lucknow / Video Telehealth");

  // Approximate ISO date string for calendar (fallback to tomorrow 10:00 AM)
  const now = new Date();
  const startIso = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .replace(/-|:|\.\d+/g, "");
  const endIso = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 45 * 60 * 1000)
    .toISOString()
    .replace(/-|:|\.\d+/g, "");

  const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${startIso}/${endIso}`;

  return { meetingLink, calendarLink };
};

// ==========================================
// 1. PROFILES
// ==========================================

export const getUserProfile = async (identifier) => {
  if (!identifier) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${identifier},email.eq.${identifier},phone.eq.${identifier}`)
      .maybeSingle();

    if (error) {
      // Don't spam warnings if table doesn't exist yet in Supabase schema cache
      if (
        error.code !== "PGRST116" &&
        !error.message?.includes("schema cache") &&
        !error.message?.includes("Could not find the table")
      ) {
        console.warn("[Supabase] Get profile error:", error.message);
      }
      return null;
    }
    return data;
  } catch (err) {
    return null;
  }
};

export const saveUserProfile = async (profileData) => {
  if (!profileData) return null;
  try {
    // 1. Resolve authenticated user to guarantee RLS match
    let activeUid = profileData.id;
    let activeEmail = (profileData.email || "").toLowerCase().trim();

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        activeUid = authData.user.id;
        if (authData.user.email) activeEmail = authData.user.email.toLowerCase().trim();
      }
    } catch (_) {}

    const targetId = activeUid || profileData.id;
    const fullName = (profileData.fullName || profileData.full_name || profileData.name || "").trim();
    const phone = (profileData.mobileNumber || profileData.phone || "").trim();
    const gender = profileData.gender || "Male";
    const dob = profileData.dob || "";
    const bloodGroup = profileData.bloodGroup || profileData.blood_group || "B+";
    const emergencyContact = (profileData.emergencyContact || profileData.emergency_contact || "").trim();

    // 2. Primary: Try update_my_profile RPC (atomic, security definer)
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("update_my_profile", {
        p_full_name: fullName,
        p_phone: phone,
        p_gender: gender,
        p_dob: dob,
        p_blood_group: bloodGroup,
        p_emergency_contact: emergencyContact,
      });

      if (!rpcErr && rpcData) {
        return {
          ...profileData,
          id: targetId,
          fullName: rpcData.full_name || fullName,
          name: rpcData.name || fullName,
          email: rpcData.email || activeEmail,
          mobileNumber: rpcData.phone || phone,
          phone: rpcData.phone || phone,
          gender: rpcData.gender || gender,
          dob: rpcData.dob || dob,
          bloodGroup: rpcData.blood_group || bloodGroup,
          emergencyContact: rpcData.emergency_contact || emergencyContact,
          role: rpcData.role || profileData.role || "patient",
        };
      }
    } catch (rpcEx) {
      // Fall through to direct table queries
    }

    // 3. Fallback: Direct UPDATE on profiles table
    const updatePayload = {
      full_name: fullName,
      name: fullName,
      phone: phone,
      gender: gender,
      dob: dob,
      blood_group: bloodGroup,
      emergency_contact: emergencyContact,
      updated_at: new Date().toISOString(),
    };

    let updatedRow = null;

    if (targetId) {
      const { data: byIdData, error: idErr } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("id", targetId)
        .select()
        .maybeSingle();

      if (!idErr && byIdData) {
        updatedRow = byIdData;
      }
    }

    if (!updatedRow && activeEmail) {
      const { data: byEmailData } = await supabase
        .from("profiles")
        .update(updatePayload)
        .eq("email", activeEmail)
        .select()
        .maybeSingle();

      if (byEmailData) {
        updatedRow = byEmailData;
      }
    }

    // If row did not exist yet, insert it
    if (!updatedRow && targetId) {
      const insertPayload = {
        id: targetId,
        email: activeEmail,
        role: profileData.role || "patient",
        ...updatePayload,
      };
      const { data: insertedData, error: insErr } = await supabase
        .from("profiles")
        .insert(insertPayload)
        .select()
        .maybeSingle();

      if (!insErr && insertedData) {
        updatedRow = insertedData;
      }
    }

    // Also update auth.users user_metadata for phone and full_name
    try {
      supabase.auth.updateUser({
        data: {
          full_name: fullName,
          name: fullName,
          phone: phone,
        },
      }).catch(() => {});
    } catch (_) {}

    return {
      ...profileData,
      id: targetId,
      fullName: updatedRow?.full_name || fullName,
      name: updatedRow?.name || fullName,
      email: updatedRow?.email || activeEmail,
      mobileNumber: updatedRow?.phone || phone,
      phone: updatedRow?.phone || phone,
      gender: updatedRow?.gender || gender,
      dob: updatedRow?.dob || dob,
      bloodGroup: updatedRow?.blood_group || bloodGroup,
      emergencyContact: updatedRow?.emergency_contact || emergencyContact,
      role: updatedRow?.role || profileData.role || "patient",
    };
  } catch (err) {
    console.warn("[Supabase] Save profile exception:", err.message);
    return profileData;
  }
};

// ==========================================
// 2. DOCTORS & AVAILABILITY
// ==========================================

export const fetchDoctorsFromDb = async () => {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data || data.length === 0) {
      // Fallback to local constants
      const { DOCTORS } = await import("../constants/data.js");
      return DOCTORS;
    }

    return data.map((doc) => ({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      specialty: doc.specialization,
      specialization: doc.specialization,
      department: doc.department,
      qualification: doc.qualification,
      experience: doc.experience,
      fee: `₹${doc.consultation_fee || 800}`,
      consultationFee: Number(doc.consultation_fee || 800),
      rating: String(doc.rating || 4.9),
      reviewsCount: doc.reviews_count || 150,
      bio: doc.bio,
      about: doc.bio,
      clinicName: doc.clinic_name || "KMC Hospital, Jankipuram, Lucknow",
      availableDays: doc.available_days || "Mon - Sat",
      image: doc.image,
      active: doc.active !== false && doc.verification_status !== "suspended",
      verificationStatus: doc.verification_status || "verified",
      authUserId: doc.auth_user_id,
      isOnline: Boolean(doc.is_online),
      is_online: Boolean(doc.is_online),
    }));
  } catch (err) {
    console.warn("[Supabase] fetchDoctorsFromDb fallback:", err.message);
    const { DOCTORS } = await import("../constants/data.js");
    return DOCTORS;
  }
};

/**
 * Update doctor's online / offline status in database
 */
export const setDoctorOnlineStatusInDb = async (doctorId, isOnline) => {
  const boolVal = Boolean(isOnline);
  try {
    // 1. Try secure RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc("set_doctor_online_status", {
      p_doctor_id: doctorId,
      p_is_online: boolVal,
    });

    if (!rpcError && rpcData?.success) {
      // Broadcast live event across all mobile clients
      try {
        const liveChannel = supabase.channel("kmc-live-events");
        await liveChannel.send({
          type: "broadcast",
          event: "doctor_online_changed",
          payload: { doctorId, isOnline: boolVal },
        });
      } catch (bcErr) {
        // Broadcast non-fatal
      }
      return { success: true, doctor: rpcData };
    }

    // 2. Fallback to direct table update
    const { data, error } = await supabase
      .from("doctors")
      .update({ is_online: boolVal })
      .eq("id", doctorId)
      .select()
      .single();

    if (error) throw error;

    try {
      const liveChannel = supabase.channel("kmc-live-events");
      await liveChannel.send({
        type: "broadcast",
        event: "doctor_online_changed",
        payload: { doctorId, isOnline: boolVal },
      });
    } catch (bcErr) {
      // Broadcast non-fatal
    }

    return { success: true, doctor: data };
  } catch (err) {
    console.error("[Supabase] setDoctorOnlineStatusInDb error:", err.message);
    throw err;
  }
};

/**
 * Convert time string like "10:00 AM" or "02:30 PM" to 24h format "10:00:00" or "14:30:00"
 */
export const formatTimeTo24h = (timeStr) => {
  if (!timeStr) return "10:00:00";
  if (timeStr.includes(":") && timeStr.split(":").length === 3) return timeStr;

  const match = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return "10:00:00";

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = (match[3] || "").toUpperCase();

  if (modifier === "PM" && hours < 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return `${String(hours).padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
};

/**
 * Convert 24h time "14:30:00" to 12h format "02:30 PM"
 */
export const formatTimeTo12h = (time24) => {
  if (!time24) return "10:00 AM";
  if (time24.toUpperCase().includes("AM") || time24.toUpperCase().includes("PM")) {
    return time24;
  }
  const parts = time24.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] || "00";
  const modifier = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${minutes} ${modifier}`;
};

/**
 * Extract numeric fee from string like "₹800", "₹1,000", or number 800
 */
export const parseFeeAmount = (fee) => {
  if (typeof fee === "number") return fee;
  if (!fee) return 800;
  const num = parseFloat(String(fee).replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 800 : num;
};

// ==========================================
// 3. APPOINTMENTS
// ==========================================

export const fetchAppointmentsFromSupabase = async (userIdOrEmail) => {
  try {
    let query = supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false });

    if (userIdOrEmail) {
      query = query.or(
        `patient_id.eq.${userIdOrEmail},patient_email.eq.${userIdOrEmail}`
      );
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase] Fetch appointments error:", error.message);
      return [];
    }

    // Map DB column names to UI model
    return (data || []).map((row) => ({
      id: row.id,
      tokenNumber: row.token_number,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientEmail: row.patient_email,
      patientPhone: row.patient_phone,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      doctorSpecialty: row.doctor_specialty,
      department: row.department,
      date: row.appointment_date,
      time: row.appointment_time || (row.start_time ? formatTimeTo12h(row.start_time) : "10:00 AM"),
      startTime: row.start_time,
      endTime: row.end_time,
      slotKey: row.slot_key,
      status: (row.status || "confirmed").charAt(0).toUpperCase() + (row.status || "confirmed").slice(1),
      dbStatus: row.status,
      type: row.type || "Hospital Visit",
      fee: `₹${row.consultation_fee || row.total_amount || 800}`,
      consultationFee: row.consultation_fee || 800,
      totalAmount: row.total_amount || row.consultation_fee || 800,
      paymentMethod: row.payment_method || "cash",
      paymentStatus: row.payment_status || "pending",
      paymentId: row.payment_id,
      reason: row.reason || row.notes || "",
      notes: row.notes || row.reason || "",
      meetingLink: row.meeting_link,
      calendarLink: row.calendar_link,
      googleMeetLink: row.google_meet_link,
      calendarEventId: row.calendar_event_id,
      calendarSyncStatus: row.calendar_sync_status,
      videoConsultation: Boolean(row.video_consultation || (row.type && row.type.toLowerCase().includes("video"))),
      doctorEmail: row.doctor_email,
      confirmationEmailSent: row.confirmation_email_sent,
      hospitalAddress: row.hospital_address || "KMC Hospital, Jankipuram, Lucknow",
      contactNumber: row.contact_number || "+918303666400",
      googleSheetsSynced: row.google_sheets_synced,
      bookedAt: row.created_at,
    }));
  } catch (err) {
    console.warn("[Supabase] Fetch appointments exception:", err.message);
    return [];
  }
};

/**
 * Fetch appointments for Doctor Portal / Dashboard
 */
export const fetchDoctorAppointments = async (doctorId) => {
  try {
    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (doctorId && doctorId !== "all") {
      query = query.eq("doctor_id", String(doctorId));
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase] fetchDoctorAppointments error:", error.message);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      tokenNumber: row.token_number,
      patientId: row.patient_id,
      patientName: row.patient_name,
      patientEmail: row.patient_email,
      patientPhone: row.patient_phone,
      doctorId: row.doctor_id,
      doctorName: row.doctor_name,
      doctorSpecialty: row.doctor_specialty,
      department: row.department,
      date: row.appointment_date,
      time: row.appointment_time || (row.start_time ? formatTimeTo12h(row.start_time) : "10:00 AM"),
      startTime: row.start_time,
      endTime: row.end_time,
      slotKey: row.slot_key,
      status: (row.status || "confirmed").charAt(0).toUpperCase() + (row.status || "confirmed").slice(1),
      dbStatus: row.status,
      type: row.type || "Hospital Visit",
      fee: `₹${row.consultation_fee || 800}`,
      consultationFee: row.consultation_fee || 800,
      totalAmount: row.total_amount || 800,
      paymentMethod: row.payment_method || "cash",
      paymentStatus: row.payment_status || "pending",
      paymentId: row.payment_id,
      reason: row.reason || row.notes || "",
      meetingLink: row.meeting_link,
      calendarLink: row.calendar_link,
      googleMeetLink: row.google_meet_link,
      calendarEventId: row.calendar_event_id,
      calendarSyncStatus: row.calendar_sync_status,
      videoConsultation: Boolean(row.video_consultation || (row.type && row.type.toLowerCase().includes("video"))),
      doctorEmail: row.doctor_email,
      confirmationEmailSent: row.confirmation_email_sent,
      hospitalAddress: row.hospital_address,
      contactNumber: row.contact_number,
      googleSheetsSynced: row.google_sheets_synced,
      bookedAt: row.created_at,
    }));
  } catch (err) {
    console.warn("[Supabase] fetchDoctorAppointments exception:", err.message);
    return [];
  }
};

/**
 * Trigger background synchronization to Google Sheets via Supabase Edge Function.
 * Non-blocking, fail-safe: never throws or disrupts app UI.
 */
export const triggerGoogleSheetsSync = (appointmentId) => {
  if (!appointmentId) return;
  try {
    supabase.functions
      .invoke("sync-appointment-to-sheets", {
        body: { appointment_id: appointmentId },
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn("[Google Sheets Sync] Function notice:", error.message);
        } else {
          console.log("[Google Sheets Sync] Sync result:", data);
        }
      })
      .catch((err) => {
        console.warn("[Google Sheets Sync] Non-blocking notice:", err.message);
      });
  } catch (e) {
    console.warn("[Google Sheets Sync] Invoke notice:", e.message);
  }
};

/**
 * Trigger background synchronization to Google Calendar & Google Meet via Supabase Edge Function.
 * Non-blocking, fail-safe: never throws or disrupts app UI.
 */
export const triggerGoogleCalendarSync = (appointmentId, action = "create") => {
  if (!appointmentId) return;
  try {
    supabase.functions
      .invoke("sync-appointment-to-calendar", {
        body: { appointment_id: appointmentId, action },
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn("[Google Calendar Sync] Function notice:", error.message);
        } else {
          console.log("[Google Calendar Sync] Sync result:", data);
        }
      })
      .catch((err) => {
        console.warn("[Google Calendar Sync] Non-blocking notice:", err.message);
      });
  } catch (e) {
    console.warn("[Google Calendar Sync] Invoke notice:", e.message);
  }
};

export const normalizeTo12h = (timeStr) => {
  if (!timeStr) return "";
  const trimmed = String(timeStr).trim();
  if (/AM|PM/i.test(trimmed)) {
    const parts = trimmed.split(" ");
    const [h, m] = parts[0].split(":");
    const period = parts[1].toUpperCase();
    return `${String(Number(h)).padStart(2, "0")}:${String(m || "00").padStart(2, "0")} ${period}`;
  }
  const [hStr, mStr] = trimmed.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr ? mStr.substring(0, 2) : "00";
  if (isNaN(h)) return trimmed;
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${m} ${period}`;
};

export const normalizeTo24h = (timeStr) => {
  if (!timeStr) return "10:00:00";
  const trimmed = String(timeStr).trim();
  if (/AM|PM/i.test(trimmed)) {
    const [time, period] = trimmed.split(" ");
    const [hours, minutes] = time.split(":").map(Number);
    let h24 = hours;
    if (period && period.toUpperCase() === "PM" && hours < 12) h24 += 12;
    if (period && period.toUpperCase() === "AM" && hours === 12) h24 = 0;
    return `${String(h24).padStart(2, "0")}:${String(minutes || 0).padStart(2, "0")}:00`;
  }
  const parts = trimmed.split(":");
  const h = String(parseInt(parts[0], 10) || 0).padStart(2, "0");
  const m = String(parseInt(parts[1], 10) || 0).padStart(2, "0");
  return `${h}:${m}:00`;
};

export const saveAppointmentToSupabase = async (apt) => {
  try {
    const isVideo = (apt.type || "").toLowerCase().includes("video");
    const feeNumeric = parseFeeAmount(apt.fee || apt.consultationFee || 800);
    const time12 = normalizeTo12h(apt.time || "10:00 AM");
    const startTime24 = normalizeTo24h(apt.time || "10:00 AM");
    
    // Compute 30-minute end time
    const [h, m] = startTime24.split(":").map(Number);
    const endMinutes = (m + 30) % 60;
    const endHours = h + Math.floor((m + 30) / 60);
    const endTime24 = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;

    const normalizedStatus = (apt.status || "confirmed").toLowerCase();
    const targetDoctorId = String(apt.doctorId || apt.doctor?.id || "doc_1");

    // SECURITY: Look up verified doctor email directly from public.doctors
    let verifiedDoctorEmail = "";
    let verifiedDoctorName = apt.doctorName || apt.doctor?.name || "KMC Doctor";
    let verifiedSpecialty = apt.doctorSpecialty || apt.doctor?.specialty || "";
    let verifiedDept = apt.department || apt.doctor?.department || "General";

    try {
      const { data: dbDoc } = await supabase
        .from("doctors")
        .select("email, name, specialization, department")
        .eq("id", targetDoctorId)
        .maybeSingle();

      if (dbDoc) {
        if (dbDoc.email) verifiedDoctorEmail = dbDoc.email;
        if (dbDoc.name) verifiedDoctorName = dbDoc.name;
        if (dbDoc.specialization) verifiedSpecialty = dbDoc.specialization;
        if (dbDoc.department) verifiedDept = dbDoc.department;
      }
    } catch (e) {
      console.warn("[saveAppointmentToSupabase] Doctor verify lookup notice:", e.message);
    }

    if (!verifiedDoctorEmail) {
      verifiedDoctorEmail = apt.doctorEmail || apt.doctor?.email || "";
    }

    const payload = {
      id: apt.id,
      token_number: apt.tokenNumber,
      patient_id: apt.patientId || null,
      patient_name: apt.patientName || "Patient",
      patient_email: apt.patientEmail || "",
      patient_phone: apt.patientPhone || "",
      doctor_id: targetDoctorId,
      doctor_name: verifiedDoctorName,
      doctor_email: verifiedDoctorEmail,
      doctor_specialty: verifiedSpecialty,
      department: verifiedDept,
      appointment_date: apt.date || "Today",
      appointment_time: time12,
      start_time: startTime24,
      end_time: endTime24,
      slot_key: apt.slotKey || buildSlotKey(apt.doctorId || apt.doctor?.id, apt.date, startTime24),
      consultation_fee: feeNumeric,
      total_amount: feeNumeric,
      payment_method: apt.paymentMethod || apt.payment_method || "cash",
      payment_status: apt.paymentStatus || apt.payment_status || "pending",
      payment_id: apt.paymentId || apt.payment_id || null,
      status: normalizedStatus,
      type: apt.type || "Hospital Visit",
      fee: `₹${feeNumeric}`,
      reason: apt.reason || apt.notes || "",
      meeting_link: isVideo ? (apt.meetingLink || "") : null,
      google_meet_link: isVideo ? (apt.meetingLink || "") : null,
      calendar_link: isVideo ? (apt.calendarLink || "") : null,
      video_consultation: isVideo,
      calendar_sync_status: isVideo ? "pending" : "not_applicable",
      hospital_address: apt.hospitalAddress || "KMC Hospital, Jankipuram, Lucknow",
      contact_number: apt.contactNumber || "+918303666400",
      notes: apt.notes || apt.reason || "",
      created_at: apt.bookedAt || new Date().toISOString(),
    };

    // 1. Try atomic database procedure for First-Come First-Served conflict prevention
    let rpcSuccess = false;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("confirm_appointment_atomic", {
        p_appointment: payload,
      });

      if (rpcError) {
        if (
          rpcError.code === "23505" ||
          rpcError.message?.includes("already_booked") ||
          rpcError.message?.includes("Conflict") ||
          rpcError.message?.includes("unique_active_doctor_appointment_slot")
        ) {
          throw new Error("This doctor slot has already been booked by another patient. Please choose a different time slot.");
        }
        console.warn("[Supabase] confirm_appointment_atomic notice:", rpcError.message);
      } else if (rpcData) {
        if (!rpcData.success) {
          // Database atomically detected conflict: NEVER fall through to direct upsert!
          throw new Error(rpcData.message || "This doctor slot has already been booked by another patient. Please choose a different time slot.");
        }
        rpcSuccess = true;
      }
    } catch (rpcEx) {
      // Re-throw immediately: never swallow booking conflict!
      throw rpcEx;
    }

    // 2. Direct table insert fallback ONLY if RPC was not invoked or did not exist
    let resData = null;
    if (!rpcSuccess) {
      const { data, error } = await supabase
        .from("appointments")
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) {
        if (
          error.code === "23505" ||
          error.message?.includes("unique_active_doctor_appointment_slot") ||
          error.message?.includes("duplicate key")
        ) {
          throw new Error("This doctor slot has already been booked by another patient. Please choose a different time slot.");
        }
        if (error.message?.includes("schema cache") || error.message?.includes("Could not find")) {
          const legacyPayload = { ...payload };
          delete legacyPayload.video_consultation;
          delete legacyPayload.calendar_sync_status;
          delete legacyPayload.google_meet_link;
          delete legacyPayload.doctor_email;
          const { data: retryData, error: retryErr } = await supabase
            .from("appointments")
            .insert(legacyPayload)
            .select()
            .maybeSingle();
          if (retryErr) {
            if (retryErr.code === "23505" || retryErr.message?.includes("unique_active_doctor_appointment_slot")) {
              throw new Error("This doctor slot has already been booked by another patient. Please choose a different time slot.");
            }
            throw new Error(retryErr.message);
          }
          resData = retryData;
        } else {
          throw new Error(error.message);
        }
      } else {
        resData = data;
      }
    }

    // Trigger async sync to Google Sheets (non-blocking)
    triggerGoogleSheetsSync(payload.id);

    // If Video Consultation, trigger Google Calendar & Google Meet sync
    if (isVideo) {
      triggerGoogleCalendarSync(payload.id, "create");
    }

    // Broadcast real-time appointment event to all connected dashboards (Super Admin, Doctor, Admin, Patient)
    try {
      const liveChannel = supabase.channel("kmc-live-events");
      liveChannel.send({
        type: "broadcast",
        event: "appointment_changed",
        payload: {
          id: payload.id,
          doctorId: payload.doctor_id,
          date: payload.appointment_date,
          time: payload.appointment_time,
          status: payload.status,
        },
      });
    } catch (_) {}

    return resData || payload;
  } catch (err) {
    console.warn("[Supabase] Save appointment exception:", err.message);
    throw err;
  }
};

export const updateAppointmentStatusInSupabase = async (id, status) => {
  try {
    const normalizedStatus = (status || "confirmed").toLowerCase();
    const { data, error } = await supabase
      .from("appointments")
      .update({
        status: normalizedStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      console.warn("[Supabase] Update appointment status error:", error.message);
    }

    // Update synced row in Google Sheets
    triggerGoogleSheetsSync(id);

    // Sync status change to Google Calendar if applicable
    if (normalizedStatus === "cancelled") {
      triggerGoogleCalendarSync(id, "cancel");
    } else if (normalizedStatus === "confirmed") {
      triggerGoogleCalendarSync(id, "update");
    }

    // Broadcast status change real-time event
    try {
      const liveChannel = supabase.channel("kmc-live-events");
      liveChannel.send({
        type: "broadcast",
        event: "appointment_changed",
        payload: { id, status: normalizedStatus },
      });
    } catch (_) {}

    return data;
  } catch (err) {
    console.warn("[Supabase] Update status exception:", err.message);
    return null;
  }
};

// ==========================================
// 3. REAL-TIME CONCURRENCY & SLOT LOCKING
// ==========================================

/**
 * Fetch current statuses of all slots for a doctor and date
 */
export const fetchSlotStatuses = async (doctorId, date) => {
  const result = {};

  try {
    // Normalise date candidates (e.g. "Today" matches today's ISO date, and vice-versa)
    const today = new Date();
    const todayIso = today.toISOString().split("T")[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().split("T")[0];

    const dateStr = String(date || "").trim();
    let dateCandidates = [dateStr];
    if (dateStr.toLowerCase() === "today" || dateStr === todayIso) {
      dateCandidates = ["Today", "today", todayIso];
    } else if (dateStr.toLowerCase() === "tomorrow" || dateStr === tomorrowIso) {
      dateCandidates = ["Tomorrow", "tomorrow", tomorrowIso];
    }

    // 1. Check permanently active / confirmed appointments from Supabase DB
    const { data: bookedData } = await supabase
      .from("appointments")
      .select("appointment_time, start_time, status, patient_name, doctor_id, appointment_date")
      .eq("doctor_id", String(doctorId))
      .in("appointment_date", dateCandidates)
      .in("status", ["confirmed", "Confirmed", "pending", "Pending"]);

    if (bookedData) {
      bookedData.forEach((row) => {
        const entry = {
          status: "booked", // Unable to book
          patientName: row.patient_name,
        };
        const rawTime = row.appointment_time;
        const rawStart = row.start_time;
        const norm12 = normalizeTo12h(rawTime || rawStart);
        const norm24 = normalizeTo24h(rawStart || rawTime);

        if (rawTime) result[rawTime] = entry;
        if (rawStart) result[rawStart] = entry;
        if (norm12) result[norm12] = entry;
        if (norm24) result[norm24] = entry;
      });
    }

    // 2. Check local appointments cache for freshly booked appointments on this device
    try {
      const localJson = await AsyncStorage.getItem("@kmc_appointments");
      if (localJson) {
        const localApts = JSON.parse(localJson);
        if (Array.isArray(localApts)) {
          localApts.forEach((apt) => {
            const aptDocId = String(apt.doctorId || apt.doctor_id || "");
            const aptDate = String(apt.date || apt.appointment_date || "");
            const aptStatus = String(apt.dbStatus || apt.status || "").toLowerCase();
            const isMatchDoc = aptDocId === String(doctorId);
            const isMatchDate = dateCandidates.includes(aptDate);
            const isActive = aptStatus === "confirmed" || aptStatus === "pending";

            if (isMatchDoc && isMatchDate && isActive) {
              const rawTime = apt.time || apt.appointment_time;
              const rawStart = apt.startTime || apt.start_time;
              const norm12 = normalizeTo12h(rawTime || rawStart);
              const norm24 = normalizeTo24h(rawStart || rawTime);
              const entry = {
                status: "booked",
                patientName: apt.patientName || apt.patient_name,
              };
              if (rawTime) result[rawTime] = entry;
              if (rawStart) result[rawStart] = entry;
              if (norm12) result[norm12] = entry;
              if (norm24) result[norm24] = entry;
            }
          });
        }
      }
    } catch (_) {}

    // 3. Check temporary active holds
    const nowIso = new Date().toISOString();
    const { data: holdsData } = await supabase
      .from("slot_holds")
      .select("appointment_time, start_time, held_by, held_by_name, expires_at")
      .eq("doctor_id", String(doctorId))
      .in("appointment_date", dateCandidates)
      .gt("expires_at", nowIso);

    if (holdsData) {
      holdsData.forEach((row) => {
        const rawTime = row.appointment_time;
        const rawStart = row.start_time;
        const norm12 = normalizeTo12h(rawTime || rawStart);
        const norm24 = normalizeTo24h(rawStart || rawTime);

        const entry = {
          status: "held", // Temporarily locked by another user
          heldBy: row.held_by,
          heldByName: row.held_by_name,
          expiresAt: row.expires_at,
        };

        if (rawTime && !result[rawTime]) result[rawTime] = entry;
        if (rawStart && !result[rawStart]) result[rawStart] = entry;
        if (norm12 && !result[norm12]) result[norm12] = entry;
        if (norm24 && !result[norm24]) result[norm24] = entry;
      });
    }
  } catch (e) {
    console.warn("[Supabase] fetchSlotStatuses error:", e.message);
  }

  return result;
};

/**
 * Place a 5-minute hold on a slot for conflict prevention
 */
export const holdSlotInSupabase = async ({
  doctorId,
  date,
  time,
  userId,
  userName,
  durationMinutes = 5,
}) => {
  const slotKey = buildSlotKey(doctorId, date, time);
  const now = new Date();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString();

  try {
    // 1. Try atomic stored procedure if available in Supabase
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("hold_slot_atomic", {
        p_slot_key: slotKey,
        p_doctor_id: String(doctorId),
        p_appointment_date: String(date),
        p_appointment_time: String(time),
        p_user_id: String(userId || "guest"),
        p_user_name: userName || "Patient",
        p_duration_seconds: durationMinutes * 60,
      });

      if (!rpcError && rpcData) {
        return rpcData;
      }
    } catch (rpcErr) {
      // fallback to client-side queries
    }

    // 2. Client query fallback: Check if already permanently booked
    const { data: existingApt } = await supabase
      .from("appointments")
      .select("id, status")
      .eq("slot_key", slotKey)
      .in("status", ["confirmed", "Confirmed", "pending", "Pending"])
      .maybeSingle();

    if (existingApt) {
      return {
        success: false,
        reason: "booked",
        message: "Yeh slot already book ho chuka hai (Unable to book). Kripya doosra time chunein.",
      };
    }

    // 2. Check if held by another active user
    const { data: existingHold } = await supabase
      .from("slot_holds")
      .select("held_by, expires_at")
      .eq("slot_key", slotKey)
      .gt("expires_at", nowIso)
      .maybeSingle();

    if (existingHold && existingHold.held_by !== userId) {
      return {
        success: false,
        reason: "held_by_other",
        message: "This slot is currently locked for another patient for 5 minutes. Please choose another slot or try again after some time.",
      };
    }

    // 3. Claim the hold
    const holdPayload = {
      slot_key: slotKey,
      doctor_id: String(doctorId),
      appointment_date: String(date),
      appointment_time: String(time),
      held_by: String(userId || "guest"),
      held_by_name: userName || "Patient",
      held_at: nowIso,
      expires_at: expiresAt,
    };

    const { error: upsertError } = await supabase
      .from("slot_holds")
      .upsert(holdPayload, { onConflict: "slot_key" });

    if (upsertError) {
      console.warn("[Supabase] Hold slot error:", upsertError.message);
    }

    return {
      success: true,
      slotKey,
      expiresAt,
      message: "Slot 5 minute ke liye hold ho gaya hai.",
    };
  } catch (err) {
    console.warn("[Supabase] holdSlot exception:", err.message);
    // Graceful fallback to allow booking if offline
    return {
      success: true,
      slotKey,
      expiresAt,
      message: "Slot selected.",
    };
  }
};

/**
 * Release temporary hold
 */
export const releaseSlotHoldInSupabase = async ({ doctorId, date, time, userId }) => {
  const slotKey = buildSlotKey(doctorId, date, time);
  try {
    let q = supabase.from("slot_holds").delete().eq("slot_key", slotKey);
    if (userId) {
      q = q.eq("held_by", String(userId));
    }
    await q;
  } catch (e) {
    console.warn("[Supabase] releaseSlotHold error:", e.message);
  }
};

/**
 * Subscribe to real-time slot and appointment events
 */
export const subscribeToRealtimeSlots = (onSlotChange) => {
  try {
    const channel = supabase
      .channel("kmc_realtime_slots_" + Math.random().toString(36).substring(7))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "slot_holds" },
        (payload) => {
          if (onSlotChange) onSlotChange({ type: "slot_hold", payload });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        (payload) => {
          if (onSlotChange) onSlotChange({ type: "appointment", payload });
        }
      )
      .subscribe((status) => {
        console.log("[Supabase Realtime] Channel status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (e) {
    console.warn("[Supabase Realtime] Subscribe exception:", e.message);
    return () => {};
  }
};
