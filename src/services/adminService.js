import { supabase } from "../utils/supabase.js";
import { formatTimeTo12h } from "./supabaseService.js";

/**
 * Fetch high-level statistics for Admin Overview
 */
export const fetchAdminOverviewStats = async () => {
  try {
    // 1. Appointments counts & revenue
    const { data: appointments, error: aptErr } = await supabase
      .from("appointments")
      .select("id, status, consultation_fee, total_amount, google_sheets_synced, calendar_sync_status, type, created_at");

    if (aptErr) console.warn("[AdminService] Appointments stats error:", aptErr.message);

    const aptList = appointments || [];
    const totalAppointments = aptList.length;
    const pendingAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "pending").length;
    const confirmedAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "confirmed").length;
    const completedAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "completed").length;
    const cancelledAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "cancelled").length;

    const totalRevenue = aptList
      .filter((a) => (a.status || "").toLowerCase() !== "cancelled")
      .reduce((sum, a) => sum + (Number(a.total_amount) || Number(a.consultation_fee) || 800), 0);

    const videoAppointments = aptList.filter(
      (a) => (a.type || "").toLowerCase().includes("video") || (a.type || "").toLowerCase().includes("online")
    ).length;

    const sheetsSynced = aptList.filter((a) => a.google_sheets_synced === true).length;
    const calendarSynced = aptList.filter((a) => a.calendar_sync_status === "synced").length;

    // 2. Doctors stats
    const { data: doctors, error: docErr } = await supabase
      .from("doctors")
      .select("id, active, verification_status, invitation_status, auth_user_id");

    if (docErr) console.warn("[AdminService] Doctors stats error:", docErr.message);

    const docList = doctors || [];
    const totalDoctors = docList.length;
    const activeDoctors = docList.filter((d) => d.active !== false && d.verification_status !== "suspended").length;
    const suspendedDoctors = docList.filter((d) => d.active === false || d.verification_status === "suspended").length;
    const invitedDoctors = docList.filter((d) => d.invitation_status === "invited").length;

    // 3. Patients count
    const { count: patientCount, error: patErr } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "patient");

    if (patErr) console.warn("[AdminService] Patient count error:", patErr.message);

    return {
      totalAppointments,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      totalRevenue,
      videoAppointments,
      sheetsSynced,
      calendarSynced,
      totalDoctors,
      activeDoctors,
      suspendedDoctors,
      invitedDoctors,
      totalPatients: patientCount || 0,
    };
  } catch (err) {
    console.warn("[AdminService] Overview stats exception:", err.message);
    return {
      totalAppointments: 0,
      pendingAppointments: 0,
      confirmedAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      totalRevenue: 0,
      videoAppointments: 0,
      sheetsSynced: 0,
      calendarSynced: 0,
      totalDoctors: 0,
      activeDoctors: 0,
      suspendedDoctors: 0,
      invitedDoctors: 0,
      totalPatients: 0,
    };
  }
};

/**
 * Fetch complete doctor list for Admin management
 */
export const fetchAdminDoctorsList = async () => {
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("[AdminService] fetchAdminDoctorsList error:", error.message);
      return [];
    }

    return (data || []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
      department: doc.department,
      specialization: doc.specialization,
      qualification: doc.qualification,
      experience: doc.experience,
      consultationFee: doc.consultation_fee || 800,
      clinicName: doc.clinic_name || "KMC Hospital, Jankipuram, Lucknow",
      bio: doc.bio,
      rating: doc.rating || 4.9,
      reviewsCount: doc.reviews_count || 150,
      active: doc.active !== false && doc.verification_status !== "suspended",
      verificationStatus: doc.verification_status || "verified",
      invitationStatus: doc.invitation_status || "accepted",
      authUserId: doc.auth_user_id,
      invitedAt: doc.invited_at,
      verifiedAt: doc.verified_at,
    }));
  } catch (err) {
    console.warn("[AdminService] fetchAdminDoctorsList exception:", err.message);
    return [];
  }
};

/**
 * Helper to extract real server error message from Edge Function response
 */
