import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useAppointments } from "../../context/AppointmentContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { DOCTORS } from "../../constants/data";
import { formatAppointmentRef } from "../../utils/appointmentFormatter";
import { isMeetExpired, compareMeetsByDate } from "../../utils/dateFormatter";
import { supabase } from "../../utils/supabase";
import { HOSPITAL_DEPARTMENTS } from "./AdminDashboardScreen";
import { doctorInitiateCall } from "../../services/callService";
import { requestCameraAndAudioPermissions } from "../../services/permissionService";

export default function DoctorDashboardScreen() {
  const navigation = useNavigation();
  const { language, t } = useLanguage();
  const {
    doctors,
    getDoctorAppointmentsList,
    confirmAppointmentByDoctor,
    completeAppointmentByDoctor,
    rejectAppointmentByDoctor,
    updateDoctorProfile,
    setDoctorOnlineStatus,
    realtimeTrigger,
  } = useAppointments();
  const { userRole, doctorRecord, isDoctor, isAdmin, isDoctorSuspended, logout, profile, refreshRole } = useAuth();

  const doctorList = doctors && doctors.length > 0 ? doctors : DOCTORS;

  // View state: "appointments" | "profile"
  const [activeView, setActiveView] = useState("appointments");

  // If logged in as Doctor, lock strictly to doctorRecord.id. If Admin, allow selecting "all" or specific doctor.
  const verifiedDoctorId = isDoctor ? (doctorRecord?.id || null) : null;
  const [selectedDoctorId, setSelectedDoctorId] = useState(verifiedDoctorId || "all");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "pending" | "confirmed" | "completed" | "cancelled"
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [callStartingId, setCallStartingId] = useState(null);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Target doctor & online state resolution
  const targetDocId = isDoctor ? doctorRecord?.id : (selectedDoctorId !== "all" ? selectedDoctorId : null);
  const currentDoctor = (doctors || []).find((d) => d.id === targetDocId) || (isDoctor ? doctorRecord : null);
  const isOnline = Boolean(currentDoctor?.isOnline || currentDoctor?.is_online);

  const handleToggleOnline = async (newValue) => {
    if (!targetDocId) {
      Alert.alert(
        language === "hi" ? "सूचना" : "Notice",
        language === "hi"
          ? "कृपया ऑनलाइन स्थिति बदलने के लिए एक डॉक्टर चुनें।"
          : "Please select a specific doctor to toggle availability."
      );
      return;
    }

    try {
      setToggleLoading(true);
      await setDoctorOnlineStatus(targetDocId, newValue);
      if (doctorRecord && doctorRecord.id === targetDocId) {
        doctorRecord.is_online = newValue;
        doctorRecord.isOnline = newValue;
      }
    } catch (err) {
      Alert.alert(
        language === "hi" ? "त्रुटि" : "Error",
        err.message ||
          (language === "hi"
            ? "ऑनलाइन स्थिति अपडेट करने में विफल"
            : "Failed to update online status")
      );
    } finally {
      setToggleLoading(false);
    }
  };

  // Doctor Profile Form State
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    department: "General Medicine",
    specialization: "",
    qualification: "",
    experience: "",
    consultationFee: "800",
    clinicName: "KMC Hospital, Jankipuram, Lucknow",
    about: "",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [deptPickerVisible, setDeptPickerVisible] = useState(false);

  // Sync profile form when doctorRecord or profile updates
  useEffect(() => {
    if (doctorRecord) {
      setProfileForm({
        name: doctorRecord.name || profile?.full_name || "",
        phone: doctorRecord.phone || profile?.phone || "",
        department: doctorRecord.department || "General Medicine",
        specialization: doctorRecord.specialization || doctorRecord.specialty || "",
        qualification: doctorRecord.qualification || "",
        experience: doctorRecord.experience || "",
        consultationFee: String(doctorRecord.consultation_fee || doctorRecord.consultationFee || doctorRecord.fee || "800").replace(/[^0-9]/g, ""),
        clinicName: doctorRecord.clinic_name || doctorRecord.clinicName || "KMC Hospital, Jankipuram, Lucknow",
        about: doctorRecord.bio || doctorRecord.about || "",
      });
    }
  }, [doctorRecord, profile]);

  // Sync selectedDoctorId if doctorRecord updates
  useEffect(() => {
    if (isDoctor && doctorRecord?.id) {
      setSelectedDoctorId(doctorRecord.id);
    }
  }, [isDoctor, doctorRecord]);

  const loadDoctorAppointments = async () => {
    try {
      // SECURITY: A doctor can ONLY ever fetch their own appointments, never another doctor's.
      const queryDoctorId = isDoctor ? (doctorRecord?.id || "unlinked") : selectedDoctorId;
      const data = await getDoctorAppointmentsList(queryDoctorId);
      setAppointments(data || []);
    } catch (err) {
      console.warn("[DoctorDashboard] Load error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadDoctorAppointments();
  }, [selectedDoctorId, realtimeTrigger, doctorRecord]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDoctorAppointments();
  };

  // Filter appointments and track by date chronologically
  const filteredAppointments = appointments
    .filter((apt) => {
      const s = (apt.dbStatus || apt.status || "").toLowerCase();
      const isExpired = s === "completed" || isMeetExpired(apt.date, apt.time, s);
      if (statusFilter === "all") return true;
      if (statusFilter === "completed") return isExpired;
      if (statusFilter === "confirmed") return s === "confirmed" && !isExpired;
      return s === statusFilter.toLowerCase();
    })
    .sort(compareMeetsByDate);

  // Calculate stats
  const stats = {
    total: appointments.length,
    pending: appointments.filter((a) => (a.dbStatus || a.status || "").toLowerCase() === "pending").length,
    confirmed: appointments.filter((a) => {
      const s = (a.dbStatus || a.status || "").toLowerCase();
      return s === "confirmed" && !isMeetExpired(a.date, a.time, s);
    }).length,
    completed: appointments.filter((a) => {
      const s = (a.dbStatus || a.status || "").toLowerCase();
      return s === "completed" || isMeetExpired(a.date, a.time, s);
    }).length,
    cancelled: appointments.filter((a) => (a.dbStatus || a.status || "").toLowerCase() === "cancelled").length,
    totalRevenue: appointments
      .filter((a) => (a.dbStatus || a.status || "").toLowerCase() !== "cancelled")
      .reduce((sum, a) => sum + (Number(a.totalAmount) || Number(a.consultationFee) || 800), 0),
  };

  // Doctor Actions
  const handleConfirm = async (item) => {
    try {
      setActionLoadingId(item.id);
      await confirmAppointmentByDoctor(item.id);
      Alert.alert("Success", `Consultation ${formatAppointmentRef(item.tokenNumber, item.type)} has been confirmed & synced with Google Sheets.`);
      loadDoctorAppointments();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to confirm appointment");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleComplete = async (item) => {
    try {
      setActionLoadingId(item.id);
      await completeAppointmentByDoctor(item.id);
      Alert.alert("Completed", `Consultation ${formatAppointmentRef(item.tokenNumber, item.type)} marked as Completed & Google Sheets updated.`);
      loadDoctorAppointments();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to complete appointment");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = (item) => {
    Alert.alert(
      "Cancel Appointment",
      `Are you sure you want to cancel consultation ${formatAppointmentRef(item.tokenNumber, item.type)} for ${item.patientName}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoadingId(item.id);
              await rejectAppointmentByDoctor(item.id);
              Alert.alert("Cancelled", "Appointment marked as Cancelled & synced to Sheets.");
              loadDoctorAppointments();
            } catch (e) {
              Alert.alert("Error", e.message || "Failed to cancel appointment");
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleStartCall = async (item, callType = "video") => {
    try {
      setCallStartingId(`${item.id}_${callType}`);
      const res = await doctorInitiateCall({
        appointmentId: item.id,
        callType,
      });

      if (!res.success) {
        Alert.alert("Call Initiation Failed", res.error || "Could not initiate call. Please try again.");
        return;
      }

      try {
        const permResult = await requestCameraAndAudioPermissions({ video: callType === "video", audio: true });
        if (!permResult.granted) {
          Alert.alert(
            "Permission Required",
            "Camera and Microphone access is required for video calls. Please allow access and try again.",
            [{ text: "OK" }]
          );
          return;
        }
      } catch (e) {
        console.warn("[DoctorDashboard] Permission request error:", e);
      }

      navigation.navigate("CallScreen", {
        callId: res.call.id,
        appointmentId: item.id,
        callType,
        role: "doctor",
        otherUserName: item.patientName || "Patient",
      });
    } catch (err) {
      Alert.alert("Error", err.message || "Failed to start call");
    } finally {
      setCallStartingId(null);
    }
  };

  const handleConfirmLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of the Doctor Portal?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: logout },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      Alert.alert("Validation", "Doctor name cannot be empty.");
      return;
    }
    if (!profileForm.department.trim()) {
      Alert.alert("Validation", "Please select a clinical department.");
      return;
    }

    try {
      setProfileSaving(true);
      const targetDocId = isDoctor ? doctorRecord?.id : (selectedDoctorId !== "all" ? selectedDoctorId : null);
      if (!targetDocId) {
        throw new Error("No linked doctor profile found to update.");
      }

      // Update public.doctors table via context
      const updateData = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        department: profileForm.department.trim(),
        specialization: profileForm.specialization.trim(),
        qualification: profileForm.qualification.trim(),
        experience: profileForm.experience.trim(),
        clinic_name: profileForm.clinicName.trim(),
        bio: profileForm.about.trim(),
      };

      const res = await updateDoctorProfile(targetDocId, updateData);
      if (!res.success) {
        throw new Error(res.error || "Failed to update doctor profile");
      }

      // If doctor is logged in, sync their profiles row full_name & phone
      if (profile?.id && isDoctor) {
        await supabase
          .from("profiles")
          .update({
            full_name: profileForm.name.trim(),
            phone: profileForm.phone.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
      }

      // Refresh auth role/record
      if (refreshRole) {
        await refreshRole();
      }

      Alert.alert(
        "Profile Updated",
        "Your doctor profile has been updated successfully! Changes are live across patient search and appointment booking.",
        [{ text: "OK" }]
      );
    } catch (err) {
      Alert.alert("Update Error", err.message || "Failed to save doctor profile.");
    } finally {
      setProfileSaving(false);
    }
  };

  const renderAppointmentItem = ({ item }) => {
    const rawStatus = (item.dbStatus || item.status || "confirmed").toLowerCase();
    const isExpired = rawStatus === "completed" || isMeetExpired(item.date, item.time, rawStatus);
    const isPending = rawStatus === "pending" && !isExpired;
    const isConfirmed = rawStatus === "confirmed" && !isExpired;
    const isCompleted = isExpired;
    const isCancelled = rawStatus === "cancelled";
    const isActionLoading = actionLoadingId === item.id;

    return (
      <View style={styles.card}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={[
                  styles.refPill,
                  item.type?.toLowerCase().includes("video") ? styles.refPillVideo : styles.refPillOpd,
                ]}
              >
                <Text
                  style={[
                    styles.refPillText,
                    item.type?.toLowerCase().includes("video") ? styles.refPillVideoText : styles.refPillOpdText,
                  ]}
                >
                  {formatAppointmentRef(item.tokenNumber, item.type)}
                </Text>
              </View>
              <Text style={styles.typeBadgeText}>
                {item.type?.toLowerCase().includes("video") ? "Online Video" : "Hospital OPD"}
              </Text>
            </View>
            <Text style={styles.doctorSubText}>Assigned: {item.doctorName}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              isPending && styles.badgePending,
              isConfirmed && styles.badgeConfirmed,
              isCompleted && styles.badgeCompleted,
              isCancelled && styles.badgeCancelled,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isPending && styles.textPending,
                isConfirmed && styles.textConfirmed,
                isCompleted && styles.textCompleted,
                isCancelled && styles.textCancelled,
              ]}
            >
              {isExpired ? "EXPIRED MEET" : rawStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Patient & Booking Details */}
        <View style={styles.detailRow}>
          <Ionicons name="person-circle" size={18} color={COLORS.primary} />
          <Text style={styles.detailTextBold}>{item.patientName || "Patient"}</Text>
          {item.patientPhone ? (
            <TouchableOpacity
              style={styles.callPatientBtn}
              onPress={() => Linking.openURL(`tel:${item.patientPhone}`)}
            >
              <Ionicons name="call" size={12} color="#059669" />
              <Text style={styles.callPatientText}>+91 {item.patientPhone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {item.patientEmail ? (
          <View style={[styles.detailRow, { marginTop: 4 }]}>
            <Ionicons name="mail-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.detailText}>{item.patientEmail}</Text>
          </View>
        ) : null}

        <View style={[styles.detailRow, { marginTop: 6 }]}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.textLight} />
          <Text style={styles.detailText}>
            {item.date} at {item.time} ({item.type || "Hospital Visit"})
          </Text>
        </View>

        {/* Reason for visit */}
        {Boolean(item.reason) && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason:</Text>
            <Text style={styles.reasonText}>{item.reason}</Text>
          </View>
        )}

        {/* Fee & Payment Breakdown */}
        <View style={styles.feeStrip}>
          <View>
            <Text style={styles.feeStripLabel}>Consultation Fee</Text>
            <Text style={styles.feeStripValue}>{item.fee || `₹${item.consultationFee || 800}`}</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={styles.feeStripLabel}>Payment Method</Text>
            <Text style={styles.feeStripSub}>
              {item.paymentMethod === "online" ? "Online Payment" : "Hospital Desk"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.feeStripLabel}>Payment Status</Text>
            <Text
              style={[
                styles.feeStripStatus,
                item.paymentStatus === "paid" ? { color: COLORS.success } : { color: "#D97706" },
              ]}
            >
              {(item.paymentStatus || "pending").toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Telehealth Direct WebRTC Call Controls for Online Consultations */}
        {(item.type === "Video Consultation" || item.video_consultation || item.type?.toLowerCase().includes("video")) &&
          !isCancelled &&
          !isCompleted && (
            <View style={styles.telehealthBox}>
              <View style={styles.telehealthHeader}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Ionicons name="videocam" size={14} color="#15803D" style={{ marginRight: 5 }} />
                  <Text style={styles.telehealthTitle}>Direct WebRTC Telehealth Call</Text>
                </View>
                <Text style={styles.telehealthSubtitle}>Encrypted Line</Text>
              </View>

              <View style={styles.telehealthActions}>
                <TouchableOpacity
                  style={[styles.callBtn, styles.videoCallBtn]}
                  disabled={Boolean(callStartingId)}
                  onPress={() => handleStartCall(item, "video")}
                  activeOpacity={0.8}
                >
                  {callStartingId === `${item.id}_video` ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="videocam" size={15} color={COLORS.white} style={{ marginRight: 6 }} />
                      <Text style={styles.callBtnText}>Start Video Call</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.callBtn, styles.audioCallBtn]}
                  disabled={Boolean(callStartingId)}
                  onPress={() => handleStartCall(item, "audio")}
                  activeOpacity={0.8}
                >
                  {callStartingId === `${item.id}_audio` ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="call" size={14} color={COLORS.white} style={{ marginRight: 6 }} />
                      <Text style={styles.callBtnText}>Audio Call</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

        {/* Sync Indicator */}
        <View style={styles.syncRow}>
          <View style={styles.syncIndicator}>
            <Ionicons name="cloud-done" size={14} color="#059669" style={{ marginRight: 4 }} />
            <Text style={styles.syncNotice}>Verified Booking · Google Sheets Synced</Text>
          </View>

          {item.type === "Hospital Visit" ? (
            <View style={[styles.meetBtn, { backgroundColor: "#F1F5F9" }]}>
              <Ionicons name="business-outline" size={14} color="#475569" style={{ marginRight: 4 }} />
              <Text style={[styles.meetBtnText, { color: "#475569" }]}>In-Hospital OPD</Text>
            </View>
          ) : null}
        </View>

        {/* Action Controls for Doctor / Staff */}
        {!isCancelled && !isCompleted && (
          <View style={styles.actionsBar}>
            {isActionLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
            ) : (
              <>
                {isPending && (
                  <TouchableOpacity
                    style={[styles.btnAction, styles.btnConfirm]}
                    onPress={() => handleConfirm(item)}
                  >
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                    <Text style={styles.btnActionText}>Confirm</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.btnAction, styles.btnComplete]}
                  onPress={() => handleComplete(item)}
                >
                  <Ionicons name="checkmark-done-circle" size={16} color={COLORS.white} />
                  <Text style={styles.btnActionText}>Mark Complete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnAction, styles.btnReject]}
                  onPress={() => handleReject(item)}
                >
                  <Ionicons name="close-circle" size={16} color="#DC2626" />
                  <Text style={[styles.btnActionText, { color: "#DC2626" }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    );
  };

  // Security check: Deny access if user is patient
  if (!isDoctor && !isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="lock-closed" size={56} color={COLORS.danger} />
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 14 }}>Access Restricted</Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            This portal is strictly reserved for verified KMC Hospital doctors. You are currently signed in as a patient.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
            onPress={() => navigation.navigate("MainTabs")}
          >
            <Text style={{ color: COLORS.white, fontWeight: "700" }}>Go to Patient Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Security check: Lockout unlinked doctor account
  if (isDoctor && (!doctorRecord || !doctorRecord.id || !doctorRecord.auth_user_id)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="link-outline" size={56} color="#D97706" />
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 14 }}>
            Doctor Account Not Linked
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            Your login account has not been linked to an active hospital doctor record. Please request the KMC Hospital Administrator to link your profile.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: "#FEF3C7", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
            onPress={handleConfirmLogout}
          >
            <Text style={{ color: "#B45309", fontWeight: "700" }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Security check: Lockout unverified doctor
  if (isDoctor && doctorRecord.verification_status !== "verified") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="time-outline" size={56} color="#2563EB" />
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 14 }}>
            Verification Pending
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            Your doctor credentials are currently pending review and verification by KMC Hospital Administration.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: "#DBEAFE", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
            onPress={handleConfirmLogout}
          >
            <Text style={{ color: "#1D4ED8", fontWeight: "700" }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Security check: Lockout suspended doctor
  if (isDoctor && (isDoctorSuspended || doctorRecord.active === false || doctorRecord.verification_status === "suspended")) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="pause-circle" size={56} color="#DC2626" />
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 14 }}>Doctor Account Suspended</Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            Your doctor account has been temporarily suspended by KMC Hospital Administration. You cannot access patient bookings or accept consultations. Please contact hospital administration at +91 8303666400.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: "#FEE2E2", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
            onPress={handleConfirmLogout}
          >
            <Text style={{ color: COLORS.danger, fontWeight: "700" }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (isAdmin ? navigation.navigate("AdminDashboard") : navigation.goBack())}
          >
            <Ionicons name={isAdmin ? "shield-checkmark" : "arrow-back"} size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isDoctor ? (doctorRecord?.name || "Dr. Consultation Portal") : "Doctor Appointments Feed"}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {isDoctor
                ? `${doctorRecord?.department || "Specialist"} · Verified KMC Doctor`
                : "Admin Hospital View · Real-time Sync"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          {isDoctor && (
            <TouchableOpacity style={[styles.refreshBtn, { backgroundColor: "#FEE2E2" }]} onPress={handleConfirmLogout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Doctor Online / Offline Availability Toggle Banner */}
      {Boolean(targetDocId) && (
        <View
          style={[
            styles.availabilityCard,
            isOnline ? styles.availabilityCardOnline : styles.availabilityCardOffline,
          ]}
        >
          <View style={styles.availabilityLeft}>
            <View
              style={[
                styles.statusDotIndicator,
                isOnline ? styles.statusDotOnline : styles.statusDotOffline,
              ]}
            >
              <View
                style={[
                  styles.statusDotInner,
                  isOnline ? styles.statusDotInnerOnline : styles.statusDotInnerOffline,
                ]}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={[
                    styles.availabilityTitle,
                    isOnline ? styles.availabilityTitleOnline : styles.availabilityTitleOffline,
                  ]}
                >
                  {isDoctor
                    ? isOnline
                      ? language === "hi"
                        ? "आप ऑनलाइन हैं (उपलब्ध)"
                        : "You are Online (Available)"
                      : language === "hi"
                      ? "आप ऑफलाइन हैं (अनुपलब्ध)"
                      : "You are Offline (Unavailable)"
                    : isOnline
                    ? language === "hi"
                      ? `${currentDoctor?.name || "डॉक्टर"} ऑनलाइन हैं`
                      : `${currentDoctor?.name || "Doctor"} is Online`
                    : language === "hi"
                    ? `${currentDoctor?.name || "डॉक्टर"} ऑफलाइन हैं`
                    : `${currentDoctor?.name || "Doctor"} is Offline`}
                </Text>
                <View
                  style={[
                    styles.statusTagPill,
                    isOnline ? styles.statusTagPillOnline : styles.statusTagPillOffline,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTagText,
                      isOnline ? styles.statusTagTextOnline : styles.statusTagTextOffline,
                    ]}
                  >
                    {isOnline
                      ? language === "hi"
                        ? "लाइव"
                        : "LIVE"
                      : language === "hi"
                      ? "ऑफलाइन"
                      : "OFFLINE"}
                  </Text>
                </View>
              </View>
              <Text style={styles.availabilitySub} numberOfLines={2}>
                {isOnline
                  ? language === "hi"
                    ? "मरीज़ आपको ऑनलाइन देख सकते हैं और परामर्श बुक कर सकते हैं।"
                    : "Patients see you as Online for live consultations & appointments."
                  : language === "hi"
                  ? "मरीज़ आपको ऑफलाइन देख रहे हैं, परामर्श अनुरोध रोके गए हैं।"
                  : "Patients see you as Offline; new consultation calls paused."}
              </Text>
            </View>
          </View>

          <View style={styles.switchWrapper}>
            {toggleLoading ? (
              <ActivityIndicator size="small" color={isOnline ? "#16A34A" : COLORS.textLight} />
            ) : (
              <Switch
                value={isOnline}
                onValueChange={handleToggleOnline}
                trackColor={{ false: "#CBD5E1", true: "#86EFAC" }}
                thumbColor={isOnline ? "#16A34A" : "#64748B"}
                ios_backgroundColor="#CBD5E1"
              />
            )}
          </View>
        </View>
      )}

      {/* Top View Selector: Consultations vs Doctor Profile */}
      {isDoctor && (
        <View style={styles.topTabBar}>
          <TouchableOpacity
            style={[styles.topTabBtn, activeView === "appointments" && styles.topTabBtnActive]}
            onPress={() => setActiveView("appointments")}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={activeView === "appointments" ? COLORS.primary : COLORS.textLight}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.topTabBtnText,
                activeView === "appointments" && styles.topTabBtnTextActive,
              ]}
            >
              Consultations ({appointments.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topTabBtn, activeView === "profile" && styles.topTabBtnActive]}
            onPress={() => setActiveView("profile")}
          >
            <Ionicons
              name="person-circle"
              size={17}
              color={activeView === "profile" ? COLORS.primary : COLORS.textLight}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.topTabBtnText,
                activeView === "profile" && styles.topTabBtnTextActive,
              ]}
            >
              Doctor Profile
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ==================== VIEW 1: DOCTOR PROFILE SECTION ==================== */}
      {activeView === "profile" ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          >
            {/* Hero Profile Card */}
            <View style={styles.profileHeaderCard}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarText}>
                  {profileForm.name
                    ? profileForm.name.replace("Dr. ", "").replace("Prof. (Dr.) ", "").substring(0, 2).toUpperCase()
                    : "DR"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.profileNameText}>
                  Dr. {profileForm.name.replace("Dr. ", "").replace("Prof. (Dr.) ", "")}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  <View style={styles.deptBadge}>
                    <Ionicons name="medical" size={11} color="#0369A1" style={{ marginRight: 4 }} />
                    <Text style={styles.deptBadgeText}>{profileForm.department || "Specialist"}</Text>
                  </View>
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="shield-checkmark" size={11} color="#059669" style={{ marginRight: 4 }} />
                    <Text style={styles.verifiedBadgeText}>Verified KMC Doctor</Text>
                  </View>
                  <View
                    style={[
                      styles.statusMiniBadge,
                      isOnline ? styles.statusMiniBadgeOnline : styles.statusMiniBadgeOffline,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusMiniDot,
                        isOnline ? styles.statusMiniDotOnline : styles.statusMiniDotOffline,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusMiniBadgeText,
                        isOnline ? styles.statusMiniBadgeTextOnline : styles.statusMiniBadgeTextOffline,
                      ]}
                    >
                      {isOnline
                        ? language === "hi"
                          ? "ऑनलाइन"
                          : "Online"
                        : language === "hi"
                        ? "ऑफलाइन"
                        : "Offline"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.profileMetaText}>
                  ID: {doctorRecord?.id || "N/A"} · {doctorRecord?.email || profile?.email || "hospital@kmchospital.in"}
                </Text>
              </View>
            </View>

            {/* Profile Edit Form Card */}
            <View style={styles.profileFormCard}>
              <Text style={styles.formSectionTitle}>Doctor Profile & Practice Details</Text>

              {/* Doctor Full Name */}
              <Text style={styles.inputLabel}>Doctor Full Name *</Text>
              <TextInput
                style={styles.formInput}
                value={profileForm.name}
                onChangeText={(t) => setProfileForm({ ...profileForm, name: t })}
                placeholder="e.g. Dr. Ayushmaan Singh"
              />

              {/* Mobile Phone */}
              <Text style={styles.inputLabel}>Mobile / WhatsApp Contact</Text>
              <TextInput
                style={styles.formInput}
                value={profileForm.phone}
                keyboardType="phone-pad"
                onChangeText={(t) => setProfileForm({ ...profileForm, phone: t })}
                placeholder="10-digit mobile number"
              />

              {/* Department Dropdown Selector */}
              <Text style={styles.inputLabel}>Clinical Department *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setDeptPickerVisible(true)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name="business-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.dropdownSelectorText, !profileForm.department && { color: COLORS.textLight }]}>
                    {profileForm.department || "Select Clinical Department"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
              </TouchableOpacity>

              {/* Specialization */}
              <Text style={styles.inputLabel}>Specialization & Designation</Text>
              <TextInput
                style={styles.formInput}
                value={profileForm.specialization}
                onChangeText={(t) => setProfileForm({ ...profileForm, specialization: t })}
                placeholder="e.g. Senior Neonatal Consultant & Pediatrician"
              />

              {/* Qualifications & Experience */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Qualifications</Text>
                  <TextInput
                    style={styles.formInput}
                    value={profileForm.qualification}
                    onChangeText={(t) => setProfileForm({ ...profileForm, qualification: t })}
                    placeholder="MBBS, MD, DNB"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Experience</Text>
                  <TextInput
                    style={styles.formInput}
                    value={profileForm.experience}
                    onChangeText={(t) => setProfileForm({ ...profileForm, experience: t })}
                    placeholder="15+ Yrs"
                  />
                </View>
              </View>

              {/* Consultation Fee (Hospital Standard) */}
              <Text style={styles.inputLabel}>Consultation Fee (Hospital Standard)</Text>
              <View style={[styles.formInput, styles.feeDisabledInput]}>
                <Ionicons name="lock-closed" size={14} color={COLORS.textLight} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: "700" }}>
                  ₹{profileForm.consultationFee || 800}
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.textLight, marginLeft: "auto" }}>
                  Hospital Admin Managed
                </Text>
              </View>

              {/* OPD Chamber / Room Location */}
              <Text style={styles.inputLabel}>OPD Chamber / Clinic Room Location</Text>
              <TextInput
                style={styles.formInput}
                value={profileForm.clinicName}
                onChangeText={(t) => setProfileForm({ ...profileForm, clinicName: t })}
                placeholder="e.g. OPD Chamber 4, Ground Floor, KMC Hospital"
              />

              {/* Bio / Professional Summary */}
              <Text style={styles.inputLabel}>Professional Bio & Summary</Text>
              <TextInput
                style={[styles.formInput, { height: 90, textAlignVertical: "top", paddingTop: 10 }]}
                value={profileForm.about}
                onChangeText={(t) => setProfileForm({ ...profileForm, about: t })}
                placeholder="Describe your background, expertise, treatment specializations, and patient care approach..."
                multiline
                numberOfLines={4}
              />

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveProfileBtn, profileSaving && { opacity: 0.6 }]}
                onPress={handleSaveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                    <Text style={styles.saveProfileBtnText}>Save Profile Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* ==================== VIEW 2: APPOINTMENTS FEED ==================== */
        <>
          {/* Doctor Identity / Switcher */}
          {isAdmin ? (
            <View style={{ marginTop: 6, marginBottom: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                <TouchableOpacity
                  style={[styles.filterChip, selectedDoctorId === "all" && styles.filterChipActive]}
                  onPress={() => setSelectedDoctorId("all")}
                >
                  <Text style={[styles.filterChipText, selectedDoctorId === "all" && styles.filterChipTextActive]}>
                    All Doctors ({appointments.length})
                  </Text>
                </TouchableOpacity>
                {doctorList.map((doc) => (
                  <TouchableOpacity
                    key={doc.id}
                    style={[styles.filterChip, selectedDoctorId === doc.id && styles.filterChipActive]}
                    onPress={() => setSelectedDoctorId(doc.id)}
                  >
                    <Text style={[styles.filterChipText, selectedDoctorId === doc.id && styles.filterChipTextActive]}>
                      {doc.name.replace("Dr. ", "").replace("Prof. (Dr.) ", "")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 4 }}>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F0FDF4",
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#BBF7D0",
              }}>
                <Ionicons name="shield-checkmark" size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, color: "#166534", fontWeight: "700" }}>
                  Private Doctor Portal: Locked to your assigned consultations
                </Text>
              </View>
            </View>
          )}

          {/* Summary KPI Cards */}
          <View style={styles.kpiContainer}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiValue}>{stats.total}</Text>
              <Text style={styles.kpiLabel}>Total</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#D97706" }]}>{stats.pending}</Text>
              <Text style={styles.kpiLabel}>Pending</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: COLORS.primary }]}>{stats.confirmed}</Text>
              <Text style={styles.kpiLabel}>Confirmed</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: "#059669" }]}>{stats.completed}</Text>
              <Text style={styles.kpiLabel}>Done</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={[styles.kpiValue, { color: COLORS.text }]}>₹{stats.totalRevenue}</Text>
              <Text style={styles.kpiLabel}>Revenue</Text>
            </View>
          </View>

          {/* Status Filter Tabs */}
          <View style={styles.statusTabs}>
            {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.statusTabBtn, statusFilter === s && styles.statusTabBtnActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.statusTabText, statusFilter === s && styles.statusTabTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Appointment Feed */}
          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Fetching doctor appointments...</Text>
            </View>
          ) : filteredAppointments.length === 0 ? (
            <View style={styles.centerWrap}>
              <Ionicons name="calendar-outline" size={56} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>No appointments found</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter === "all"
                  ? "No bookings registered for this doctor yet."
                  : `No appointments with status "${statusFilter}".`}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredAppointments}
              keyExtractor={(item) => item.id}
              renderItem={renderAppointmentItem}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* ==================== MODAL: DOCTOR DEPARTMENT PICKER ==================== */}
      <Modal visible={deptPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="business" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Choose Clinical Department</Text>
              </View>
              <TouchableOpacity onPress={() => setDeptPickerVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>
              Select your primary hospital department. Patients will find your profile when filtering by this department.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {HOSPITAL_DEPARTMENTS.map((dept) => {
                const isSelected = profileForm.department === dept;
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.deptOptionRow, isSelected && styles.deptOptionRowSelected]}
                    onPress={() => {
                      setProfileForm({ ...profileForm, department: dept });
                      setDeptPickerVisible(false);
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <View style={[styles.deptIconWrap, isSelected && styles.deptIconWrapSelected]}>
                        <Ionicons
                          name="medkit-outline"
                          size={16}
                          color={isSelected ? COLORS.white : COLORS.primary}
                        />
                      </View>
                      <Text style={[styles.deptOptionText, isSelected && styles.deptOptionTextActive]}>
                        {dept}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  headerSubtitle: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  filterChipTextActive: { color: COLORS.white },
  kpiContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "space-between",
  },
  kpiCard: { alignItems: "center", flex: 1 },
  kpiValue: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  kpiLabel: { fontSize: 10, color: COLORS.textLight, marginTop: 2, fontWeight: "600" },
  statusTabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    padding: 3,
  },
  statusTabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  statusTabBtnActive: { backgroundColor: COLORS.white, elevation: 1 },
  statusTabText: { fontSize: 11, fontWeight: "700", color: COLORS.textLight },
  statusTabTextActive: { color: COLORS.primary },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  loadingText: { marginTop: 12, fontSize: 13, color: COLORS.textLight },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginTop: 14 },
  emptySubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  refPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  refPillVideo: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  refPillVideoText: {
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: "800",
  },
  refPillOpd: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  refPillOpdText: {
    color: "#15803D",
    fontSize: 12,
    fontWeight: "800",
  },
  typeBadgeText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
    marginLeft: 6,
  },
  tokenNumber: { fontSize: 15, fontWeight: "900", color: COLORS.primary },
  doctorSubText: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgePending: { backgroundColor: "#FEF3C7" },
  badgeConfirmed: { backgroundColor: "#ECFDF5" },
  badgeCompleted: { backgroundColor: "#EFF6FF" },
  badgeCancelled: { backgroundColor: "#FEE2E2" },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  textPending: { color: "#D97706" },
  textConfirmed: { color: "#059669" },
  textCompleted: { color: "#2563EB" },
  textCancelled: { color: "#DC2626" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 10 },
  detailRow: { flexDirection: "row", alignItems: "center" },
  detailTextBold: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginLeft: 8 },
  detailText: { fontSize: 12, color: COLORS.textLight, marginLeft: 8 },
  callPatientBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 10,
  },
  callPatientText: { fontSize: 11, fontWeight: "700", color: "#059669", marginLeft: 4 },
  reasonBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reasonLabel: { fontSize: 10, fontWeight: "800", color: COLORS.textLight },
  reasonText: { fontSize: 12, color: COLORS.text, marginTop: 2 },
  feeStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  feeStripLabel: { fontSize: 10, color: COLORS.textLight },
  feeStripValue: { fontSize: 13, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  feeStripSub: { fontSize: 11, fontWeight: "700", color: COLORS.text, marginTop: 2 },
  feeStripStatus: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  syncIndicator: { flexDirection: "row", alignItems: "center" },
  syncNotice: { fontSize: 10, color: "#059669", fontWeight: "600" },
  meetBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#059669",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  meetBtnText: { fontSize: 11, fontWeight: "700", color: COLORS.white },
  telehealthBox: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  telehealthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  telehealthTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },
  telehealthSubtitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#15803D",
  },
  telehealthActions: {
    flexDirection: "row",
    gap: 8,
  },
  callBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 8,
  },
  videoCallBtn: {
    backgroundColor: "#059669",
  },
  audioCallBtn: {
    backgroundColor: "#0284C7",
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.white,
  },
  actionsBar: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  btnAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnConfirm: { backgroundColor: COLORS.primary },
  btnComplete: { backgroundColor: "#059669" },
  btnReject: { backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FECACA" },
  btnActionText: { fontSize: 11, fontWeight: "800", color: COLORS.white, marginLeft: 4 },

  // Top View Switcher Tabs
  topTabBar: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
    borderRadius: 12,
    padding: 3,
  },
  topTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  topTabBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  topTabBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textLight,
  },
  topTabBtnTextActive: {
    color: COLORS.primary,
  },

  // Profile Header Card
  profileHeaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  profileAvatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  profileAvatarText: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.white,
  },
  profileNameText: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  deptBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deptBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0369A1",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
  },
  profileMetaText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 6,
  },

  // Profile Form Card
  profileFormCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  formSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 14,
  },
  feeDisabledInput: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
  },
  saveProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  saveProfileBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  // Department Dropdown Picker
  dropdownSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
  dropdownSelectorText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  deptOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  deptOptionRowSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: COLORS.primary,
  },
  deptIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  deptIconWrapSelected: {
    backgroundColor: COLORS.primary,
  },
  deptOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    flex: 1,
  },
  deptOptionTextActive: {
    color: COLORS.primary,
    fontWeight: "800",
  },

  // Modal Structure
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },

  // Online / Offline Availability Toggle Styles
  availabilityCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  availabilityCardOnline: {
    backgroundColor: "#F0FDF4",
    borderColor: "#86EFAC",
  },
  availabilityCardOffline: {
    backgroundColor: "#F8FAFC",
    borderColor: "#CBD5E1",
  },
  availabilityLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 10,
  },
  statusDotIndicator: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotOnline: {
    backgroundColor: "#DCFCE7",
  },
  statusDotOffline: {
    backgroundColor: "#E2E8F0",
  },
  statusDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusDotInnerOnline: {
    backgroundColor: "#16A34A",
  },
  statusDotInnerOffline: {
    backgroundColor: "#94A3B8",
  },
  availabilityTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  availabilityTitleOnline: {
    color: "#166534",
  },
  availabilityTitleOffline: {
    color: "#334155",
  },
  statusTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginLeft: 6,
  },
  statusTagPillOnline: {
    backgroundColor: "#BBF7D0",
  },
  statusTagPillOffline: {
    backgroundColor: "#E2E8F0",
  },
  statusTagText: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statusTagTextOnline: {
    color: "#166534",
  },
  statusTagTextOffline: {
    color: "#64748B",
  },
  availabilitySub: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
    lineHeight: 15,
  },
  switchWrapper: {
    minWidth: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  statusMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusMiniBadgeOnline: {
    backgroundColor: "#DCFCE7",
  },
  statusMiniBadgeOffline: {
    backgroundColor: "#F1F5F9",
  },
  statusMiniDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 4,
  },
  statusMiniDotOnline: {
    backgroundColor: "#16A34A",
  },
  statusMiniDotOffline: {
    backgroundColor: "#94A3B8",
  },
  statusMiniBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusMiniBadgeTextOnline: {
    color: "#166534",
  },
  statusMiniBadgeTextOffline: {
    color: "#64748B",
  },
});
