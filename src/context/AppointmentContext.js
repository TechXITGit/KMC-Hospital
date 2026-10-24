import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  fetchAppointmentsFromSupabase,
  saveAppointmentToSupabase,
  updateAppointmentStatusInSupabase,
  fetchSlotStatuses,
  holdSlotInSupabase,
  releaseSlotHoldInSupabase,
  subscribeToRealtimeSlots,
  generateMeetingDetails,
  buildSlotKey,
  fetchDoctorsFromDb,
  setDoctorOnlineStatusInDb,
  fetchDoctorAppointments,
  parseFeeAmount,
} from "../services/supabaseService";
import { supabase } from "../utils/supabase";
import { useAuth } from "./AuthContext";

const AppointmentContext = createContext(null);

export const AppointmentProvider = ({ children }) => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeTrigger, setRealtimeTrigger] = useState(0);

  // Load doctors from Supabase / constants
  const loadDoctors = async () => {
    try {
      const docList = await fetchDoctorsFromDb();
      if (docList && Array.isArray(docList) && docList.length > 0) {
        setDoctors(docList);
      }
    } catch (e) {
      console.warn("[AppointmentContext] loadDoctors error:", e.message);
    }
  };

  // Load appointments from LocalStorage & Supabase (no hardcoded demo data)
  const loadAppointments = async (userIdOrEmail) => {
    try {
      const targetUser = userIdOrEmail || user?.id || user?.email;
      const stored = await AsyncStorage.getItem("@kmc_appointments");
      
      let initialList = [];
      if (stored) {
        // Clean out any legacy demo or hardcoded appointments
        const parsed = JSON.parse(stored);
        initialList = (parsed || []).filter(
          (apt) =>
            apt &&
            apt.id !== "apt_101" &&
            apt.id !== "apt_100" &&
            !apt.id?.startsWith("demo_") &&
            apt.tokenNumber !== "KMC-2026-1042" &&
            apt.tokenNumber !== "KMC-2026-0984"
        );
        // If user is logged in, filter only this user's appointments
        if (targetUser) {
          initialList = initialList.filter(
            (apt) => !apt.patientId || apt.patientId === targetUser || apt.patientEmail === targetUser
          );
        }
        setAppointments(initialList);
        await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(initialList));
      } else {
        setAppointments([]);
      }

      // Sync real appointments from Supabase DB
      const remoteApts = await fetchAppointmentsFromSupabase(targetUser);
      if (remoteApts && Array.isArray(remoteApts)) {
        const cleanedRemote = remoteApts.filter(
          (a) =>
            a.id !== "apt_101" &&
            a.id !== "apt_100" &&
            !a.id?.startsWith("demo_") &&
            a.tokenNumber !== "KMC-2026-1042" &&
            a.tokenNumber !== "KMC-2026-0984"
        );

        setAppointments((prev) => {
          const map = new Map();
          prev.forEach((a) => map.set(a.id, a));
          cleanedRemote.forEach((a) => map.set(a.id, a));
          const merged = Array.from(map.values());
          AsyncStorage.setItem("@kmc_appointments", JSON.stringify(merged));
          return merged;
        });
      }
    } catch (e) {
      console.warn("[AppointmentContext] Load error:", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
    loadAppointments(user?.id || user?.email);

    // Subscribe to real-time slot holds and appointment bookings
    const unsubscribe = subscribeToRealtimeSlots(() => {
      console.log("[AppointmentContext] Realtime slot event detected! Refreshing state...");
      setRealtimeTrigger((prev) => prev + 1);
      loadAppointments(user?.id || user?.email);
    });

    // Subscribe to real-time changes on public.doctors table
    let docChannel = null;
    try {
      if (supabase && typeof supabase.channel === "function") {
        docChannel = supabase
          .channel("public:doctors:realtime")
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "doctors" },
            (payload) => {
              console.log("[AppointmentContext] Doctors table change detected!", payload.eventType);
              loadDoctors();
            }
          )
          .on(
            "broadcast",
            { event: "doctor_online_changed" },
            ({ payload }) => {
              if (payload?.doctorId) {
                console.log("[AppointmentContext] Live doctor_online_changed broadcast:", payload);
                const isOnlineVal = Boolean(payload.isOnline);
                setDoctors((prev) =>
                  prev.map((d) =>
                    d.id === payload.doctorId
                      ? { ...d, isOnline: isOnlineVal, is_online: isOnlineVal }
                      : d
                  )
                );
              }
              loadDoctors();
            }
          )
          .subscribe();
      }
    } catch (e) {
      console.warn("[AppointmentContext] Doctors realtime error:", e.message);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (docChannel && typeof docChannel.unsubscribe === "function") {
        docChannel.unsubscribe();
      }
    };
  }, [user?.id, user?.email]);

  /**
   * Hold a time slot for 5 minutes to prevent simultaneous booking
   */
  const holdSlot = async ({ doctor, date, time, user: bookingUser, durationMinutes = 5 }) => {
    const doctorId = doctor?.id || "doc_1";
    const res = await holdSlotInSupabase({
      doctorId,
      date,
      time,
      userId: bookingUser?.id || user?.id || user?.email || "guest",
      userName: bookingUser?.fullName || user?.user_metadata?.full_name || "Patient",
      durationMinutes,
    });
    setRealtimeTrigger((prev) => prev + 1);
    return res;
  };

  /**
   * Release hold if user cancels or selects a different slot
   */
  const releaseSlot = async ({ doctor, date, time, user: bookingUser }) => {
    const doctorId = doctor?.id || "doc_1";
    await releaseSlotHoldInSupabase({
      doctorId,
      date,
      time,
      userId: bookingUser?.id || user?.id || user?.email || "guest",
    });
    setRealtimeTrigger((prev) => prev + 1);
  };

  /**
   * Fetch current slot availability for a doctor & date (available, held, booked)
   */
  const getSlotStatuses = async (doctorId, date) => {
    return await fetchSlotStatuses(doctorId, date);
  };

  /**
   * Confirm and book the appointment in Supabase with Google Meet scheduling
   */
  const bookAppointment = async (details, bookingUser) => {
    const activeUser = bookingUser || user;
    const randomToken = `KMC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const docName = details.doctor?.name || "Specialist Doctor";
    const deptName = details.department || details.doctor?.department || "General";
    const numericFee = parseFeeAmount(details.fee || details.doctor?.fee || 800);

    const isVideo = (details.type || "Hospital Visit") === "Video Consultation";
    let meetingLink = null;
    let calendarLink = null;

    // Generate Google Meet / Jitsi Video Room & Google Calendar invite ONLY for video consultation
    if (isVideo) {
      const meetDetails = generateMeetingDetails({
        tokenNumber: randomToken,
        doctorName: docName,
        department: deptName,
        date: details.date || "Today",
        time: details.time || "10:00 AM",
        patientName: details.patientName || activeUser?.fullName || "Self",
      });
      meetingLink = meetDetails.meetingLink;
      calendarLink = meetDetails.calendarLink;
    }

    const newAppointment = {
      id: `apt_${Date.now()}`,
      tokenNumber: randomToken,
      patientId: activeUser?.id || null,
      patientName: details.patientName || activeUser?.fullName || "Self",
      patientEmail: details.patientEmail || activeUser?.email || "",
      patientPhone: details.patientPhone || activeUser?.mobileNumber || "",
      doctorId: details.doctor?.id || "doc_1",
      doctorName: docName,
      doctorEmail: details.doctor?.email || "",
      doctorSpecialty: details.doctor?.specialty || details.doctor?.specialization || "Medical Specialist",
      department: deptName,
      date: details.date || "Today",
      time: details.time || "10:00 AM",
      day: details.day || new Date().getDate().toString(),
      month: details.month || "Sep",
      status: "Confirmed",
      dbStatus: "confirmed",
      type: details.type || "Hospital Visit",
      videoConsultation: isVideo,
      video_consultation: isVideo,
      fee: `₹${numericFee}`,
      consultationFee: numericFee,
      totalAmount: numericFee,
      paymentMethod: details.paymentMethod || "cash",
      paymentStatus: details.paymentStatus || "pending",
      paymentId: details.paymentId || null,
      reason: details.reason || details.notes || "",
      meetingLink: isVideo ? meetingLink : null,
      googleMeetLink: isVideo ? meetingLink : null,
      calendarLink: isVideo ? calendarLink : null,
      hospitalAddress: "B-1/6 Sector G, Near Bhawna Complex, Sahara State Road, Jankipuram, Lucknow",
      contactNumber: "+918303666400",
      notes: details.notes || details.reason || "General Consultation",
      bookedAt: new Date().toISOString(),
    };

    const slotKey = buildSlotKey(newAppointment.doctorId, newAppointment.date, newAppointment.time);
    newAppointment.slotKey = slotKey;

    // Save to Supabase DB (with atomic FCFS validation & Google Sheets sync trigger)
    await saveAppointmentToSupabase(newAppointment);

    const updated = [newAppointment, ...appointments];
    setAppointments(updated);
    await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(updated));

    // Release temporary hold now that appointment is confirmed
    releaseSlotHoldInSupabase({
      doctorId: newAppointment.doctorId,
      date: newAppointment.date,
      time: newAppointment.time,
      userId: activeUser?.id,
    }).catch(() => {});

    setRealtimeTrigger((prev) => prev + 1);
    return newAppointment;
  };

  /**
   * Cancel an existing appointment
   */
  const cancelAppointment = async (id) => {
    const updated = appointments.map((apt) =>
      apt.id === id ? { ...apt, status: "Cancelled", dbStatus: "cancelled" } : apt
    );
    setAppointments(updated);
    await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(updated));

    // Update in Supabase (triggers Google Sheets sync)
    await updateAppointmentStatusInSupabase(id, "cancelled").catch((err) => {
      console.warn("[Appointment] Supabase cancel update error:", err.message);
    });

    setRealtimeTrigger((prev) => prev + 1);
  };

  /**
   * Doctor Action: Confirm an appointment
   */
  const confirmAppointmentByDoctor = async (id) => {
    const updated = appointments.map((apt) =>
      apt.id === id ? { ...apt, status: "Confirmed", dbStatus: "confirmed" } : apt
    );
    setAppointments(updated);
    await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(updated));

    await updateAppointmentStatusInSupabase(id, "confirmed");
    setRealtimeTrigger((prev) => prev + 1);
  };

  /**
   * Doctor Action: Mark appointment completed
   */
  const completeAppointmentByDoctor = async (id) => {
    const updated = appointments.map((apt) =>
      apt.id === id ? { ...apt, status: "Completed", dbStatus: "completed" } : apt
    );
    setAppointments(updated);
    await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(updated));

    await updateAppointmentStatusInSupabase(id, "completed");
    setRealtimeTrigger((prev) => prev + 1);
  };

  /**
   * Doctor Action: Reject / Cancel appointment
   */
  const rejectAppointmentByDoctor = async (id) => {
    await cancelAppointment(id);
  };

  /**
   * Fetch appointments for Doctor Dashboard
   */
  const getDoctorAppointmentsList = async (doctorId) => {
    return await fetchDoctorAppointments(doctorId);
  };

  /**
   * Reschedule appointment
   */
  const rescheduleAppointment = async (id, newDate, newTime) => {
    const updated = appointments.map((apt) =>
      apt.id === id
        ? {
            ...apt,
            date: newDate,
            time: newTime,
            status: "Confirmed",
            dbStatus: "confirmed",
          }
        : apt
    );
    setAppointments(updated);
    await AsyncStorage.setItem("@kmc_appointments", JSON.stringify(updated));
    setRealtimeTrigger((prev) => prev + 1);
  };

  const getAppointmentById = (id) => {
    return appointments.find((a) => a.id === id);
  };

  const updateDoctorProfile = async (doctorId, updateFields) => {
    try {
      const { data, error } = await supabase
        .from("doctors")
        .update(updateFields)
        .eq("id", doctorId)
        .select()
        .single();

      if (error) throw error;

      await loadDoctors();
      return { success: true, doctor: data };
    } catch (err) {
      console.warn("[AppointmentContext] updateDoctorProfile error:", err.message);
      throw err;
    }
  };

  const setDoctorOnlineStatus = async (doctorId, isOnline) => {
    try {
      const boolVal = Boolean(isOnline);
      // Optimistically update local state for instant UI reaction
      setDoctors((prev) =>
        prev.map((d) => (d.id === doctorId ? { ...d, isOnline: boolVal, is_online: boolVal } : d))
      );

      const res = await setDoctorOnlineStatusInDb(doctorId, boolVal);
      await loadDoctors();
      return res;
    } catch (err) {
      console.warn("[AppointmentContext] setDoctorOnlineStatus error:", err.message);
      await loadDoctors();
      throw err;
    }
  };

  return (
    <AppointmentContext.Provider
      value={{
        appointments,
        doctors,
        isLoading,
        realtimeTrigger,
        bookAppointment,
        cancelAppointment,
        confirmAppointmentByDoctor,
        completeAppointmentByDoctor,
        rejectAppointmentByDoctor,
        getDoctorAppointmentsList,
        rescheduleAppointment,
        getAppointmentById,
        holdSlot,
        releaseSlot,
        getSlotStatuses,
        loadAppointments,
        loadDoctors,
        updateDoctorProfile,
        setDoctorOnlineStatus,
      }}
    >
      {children}
    </AppointmentContext.Provider>
  );
};

export const useAppointments = () => {
  const ctx = useContext(AppointmentContext);
  if (!ctx) throw new Error("useAppointments must be used within AppointmentProvider");
  return ctx;
};
