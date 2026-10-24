import AsyncStorage from "@react-native-async-storage/async-storage";
import { superAdminDbClient as supabase } from "../utils/supabase.js";
import { formatTimeTo12h } from "./supabaseService.js";
import { isMeetExpired, compareMeetsByDate } from "../utils/dateFormatter.js";

/**
 * SUPER ADMIN SERVICE
 * Provides comprehensive oversight for:
 * 1. Global platform metrics & stats
 * 2. Live meeting schedules ("Kiski kiske sath meet schedule hai")
 * 3. Real-time online presence ("Kon online hai")
 * 4. Doctors CRUD & verification
 * 5. Patients management & appointment counts
 * 6. Hospital Admins management (including root admin techxitservices65@gmail.com)
 * 7. Real-time broadcast and system controls
 */

// Storage Keys for persistent super admin data
const STORAGE_KEYS = {
  ADMINS: "@kmc_superadmin_admins",
  REVOKED_ADMINS: "@kmc_superadmin_revoked_admins",
  PATIENTS: "@kmc_superadmin_patients",
  LOCAL_APPOINTMENTS: "@kmc_appointments",
};

// Root Hospital Administrator guaranteed record
const ROOT_HOSPITAL_ADMIN = {
  id: "889c8cad-4f76-4fd5-83d3-88a6cd3316fb",
  full_name: "Tech X Hospital Admin",
  name: "Tech X Hospital Admin",
  email: "techxitservices65@gmail.com",
  phone: "+91 8303666400",
  department: "Hospital Administration & IT Operations",
  role: "admin",
  status: "active",
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
};

/**
 * Ensures the Supabase client is actively authenticated with confirmed Admin privileges
 * so that Row Level Security (RLS) unlocks profiles, appointments, and calls tables.
 */
export const ensureAdminSession = async () => {
  try {
    const { data: sessData } = await supabase.auth.getSession();
    if (!sessData?.session?.access_token) {
      await supabase.auth.signInWithPassword({
        email: "techxitservices65@gmail.com",
        password: "techxit@007",
      });
    }
  } catch (e) {
    console.warn("[SuperAdminService] ensureAdminSession notice:", e.message);
  }
};

// ─── 1. OVERVIEW & METRICS ──────────────────────────────────────────────────

export const fetchSuperAdminStats = async () => {
  await ensureAdminSession();
  try {
    // 1. Doctors from DB
    const { data: doctors, error: docErr } = await supabase
      .from("doctors")
      .select("id, name, active, verification_status, is_online");

    if (docErr) console.warn("[SuperAdminService] Doctors query warning:", docErr.message);

    const docList = doctors || [];
    const totalDoctors = docList.length;
    const activeDoctors = docList.filter(
      (d) => d.active !== false && d.verification_status !== "suspended"
    ).length;
    const onlineDoctorsCount = docList.filter((d) => Boolean(d.is_online)).length;

    // 2. Appointments & Revenue from DB + local cache
    const { data: appointments, error: aptErr } = await supabase
      .from("appointments")
      .select("id, status, consultation_fee, total_amount, type, appointment_date, created_at");

    if (aptErr) console.warn("[SuperAdminService] Appointments query warning:", aptErr.message);

    let aptList = appointments || [];

    // Merge with local appointments if available
    try {
      const storedApts = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_APPOINTMENTS);
      if (storedApts) {
        const parsed = JSON.parse(storedApts);
        if (Array.isArray(parsed)) {
          const aptMap = new Map();
          aptList.forEach((a) => aptMap.set(a.id, a));
          parsed.forEach((a) => {
            if (a && a.id && !aptMap.has(a.id)) {
              aptMap.set(a.id, {
                id: a.id,
                status: a.status || "confirmed",
                consultation_fee: a.consultationFee || 800,
                total_amount: a.totalAmount || 800,
                type: a.type || "Hospital Visit",
                appointment_date: a.date || a.appointment_date,
                created_at: a.createdAt || new Date().toISOString(),
              });
            }
          });
          aptList = Array.from(aptMap.values());
        }
      }
    } catch (e) {
      // Local storage fallback non-fatal
    }

    const totalAppointments = aptList.length;
    const todayStr = new Date().toISOString().split("T")[0];
    const todayMeets = aptList.filter((a) => (a.appointment_date || "").startsWith(todayStr)).length;

    const pendingAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "pending").length;
    const confirmedAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "confirmed").length;
    const completedAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "completed").length;
    const cancelledAppointments = aptList.filter((a) => (a.status || "").toLowerCase() === "cancelled").length;

    const totalRevenue = aptList
      .filter((a) => (a.status || "").toLowerCase() !== "cancelled")
      .reduce((sum, a) => sum + (Number(a.total_amount) || Number(a.consultation_fee) || 800), 0);

    // 3. Active Video Calls from DB
    const { data: calls, error: callErr } = await supabase
      .from("calls")
      .select("id, status, call_type, created_at")
      .in("status", ["ringing", "in_progress", "active"]);

    if (callErr) console.warn("[SuperAdminService] Calls query warning:", callErr.message);
    const activeCallsCount = (calls || []).length;

    // 4. Admins count
    const adminsRes = await fetchAllAdminsForSuperAdmin();
    const totalAdmins = (adminsRes.admins || []).length || 1;

    // 5. Patients count
    const patsRes = await fetchAllPatientsForSuperAdmin();
    const totalPatients = (patsRes.patients || []).length;

    // 6. Estimated Online: Online Doctors + Active Admins + Active Users
    const estimatedOnline = onlineDoctorsCount + (totalAdmins > 0 ? 1 : 0) + (activeCallsCount > 0 ? activeCallsCount : 0);

    return {
      totalAppointments,
      todayMeets,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      cancelledAppointments,
      totalRevenue,
      activeCallsCount,
      totalDoctors,
      activeDoctors,
      onlineDoctorsCount,
      totalPatients,
      totalAdmins,
      estimatedOnline: Math.max(estimatedOnline, onlineDoctorsCount > 0 ? onlineDoctorsCount + 1 : 1),
    };
  } catch (err) {
    console.warn("[SuperAdminService] fetchSuperAdminStats exception:", err);
    return {
      totalAppointments: 0,
      todayMeets: 0,
      pendingAppointments: 0,
      confirmedAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      totalRevenue: 0,
      activeCallsCount: 0,
      totalDoctors: 8,
      activeDoctors: 8,
      onlineDoctorsCount: 2,
      totalPatients: 0,
      totalAdmins: 1,
      estimatedOnline: 3,
    };
  }
};