const extractInvokeError = async (error) => {
  if (!error) return "Unknown error occurred";
  let msg = error.message || "Failed to process request";
  if (error.context) {
    try {
      const json = await error.context.json();
      if (json?.error) {
        msg = json.error;
      } else if (json?.message) {
        msg = json.message;
      }
    } catch (_) {
      try {
        const text = await error.context.text();
        if (text) msg = text;
      } catch (__) {}
    }
  }
  return msg;
};

/**
 * Call Edge Function: Add Hospital Doctor (directory record)
 * Includes direct database fallback for authenticated admins
 */
export const adminAddHospitalDoctor = async (doctorData) => {
  let fnErrorMsg = "";
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "add_doctor",
        ...doctorData,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }
    if (error) {
      fnErrorMsg = await extractInvokeError(error);
      console.warn("[AdminService] adminAddHospitalDoctor Edge Function notice:", fnErrorMsg);
    } else if (data?.error) {
      fnErrorMsg = data.error;
    }
  } catch (fnErr) {
    fnErrorMsg = await extractInvokeError(fnErr);
    console.warn("[AdminService] adminAddHospitalDoctor Edge Function exception:", fnErrorMsg);
  }

  // Resilient Direct Supabase Fallback: Authenticated Admin has direct INSERT permissions via RLS
  const targetDoctorId = `doc_${Date.now()}`;
  const insertPayload = {
    id: targetDoctorId,
    name: doctorData.name?.trim() || "KMC Doctor",
    email: doctorData.email?.trim().toLowerCase() || null,
    phone: doctorData.phone ? doctorData.phone.trim() : "",
    department: doctorData.department || "General Medicine",
    specialization: doctorData.specialization || "Senior Consultant",
    qualification: doctorData.qualification || "MBBS",
    experience: doctorData.experience || "5+ Yrs",
    consultation_fee: Number(doctorData.consultationFee || 800),
    clinic_name: doctorData.clinicName || "KMC Hospital, Jankipuram, Lucknow",
    bio: doctorData.bio || "",
    active: true,
    verification_status: "verified",
    invitation_status: "uninvited",
    auth_user_id: null,
  };

  const { data: dbData, error: dbErr } = await supabase
    .from("doctors")
    .insert(insertPayload)
    .select()
    .single();

  if (dbErr) {
    throw new Error(dbErr.message || fnErrorMsg || "Failed to add doctor to hospital directory");
  }

  return { success: true, doctor: dbData, fallback: true };
};

/**
 * Call Edge Function: Invite or Link Doctor
 */
export const adminInviteDoctor = async (payload) => {
  let friendlyErrMsg = "";
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "invite_doctor",
        ...payload,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }

    if (error) {
      friendlyErrMsg = await extractInvokeError(error);
    } else if (data?.error) {
      friendlyErrMsg = data.error;
    }
  } catch (err) {
    friendlyErrMsg = await extractInvokeError(err);
  }

  // If Edge Function failed, but admin was creating a new doctor from scratch,
  // ensure the doctor directory entry is preserved via fallback!
  if (!payload.doctorId && payload.name) {
    try {
      await adminAddHospitalDoctor({
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        department: payload.department,
        specialization: payload.specialization,
        qualification: payload.qualification,
        experience: payload.experience,
        consultationFee: payload.consultationFee,
      });

      throw new Error(
        `Doctor saved in hospital directory, but Auth Account creation encountered: ${friendlyErrMsg || "Edge Function offline"}. You can link login credentials later.`
      );
    } catch (saveErr) {
      if (saveErr.message?.includes("Doctor saved in hospital directory")) {
        throw saveErr;
      }
    }
  }

  throw new Error(friendlyErrMsg || "Failed to authorize doctor. Please check edge function deployment.");
};

/**
 * Call Edge Function: Toggle Active / Suspended with direct Supabase Fallback
 */
export const adminToggleDoctorActive = async (doctorId, active) => {
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "toggle_active",
        doctorId,
        active,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }
  } catch (_) {}

  // Direct Supabase Fallback (Admin RLS allows update on doctors)
  const { data: dbDoc, error: dbErr } = await supabase
    .from("doctors")
    .update({
      active,
      verification_status: active ? "verified" : "suspended",
    })
    .eq("id", doctorId)
    .select()
    .single();

  if (dbErr) {
    throw new Error(dbErr.message || "Failed to update doctor active status");
  }
  return { success: true, doctor: dbDoc };
};

/**
 * Call Edge Function: Update Doctor details with direct Supabase Fallback
 */
export const adminUpdateDoctor = async (doctorId, updateData) => {
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "update_doctor",
        doctorId,
        updateData,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }
  } catch (_) {}

  // Direct Supabase Fallback
  const { data: dbDoc, error: dbErr } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId)
    .select()
    .single();

  if (dbErr) {
    throw new Error(dbErr.message || "Failed to update doctor profile");
  }
  return { success: true, doctor: dbDoc };
};

/**
 * Call Edge Function: Reset doctor password / re-invite
 */
export const adminResetDoctorPassword = async (doctorId, newPassword) => {
  let friendlyErrMsg = "";
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "reset_password",
        doctorId,
        newPassword,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }
    if (error) {
      friendlyErrMsg = await extractInvokeError(error);
    } else if (data?.error) {
      friendlyErrMsg = data.error;
    }
  } catch (err) {
    friendlyErrMsg = await extractInvokeError(err);
  }

  throw new Error(friendlyErrMsg || "Failed to reset doctor password. Ensure Edge Function is deployed.");
};

/**
 * Call Edge Function: Verify Doctor with direct Supabase Fallback
 */
export const adminVerifyDoctor = async (doctorId) => {
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "verify_doctor",
        doctorId,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }
  } catch (_) {}

  // Direct Supabase Fallback
  const { data: dbDoc, error: dbErr } = await supabase
    .from("doctors")
    .update({
      verification_status: "verified",
      verified_at: new Date().toISOString(),
    })
    .eq("id", doctorId)
    .select()
    .single();

  if (dbErr) {
    throw new Error(dbErr.message || "Failed to verify doctor");
  }
  return { success: true, doctor: dbDoc };
};

/**
 * Call Edge Function: Update Doctor Availability schedule with direct Supabase Fallback
 */
export const adminUpdateDoctorAvailability = async (doctorId, availability) => {
  try {
    const { data, error } = await supabase.functions.invoke("admin-manage-doctor", {
      body: {
        action: "manage_availability",
        doctorId,
        availability,
      },
    });

    if (!error && data && !data.error) {
      return data;
    }
  } catch (_) {}

  // Direct Supabase Fallback
  await supabase.from("doctor_availability").delete().eq("doctor_id", doctorId);

  const rows = (availability || []).map((a) => ({
    doctor_id: doctorId,
    day_of_week: a.day_of_week,
    start_time: a.start_time || "09:00 AM",
    end_time: a.end_time || "02:00 PM",
    is_available: a.is_available !== false,
  }));

  const { data: dbData, error: dbErr } = await supabase
    .from("doctor_availability")
    .insert(rows)
    .select();

  if (dbErr) {
    throw new Error(dbErr.message || "Failed to update doctor availability schedule");
  }
  return { success: true, availability: dbData };
};

/**
  * Fetch availability schedule for a doctor
  */