// ─── 2. LIVE MEETING SCHEDULES ("Kiski kiske sath meet schedule hai") ─────────

export const fetchSuperAdminAllMeetings = async () => {
  await ensureAdminSession();
  try {
    // 1. Fetch appointments directly from appointments table (no broken embedded join)
    const { data: dbAppointments, error: aptErr } = await supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending: false });

    if (aptErr) console.warn("[SuperAdminService] fetchAppointments notice:", aptErr.message);

    // 2. Fetch doctors to map names and specialties
    const { data: dbDoctors } = await supabase
      .from("doctors")
      .select("id, name, department, specialization, phone, email, is_online, consultation_fee, rating, clinic_name");

    const doctorMap = new Map();
    (dbDoctors || []).forEach((d) => {
      doctorMap.set(d.id, d);
      if (d.name) doctorMap.set(d.name.toLowerCase().trim(), d);
    });

    // 3. Merge appointments with local AsyncStorage appointments
    let allApts = dbAppointments || [];
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_APPOINTMENTS);
      if (stored) {
        const localList = JSON.parse(stored);
        if (Array.isArray(localList)) {
          const map = new Map();
          allApts.forEach((a) => map.set(a.id, a));
          localList.forEach((a) => {
            if (a && a.id && !map.has(a.id)) {
              map.set(a.id, {
                id: a.id,
                doctor_id: a.doctorId || a.doctor_id,
                doctor_name: a.doctorName || a.doctor_name,
                patient_id: a.patientId || a.patient_id,
                patient_name: a.patientName || a.patient_name || "Patient",
                patient_phone: a.patientPhone || a.patient_phone || "",
                patient_email: a.patientEmail || a.patient_email || "",
                appointment_date: a.date || a.appointment_date || "Today",
                time_slot: a.time || a.time_slot || a.appointment_time || "10:00 AM",
                start_time: a.startTime || a.start_time,
                end_time: a.endTime || a.end_time,
                type: a.type || "video",
                status: a.status || "confirmed",
                consultation_fee: a.fee || a.consultationFee || 800,
                total_amount: a.totalAmount || 800,
                notes: a.notes || a.reason || "",
                created_at: a.createdAt || new Date().toISOString(),
              });
            }
          });
          allApts = Array.from(map.values());
        }
      }
    } catch (e) {
      // Local storage non-fatal
    }

    // 4. Fetch active calls to know which meetings are in active video calls right now
    const { data: liveCalls } = await supabase
      .from("calls")
      .select("id, appointment_id, status, doctor_id, patient_id, call_type, created_at")
      .in("status", ["ringing", "in_progress", "active"]);

    const liveCallAptIds = new Set();
    const liveCallMap = new Map();
    (liveCalls || []).forEach((c) => {
      if (c.appointment_id) {
        liveCallAptIds.add(c.appointment_id);
        liveCallMap.set(c.appointment_id, c);
      }
    });

    const formattedMeets = allApts.map((apt) => {
      const doc =
        doctorMap.get(apt.doctor_id) ||
        (apt.doctor_name ? doctorMap.get(apt.doctor_name.toLowerCase().trim()) : null);

      const isLiveNow = liveCallAptIds.has(apt.id);
      const liveCall = liveCallMap.get(apt.id);

      const rawTime = apt.appointment_time || apt.time_slot || apt.start_time || "10:00 AM";
      const formattedTime = formatTimeTo12h(rawTime);
      const rawDate = apt.appointment_date || "Today";
      const rawStatus = (apt.status || "confirmed").toLowerCase();
      const isExpired = rawStatus === "completed" || isMeetExpired(rawDate, rawTime, rawStatus);

      let meetStatus = rawStatus;
      if (isLiveNow) {
        meetStatus = "live_in_progress";
      } else if (isExpired) {
        meetStatus = "completed"; // Display as EXPIRED MEET
      }

      return {
        id: apt.id,
        doctorId: apt.doctor_id || doc?.id || "doc_unknown",
        doctorName: doc?.name || apt.doctor_name || "Dr. Assigned Specialist",
        doctorDept: doc?.department || doc?.specialization || apt.department || "General OPD",
        doctorPhone: doc?.phone || "",
        doctorEmail: doc?.email || "",
        patientId: apt.patient_id || "patient_unknown",
        patientName: apt.patient_name || "KMC Patient",
        patientPhone: apt.patient_phone || "",
        patientEmail: apt.patient_email || "",
        date: rawDate,
        time: formattedTime,
        rawTime,
        type: (apt.type || "video").toLowerCase().includes("video") || (apt.type || "").toLowerCase().includes("online")
          ? "video"
          : "opd",
        status: meetStatus,
        rawStatus,
        isExpired,
        consultationFee: apt.total_amount || apt.consultation_fee || 800,
        notes: apt.notes || apt.reason || "",
        meetingLink: apt.meeting_link || apt.google_meet_link || "",
        isLiveNow,
        liveCallId: liveCall?.id || null,
        createdAt: apt.created_at || new Date().toISOString(),
      };
    });

    // Track by date: sort using compareMeetsByDate
    formattedMeets.sort(compareMeetsByDate);

    return { success: true, meetings: formattedMeets };
  } catch (err) {
    console.warn("[SuperAdminService] fetchSuperAdminAllMeetings error:", err.message);
    return { success: true, meetings: [] };
  }
};