export const fetchDoctorAvailability = async (doctorId) => {
  try {
    const { data, error } = await supabase
      .from("doctor_availability")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("day_of_week", { ascending: true });

    if (error) {
      console.warn("[AdminService] fetchDoctorAvailability error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn("[AdminService] fetchDoctorAvailability exception:", err.message);
    return [];
  }
};

/**
 * Fetch all appointments for Admin Appointments Tab
 */
export const fetchAdminAppointments = async (filters = {}) => {
  try {
    let query = supabase
      .from("appointments")
      .select("*")
      .order("appointment_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (filters.doctorId && filters.doctorId !== "all") {
      query = query.eq("doctor_id", filters.doctorId);
    }

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status.toLowerCase());
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[AdminService] fetchAdminAppointments error:", error.message);
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
      status: (row.status || "confirmed").charAt(0).toUpperCase() + (row.status || "confirmed").slice(1),
      dbStatus: row.status,
      type: row.type || "Hospital Visit",
      fee: `₹${row.consultation_fee || row.total_amount || 800}`,
      consultationFee: row.consultation_fee || 800,
      totalAmount: row.total_amount || 800,
      paymentMethod: row.payment_method || "cash",
      paymentStatus: row.payment_status || "pending",
      meetingLink: row.meeting_link,
      googleMeetLink: row.google_meet_link,
      calendarLink: row.calendar_link,
      calendarSyncStatus: row.calendar_sync_status,
      googleSheetsSynced: row.google_sheets_synced,
      bookedAt: row.created_at,
    }));
  } catch (err) {
    console.warn("[AdminService] fetchAdminAppointments exception:", err.message);
    return [];
  }
};

/**
 * Fetch registered patients for Admin Patients Tab
 */
export const fetchAdminPatientsList = async () => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, name, email, phone, gender, blood_group, created_at, updated_at")
      .or("role.eq.patient,role.is.null")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: aptsData } = await supabase
      .from("appointments")
      .select("patient_id, patient_name, patient_phone, patient_email, appointment_date, created_at");

    const patientMap = new Map();

    (data || []).forEach((p) => {
      patientMap.set(p.id, {
        id: p.id,
        name: p.full_name || p.name || "Patient",
        email: p.email || "",
        phone: p.phone || "",
        gender: p.gender || "Not specified",
        bloodGroup: p.blood_group || "-",
        registeredAt: p.created_at,
        appointmentCount: 0,
      });
    });

    (aptsData || []).forEach((apt) => {
      const pid = apt.patient_id || apt.patient_email || apt.patient_phone;
      if (!pid) return;

      if (patientMap.has(pid)) {
        const exist = patientMap.get(pid);
        exist.appointmentCount = (exist.appointmentCount || 0) + 1;
        if (!exist.phone && apt.patient_phone) exist.phone = apt.patient_phone;
        if (!exist.email && apt.patient_email) exist.email = apt.patient_email;
      } else {
        patientMap.set(pid, {
          id: pid,
          name: apt.patient_name || "Hospital Patient",
          email: apt.patient_email || "",
          phone: apt.patient_phone || "",
          gender: "Not specified",
          bloodGroup: "-",
          registeredAt: apt.created_at || apt.appointment_date,
          appointmentCount: 1,
        });
      }
    });

    return Array.from(patientMap.values());
  } catch (err) {
    console.warn("[AdminService] fetchAdminPatientsList exception:", err.message);
    return [];
  }
};

/**
 * Real-time slot conflict checker for Hospital Admin Scheduler Modal
 */
export const fetchAdminDoctorSlotStatuses = async (doctorId, date) => {
  const { fetchDoctorSlotStatuses } = await import("./superAdminService.js");
  return await fetchDoctorSlotStatuses(doctorId, date);
};

/**
 * Schedule consultation meet by Hospital Admin
 * Seamlessly synchronizes to database, patient app cache, and real-time feeds
 */
export const scheduleMeetingByAdmin = async (params) => {
  const { scheduleMeetingBySuperAdmin } = await import("./superAdminService.js");
  return await scheduleMeetingBySuperAdmin(params);
};

/**
 * Subscribe to realtime appointment updates for Admin Dashboard
 */
export const subscribeToAdminAppointmentsRealtime = (onUpdate) => {
  const channel = supabase
    .channel("hospital_admin_appointments_channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
      onUpdate && onUpdate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, () => {
      onUpdate && onUpdate();
    })
    .subscribe();

  // Also listen on global kmc-live-events broadcast channel
  const globalEvents = supabase
    .channel("kmc-live-events")
    .on("broadcast", { event: "appointment_changed" }, () => {
      onUpdate && onUpdate();
    })
    .on("broadcast", { event: "doctor_online_changed" }, () => {
      onUpdate && onUpdate();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    supabase.removeChannel(globalEvents);
  };
};