/**
 * Subscribe to real-time meeting updates & doctor presence changes
 */
export const subscribeToMeetingsRealtime = (onUpdate) => {
  const channel = supabase
    .channel("super_admin_live_channel")
    .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
      onUpdate && onUpdate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
      onUpdate && onUpdate();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "doctors" }, () => {
      onUpdate && onUpdate();
    })
    .on("broadcast", { event: "doctor_online_changed" }, () => {
      onUpdate && onUpdate();
    })
    .on("broadcast", { event: "appointment_changed" }, () => {
      onUpdate && onUpdate();
    })
    .subscribe();

  // Also listen on global kmc-live-events channel
  const globalChannel = supabase
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
    supabase.removeChannel(globalChannel);
  };
};

// ─── 3. LIVE ONLINE PRESENCE ("Kon online hai") ──────────────────────────────

export const fetchSuperAdminOnlineRoster = async () => {
  await ensureAdminSession();
  try {
    // 1. Fetch doctors directly with valid columns (excluding non-existent updated_at)
    const { data: dbDoctors, error: docErr } = await supabase
      .from("doctors")
      .select("id, name, department, specialization, email, phone, active, verification_status, is_online, created_at")
      .order("name");

    if (docErr) console.warn("[SuperAdminService] fetchOnlineRoster doctors notice:", docErr.message);

    // 2. Fetch active calls to see who is on call right now
    const { data: activeCalls } = await supabase
      .from("calls")
      .select("id, doctor_id, doctor_user_id, patient_id, patient_user_id, status")
      .in("status", ["ringing", "in_progress", "active"]);

    const activeCallUserIds = new Set();
    (activeCalls || []).forEach((c) => {
      if (c.doctor_id) activeCallUserIds.add(c.doctor_id);
      if (c.doctor_user_id) activeCallUserIds.add(c.doctor_user_id);
      if (c.patient_id) activeCallUserIds.add(c.patient_id);
      if (c.patient_user_id) activeCallUserIds.add(c.patient_user_id);
    });

    // 3. Build Doctor Roster with true DB is_online status (online doctors first)
    const doctorRoster = (dbDoctors || [])
      .map((doc) => {
        const isCallActive = activeCallUserIds.has(doc.id);
        const isOnline = Boolean(doc.is_online);

        return {
          id: doc.id,
          name: doc.name,
          subtitle: doc.specialization || doc.department || "Consultant Specialist",
          email: doc.email || "",
          phone: doc.phone || "",
          role: "doctor",
          status: isCallActive ? "In Video Call" : isOnline ? "Online & Ready" : "Offline",
          isOnline: isOnline || isCallActive,
          isInCall: isCallActive,
        };
      })
      .sort((a, b) => {
        if (a.isOnline === b.isOnline) return a.name.localeCompare(b.name);
        return a.isOnline ? -1 : 1;
      });

    // 4. Fetch Hospital Admins (including the created root admin)
    const adminsRes = await fetchAllAdminsForSuperAdmin();
    const adminRoster = (adminsRes.admins || []).map((admin) => ({
      id: admin.id,
      name: admin.full_name || admin.name || "Hospital Admin",
      subtitle: admin.department || "Hospital Administration",
      email: admin.email || "",
      phone: admin.phone || "+91 8303666400",
      role: "admin",
      status: "Online & Managing",
      isOnline: true,
      isInCall: false,
    }));

    // 5. Fetch Registered Patients
    const patsRes = await fetchAllPatientsForSuperAdmin();
    const patientRoster = (patsRes.patients || []).map((p) => {
      const isCallActive = activeCallUserIds.has(p.id);
      return {
        id: p.id,
        name: p.full_name || p.name || "Patient",
        subtitle: p.blood_group ? `Blood: ${p.blood_group}` : "Registered Patient",
        email: p.email || "",
        phone: p.phone || "",
        role: "patient",
        status: isCallActive ? "In Consultation" : "Active Patient",
        isOnline: isCallActive || false,
        isInCall: isCallActive,
      };
    });

    const allUsers = [...adminRoster, ...patientRoster];
    const onlineDoctors = doctorRoster.filter((d) => d.isOnline);
    const onlineUsers = allUsers.filter((u) => u.isOnline);
    const totalOnline = onlineDoctors.length + onlineUsers.length;

    return {
      success: true,
      allDoctors: doctorRoster,
      allUsers,
      onlineDoctorsCount: onlineDoctors.length,
      onlineUsersCount: onlineUsers.length,
      totalOnline,
    };
  } catch (err) {
    console.warn("[SuperAdminService] fetchSuperAdminOnlineRoster error:", err.message);
    return {
      success: true,
      allDoctors: [],
      allUsers: [
        {
          id: ROOT_HOSPITAL_ADMIN.id,
          name: ROOT_HOSPITAL_ADMIN.full_name,
          subtitle: ROOT_HOSPITAL_ADMIN.department,
          email: ROOT_HOSPITAL_ADMIN.email,
          phone: ROOT_HOSPITAL_ADMIN.phone,
          role: "admin",
          status: "Online & Managing",
          isOnline: true,
          isInCall: false,
        },
      ],
      onlineDoctorsCount: 0,
      onlineUsersCount: 1,
      totalOnline: 1,
    };
  }
};

// ─── 4. DOCTORS MANAGEMENT (Full CRUD) ──────────────────────────────────────

export const fetchAllDoctorsForSuperAdmin = async () => {
  await ensureAdminSession();
  try {
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("[SuperAdminService] fetchAllDoctors error:", error.message);
      return { success: true, doctors: [] };
    }

    const formatted = (data || []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      department: doc.department,
      specialization: doc.specialization,
      qualification: doc.qualification || "MBBS",
      experience: doc.experience || "5+ Yrs",
      consultationFee: doc.consultation_fee || 800,
      email: doc.email || "",
      phone: doc.phone || "",
      clinicName: doc.clinic_name || "KMC Hospital, Jankipuram, Lucknow",
      bio: doc.bio || "",
      rating: String(doc.rating || 4.8),
      reviewsCount: doc.reviews_count || 120,
      active: doc.active !== false && doc.verification_status !== "suspended",
      verificationStatus: doc.verification_status || "verified",
      isOnline: Boolean(doc.is_online),
      is_online: Boolean(doc.is_online),
      created_at: doc.created_at,
    }));

    return { success: true, doctors: formatted };
  } catch (err) {
    return { success: false, error: err.message, doctors: [] };
  }
};

export const createDoctorBySuperAdmin = async ({
  name,
  department,
  specialization,
  email,
  phone,
  consultationFee = 800,
  experience = "5 years",
  about = "",
}) => {
  try {
    const cleanEmail = (email || "").trim().toLowerCase();
    const docId = "doc_" + Date.now();

    const docData = {
      id: docId,
      name: name.trim(),
      department: department.trim(),
      specialization: specialization ? specialization.trim() : department.trim(),
      qualification: "MBBS, Specialist",
      experience: experience || "5 years",
      consultation_fee: Number(consultationFee) || 800,
      bio: about || `Consultant Specialist in ${department}`,
      clinic_name: "KMC Hospital, Jankipuram, Lucknow",
      rating: 4.8,
      reviews_count: 50,
      email: cleanEmail,
      phone: phone ? phone.trim() : "",
      active: true,
      verification_status: "verified",
      invitation_status: "accepted",
      is_online: false,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("doctors")
      .insert([docData])
      .select()
      .single();

    if (error) throw error;

    return { success: true, doctor: data };
  } catch (err) {
    console.warn("[SuperAdminService] createDoctor error:", err.message);
    return { success: false, error: err.message };
  }
};

export const updateDoctorBySuperAdmin = async (doctorId, updates) => {
  try {
    // Exclude updated_at as it does not exist on doctors table
    const { updated_at, ...cleanUpdates } = updates;

    const { data, error } = await supabase
      .from("doctors")
      .update(cleanUpdates)
      .eq("id", doctorId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, doctor: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteDoctorBySuperAdmin = async (doctorId) => {
  try {
    const { error } = await supabase
      .from("doctors")
      .delete()
      .eq("id", doctorId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Super Admin 1-Click Toggle Doctor Online/Offline in Database
 */
export const toggleDoctorOnlineStatusBySuperAdmin = async (doctorId, currentStatus) => {
  try {
    const newStatus = !currentStatus;
    const { data, error } = await supabase
      .from("doctors")
      .update({ is_online: newStatus })
      .eq("id", doctorId)
      .select()
      .single();

    if (error) throw error;

    // Broadcast live event across all mobile clients
    try {
      const liveChannel = supabase.channel("kmc-live-events");
      await liveChannel.send({
        type: "broadcast",
        event: "doctor_online_changed",
        payload: { doctorId, isOnline: newStatus },
      });
    } catch (bcErr) {
      // non-fatal
    }

    return { success: true, is_online: newStatus, doctor: data };
  } catch (err) {
    console.warn("[SuperAdminService] toggleDoctorOnlineStatus error:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Super Admin Quick Live Meeting Creator for testing/demonstration
 */
export const createSampleMeetingBySuperAdmin = async () => {
  try {
    const meetId = "apt_live_" + Date.now();
    const token = "KMC-LIVE-" + Math.floor(1000 + Math.random() * 9000);
    const sampleApt = {
      id: meetId,
      tokenNumber: token,
      token_number: token,
      doctorId: "doc1",
      doctor_id: "doc1",
      doctorName: "Dr. Neeta Khare",
      doctor_name: "Dr. Neeta Khare",
      department: "Obstetrics & Gynaecology",
      patientId: "pat_sample_01",
      patient_id: "pat_sample_01",
      patientName: "Ayush Sharma",
      patient_name: "Ayush Sharma",
      patientPhone: "+91 9876543210",
      patient_phone: "+91 9876543210",
      patientEmail: "ayush.patient@gmail.com",
      patient_email: "ayush.patient@gmail.com",
      date: new Date().toISOString().split("T")[0],
      appointment_date: new Date().toISOString().split("T")[0],
      time: "11:00 AM",
      time_slot: "11:00 AM",
      appointment_time: "11:00 AM",
      type: "video",
      status: "confirmed",
      consultationFee: 800,
      totalAmount: 800,
      notes: "Telehealth consultation & maternal care follow-up",
      meeting_link: "https://meet.google.com/kmc-telehealth-doc1",
      createdAt: new Date().toISOString(),
    };

    // Save to local appointments cache
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_APPOINTMENTS);
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(sampleApt);
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_APPOINTMENTS, JSON.stringify(list));
    } catch (e) {}

    // Also attempt atomic DB insertion
    try {
      await supabase.rpc("confirm_appointment_atomic", {
        p_appointment: {
          id: meetId,
          token_number: token,
          patient_id: sampleApt.patientId,
          patient_name: sampleApt.patientName,
          patient_email: sampleApt.patientEmail,
          patient_phone: sampleApt.patientPhone,
          doctor_id: sampleApt.doctorId,
          doctor_name: sampleApt.doctorName,
          department: sampleApt.department,
          appointment_date: sampleApt.date,
          appointment_time: sampleApt.time,
          start_time: "11:00:00",
          end_time: "11:30:00",
          slot_key: `${sampleApt.doctorId}_${sampleApt.date}_11:00:00`,
          consultation_fee: 800,
          total_amount: 800,
          payment_status: "completed",
          payment_method: "online",
          status: "confirmed",
          type: "video",
          notes: sampleApt.notes,
          meeting_link: sampleApt.meeting_link,
        },
      });
    } catch (e) {}

    return { success: true, meeting: sampleApt };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

/**
 * Super Admin Schedule Meeting between registered Doctor and registered Patient
 * Updates database, patient appointments cache, and doctor appointments feed
 */
export const scheduleMeetingBySuperAdmin = async ({
  patient,
  doctor,
  date,
  time,
  type = "video",
  notes = "Scheduled Consultation",
}) => {
  await ensureAdminSession();
  try {
    const meetId = "apt_" + Date.now();
    const token = "KMC-2026-" + Math.floor(1000 + Math.random() * 9000);
    const isVideo = (type || "").toLowerCase().includes("video");
    const docFee = Number(doctor.consultation_fee || doctor.fee || 800);
    const meetingLink = isVideo
      ? `https://meet.google.com/kmc-${doctor.id || "doc"}-${Math.floor(1000 + Math.random() * 9000)}`
      : null;

    // Helper for 24-hour time calculation
    const timeMatch = (time || "10:00 AM").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    let h = 10, m = "00";
    if (timeMatch) {
      h = parseInt(timeMatch[1], 10);
      m = timeMatch[2];
      const mod = timeMatch[3] ? timeMatch[3].toUpperCase() : null;
      if (mod === "PM" && h < 12) h += 12;
      if (mod === "AM" && h === 12) h = 0;
    }
    const startTime24 = `${String(h).padStart(2, "0")}:${m}:00`;
    const endMinutes = (parseInt(m, 10) + 30) % 60;
    const endHours = h + Math.floor((parseInt(m, 10) + 30) / 60);
    const endTime24 = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}:00`;

    const docName = doctor.name?.startsWith("Dr.") ? doctor.name : `Dr. ${doctor.name || "Specialist"}`;
    const patName = patient.full_name || patient.name || "Registered Patient";
    const slotKey = `${doctor.id}_${date}_${startTime24}_${Date.now()}`;

    const appointmentRecord = {
      id: meetId,
      token_number: token,
      patient_id: patient.id || null,
      patient_name: patName,
      patient_email: patient.email || "",
      patient_phone: patient.phone || "",
      doctor_id: String(doctor.id),
      doctor_name: docName,
      doctor_email: doctor.email || "",
      doctor_specialty: doctor.specialization || doctor.department || "Medical Specialist",
      department: doctor.department || "General",
      appointment_date: date,
      appointment_time: time,
      start_time: startTime24,
      end_time: endTime24,
      slot_key: slotKey,
      consultation_fee: docFee,
      total_amount: docFee,
      payment_method: "cash",
      payment_status: "pending",
      status: "confirmed",
      type: isVideo ? "Video Consultation" : "Hospital Visit",
      video_consultation: isVideo,
      meeting_link: meetingLink,
      google_meet_link: meetingLink,
      hospital_address: "B-1/6 Sector G, Near Bhawna Complex, Sahara State Road, Jankipuram, Lucknow",
      contact_number: "+918303666400",
      notes: notes || "Scheduled Consultation",
      created_at: new Date().toISOString(),
    };

    // 1. Try atomic RPC first (safely bypasses RLS and sets columns)
    let rpcDone = false;
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("confirm_appointment_atomic", {
        p_appointment: appointmentRecord,
      });
      if (!rpcErr && rpcRes?.success) {
        rpcDone = true;
      } else if (rpcErr) {
        console.warn("[SuperAdminService] confirm_appointment_atomic note:", rpcErr.message);
      }
    } catch (e) {}

    // 2. Direct table insert fallback if RPC was not used
    if (!rpcDone) {
      const { error: dbErr } = await supabase
        .from("appointments")
        .insert(appointmentRecord);

      if (dbErr) {
        console.warn("[SuperAdminService] scheduleMeeting insert note:", dbErr.message);
        // Fallback without extra columns if column does not exist
        const cleanRecord = { ...appointmentRecord };
        delete cleanRecord.video_consultation;
        delete cleanRecord.google_meet_link;
        await supabase.from("appointments").insert(cleanRecord);
      }
    }

    // 3. Format for local patient appointments cache (@kmc_appointments)
    try {
      const stored = await AsyncStorage.getItem("@kmc_appointments");
      const localList = stored ? JSON.parse(stored) : [];
      const clientApt = {
        id: meetId,
        tokenNumber: token,
        patientId: appointmentRecord.patient_id,
        patientName: appointmentRecord.patient_name,
        patientEmail: appointmentRecord.patient_email,
        patientPhone: appointmentRecord.patient_phone,
        doctorId: appointmentRecord.doctor_id,
        doctorName: appointmentRecord.doctor_name,
        doctorEmail: appointmentRecord.doctor_email,
        doctorSpecialty: appointmentRecord.doctor_specialty,
        department: appointmentRecord.department,
        date: appointmentRecord.appointment_date,
        time: appointmentRecord.appointment_time,
        startTime: appointmentRecord.start_time,
        endTime: appointmentRecord.end_time,
        slotKey: appointmentRecord.slot_key,
        status: "Confirmed",
        dbStatus: "confirmed",
        type: appointmentRecord.type,
        videoConsultation: isVideo,
        fee: `₹${docFee}`,
        consultationFee: docFee,
        totalAmount: docFee,
        paymentMethod: "cash",
        paymentStatus: "pending",
        reason: notes,
        notes: notes,
        meetingLink: meetingLink,
        googleMeetLink: meetingLink,
        hospitalAddress: appointmentRecord.hospital_address,
        contactNumber: appointmentRecord.contact_number,
        bookedAt: appointmentRecord.created_at,
      };
      localList.unshift(clientApt);
      await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(localList));
    } catch (e) {}

    // 4. Save to local superadmin cache (@kmc_superadmin_appointments)
    try {
      const storedSa = await AsyncStorage.getItem(STORAGE_KEYS.LOCAL_APPOINTMENTS);
      const listSa = storedSa ? JSON.parse(storedSa) : [];
      listSa.unshift({
        id: meetId,
        tokenNumber: token,
        doctorId: appointmentRecord.doctor_id,
        doctorName: appointmentRecord.doctor_name,
        department: appointmentRecord.department,
        patientId: appointmentRecord.patient_id,
        patientName: appointmentRecord.patient_name,
        patientPhone: appointmentRecord.patient_phone,
        patientEmail: appointmentRecord.patient_email,
        date: appointmentRecord.appointment_date,
        time: appointmentRecord.appointment_time,
        type: isVideo ? "video" : "call",
        status: "confirmed",
        consultationFee: docFee,
        totalAmount: docFee,
        notes: notes,
        meeting_link: meetingLink,
        createdAt: appointmentRecord.created_at,
      });
      await AsyncStorage.setItem(STORAGE_KEYS.LOCAL_APPOINTMENTS, JSON.stringify(listSa));
    } catch (e) {}

    // 5. Broadcast real-time appointment event to all connected apps and panels
    try {
      const liveChannel = supabase.channel("kmc-live-events");
      liveChannel.send({
        type: "broadcast",
        event: "appointment_changed",
        payload: {
          id: meetId,
          doctorId: appointmentRecord.doctor_id,
          date: appointmentRecord.appointment_date,
          time: appointmentRecord.appointment_time,
          status: "confirmed",
        },
      });
    } catch (_) {}

    return { success: true, appointment: appointmentRecord };
  } catch (err) {
    console.warn("[SuperAdminService] scheduleMeeting error:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Real-time slot conflict checker for Super Admin Scheduler Modal
 */
export const fetchDoctorSlotStatuses = async (doctorId, date) => {
  if (!doctorId || !date) return {};
  await ensureAdminSession();

  const result = {};
  try {
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

    // 1. Query appointments table in Supabase
    const { data: bookedData, error } = await supabase
      .from("appointments")
      .select("appointment_time, start_time, status, patient_name, doctor_id, appointment_date")
      .eq("doctor_id", String(doctorId))
      .in("appointment_date", dateCandidates)
      .in("status", ["confirmed", "Confirmed", "pending", "Pending"]);

    if (!error && bookedData) {
      bookedData.forEach((row) => {
        const entry = {
          status: "booked",
          booked: true,
          patientName: row.patient_name,
        };
        const rawTime = row.appointment_time;
        const rawStart = row.start_time;
        const norm12 = formatTimeTo12h(rawTime || rawStart);

        if (rawTime) result[rawTime] = entry;
        if (rawStart) result[rawStart] = entry;
        if (norm12) result[norm12] = entry;
      });
    }

    // 2. Check local appointments storage (@kmc_appointments)
    try {
      const stored = await AsyncStorage.getItem("@kmc_appointments");
      if (stored) {
        const localList = JSON.parse(stored);
        if (Array.isArray(localList)) {
          localList.forEach((apt) => {
            const aptDocId = String(apt.doctorId || apt.doctor_id || "");
            const aptDate = String(apt.date || apt.appointment_date || "");
            const aptStatus = String(apt.dbStatus || apt.status || "").toLowerCase();
            const isMatchDoc = aptDocId === String(doctorId);
            const isMatchDate = dateCandidates.includes(aptDate);
            const isActive = aptStatus === "confirmed" || aptStatus === "pending";

            if (isMatchDoc && isMatchDate && isActive) {
              const rawTime = apt.time || apt.appointment_time;
              const rawStart = apt.startTime || apt.start_time;
              const norm12 = formatTimeTo12h(rawTime || rawStart);
              const entry = {
                status: "booked",
                booked: true,
                patientName: apt.patientName || apt.patient_name,
              };
              if (rawTime) result[rawTime] = entry;
              if (rawStart) result[rawStart] = entry;
              if (norm12) result[norm12] = entry;
            }
          });
        }
      }
    } catch (_) {}
  } catch (e) {
    console.warn("[SuperAdminService] fetchDoctorSlotStatuses error:", e.message);
  }

  return result;
};

// ─── 5. PATIENTS MANAGEMENT (Full Access) ───────────────────────────────────

export const fetchAllPatientsForSuperAdmin = async () => {
  await ensureAdminSession();
  try {
    // 1. Fetch from profiles table where role = 'patient'
    const { data: dbProfiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, name, email, phone, gender, blood_group, created_at, role")
      .eq("role", "patient")
      .order("created_at", { ascending: false });

    if (pErr) console.warn("[SuperAdminService] dbProfiles patient notice:", pErr.message);

    const patientMap = new Map();

    (dbProfiles || []).forEach((p) => {
      const key = (p.email || p.phone || p.id || "").toLowerCase();
      if (key) {
        patientMap.set(key, {
          id: p.id,
          full_name: p.full_name || p.name || "KMC Patient",
          name: p.name || p.full_name || "KMC Patient",
          email: p.email || "",
          phone: p.phone || "",
          gender: p.gender || "Not specified",
          blood_group: p.blood_group || "-",
          role: "patient",
          created_at: p.created_at || new Date().toISOString(),
          appointmentCount: 0,
        });
      }
    });

    // 2. Extract patient contacts and count appointments from DB
    try {
      const { data: apts } = await supabase
        .from("appointments")
        .select("id, patient_id, patient_name, patient_phone, patient_email, created_at");

      if (apts) {
        apts.forEach((a) => {
          const emailKey = (a.patient_email || "").toLowerCase().trim();
          const phoneKey = (a.patient_phone || "").trim();
          const idKey = a.patient_id;

          let targetKey = null;
          if (emailKey && patientMap.has(emailKey)) targetKey = emailKey;
          else if (phoneKey && patientMap.has(phoneKey)) targetKey = phoneKey;
          else if (idKey && patientMap.has(idKey)) targetKey = idKey;

          if (targetKey) {
            const existing = patientMap.get(targetKey);
            existing.appointmentCount = (existing.appointmentCount || 0) + 1;
            if (!existing.phone && a.patient_phone) existing.phone = a.patient_phone;
            if ((!existing.full_name || existing.full_name === "KMC Patient") && a.patient_name) {
              existing.full_name = a.patient_name;
              existing.name = a.patient_name;
            }
          } else if (a.patient_name || a.patient_phone || a.patient_email) {
            const newKey = emailKey || phoneKey || idKey || "pat_" + Math.random().toString(36).substring(2, 8);
            patientMap.set(newKey, {
              id: a.patient_id || newKey,
              full_name: a.patient_name || "Patient",
              name: a.patient_name || "Patient",
              phone: a.patient_phone || "",
              email: a.patient_email || "",
              gender: "Not specified",
              blood_group: "-",
              role: "patient",
              created_at: a.created_at || new Date().toISOString(),
              appointmentCount: 1,
            });
          }
        });
      }
    } catch (e) {}

    // 3. Merge local patients if any
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
      if (stored) {
        const localPatients = JSON.parse(stored) || [];
        localPatients.forEach((p) => {
          const key = (p.email || p.phone || p.id || "").toLowerCase();
          if (key && !patientMap.has(key)) {
            patientMap.set(key, { ...p, appointmentCount: p.appointmentCount || 0 });
          }
        });
      }
    } catch (e) {}

    const patients = Array.from(patientMap.values());
    return { success: true, patients };
  } catch (err) {
    console.warn("[SuperAdminService] fetchAllPatients error:", err.message);
    return { success: true, patients: [] };
  }
};

export const createPatientBySuperAdmin = async ({
  name,
  email = "",
  phone = "",
  gender = "Not specified",
  bloodGroup = "-",
  age = "",
  medicalNotes = "",
}) => {
  try {
    const patientId = "pat_" + Date.now();
    const newPatient = {
      id: patientId,
      full_name: name.trim(),
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : "",
      phone: phone ? phone.trim() : "",
      gender,
      blood_group: bloodGroup,
      role: "patient",
      created_at: new Date().toISOString(),
    };

    // Save to local storage for instant access
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
      const list = stored ? JSON.parse(stored) : [];
      list.unshift(newPatient);
      await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(list));
    } catch (e) {
      // ignore
    }

    // Try saving to Supabase profiles
    try {
      await supabase.from("profiles").upsert(newPatient, { onConflict: "id" });
    } catch (e) {
      // ignore
    }

    return { success: true, patient: newPatient };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deletePatientBySuperAdmin = async (patientId) => {
  try {
    // Remove from local storage
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PATIENTS);
      if (stored) {
        const list = JSON.parse(stored);
        const filtered = list.filter((p) => p.id !== patientId);
        await AsyncStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(filtered));
      }
    } catch (e) {
      // ignore
    }

    // Remove from DB
    await supabase.from("profiles").delete().eq("id", patientId);

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── 6. HOSPITAL ADMINS MANAGEMENT (Full Access & Revocation) ────────────────────────────

export const getRevokedAdmins = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.REVOKED_ADMINS);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
};

export const revokeAdminAccessBySuperAdmin = async (adminEmailOrId) => {
  try {
    const cleanKey = (adminEmailOrId || "").trim().toLowerCase();
    const revoked = await getRevokedAdmins();
    if (!revoked.includes(cleanKey)) {
      revoked.push(cleanKey);
      await AsyncStorage.setItem(STORAGE_KEYS.REVOKED_ADMINS, JSON.stringify(revoked));
    }

    // Update in local admin store
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS);
      if (stored) {
        const list = JSON.parse(stored);
        const updated = list.map((a) => {
          if (a.email?.toLowerCase() === cleanKey || a.id === adminEmailOrId) {
            return { ...a, status: "revoked" };
          }
          return a;
        });
        await AsyncStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(updated));
      }
    } catch (_) {}

    // Update in Supabase profiles (deactivate admin privileges)
    try {
      await supabase
        .from("profiles")
        .update({ role: "patient", updated_at: new Date().toISOString() })
        .eq("email", cleanKey);
    } catch (_) {}

    return { success: true, message: `Access revoked for ${cleanKey}.` };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const restoreAdminAccessBySuperAdmin = async (adminEmailOrId) => {
  try {
    const cleanKey = (adminEmailOrId || "").trim().toLowerCase();
    const revoked = await getRevokedAdmins();
    const updatedRevoked = revoked.filter((e) => e !== cleanKey);
    await AsyncStorage.setItem(STORAGE_KEYS.REVOKED_ADMINS, JSON.stringify(updatedRevoked));

    // Update in local admin store
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS);
      if (stored) {
        const list = JSON.parse(stored);
        const updated = list.map((a) => {
          if (a.email?.toLowerCase() === cleanKey || a.id === adminEmailOrId) {
            return { ...a, status: "active" };
          }
          return a;
        });
        await AsyncStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(updated));
      }
    } catch (_) {}

    // Update in Supabase profiles (restore admin role)
    try {
      await supabase
        .from("profiles")
        .update({ role: "admin", updated_at: new Date().toISOString() })
        .eq("email", cleanKey);
    } catch (_) {}

    return { success: true, message: `Admin privileges restored for ${cleanKey}.` };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const fetchAllAdminsForSuperAdmin = async () => {
  await ensureAdminSession();
  try {
    const revokedList = await getRevokedAdmins();
    const adminMap = new Map();

    // 1. Root administrator
    const isRootRevoked = revokedList.includes(ROOT_HOSPITAL_ADMIN.email.toLowerCase());
    adminMap.set(ROOT_HOSPITAL_ADMIN.email.toLowerCase(), {
      ...ROOT_HOSPITAL_ADMIN,
      status: isRootRevoked ? "revoked" : "active",
    });

    // 2. Fetch any admins from Supabase profiles table
    try {
      const { data: dbAdmins, error: aErr } = await supabase
        .from("profiles")
        .select("id, full_name, name, email, phone, role, created_at, updated_at")
        .eq("role", "admin");

      if (aErr) console.warn("[SuperAdminService] dbAdmins error:", aErr.message);

      (dbAdmins || []).forEach((a) => {
        if (a && a.email) {
          const em = a.email.toLowerCase();
          const isTechX = em === "techxitservices65@gmail.com";
          const isRevoked = revokedList.includes(em);
          adminMap.set(em, {
            id: a.id,
            full_name: isTechX ? "Tech X Hospital Admin" : (a.full_name || a.name || "Hospital Admin"),
            name: isTechX ? "Tech X Hospital Admin" : (a.name || a.full_name || "Hospital Admin"),
            email: a.email,
            phone: a.phone || (isTechX ? "+91 8303666400" : ""),
            department: "Hospital Administration & IT Operations",
            role: "admin",
            status: isRevoked ? "revoked" : "active",
            created_at: a.created_at || new Date().toISOString(),
          });
        }
      });
    } catch (e) {
      console.warn("[SuperAdminService] dbAdmins error:", e.message);
    }

    // 3. Merge locally created admins from AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS);
      if (stored) {
        const localList = JSON.parse(stored);
        if (Array.isArray(localList)) {
          localList.forEach((a) => {
            if (a && a.email) {
              const em = a.email.toLowerCase();
              const isRevoked = revokedList.includes(em) || a.status === "revoked";
              adminMap.set(em, {
                ...a,
                status: isRevoked ? "revoked" : "active",
              });
            }
          });
        }
      }
    } catch (e) {}

    const admins = Array.from(adminMap.values());
    return { success: true, admins };
  } catch (err) {
    console.warn("[SuperAdminService] fetchAllAdmins error:", err.message);
    return { success: true, admins: [ROOT_HOSPITAL_ADMIN] };
  }
};

export const createAdminBySuperAdmin = async ({
  fullName,
  email,
  password,
  phone = "",
  department = "Hospital Administration",
}) => {
  try {
    const cleanEmail = (email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: "Email address is required." };
    }
    if (!password || password.trim().length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    const adminId = "admin_" + Date.now();
    const cleanPassword = password.trim();

    const newAdmin = {
      id: adminId,
      full_name: fullName.trim(),
      name: fullName.trim(),
      email: cleanEmail,
      password: cleanPassword,
      phone: phone ? phone.trim() : "+91 8303666400",
      department: department || "Hospital Administration",
      role: "admin",
      status: "active",
      created_at: new Date().toISOString(),
    };

    // Un-revoke if it was previously revoked
    try {
      const revoked = await getRevokedAdmins();
      const filteredRevoked = revoked.filter((e) => e !== cleanEmail);
      await AsyncStorage.setItem(STORAGE_KEYS.REVOKED_ADMINS, JSON.stringify(filteredRevoked));
    } catch (_) {}

    // 1. Save to local storage for reliable persistence & credential check
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS);
      const list = stored ? JSON.parse(stored) : [];
      const filtered = list.filter((a) => a.email?.toLowerCase() !== cleanEmail);
      filtered.unshift(newAdmin);
      await AsyncStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(filtered));
    } catch (e) {
      console.warn("[SuperAdminService] local admin save error:", e.message);
    }

    // 2. Save to Supabase profiles
    try {
      await supabase.from("profiles").upsert(
        {
          id: adminId,
          full_name: fullName.trim(),
          name: fullName.trim(),
          email: cleanEmail,
          phone: phone ? phone.trim() : "",
          role: "admin",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    } catch (e) {}

    // 3. Attempt to register in Supabase Auth in background
    try {
      await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: fullName.trim(),
            name: fullName.trim(),
            role: "admin",
          },
        },
      });
    } catch (_) {}

    return { success: true, admin: newAdmin };
  } catch (err) {
    console.warn("[SuperAdminService] createAdmin error:", err.message);
    return { success: false, error: err.message };
  }
};

export const deleteAdminBySuperAdmin = async (adminId, adminEmail = null) => {
  try {
    const cleanEmail = (adminEmail || "").trim().toLowerCase();

    // If deleting or revoking techxitservices65@gmail.com, revoke its access
    if (adminId === ROOT_HOSPITAL_ADMIN.id || cleanEmail === ROOT_HOSPITAL_ADMIN.email) {
      await revokeAdminAccessBySuperAdmin(ROOT_HOSPITAL_ADMIN.email);
      return { success: true, message: "Root administrator privileges have been revoked." };
    }

    // Remove from local storage
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.ADMINS);
      if (stored) {
        const list = JSON.parse(stored);
        const filtered = list.filter((a) => a.id !== adminId && a.email?.toLowerCase() !== cleanEmail);
        await AsyncStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(filtered));
      }
    } catch (e) {}

    // Remove from Supabase
    try {
      if (adminId && !adminId.startsWith("admin_")) {
        await supabase.from("profiles").delete().eq("id", adminId);
      } else if (cleanEmail) {
        await supabase.from("profiles").delete().eq("email", cleanEmail);
      }
    } catch (e) {}

    // Also mark as revoked
    if (cleanEmail) {
      await revokeAdminAccessBySuperAdmin(cleanEmail);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

// ─── 7. EMERGENCY BROADCAST & SYSTEM CONTROL ────────────────────────────────

export const broadcastHospitalAnnouncement = async ({ title, message, priority = "high" }) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          title: title.trim(),
          body: message.trim(),
          type: "hospital_announcement",
          priority,
          is_broadcast: true,
          created_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) console.warn("[SuperAdminService] Broadcast notifications table notice:", error.message);

    // Also broadcast live socket event
    try {
      const liveChannel = supabase.channel("kmc-live-events");
      await liveChannel.send({
        type: "broadcast",
        event: "emergency_broadcast",
        payload: { title, message, priority, timestamp: new Date().toISOString() },
      });
    } catch (bcErr) {
      // non-fatal
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
