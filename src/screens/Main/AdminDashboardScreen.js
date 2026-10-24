import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  Share,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../utils/supabase";
import { formatAppointmentRef } from "../../utils/appointmentFormatter";
import { isMeetExpired, compareMeetsByDate } from "../../utils/dateFormatter";
import {
  fetchAdminOverviewStats,
  fetchAdminDoctorsList,
  adminAddHospitalDoctor,
  adminInviteDoctor,
  adminToggleDoctorActive,
  adminUpdateDoctor,
  adminResetDoctorPassword,
  adminVerifyDoctor,
  adminUpdateDoctorAvailability,
  fetchDoctorAvailability,
  fetchAdminAppointments,
  fetchAdminPatientsList,
  scheduleMeetingByAdmin,
  fetchAdminDoctorSlotStatuses,
  subscribeToAdminAppointmentsRealtime,
} from "../../services/adminService";
import { sendTestPushNotification } from "../../services/notificationService";

export const HOSPITAL_DEPARTMENTS = [
  "Obstetrics & Gynaecology",
  "Neonatology (NICU)",
  "Pediatrics & PICU",
  "Pediatric Surgery",
  "General Surgery",
  "Orthopaedics",
  "General Medicine",
  "Cardiology",
  "Emergency & Trauma",
  "Neurology",
  "Dermatology",
  "ENT (Ear, Nose, Throat)",
  "Dentistry & Maxillofacial",
  "Radiology & Ultrasound",
  "Pathology & Diagnostics",
];

const AVAILABLE_TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:30 PM",
  "04:30 PM",
  "05:30 PM",
  "06:30 PM",
];

const getDateOptions = () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);

  const fmt = (d) => d.toISOString().split("T")[0];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return [
    { label: "Today", dateStr: fmt(today) },
    { label: "Tomorrow", dateStr: fmt(tomorrow) },
    {
      label: `${dayNames[dayAfter.getDay()]}, ${monthNames[dayAfter.getMonth()]} ${dayAfter.getDate()}`,
      dateStr: fmt(dayAfter),
    },
  ];
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const { profile, logout, userRole, isAdmin } = useAuth();

  // Strict role guard: non-admin users cannot access Admin Dashboard
  if (!isAdmin && userRole !== "admin" && userRole !== "super_admin") {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <Ionicons name="shield-outline" size={56} color={COLORS.danger} />
          <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 14 }}>
            Administrative Access Only
          </Text>
          <Text style={{ fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 8, lineHeight: 20 }}>
            You do not have permission to view the Hospital Admin Portal. Please sign in with an authorized hospital administrator account.
          </Text>
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}
            onPress={logout}
          >
            <Text style={{ color: COLORS.white, fontWeight: "700" }}>Sign In Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "doctors" | "appointments" | "patients"
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [stats, setStats] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);

  // Search & Filters
  const [doctorSearch, setDoctorSearch] = useState("");
  const [appointmentFilter, setAppointmentFilter] = useState("all");
  const [appointmentSearch, setAppointmentSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");

  // Modals
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [editDocModalVisible, setEditDocModalVisible] = useState(false);
  const [resetPwdModalVisible, setResetPwdModalVisible] = useState(false);
  const [availModalVisible, setAvailModalVisible] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedAvailDoc, setSelectedAvailDoc] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Doctor Access & Invite Management Modal State
  const [accessModalVisible, setAccessModalVisible] = useState(false);
  const [accessDoctor, setAccessDoctor] = useState(null);
  const [accessTempPassword, setAccessTempPassword] = useState("");
  const [accessInviteLink, setAccessInviteLink] = useState("");

  // Google Meet Edit / Assign Modal State
  const [meetModalVisible, setMeetModalVisible] = useState(false);
  const [selectedAptForMeet, setSelectedAptForMeet] = useState(null);
  const [customMeetUrl, setCustomMeetUrl] = useState("");

  // Test Push Notification Modal State
  const [testPushModalVisible, setTestPushModalVisible] = useState(false);
  const [testPushTarget, setTestPushTarget] = useState("self"); // "self" | "custom"
  const [testPushCustomUserId, setTestPushCustomUserId] = useState("");
  const [testPushTitle, setTestPushTitle] = useState("KMC Hospital Alert");
  const [testPushBody, setTestPushBody] = useState("This is a live test notification from KMC Administration.");
  const [testPushLoading, setTestPushLoading] = useState(false);

  // Availability Schedule State
  const [availSchedule, setAvailSchedule] = useState([
    { day_of_week: "Mon", start_time: "09:00 AM", end_time: "02:00 PM", is_available: true },
    { day_of_week: "Tue", start_time: "09:00 AM", end_time: "02:00 PM", is_available: true },
    { day_of_week: "Wed", start_time: "09:00 AM", end_time: "02:00 PM", is_available: true },
    { day_of_week: "Thu", start_time: "09:00 AM", end_time: "02:00 PM", is_available: true },
    { day_of_week: "Fri", start_time: "09:00 AM", end_time: "02:00 PM", is_available: true },
    { day_of_week: "Sat", start_time: "09:00 AM", end_time: "02:00 PM", is_available: true },
    { day_of_week: "Sun", start_time: "09:00 AM", end_time: "01:00 PM", is_available: false },
  ]);

  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "General Medicine",
    specialization: "Senior Consultant",
    qualification: "MBBS, MD",
    experience: "10+ Yrs",
    consultationFee: "800",
    password: "",
  });

  // Edit Doctor Form State
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    department: "",
    specialization: "",
    qualification: "",
    experience: "",
    consultation_fee: "800",
  });

  // Department Picker Modal State
  const [deptPickerVisible, setDeptPickerVisible] = useState(false);
  const [deptPickerTarget, setDeptPickerTarget] = useState("invite"); // "invite" | "edit"

  // Reset Password State
  const [newPassword, setNewPassword] = useState("");

  // Schedule Consultation Meet Modal State
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    patientMode: "registered", // 'registered' | 'custom'
    selectedPatientId: "",
    customPatientName: "",
    customPatientPhone: "",
    customPatientEmail: "",
    selectedDoctorId: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
    type: "Video Consultation",
    notes: "Hospital Consultation & Checkup",
  });
  const [modalSlots, setModalSlots] = useState({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const adminModalTrackerRef = useRef({
    visible: false,
    docId: "",
    date: "",
  });

  const loadAdminModalSlotStatuses = useCallback(async (docId, dateVal) => {
    if (!docId || !dateVal) return;
    setLoadingSlots(true);
    try {
      const statuses = await fetchAdminDoctorSlotStatuses(docId, dateVal);
      setModalSlots(statuses || {});
      setScheduleForm((prev) => {
        if (prev.time && (statuses?.[prev.time]?.status === "booked" || statuses?.[prev.time]?.booked)) {
          return { ...prev, time: "" };
        }
        return prev;
      });
    } catch (e) {
      console.warn("[AdminDashboard] loadAdminModalSlotStatuses notice:", e);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    adminModalTrackerRef.current = {
      visible: scheduleModalVisible,
      docId: scheduleForm.selectedDoctorId,
      date: scheduleForm.date,
    };
  }, [scheduleModalVisible, scheduleForm.selectedDoctorId, scheduleForm.date]);

  useEffect(() => {
    if (scheduleModalVisible && scheduleForm.selectedDoctorId && scheduleForm.date) {
      loadAdminModalSlotStatuses(scheduleForm.selectedDoctorId, scheduleForm.date);
    }
  }, [scheduleModalVisible, scheduleForm.selectedDoctorId, scheduleForm.date, loadAdminModalSlotStatuses]);

  const loadAllData = async () => {
    try {
      const [overviewRes, docsRes, aptsRes, patsRes] = await Promise.all([
        fetchAdminOverviewStats(),
        fetchAdminDoctorsList(),
        fetchAdminAppointments(),
        fetchAdminPatientsList(),
      ]);
      setStats(overviewRes);
      setDoctors(docsRes);
      setAppointments(aptsRes);
      setPatients(patsRes);
    } catch (err) {
      console.warn("[AdminDashboard] Load error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();

    // Realtime subscription for appointments and live broadcasts
    const unsub = subscribeToAdminAppointmentsRealtime(() => {
      loadAllData();
      if (adminModalTrackerRef.current.visible && adminModalTrackerRef.current.docId && adminModalTrackerRef.current.date) {
        loadAdminModalSlotStatuses(adminModalTrackerRef.current.docId, adminModalTrackerRef.current.date);
      }
    });

    return () => {
      unsub();
    };
  }, [loadAdminModalSlotStatuses]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData();
  };

  const openScheduleMeetModal = () => {
    const firstDoc = doctors.length > 0 ? doctors[0].id : "";
    const firstPat = patients.length > 0 ? patients[0].id : "";
    const todayIso = new Date().toISOString().split("T")[0];
    setScheduleForm({
      patientMode: patients.length > 0 ? "registered" : "custom",
      selectedPatientId: firstPat,
      customPatientName: "",
      customPatientPhone: "",
      customPatientEmail: "",
      selectedDoctorId: firstDoc,
      date: todayIso,
      time: "",
      type: "Video Consultation",
      notes: "Hospital Consultation & Checkup",
    });
    setModalSlots({});
    setScheduleModalVisible(true);
    if (firstDoc) {
      loadAdminModalSlotStatuses(firstDoc, todayIso);
    }
  };

  const handleConfirmScheduleMeeting = async () => {
    if (!scheduleForm.selectedDoctorId) {
      Alert.alert("Doctor Required", "Please select a registered doctor.");
      return;
    }
    const docObj = doctors.find((d) => String(d.id) === String(scheduleForm.selectedDoctorId));
    if (!docObj) {
      Alert.alert("Doctor Not Found", "Selected doctor could not be found.");
      return;
    }

    let patObj = null;
    if (scheduleForm.patientMode === "registered") {
      if (!scheduleForm.selectedPatientId) {
        Alert.alert("Patient Required", "Please select a registered patient.");
        return;
      }
      patObj = patients.find((p) => String(p.id) === String(scheduleForm.selectedPatientId));
      if (!patObj) {
        Alert.alert("Patient Not Found", "Selected patient profile could not be found.");
        return;
      }
    } else {
      if (!scheduleForm.customPatientName.trim()) {
        Alert.alert("Patient Name Required", "Please enter the patient's name.");
        return;
      }
      patObj = {
        id: "pat_" + Date.now(),
        full_name: scheduleForm.customPatientName.trim(),
        name: scheduleForm.customPatientName.trim(),
        phone: scheduleForm.customPatientPhone.trim(),
        email:
          scheduleForm.customPatientEmail.trim() ||
          `${scheduleForm.customPatientName.toLowerCase().replace(/\s+/g, "")}@kmchospital.com`,
      };
    }

    if (!scheduleForm.date || !scheduleForm.time) {
      Alert.alert("Slot Required", "Please select an available consultation date and time slot.");
      return;
    }

    // Strict conflict check
    if (modalSlots[scheduleForm.time]?.status === "booked" || modalSlots[scheduleForm.time]?.booked) {
      Alert.alert(
        "Slot Unavailable",
        `Dr. ${docObj.name} is already booked for ${scheduleForm.time} on ${scheduleForm.date}. Please select an available slot.`
      );
      return;
    }

    setScheduleSubmitting(true);
    const res = await scheduleMeetingByAdmin({
      patient: patObj,
      doctor: docObj,
      date: scheduleForm.date,
      time: scheduleForm.time,
      type: scheduleForm.type,
      notes: scheduleForm.notes,
    });
    setScheduleSubmitting(false);

    if (res.success) {
      setScheduleModalVisible(false);
      Alert.alert(
        "Meet Scheduled Successfully! 📅",
        `Consultation confirmed between Dr. ${docObj.name} and ${patObj.full_name || patObj.name}.\n\nDate: ${scheduleForm.date}\nTime: ${scheduleForm.time}\nMode: ${scheduleForm.type}\n\nBoth Patient's App and Doctor's Portal have been synchronized.`
      );
      loadAllData();
    } else {
      Alert.alert("Booking Failed", res.error || "Could not schedule consultation meet.");
    }
  };

  // --- DOCTOR ACTIONS ---

  const handleToggleActive = async (doc) => {
    const nextState = !doc.active;
    const actionLabel = nextState ? "Activate" : "Suspend";

    Alert.alert(
      `${actionLabel} Doctor`,
      `Are you sure you want to ${actionLabel.toLowerCase()} Dr. ${doc.name}? ${
        !nextState ? "This doctor will not be able to accept appointments or view patient records." : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: actionLabel,
          style: nextState ? "default" : "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await adminToggleDoctorActive(doc.id, nextState);
              Alert.alert("Success", `Dr. ${doc.name} has been ${nextState ? "activated" : "suspended"}.`);
              loadAllData();
            } catch (e) {
              Alert.alert("Error", e.message || "Failed to update doctor status");
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleVerifyDoctor = async (doc) => {
    try {
      setLoading(true);
      await adminVerifyDoctor(doc.id);
      Alert.alert("Doctor Verified", `Dr. ${doc.name} has been verified.`);
      loadAllData();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to verify doctor");
      setLoading(false);
    }
  };

  const handleOpenInviteExistingDoctor = (doc) => {
    setSelectedDoctor(doc);
    setInviteForm({
      doctorId: doc.id,
      name: doc.name,
      email: doc.email || "",
      phone: doc.phone || "",
      department: doc.department || "General Medicine",
      specialization: doc.specialization || "Senior Consultant",
      qualification: doc.qualification || "MBBS",
      experience: doc.experience || "10+ Yrs",
      consultationFee: String(doc.consultationFee || 800),
      password: "",
    });
    setInviteModalVisible(true);
  };

  const handleOpenEdit = (doc) => {
    setSelectedDoctor(doc);
    setEditForm({
      name: doc.name || "",
      phone: doc.phone || "",
      department: doc.department || "",
      specialization: doc.specialization || "",
      qualification: doc.qualification || "",
      experience: doc.experience || "",
      consultation_fee: String(doc.consultationFee || 800),
    });
    setEditDocModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedDoctor) return;
    try {
      setModalLoading(true);
      await adminUpdateDoctor(selectedDoctor.id, {
        name: editForm.name,
        phone: editForm.phone,
        department: editForm.department,
        specialization: editForm.specialization,
        qualification: editForm.qualification,
        experience: editForm.experience,
        consultation_fee: Number(editForm.consultation_fee || 800),
      });
      setEditDocModalVisible(false);
      Alert.alert("Updated", "Doctor profile updated successfully.");
      loadAllData();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update doctor.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenResetPwd = (doc) => {
    setSelectedDoctor(doc);
    setNewPassword("");
    setResetPwdModalVisible(true);
  };

  const handleSaveResetPwd = async () => {
    if (!selectedDoctor || !newPassword || newPassword.length < 6) {
      Alert.alert("Invalid Password", "Password must be at least 6 characters long.");
      return;
    }
    try {
      setModalLoading(true);
      await adminResetDoctorPassword(selectedDoctor.id, newPassword);
      setResetPwdModalVisible(false);
      Alert.alert("Success", `Password updated for Dr. ${selectedDoctor.name}.`);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to reset password.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleOpenAddDoctor = () => {
    setSelectedDoctor(null);
    setInviteForm({
      doctorId: null,
      name: "",
      email: "",
      phone: "",
      department: "General Medicine",
      specialization: "Senior Consultant",
      qualification: "MBBS, MD",
      experience: "10+ Yrs",
      consultationFee: "800",
      password: "",
    });
    setInviteModalVisible(true);
  };

  const handleOpenAvailability = async (doc) => {
    setSelectedAvailDoc(doc);
    setAvailModalVisible(true);
    try {
      const existing = await fetchDoctorAvailability(doc.id);
      if (existing && existing.length > 0) {
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const mapped = days.map((d) => {
          const found = existing.find((item) =>
            (item.day_of_week || "").toLowerCase().startsWith(d.toLowerCase())
          );
          if (found) {
            return {
              day_of_week: d,
              start_time: found.start_time || "09:00 AM",
              end_time: found.end_time || "02:00 PM",
              is_available: found.is_available !== false,
            };
          }
          return {
            day_of_week: d,
            start_time: "09:00 AM",
            end_time: "02:00 PM",
            is_available: d !== "Sun",
          };
        });
        setAvailSchedule(mapped);
      }
    } catch (e) {
      console.warn("[AdminDashboard] fetchDoctorAvailability error:", e);
    }
  };

  const handleToggleDayAvailable = (index) => {
    setAvailSchedule((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], is_available: !next[index].is_available };
      return next;
    });
  };

  const handleUpdateDayTime = (index, field, value) => {
    setAvailSchedule((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSaveAvailability = async () => {
    if (!selectedAvailDoc) return;
    try {
      setModalLoading(true);
      await adminUpdateDoctorAvailability(selectedAvailDoc.id, availSchedule);
      setAvailModalVisible(false);
      Alert.alert("Success", `Consultation schedule updated for Dr. ${selectedAvailDoc.name}.`);
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update availability schedule.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleAddDoctorOnly = async () => {
    if (!inviteForm.name.trim()) {
      Alert.alert("Required Field", "Doctor name is mandatory.");
      return;
    }
    try {
      setModalLoading(true);
      await adminAddHospitalDoctor({
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim().toLowerCase() || undefined,
        phone: inviteForm.phone.trim(),
        department: inviteForm.department,
        specialization: inviteForm.specialization,
        qualification: inviteForm.qualification,
        experience: inviteForm.experience,
        consultationFee: Number(inviteForm.consultationFee || 800),
      });
      setInviteModalVisible(false);
      Alert.alert("Doctor Added", `Dr. ${inviteForm.name} added to hospital doctor directory.`);
      loadAllData();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to add doctor to directory.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleInviteDoctorSubmit = async () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) {
      Alert.alert("Required Fields", "Doctor name and email are mandatory.");
      return;
    }
    try {
      setModalLoading(true);
      const res = await adminInviteDoctor({
        doctorId: inviteForm.doctorId || undefined,
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim().toLowerCase(),
        phone: inviteForm.phone.trim(),
        department: inviteForm.department,
        specialization: inviteForm.specialization,
        qualification: inviteForm.qualification,
        experience: inviteForm.experience,
        consultationFee: Number(inviteForm.consultationFee || 800),
        password: inviteForm.password.trim() || undefined,
      });

      setInviteModalVisible(false);
      const submittedDoc = {
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim().toLowerCase(),
        phone: inviteForm.phone.trim(),
        department: inviteForm.department,
      };
      setInviteForm({
        doctorId: null,
        name: "",
        email: "",
        phone: "",
        department: "General Medicine",
        specialization: "Senior Consultant",
        qualification: "MBBS, MD",
        experience: "10+ Yrs",
        consultationFee: "800",
        password: "",
      });

      loadAllData();

      if (res?.tempPassword) {
        handleOpenAccessModal(res.doctor || submittedDoc, res.tempPassword, res.inviteLink);
      } else {
        Alert.alert("Success", `Dr. ${submittedDoc.name} linked and authorized successfully.`);
      }
    } catch (e) {
      Alert.alert("Invitation Error", e.message || "Failed to authorize doctor.");
    } finally {
      setModalLoading(false);
    }
  };

  // --- ACCESS & CREDENTIALS MANAGEMENT HANDLERS ---
  const copyToClipboard = async (text, label = "Item") => {
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        Alert.alert("Copied!", `${label} copied to clipboard.`);
        return;
      }
    } catch (e) {}
    try {
      await Share.share({ message: text });
    } catch (e) {
      Alert.alert("Copied", text);
    }
  };

  const handleOpenAccessModal = (doc, tempPwd = "", inviteLink = "") => {
    setAccessDoctor(doc);
    setAccessTempPassword(tempPwd || "Contact Administration");
    setAccessInviteLink(inviteLink || "");
    setAccessModalVisible(true);
  };

  const handleSendDoctorEmail = (doc, password, inviteLink) => {
    const portalUrl = "https://kmchospital.in/doctor-login";
    const subject = encodeURIComponent(`KMC Hospital - Dr. ${doc.name} Doctor Portal Credentials`);
    const body = encodeURIComponent(
      `Dear Dr. ${doc.name},\n\n` +
      `Welcome to KMC Hospital! Your doctor portal access has been configured.\n\n` +
      `• Doctor Portal Login: ${portalUrl}\n` +
      `• Registered Email: ${doc.email}\n` +
      `• Temporary Password: ${password && password !== "Contact Administration" ? password : "(Set by Administrator)"}\n` +
      `• Department: ${doc.department || "Consultant"}\n\n` +
      (inviteLink ? `Direct Sign-In Link:\n${inviteLink}\n\n` : "") +
      `Please sign in to your doctor portal, review your upcoming appointments, and update your password.\n\n` +
      `Warm Regards,\n` +
      `Hospital Administration\n` +
      `KMC Hospital, Sector B, Jankipuram, Lucknow\n` +
      `Helpline: +91 8303666400`
    );
    Linking.openURL(`mailto:${doc.email}?subject=${subject}&body=${body}`);
  };

  const handleShareDoctorWhatsApp = (doc, password, inviteLink) => {
    const portalUrl = "https://kmchospital.in/doctor-login";
    const cleanPhone = (doc.phone || "").replace(/[^0-9]/g, "");
    const text = encodeURIComponent(
      `*KMC Hospital - Doctor Portal Access*\n\n` +
      `Hello Dr. ${doc.name},\n` +
      `Your doctor portal access is ready:\n\n` +
      `*Portal URL*: ${portalUrl}\n` +
      `*Email*: ${doc.email}\n` +
      `*Temporary Password*: ${password && password !== "Contact Administration" ? password : "(Set by Administrator)"}\n\n` +
      (inviteLink ? `*Direct Link*: ${inviteLink}\n\n` : "") +
      `KMC Hospital, Jankipuram`
    );
    const targetUrl = cleanPhone ? `https://wa.me/91${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    Linking.openURL(targetUrl);
  };

  const handleRegenerateDoctorPassword = async (doc) => {
    const generatedPwd = `KMCdoc#${Math.floor(100000 + Math.random() * 900000)}`;
    try {
      setModalLoading(true);
      await adminResetDoctorPassword(doc.id, generatedPwd);
      setAccessTempPassword(generatedPwd);
      Alert.alert(
        "New Password Generated",
        `New temporary password for Dr. ${doc.name} is:\n\n${generatedPwd}\n\nIt is now active in Supabase Auth.`
      );
      loadAllData();
    } catch (e) {
      Alert.alert("Reset Error", e.message || "Could not reset password.");
    } finally {
      setModalLoading(false);
    }
  };

  // --- GOOGLE MEET LINK MANAGEMENT HANDLERS ---
  const handleOpenMeetModal = (apt) => {
    setSelectedAptForMeet(apt);
    setCustomMeetUrl(apt.googleMeetLink || apt.meetingLink || "");
    setMeetModalVisible(true);
  };

  const handleSaveMeetLink = async () => {
    if (!selectedAptForMeet) return;
    try {
      setModalLoading(true);
      const urlToSave = customMeetUrl.trim();
      const { error } = await supabase
        .from("appointments")
        .update({
          google_meet_link: urlToSave || null,
          meeting_link: urlToSave || null,
          video_consultation: true,
        })
        .eq("id", selectedAptForMeet.id);

      if (error) {
        throw new Error(error.message);
      }

      Alert.alert("Success", "Google Meet consultation link updated successfully.");
      setMeetModalVisible(false);
      loadAllData();
    } catch (e) {
      Alert.alert("Update Failed", e.message || "Could not update Google Meet link.");
    } finally {
      setModalLoading(false);
    }
  };

  const handleShareMeetInvite = (apt) => {
    const link = apt.googleMeetLink || apt.meetingLink;
    if (!link) {
      Alert.alert("No Link", "Please assign a Google Meet link first.");
      return;
    }
    const message =
      `*KMC Hospital - Online Video Consultation*\n\n` +
      `Patient: ${apt.patientName}\n` +
      `Doctor: ${apt.doctorName} (${apt.department})\n` +
      `Date & Time: ${apt.date} at ${apt.time}\n` +
      `Consultation ID: ${formatAppointmentRef(apt.tokenNumber, apt.type)}\n\n` +
      `*Google Meet Join Link*:\n${link}\n\n` +
      `Please join 5 minutes before scheduled time.\nKMC Hospital, Jankipuram, Lucknow`;

    Share.share({ message });
  };

  // Filtered doctors
  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctors;
    const q = doctorSearch.toLowerCase();
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.department?.toLowerCase().includes(q) ||
        d.email?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q)
    );
  }, [doctors, doctorSearch]);

  // Filtered appointments sorted chronologically by date
  const filteredAppointments = useMemo(() => {
    let list = appointments;
    if (appointmentFilter !== "all") {
      list = list.filter((a) => {
        const s = (a.dbStatus || a.status || "").toLowerCase();
        const isExp = s === "completed" || isMeetExpired(a.date, a.time, s);
        if (appointmentFilter === "completed") return isExp;
        if (appointmentFilter === "confirmed") return s === "confirmed" && !isExp;
        return s === appointmentFilter;
      });
    }
    if (appointmentSearch.trim()) {
      const q = appointmentSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.patientName?.toLowerCase().includes(q) ||
          a.tokenNumber?.toLowerCase().includes(q) ||
          a.doctorName?.toLowerCase().includes(q)
      );
    }
    return [...list].sort(compareMeetsByDate);
  }, [appointments, appointmentFilter, appointmentSearch]);

  // Filtered patients
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const q = patientSearch.toLowerCase();
    return patients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.email?.toLowerCase().includes(q) ||
        p.phone?.toLowerCase().includes(q)
    );
  }, [patients, patientSearch]);

  const handleConfirmLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of the Hospital Admin Portal?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <View style={styles.adminBadgeRow}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={12} color={COLORS.white} />
              <Text style={styles.adminBadgeText}>ADMIN PORTAL</Text>
            </View>
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>Hospital Operations & Governance</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={onRefresh}
            title="Refresh Data"
          >
            <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: "#FEE2E2" }]}
            onPress={handleConfirmLogout}
            title="Sign Out"
          >
            <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Navigation Tab Bar */}
      <View style={styles.tabBar}>
        {[
          { key: "overview", label: "Overview", icon: "grid-outline", count: null },
          { key: "doctors", label: "Doctors", icon: "medkit-outline", count: doctors.length },
          { key: "appointments", label: "Bookings", icon: "calendar-outline", count: appointments.length },
          { key: "patients", label: "Patients", icon: "people-outline", count: patients.length },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <View style={styles.tabIconWrap}>
              <Ionicons
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? COLORS.primary : COLORS.textLight}
              />
              {tab.count !== null && (
                <View style={[styles.tabCountBadge, activeTab === tab.key && styles.tabCountBadgeActive]}>
                  <Text style={[styles.tabCountText, activeTab === tab.key && styles.tabCountTextActive]}>
                    {tab.count}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading administration data...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.contentWrap}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* ==================== TAB 1: OVERVIEW ==================== */}
          {activeTab === "overview" && (
            <View style={styles.tabContent}>
              {/* Metric KPI Grid */}
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
                  <Text style={styles.statNumber}>{stats?.totalAppointments || 0}</Text>
                  <Text style={styles.statLabel}>Total Bookings</Text>
                  <View style={styles.statSubRow}>
                    <Text style={{ fontSize: 11, color: "#059669", fontWeight: "700" }}>
                      {stats?.confirmedAppointments || 0} Confirmed
                    </Text>
                    <Text style={{ fontSize: 11, color: "#D97706", fontWeight: "700", marginLeft: 8 }}>
                      {stats?.pendingAppointments || 0} Pending
                    </Text>
                  </View>
                </View>

                <View style={[styles.statCard, { borderLeftColor: "#059669" }]}>
                  <Text style={[styles.statNumber, { color: "#059669" }]}>₹{stats?.totalRevenue || 0}</Text>
                  <Text style={styles.statLabel}>Total Revenue</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                    From completed & active bookings
                  </Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: "#2563EB" }]}>
                  <Text style={[styles.statNumber, { color: "#2563EB" }]}>{stats?.activeDoctors || 0}</Text>
                  <Text style={styles.statLabel}>Active Doctors</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                    {stats?.totalDoctors || 0} Total in Hospital
                  </Text>
                </View>

                <View style={[styles.statCard, { borderLeftColor: "#7C3AED" }]}>
                  <Text style={[styles.statNumber, { color: "#7C3AED" }]}>{stats?.totalPatients || 0}</Text>
                  <Text style={styles.statLabel}>Registered Patients</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight, marginTop: 4 }}>
                    KMC Patient Community
                  </Text>
                </View>
              </View>

              {/* Sync Health Status */}
              <View style={styles.card}>
                <Text style={styles.cardHeaderTitle}>Integration & Cloud Sync Health</Text>
                <View style={styles.syncRow}>
                  <View style={styles.syncItem}>
                    <Ionicons name="document-text" size={22} color="#059669" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.syncTitle}>Google Sheets Realtime Sync</Text>
                      <Text style={styles.syncDesc}>Synced {stats?.sheetsSynced || 0} appointment rows</Text>
                    </View>
                    <View style={styles.statusBadgeGreen}>
                      <Text style={styles.statusBadgeGreenText}>Active</Text>
                    </View>
                  </View>

                  <View style={styles.syncDivider} />

                  <View style={styles.syncItem}>
                    <Ionicons name="videocam" size={22} color="#059669" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.syncTitle}>WebRTC Telehealth</Text>
                      <Text style={styles.syncDesc}>{stats?.videoAppointments || 0} Online consultations (In-App Calling)</Text>
                    </View>
                    <View style={styles.statusBadgeGreen}>
                      <Text style={styles.statusBadgeGreenText}>Active</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.card}>
                <Text style={styles.cardHeaderTitle}>Administrative Quick Actions</Text>
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => {
                      setInviteModalVisible(true);
                    }}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: "#EAF6F5" }]}>
                      <Ionicons name="person-add" size={20} color={COLORS.primary} />
                    </View>
                    <Text style={styles.quickActionText}>Invite / Add Doctor</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setActiveTab("appointments")}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: "#EBF3FE" }]}>
                      <Ionicons name="calendar" size={20} color="#2563EB" />
                    </View>
                    <Text style={styles.quickActionText}>All Appointments</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setActiveTab("doctors")}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: "#F0FDF4" }]}>
                      <Ionicons name="medkit" size={20} color="#059669" />
                    </View>
                    <Text style={styles.quickActionText}>Manage Doctors</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.quickActionBtn}
                    onPress={() => setTestPushModalVisible(true)}
                  >
                    <View style={[styles.quickActionIcon, { backgroundColor: "#FEF3C7" }]}>
                      <Ionicons name="notifications" size={20} color="#D97706" />
                    </View>
                    <Text style={styles.quickActionText}>Test Push Alert</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ==================== TAB 2: DOCTORS ==================== */}
          {activeTab === "doctors" && (
            <View style={styles.tabContent}>
              {/* Actions & Search */}
              <View style={styles.filterBar}>
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search doctor, department, email..."
                    value={doctorSearch}
                    onChangeText={setDoctorSearch}
                  />
                  {Boolean(doctorSearch) && (
                    <TouchableOpacity onPress={() => setDoctorSearch("")}>
                      <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.addDoctorBtn}
                  onPress={handleOpenAddDoctor}
                >
                  <Ionicons name="add" size={18} color={COLORS.white} style={{ marginRight: 4 }} />
                  <Text style={styles.addDoctorBtnText}>Add Doctor</Text>
                </TouchableOpacity>
              </View>

              {/* Doctors List */}
              {filteredDoctors.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="medkit-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>No doctors matched your search.</Text>
                </View>
              ) : (
                filteredDoctors.map((doc) => (
                  <View key={doc.id} style={styles.doctorCard}>
                    <View style={styles.docHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.docName}>{doc.name}</Text>
                          <View
                            style={[
                              styles.badgePill,
                              doc.active ? styles.badgePillGreen : styles.badgePillRed,
                              { marginLeft: 8 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgePillText,
                                doc.active ? styles.badgePillGreenText : styles.badgePillRedText,
                              ]}
                            >
                              {doc.active ? "Active" : "Suspended"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.docDept}>
                          {doc.department} · {doc.specialization}
                        </Text>
                      </View>
                    </View>

                    {/* Metadata Grid */}
                    <View style={styles.docMetaGrid}>
                      <View style={styles.docMetaItem}>
                        <Ionicons name="mail-outline" size={14} color={COLORS.textLight} />
                        <Text style={styles.docMetaText} numberOfLines={1} ellipsizeMode="tail">
                          {doc.email || "No email"}
                        </Text>
                      </View>
                      <View style={styles.docMetaItem}>
                        <Ionicons name="call-outline" size={14} color={COLORS.textLight} />
                        <Text style={styles.docMetaText} numberOfLines={1} ellipsizeMode="tail">
                          {doc.phone || "+91 8303666400"}
                        </Text>
                      </View>
                      <View style={styles.docMetaItem}>
                        <Ionicons name="cash-outline" size={14} color={COLORS.textLight} />
                        <Text style={styles.docMetaText} numberOfLines={1} ellipsizeMode="tail">
                          Fee: ₹{doc.consultationFee}
                        </Text>
                      </View>
                      <View style={styles.docMetaItem}>
                        <Ionicons name="key-outline" size={14} color={COLORS.textLight} />
                        <Text style={styles.docMetaText} numberOfLines={1} ellipsizeMode="tail">
                          {doc.authUserId ? "Account Linked" : "Invite Pending"}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.docActionRow}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}
                        onPress={() => handleOpenAccessModal(doc)}
                      >
                        <Ionicons name="key-outline" size={15} color="#4F46E5" style={{ marginRight: 4 }} />
                        <Text style={[styles.actionBtnText, { color: "#4F46E5" }]}>Access & Invite</Text>
                      </TouchableOpacity>

                      {!doc.authUserId ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#FEF3C7", borderColor: "#FCD34D" }]}
                          onPress={() => handleOpenInviteExistingDoctor(doc)}
                        >
                          <Ionicons name="link-outline" size={15} color="#B45309" style={{ marginRight: 4 }} />
                          <Text style={[styles.actionBtnText, { color: "#B45309" }]}>Link Doctor</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnReset]}
                          onPress={() => handleOpenResetPwd(doc)}
                        >
                          <Ionicons name="key-outline" size={15} color="#2563EB" style={{ marginRight: 4 }} />
                          <Text style={[styles.actionBtnText, { color: "#2563EB" }]}>Password</Text>
                        </TouchableOpacity>
                      )}

                      {doc.verificationStatus === "pending" && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { backgroundColor: "#DBEAFE", borderColor: "#93C5FD" }]}
                          onPress={() => handleVerifyDoctor(doc)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={15} color="#1E40AF" style={{ marginRight: 4 }} />
                          <Text style={[styles.actionBtnText, { color: "#1E40AF" }]}>Verify</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          doc.active ? styles.actionBtnSuspend : styles.actionBtnActivate,
                        ]}
                        onPress={() => handleToggleActive(doc)}
                      >
                        <Ionicons
                          name={doc.active ? "pause-circle-outline" : "play-circle-outline"}
                          size={15}
                          color={doc.active ? "#DC2626" : "#059669"}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.actionBtnText,
                            { color: doc.active ? "#DC2626" : "#059669" },
                          ]}
                        >
                          {doc.active ? "Suspend" : "Activate"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}
                        onPress={() => handleOpenAvailability(doc)}
                      >
                        <Ionicons name="time-outline" size={15} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={[styles.actionBtnText, { color: "#059669" }]}>Schedule</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnEdit]}
                        onPress={() => handleOpenEdit(doc)}
                      >
                        <Ionicons name="create-outline" size={15} color={COLORS.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ==================== TAB 3: APPOINTMENTS ==================== */}
          {activeTab === "appointments" && (
            <View style={styles.tabContent}>
              {/* Header with Schedule Meet button */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: "#0F172A" }}>Consultation Meets</Text>
                  <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Doctor ↔ Patient live scheduling</Text>
                </View>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#0B7A75",
                    paddingHorizontal: 14,
                    paddingVertical: 9,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    shadowColor: "#0B7A75",
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                  onPress={openScheduleMeetModal}
                >
                  <Ionicons name="calendar" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 13 }}>+ Schedule Meet</Text>
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search token, patient name, doctor..."
                  value={appointmentSearch}
                  onChangeText={setAppointmentSearch}
                />
                {Boolean(appointmentSearch) && (
                  <TouchableOpacity onPress={() => setAppointmentSearch("")}>
                    <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Status Filter Chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
                {["all", "confirmed", "pending", "completed", "cancelled"].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.filterChip,
                      appointmentFilter === st && styles.filterChipActive,
                    ]}
                    onPress={() => setAppointmentFilter(st)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        appointmentFilter === st && styles.filterChipTextActive,
                      ]}
                    >
                      {st.charAt(0).toUpperCase() + st.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Appointments List */}
              {filteredAppointments.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="calendar-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>No appointments found.</Text>
                </View>
              ) : (
                filteredAppointments.map((apt) => {
                  const isAptExpired =
                    apt.dbStatus === "completed" ||
                    isMeetExpired(apt.date, apt.time, apt.dbStatus);
                  return (
                  <View key={apt.id} style={styles.aptCard}>
                    <View style={styles.aptHeaderRow}>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <View
                            style={[
                              styles.refPill,
                              apt.type?.toLowerCase().includes("video") ? styles.refPillVideo : styles.refPillOpd,
                            ]}
                          >
                            <Text
                              style={[
                                styles.refPillText,
                                apt.type?.toLowerCase().includes("video") ? styles.refPillVideoText : styles.refPillOpdText,
                              ]}
                            >
                              {formatAppointmentRef(apt.tokenNumber, apt.type)}
                            </Text>
                          </View>
                          <Text style={styles.aptTypeBadgeText}>
                            {apt.type?.toLowerCase().includes("video") ? "Online Video" : "Hospital OPD"}
                          </Text>
                        </View>
                        <Text style={styles.aptType}>{apt.type}</Text>
                      </View>
                      <View
                        style={[
                          styles.aptStatusBadge,
                          !isAptExpired && apt.dbStatus === "confirmed" && styles.statusConfirmed,
                          isAptExpired && styles.statusCompleted,
                          apt.dbStatus === "cancelled" && styles.statusCancelled,
                          apt.dbStatus === "pending" && styles.statusPending,
                        ]}
                      >
                        <Text style={styles.aptStatusText}>
                          {isAptExpired ? "Expired Meet" : apt.status}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.aptDivider} />

                    <View style={styles.aptInfoRow}>
                      <Ionicons name="person" size={15} color={COLORS.primary} style={{ marginRight: 6 }} />
                      <Text style={styles.aptPatientName}>{apt.patientName}</Text>
                      {Boolean(apt.patientPhone) && (
                        <Text style={styles.aptPatientPhone}> · {apt.patientPhone}</Text>
                      )}
                    </View>

                    <View style={styles.aptInfoRow}>
                      <Ionicons name="medkit" size={15} color={COLORS.textLight} style={{ marginRight: 6 }} />
                      <Text style={styles.aptDoctorName}>
                        {apt.doctorName} ({apt.department})
                      </Text>
                    </View>

                    <View style={styles.aptInfoRow}>
                      <Ionicons name="time" size={15} color={COLORS.textLight} style={{ marginRight: 6 }} />
                      <Text style={styles.aptTime}>
                        {apt.date} at {apt.time}
                      </Text>
                    </View>

                    {/* WebRTC Video Consultation Indicator */}
                    {apt.type?.toLowerCase().includes("video") && (
                      <View style={[styles.meetBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                        <View style={styles.meetHeaderRow}>
                          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <Ionicons name="videocam" size={16} color="#059669" />
                            <Text style={[styles.meetBoxTitle, { color: "#065F46" }]}>WebRTC Telehealth Consultation</Text>
                          </View>
                          <View style={[styles.meetActiveBadge, { backgroundColor: "#DCFCE7" }]}>
                            <Text style={[styles.meetActiveBadgeText, { color: "#15803D" }]}>In-App Call</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: "#166534", marginTop: 4 }}>
                          Direct doctor-to-patient encrypted audio/video calling. Initiated directly from Doctor Dashboard.
                        </Text>
                      </View>
                    )}

                    {/* Sync Indicators */}
                    <View style={styles.aptFooterRow}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Ionicons
                          name={apt.googleSheetsSynced ? "checkmark-circle" : "sync-outline"}
                          size={14}
                          color={apt.googleSheetsSynced ? "#059669" : COLORS.textLight}
                        />
                        <Text style={styles.syncFootText}>
                          Sheets: {apt.googleSheetsSynced ? "Synced" : "Queued"}
                        </Text>
                      </View>

                      {Boolean(apt.calendarSyncStatus) && (
                        <View style={{ flexDirection: "row", alignItems: "center", marginLeft: 12 }}>
                          <Ionicons
                            name={apt.calendarSyncStatus === "synced" ? "calendar" : "videocam-outline"}
                            size={14}
                            color={apt.calendarSyncStatus === "synced" ? "#2563EB" : COLORS.textLight}
                          />
                          <Text style={styles.syncFootText}>
                            Calendar: {apt.calendarSyncStatus}
                          </Text>
                        </View>
                      )}

                      <Text style={styles.aptFeeText}>{apt.fee}</Text>
                    </View>
                  </View>
                );
              })
              )}
            </View>
          )}

          {/* ==================== TAB 4: PATIENTS ==================== */}
          {activeTab === "patients" && (
            <View style={styles.tabContent}>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search patient name, email, phone..."
                  value={patientSearch}
                  onChangeText={setPatientSearch}
                />
              </View>

              {filteredPatients.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="people-outline" size={48} color={COLORS.textLight} />
                  <Text style={styles.emptyText}>No registered patients found.</Text>
                </View>
              ) : (
                filteredPatients.map((pat) => (
                  <View key={pat.id} style={styles.patientCard}>
                    <View style={styles.patientAvatar}>
                      <Ionicons name="person" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.patName}>{pat.name}</Text>
                      <Text style={styles.patDetail}>
                        {pat.email || "No email"} {pat.phone ? `· ${pat.phone}` : ""}
                      </Text>
                      <Text style={styles.patMeta}>
                        Blood: {pat.bloodGroup} · Gender: {pat.gender}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ==================== MODAL: ADD / INVITE DOCTOR ==================== */}
      <Modal visible={inviteModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add / Invite Hospital Doctor</Text>
              <TouchableOpacity onPress={() => setInviteModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              <Text style={styles.inputLabel}>Doctor Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Dr. Rajesh Verma"
                value={inviteForm.name}
                onChangeText={(t) => setInviteForm({ ...inviteForm, name: t })}
              />

              <Text style={styles.inputLabel}>Official Email Address *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="dr.rajesh@kmchospital.in"
                keyboardType="email-address"
                autoCapitalize="none"
                value={inviteForm.email}
                onChangeText={(t) => setInviteForm({ ...inviteForm, email: t })}
              />

              <Text style={styles.inputLabel}>Mobile Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="10-digit phone"
                keyboardType="phone-pad"
                value={inviteForm.phone}
                onChangeText={(t) => setInviteForm({ ...inviteForm, phone: t })}
              />

              <Text style={styles.inputLabel}>Department *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => {
                  setDeptPickerTarget("invite");
                  setDeptPickerVisible(true);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name="business-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.dropdownSelectorText, !inviteForm.department && { color: COLORS.textLight }]}>
                    {inviteForm.department || "Select Department"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Specialization</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Senior Pediatric Consultant"
                value={inviteForm.specialization}
                onChangeText={(t) => setInviteForm({ ...inviteForm, specialization: t })}
              />

              <Text style={styles.inputLabel}>Qualification & Experience</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="MBBS, MD"
                  value={inviteForm.qualification}
                  onChangeText={(t) => setInviteForm({ ...inviteForm, qualification: t })}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="15+ Yrs"
                  value={inviteForm.experience}
                  onChangeText={(t) => setInviteForm({ ...inviteForm, experience: t })}
                />
              </View>

              <Text style={styles.inputLabel}>Consultation Fee (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="800"
                keyboardType="numeric"
                value={inviteForm.consultationFee}
                onChangeText={(t) => setInviteForm({ ...inviteForm, consultationFee: t })}
              />

              <Text style={styles.inputLabel}>Initial Account Password (Optional)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Leave blank to auto-generate"
                secureTextEntry
                value={inviteForm.password}
                onChangeText={(t) => setInviteForm({ ...inviteForm, password: t })}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, modalLoading && { opacity: 0.6 }]}
              onPress={handleInviteDoctorSubmit}
              disabled={modalLoading}
            >
              {modalLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>
                  {inviteForm.doctorId ? "Link Doctor & Authorize Login" : "Add & Invite Doctor"}
                </Text>
              )}
            </TouchableOpacity>

            {!inviteForm.doctorId && (
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: "#F3F4F6", marginTop: 8 }]}
                onPress={handleAddDoctorOnly}
                disabled={modalLoading}
              >
                <Text style={[styles.modalSubmitBtnText, { color: COLORS.text }]}>
                  Add to Hospital Directory Only
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== MODAL: EDIT DOCTOR ==================== */}
      <Modal visible={editDocModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Doctor Details</Text>
              <TouchableOpacity onPress={() => setEditDocModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Doctor Full Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.name}
                onChangeText={(t) => setEditForm({ ...editForm, name: t })}
              />

              <Text style={styles.inputLabel}>Department *</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => {
                  setDeptPickerTarget("edit");
                  setDeptPickerVisible(true);
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                  <Ionicons name="business-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                  <Text style={[styles.dropdownSelectorText, !editForm.department && { color: COLORS.textLight }]}>
                    {editForm.department || "Select Department"}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Specialization</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.specialization}
                onChangeText={(t) => setEditForm({ ...editForm, specialization: t })}
              />

              <Text style={styles.inputLabel}>Qualification</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.qualification}
                onChangeText={(t) => setEditForm({ ...editForm, qualification: t })}
              />

              <Text style={styles.inputLabel}>Experience</Text>
              <TextInput
                style={styles.modalInput}
                value={editForm.experience}
                onChangeText={(t) => setEditForm({ ...editForm, experience: t })}
              />

              <Text style={styles.inputLabel}>Consultation Fee (₹)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={editForm.consultation_fee}
                onChangeText={(t) => setEditForm({ ...editForm, consultation_fee: t })}
              />

              <Text style={styles.inputLabel}>Contact Phone</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="phone-pad"
                value={editForm.phone}
                onChangeText={(t) => setEditForm({ ...editForm, phone: t })}
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, modalLoading && { opacity: 0.6 }]}
              onPress={handleSaveEdit}
              disabled={modalLoading}
            >
              {modalLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== MODAL: RESET PASSWORD ==================== */}
      <Modal visible={resetPwdModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Doctor Password</Text>
              <TouchableOpacity onPress={() => setResetPwdModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 14 }}>
              Set a new login password for Dr. {selectedDoctor?.name} ({selectedDoctor?.email}).
            </Text>

            <Text style={styles.inputLabel}>New Password (Min. 6 characters)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter new password"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />

            <TouchableOpacity
              style={[styles.modalSubmitBtn, modalLoading && { opacity: 0.6 }]}
              onPress={handleSaveResetPwd}
              disabled={modalLoading}
            >
              {modalLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Update Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== MODAL: MANAGE AVAILABILITY ==================== */}
      <Modal visible={availModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Doctor Availability Schedule</Text>
                <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 2 }}>
                  Dr. {selectedAvailDoc?.name} ({selectedAvailDoc?.department})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAvailModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginVertical: 10 }}>
              {availSchedule.map((item, idx) => (
                <View
                  key={item.day_of_week}
                  style={{
                    backgroundColor: item.is_available ? "#F0FDF4" : "#F3F4F6",
                    borderColor: item.is_available ? "#BBF7D0" : "#E5E7EB",
                    borderWidth: 1,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: item.is_available ? "#166534" : COLORS.textLight }}>
                      {item.day_of_week === "Mon" ? "Monday" :
                       item.day_of_week === "Tue" ? "Tuesday" :
                       item.day_of_week === "Wed" ? "Wednesday" :
                       item.day_of_week === "Thu" ? "Thursday" :
                       item.day_of_week === "Fri" ? "Friday" :
                       item.day_of_week === "Sat" ? "Saturday" : "Sunday"}
                    </Text>
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 6,
                        backgroundColor: item.is_available ? "#059669" : "#9CA3AF",
                      }}
                      onPress={() => handleToggleDayAvailable(idx)}
                    >
                      <Text style={{ color: COLORS.white, fontSize: 11, fontWeight: "700" }}>
                        {item.is_available ? "Available" : "Off Duty"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {item.is_available && (
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textLight, marginBottom: 2 }}>START TIME</Text>
                        <TextInput
                          style={[styles.modalInput, { marginBottom: 0, paddingVertical: 6, fontSize: 13 }]}
                          value={item.start_time}
                          onChangeText={(val) => handleUpdateDayTime(idx, "start_time", val)}
                          placeholder="09:00 AM"
                        />
                      </View>
                      <Text style={{ color: COLORS.textLight, marginTop: 14 }}>to</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 10, color: COLORS.textLight, marginBottom: 2 }}>END TIME</Text>
                        <TextInput
                          style={[styles.modalInput, { marginBottom: 0, paddingVertical: 6, fontSize: 13 }]}
                          value={item.end_time}
                          onChangeText={(val) => handleUpdateDayTime(idx, "end_time", val)}
                          placeholder="02:00 PM"
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, modalLoading && { opacity: 0.6 }]}
              onPress={handleSaveAvailability}
              disabled={modalLoading}
            >
              {modalLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Schedule</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== MODAL: DOCTOR ACCESS & INVITE CREDENTIALS ==================== */}
      <Modal visible={accessModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="key" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Doctor Access & Credentials</Text>
              </View>
              <TouchableOpacity onPress={() => setAccessModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 480 }}>
              <View style={styles.credCard}>
                <Text style={styles.credDoctorName}>Dr. {accessDoctor?.name}</Text>
                <Text style={styles.credDepartment}>{accessDoctor?.department || "Hospital Doctor"}</Text>

                <View style={styles.credDivider} />

                {/* Email Section */}
                <Text style={styles.credLabel}>DOCTOR LOGIN EMAIL</Text>
                <View style={styles.credValueRow}>
                  <Text style={styles.credValueText} numberOfLines={1}>{accessDoctor?.email || "No email set"}</Text>
                  <TouchableOpacity
                    style={styles.credCopyBtn}
                    onPress={() => copyToClipboard(accessDoctor?.email, "Doctor Email")}
                  >
                    <Ionicons name="copy-outline" size={15} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {/* Password Section */}
                <Text style={[styles.credLabel, { marginTop: 12 }]}>ACTIVE TEMPORARY PASSWORD</Text>
                <View style={styles.credValueRow}>
                  <Text style={[styles.credValueText, { fontWeight: "900", letterSpacing: 1 }]}>
                    {accessTempPassword || "••••••••"}
                  </Text>
                  <TouchableOpacity
                    style={styles.credCopyBtn}
                    onPress={() => copyToClipboard(accessTempPassword, "Temporary Password")}
                  >
                    <Ionicons name="copy-outline" size={15} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>

                {/* Portal Link */}
                <Text style={[styles.credLabel, { marginTop: 12 }]}>DOCTOR PORTAL LOGIN URL</Text>
                <View style={styles.credValueRow}>
                  <Text style={styles.credValueText} numberOfLines={1}>https://kmchospital.in/doctor-login</Text>
                  <TouchableOpacity
                    style={styles.credCopyBtn}
                    onPress={() => copyToClipboard("https://kmchospital.in/doctor-login", "Portal Link")}
                  >
                    <Ionicons name="copy-outline" size={15} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Buttons: 1-click mail, whatsapp, copy, regenerate */}
              <View style={{ marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: "#059669" }]}
                  onPress={() => handleSendDoctorEmail(accessDoctor, accessTempPassword, accessInviteLink)}
                >
                  <Ionicons name="mail" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.modalActionBtnText}>Send Official Email to Doctor</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: "#25D366" }]}
                  onPress={() => handleShareDoctorWhatsApp(accessDoctor, accessTempPassword, accessInviteLink)}
                >
                  <Ionicons name="logo-whatsapp" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.modalActionBtnText}>Share via WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: "#2563EB" }]}
                  onPress={() => {
                    const packet =
                      `Welcome Dr. ${accessDoctor?.name} to KMC Hospital!\n\n` +
                      `Portal: https://kmchospital.in/doctor-login\n` +
                      `Email: ${accessDoctor?.email}\n` +
                      `Temporary Password: ${accessTempPassword}\n\n` +
                      `KMC Hospital, Jankipuram, Lucknow\n` +
                      `Helpline: +91 8303666400`;
                    copyToClipboard(packet, "Doctor Welcome Packet");
                  }}
                >
                  <Ionicons name="clipboard-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                  <Text style={styles.modalActionBtnText}>Copy Full Welcome Message</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" }]}
                  onPress={() => handleRegenerateDoctorPassword(accessDoctor)}
                  disabled={modalLoading}
                >
                  <Ionicons name="refresh" size={18} color={COLORS.text} style={{ marginRight: 8 }} />
                  <Text style={[styles.modalActionBtnText, { color: COLORS.text }]}>
                    {modalLoading ? "Updating Auth..." : "Generate New Temporary Password"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== MODAL: EDIT / ASSIGN GOOGLE MEET LINK ==================== */}
      <Modal visible={meetModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="videocam" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Manage Google Meet Link</Text>
              </View>
              <TouchableOpacity onPress={() => setMeetModalVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: COLORS.textLight, marginBottom: 12 }}>
              Consultation ID: {formatAppointmentRef(selectedAptForMeet?.tokenNumber, selectedAptForMeet?.type)} with Dr. {selectedAptForMeet?.doctorName} for {selectedAptForMeet?.patientName}.
            </Text>

            <Text style={styles.inputLabel}>Google Meet Consultation URL *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://meet.google.com/abc-defg-hij"
              autoCapitalize="none"
              keyboardType="url"
              value={customMeetUrl}
              onChangeText={setCustomMeetUrl}
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.meetQuickBtn, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}
                onPress={() => {
                  const room = `${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
                  setCustomMeetUrl(`https://meet.google.com/${room}`);
                }}
              >
                <Ionicons name="sparkles" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, color: "#2563EB", fontWeight: "700" }}>Generate Room</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.meetQuickBtn, { backgroundColor: "#F8FAFC", borderColor: "#CBD5E1" }]}
                onPress={() => Linking.openURL("https://meet.google.com/new")}
              >
                <Ionicons name="open-outline" size={14} color={COLORS.text} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, color: COLORS.text, fontWeight: "700" }}>Open Google Meet</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, modalLoading && { opacity: 0.6 }]}
              onPress={handleSaveMeetLink}
              disabled={modalLoading}
            >
              {modalLoading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Save Consultation Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* ==================== MODAL: DEPARTMENT PICKER ==================== */}
      <Modal visible={deptPickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "80%" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="business" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Select Department</Text>
              </View>
              <TouchableOpacity onPress={() => setDeptPickerVisible(false)}>
                <Ionicons name="close" size={22} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 12 }}>
              Select the doctor's clinical department. Patients will see this doctor under this department category and filters.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {HOSPITAL_DEPARTMENTS.map((dept) => {
                const isSelected =
                  deptPickerTarget === "invite"
                    ? inviteForm.department === dept
                    : editForm.department === dept;
                return (
                  <TouchableOpacity
                    key={dept}
                    style={[styles.deptOptionRow, isSelected && styles.deptOptionRowSelected]}
                    onPress={() => {
                      if (deptPickerTarget === "invite") {
                        setInviteForm({ ...inviteForm, department: dept });
                      } else {
                        setEditForm({ ...editForm, department: dept });
                      }
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

      {/* Test Push Notification Modal */}
      <Modal visible={testPushModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="notifications" size={22} color="#D97706" />
                <Text style={styles.modalTitle}>Test Push Notification</Text>
              </View>
              <TouchableOpacity onPress={() => setTestPushModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={COLORS.textLight} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 14 }}>
                Send a live test notification through the Supabase Edge Function to verify device delivery.
              </Text>

              {/* Target Selector */}
              <Text style={styles.formLabel}>Notification Recipient</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: testPushTarget === "self" ? COLORS.primary : COLORS.border,
                    backgroundColor: testPushTarget === "self" ? "#EAF6F5" : COLORS.card,
                    alignItems: "center",
                  }}
                  onPress={() => setTestPushTarget("self")}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: testPushTarget === "self" ? COLORS.primary : COLORS.text }}>
                    My Device (Self)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: testPushTarget === "custom" ? COLORS.primary : COLORS.border,
                    backgroundColor: testPushTarget === "custom" ? "#EAF6F5" : COLORS.card,
                    alignItems: "center",
                  }}
                  onPress={() => setTestPushTarget("custom")}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: testPushTarget === "custom" ? COLORS.primary : COLORS.text }}>
                    Specific User ID
                  </Text>
                </TouchableOpacity>
              </View>

              {testPushTarget === "custom" && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.formLabel}>Target Supabase Auth User ID</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Enter user UUID..."
                    value={testPushCustomUserId}
                    onChangeText={setTestPushCustomUserId}
                    autoCapitalize="none"
                  />
                </View>
              )}

              <Text style={styles.formLabel}>Notification Title</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Title..."
                value={testPushTitle}
                onChangeText={setTestPushTitle}
              />

              <Text style={styles.formLabel}>Notification Body</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: "top" }]}
                placeholder="Body message..."
                multiline
                numberOfLines={3}
                value={testPushBody}
                onChangeText={setTestPushBody}
              />

              <TouchableOpacity
                style={{
                  backgroundColor: COLORS.primary,
                  paddingVertical: 13,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 10,
                  flexDirection: "row",
                  gap: 8,
                }}
                disabled={testPushLoading}
                onPress={async () => {
                  const targetId = testPushTarget === "self" ? profile?.id : testPushCustomUserId.trim();
                  if (!targetId) {
                    Alert.alert("Target Required", "Please enter a valid target user ID or select yourself.");
                    return;
                  }
                  setTestPushLoading(true);
                  try {
                    const res = await sendTestPushNotification({
                      userId: targetId,
                      title: testPushTitle,
                      body: testPushBody,
                      data: { type: "test" },
                    });
                    if (res.success) {
                      const details = res.result || {};
                      Alert.alert(
                        "Test Notification Dispatched",
                        `Active devices found: ${details.active_devices_found ?? 0}\n` +
                        `Successful sends: ${details.sent_count ?? 0}\n` +
                        (details.active_devices_found === 0
                          ? "Note: Target user has not registered any push tokens in Supabase yet."
                          : "Notification pushed to device!")
                      );
                      setTestPushModalVisible(false);
                    } else {
                      Alert.alert("Push Notification Error", res.error || "Failed to dispatch notification.");
                    }
                  } catch (e) {
                    Alert.alert("Error", e?.message || "Unexpected error");
                  } finally {
                    setTestPushLoading(false);
                  }
                }}
              >
                {testPushLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={18} color={COLORS.white} />
                    <Text style={{ color: COLORS.white, fontWeight: "800", fontSize: 14 }}>
                      Send Test Push Notification
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ==================== MODAL 9: SCHEDULE CONSULTATION MEET ==================== */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" }}
        >
          <View style={[styles.modalSheet, { maxHeight: "92%", backgroundColor: "#FFFFFF" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: "#0F172A" }]}>Schedule Consultation Meet</Text>
                <Text style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                  Syncs live across Patient App & Doctor Portal
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setScheduleModalVisible(false)}
                style={{ padding: 6, borderRadius: 8, backgroundColor: "#F1F5F9" }}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              {/* STEP 1: SELECT DOCTOR */}
              <Text style={styles.formLabel}>👨‍⚕️ 1. Select Registered Doctor *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                  {doctors.map((doc) => {
                    const isSelected = String(scheduleForm.selectedDoctorId) === String(doc.id);
                    return (
                      <TouchableOpacity
                        key={doc.id}
                        style={[
                          styles.selectorCard,
                          isSelected && styles.selectorCardActive,
                        ]}
                        onPress={() => setScheduleForm({ ...scheduleForm, selectedDoctorId: doc.id })}
                      >
                        <View style={styles.selectorAvatar}>
                          <Ionicons name="medical" size={16} color="#0B7A75" />
                        </View>
                        <View style={{ flex: 1, marginRight: 6 }}>
                          <Text style={styles.selectorDocName} numberOfLines={1}>
                            {doc.name}
                          </Text>
                          <Text style={styles.selectorDocDept} numberOfLines={1}>
                            {doc.department} • ₹{doc.consultationFee || doc.consultation_fee || 800}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={18} color="#0B7A75" />
                        )}
                        {Boolean(doc.isOnline || doc.is_online) && (
                          <View style={styles.onlineBadgeDoc} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              {/* STEP 2: SELECT PATIENT */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={styles.formLabel}>👥 2. Select Registered Patient *</Text>
                <View style={{ flexDirection: "row", backgroundColor: "#F1F5F9", borderRadius: 8, padding: 2 }}>
                  <TouchableOpacity
                    style={[
                      styles.toggleMiniBtn,
                      scheduleForm.patientMode === "registered" && styles.toggleMiniBtnActive,
                    ]}
                    onPress={() => setScheduleForm({ ...scheduleForm, patientMode: "registered" })}
                  >
                    <Text
                      style={[
                        styles.toggleMiniBtnText,
                        scheduleForm.patientMode === "registered" && styles.toggleMiniBtnTextActive,
                      ]}
                    >
                      Registered ({patients.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleMiniBtn,
                      scheduleForm.patientMode === "custom" && styles.toggleMiniBtnActive,
                    ]}
                    onPress={() => setScheduleForm({ ...scheduleForm, patientMode: "custom" })}
                  >
                    <Text
                      style={[
                        styles.toggleMiniBtnText,
                        scheduleForm.patientMode === "custom" && styles.toggleMiniBtnTextActive,
                      ]}
                    >
                      + Walk-In / New
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {scheduleForm.patientMode === "registered" ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                    {patients.map((pat) => {
                      const isSelected = String(scheduleForm.selectedPatientId) === String(pat.id);
                      return (
                        <TouchableOpacity
                          key={pat.id}
                          style={[
                            styles.patCard,
                            isSelected && styles.patCardActive,
                          ]}
                          onPress={() => setScheduleForm({ ...scheduleForm, selectedPatientId: pat.id })}
                        >
                          <View style={styles.patCardAvatar}>
                            <Ionicons name="person" size={14} color="#D97706" />
                          </View>
                          <View style={{ maxWidth: 140 }}>
                            <Text style={styles.patCardName} numberOfLines={1}>
                              {pat.name || pat.full_name}
                            </Text>
                            <Text style={styles.patCardContact} numberOfLines={1}>
                              {pat.phone || pat.email || "Registered Patient"}
                            </Text>
                          </View>
                          {isSelected && (
                            <Ionicons name="checkmark-circle" size={16} color="#0B7A75" style={{ marginLeft: 4 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              ) : (
                <View style={{ marginBottom: 12, backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4 }}>
                    Walk-In / New Patient Full Name *
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: "#FFFFFF", marginBottom: 8 }]}
                    placeholder="e.g., Rajesh Kumar"
                    value={scheduleForm.customPatientName}
                    onChangeText={(t) => setScheduleForm({ ...scheduleForm, customPatientName: t })}
                  />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4 }}>
                    Mobile Number
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: "#FFFFFF", marginBottom: 8 }]}
                    placeholder="+91 9876543210"
                    keyboardType="phone-pad"
                    value={scheduleForm.customPatientPhone}
                    onChangeText={(t) => setScheduleForm({ ...scheduleForm, customPatientPhone: t })}
                  />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4 }}>
                    Email Address
                  </Text>
                  <TextInput
                    style={[styles.formInput, { backgroundColor: "#FFFFFF" }]}
                    placeholder="patient@gmail.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={scheduleForm.customPatientEmail}
                    onChangeText={(t) => setScheduleForm({ ...scheduleForm, customPatientEmail: t })}
                  />
                </View>
              )}

              {/* STEP 3: CONSULTATION DATE */}
              <Text style={styles.formLabel}>📅 3. Select Consultation Date *</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {getDateOptions().map((opt) => {
                  const isSelected = scheduleForm.date === opt.dateStr;
                  return (
                    <TouchableOpacity
                      key={opt.dateStr}
                      style={[
                        styles.dateChip,
                        isSelected && styles.dateChipActive,
                      ]}
                      onPress={() => setScheduleForm({ ...scheduleForm, date: opt.dateStr })}
                    >
                      <Text style={[styles.dateChipText, isSelected && styles.dateChipTextActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.dateChipSub, isSelected && styles.dateChipSubActive]}>
                        {opt.dateStr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* STEP 4: AVAILABLE TIME SLOTS (Conflict-Free Live Availability) */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={styles.formLabel}>⏰ 4. Select Available Time Slot *</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981", marginRight: 4 }} />
                    <Text style={{ fontSize: 11, color: "#64748B", fontWeight: "600" }}>Available</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#DC2626", marginRight: 4 }} />
                    <Text style={{ fontSize: 11, color: "#DC2626", fontWeight: "600" }}>Booked</Text>
                  </View>
                  {loadingSlots && <ActivityIndicator size="small" color="#0B7A75" />}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {AVAILABLE_TIME_SLOTS.map((slot) => {
                  const isSelected = scheduleForm.time === slot;
                  const isBooked = Boolean(modalSlots[slot]?.status === "booked" || modalSlots[slot]?.booked);
                  return (
                    <TouchableOpacity
                      key={slot}
                      disabled={isBooked}
                      style={[
                        styles.slotChip,
                        isSelected && styles.slotChipActive,
                        isBooked && styles.slotChipBooked,
                      ]}
                      onPress={() => {
                        if (!isBooked) {
                          setScheduleForm({ ...scheduleForm, time: slot });
                        }
                      }}
                    >
                      <Ionicons
                        name={isBooked ? "close-circle" : "time-outline"}
                        size={13}
                        color={isSelected ? "#FFFFFF" : isBooked ? "#DC2626" : "#64748B"}
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[
                          styles.slotChipText,
                          isSelected && styles.slotChipTextActive,
                          isBooked && styles.slotChipTextBooked,
                        ]}
                      >
                        {slot}
                      </Text>
                      {isBooked && (
                        <View style={styles.bookedMiniTag}>
                          <Text style={styles.bookedMiniTagText}>Booked</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* STEP 5: CONSULTATION MODE */}
              <Text style={styles.formLabel}>🩺 5. Consultation Mode</Text>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    scheduleForm.type === "Video Consultation" && styles.modeCardActive,
                  ]}
                  onPress={() => setScheduleForm({ ...scheduleForm, type: "Video Consultation" })}
                >
                  <Ionicons
                    name="videocam"
                    size={20}
                    color={scheduleForm.type === "Video Consultation" ? "#0B7A75" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.modeCardText,
                      scheduleForm.type === "Video Consultation" && styles.modeCardTextActive,
                    ]}
                  >
                    Video Meet (Online)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeCard,
                    scheduleForm.type === "Hospital Visit" && styles.modeCardActive,
                  ]}
                  onPress={() => setScheduleForm({ ...scheduleForm, type: "Hospital Visit" })}
                >
                  <Ionicons
                    name="business"
                    size={20}
                    color={scheduleForm.type === "Hospital Visit" ? "#0B7A75" : "#64748B"}
                  />
                  <Text
                    style={[
                      styles.modeCardText,
                      scheduleForm.type === "Hospital Visit" && styles.modeCardTextActive,
                    ]}
                  >
                    Hospital In-Person
                  </Text>
                </TouchableOpacity>
              </View>

              {/* STEP 6: CLINICAL NOTES */}
              <Text style={styles.formLabel}>📝 Clinical Notes / Reason</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: "#FFFFFF", marginBottom: 14 }]}
                placeholder="e.g., General checkup, blood pressure review, cardiology follow-up..."
                value={scheduleForm.notes}
                onChangeText={(t) => setScheduleForm({ ...scheduleForm, notes: t })}
              />

              {/* SUMMARY CARD */}
              <View style={styles.summaryCard}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <Ionicons name="checkmark-circle" size={16} color="#0B7A75" style={{ marginRight: 6 }} />
                  <Text style={styles.summaryCardTitle}>Consultation Booking Summary</Text>
                </View>
                <Text style={styles.summaryCardText}>
                  • Doctor: {doctors.find((d) => String(d.id) === String(scheduleForm.selectedDoctorId))?.name || "Not selected"}
                </Text>
                <Text style={styles.summaryCardText}>
                  • Patient: {scheduleForm.patientMode === "registered"
                    ? patients.find((p) => String(p.id) === String(scheduleForm.selectedPatientId))?.name || "Not selected"
                    : scheduleForm.customPatientName || "Walk-In Patient"}
                </Text>
                <Text style={styles.summaryCardText}>
                  • Schedule: {scheduleForm.date} at {scheduleForm.time || "Select a slot"} ({scheduleForm.type})
                </Text>
                <Text style={[styles.summaryCardText, { color: "#0B7A75", fontWeight: "700", marginTop: 4 }]}>
                  • Live Sync: Doctor Dashboard & Patient App will update instantly.
                </Text>
              </View>

              {/* SUBMIT BUTTON */}
              <TouchableOpacity
                style={[
                  styles.formSubmitBtn,
                  { backgroundColor: "#0B7A75", marginTop: 16 },
                  scheduleSubmitting && { opacity: 0.7 },
                ]}
                disabled={scheduleSubmitting}
                onPress={handleConfirmScheduleMeeting}
              >
                {scheduleSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="calendar" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.formSubmitBtnText, { color: "#FFFFFF" }]}>
                      Confirm & Schedule Meet
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  adminBadgeRow: { flexDirection: "row", alignItems: "center" },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  adminBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "800", marginLeft: 3 },
  hospitalSub: { fontSize: 11, color: COLORS.textLight },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 3 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    borderRadius: 8,
  },
  tabItemActive: {
    borderBottomColor: COLORS.primary,
    backgroundColor: "#EAF6F5",
  },
  tabIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  tabCountBadge: {
    position: "absolute",
    top: -4,
    right: -10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tabCountBadgeActive: {
    backgroundColor: COLORS.primary,
  },
  tabCountText: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.textLight,
  },
  tabCountTextActive: {
    color: COLORS.white,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: "center",
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: "800",
  },
  contentWrap: { flex: 1, padding: 14 },
  tabContent: { paddingBottom: 30 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { fontSize: 13, color: COLORS.textLight, marginTop: 10 },

  // Stats Grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statNumber: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 2, fontWeight: "600" },
  statSubRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },

  // Generic Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeaderTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 12 },
  syncRow: { gap: 10 },
  syncItem: { flexDirection: "row", alignItems: "center" },
  syncTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  syncDesc: { fontSize: 11, color: COLORS.textLight },
  syncDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  statusBadgeGreen: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeGreenText: { color: "#166534", fontSize: 11, fontWeight: "700" },
  statusBadgeBlue: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeBlueText: { color: "#1E40AF", fontSize: 11, fontWeight: "700" },

  // Quick Actions
  quickActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickActionBtn: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickActionText: { fontSize: 11, fontWeight: "700", color: COLORS.text, textAlign: "center" },

  // Filter Bar
  filterBar: { flexDirection: "row", gap: 10, marginBottom: 12, alignItems: "center" },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.text },
  addDoctorBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addDoctorBtnText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },

  // Doctor Cards
  doctorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  docName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  docDept: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  badgePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePillGreen: { backgroundColor: "#DCFCE7" },
  badgePillGreenText: { color: "#166534", fontSize: 10, fontWeight: "800" },
  badgePillRed: { backgroundColor: "#FEE2E2" },
  badgePillRedText: { color: "#991B1B", fontSize: 10, fontWeight: "800" },
  docMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  docMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    width: "48%",
    minWidth: 130,
    flexShrink: 1,
  },
  docMetaText: {
    fontSize: 11.5,
    color: COLORS.textLight,
    marginLeft: 6,
    flexShrink: 1,
  },
  docActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    flexBasis: "48%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnSuspend: { backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" },
  actionBtnActivate: { backgroundColor: "#F0FDF4", borderColor: "#86EFAC" },
  actionBtnEdit: { backgroundColor: "#EAF6F5", borderColor: "#99F6E4" },
  actionBtnReset: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  actionBtnText: { fontSize: 12, fontWeight: "700", marginLeft: 4 },

  // Appointments
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, color: COLORS.textLight, fontWeight: "600" },
  filterChipTextActive: { color: COLORS.white, fontWeight: "800" },
  aptCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aptHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  aptToken: { fontSize: 14, fontWeight: "800", color: COLORS.primary },
  aptType: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  aptStatusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusConfirmed: { backgroundColor: "#DCFCE7" },
  statusCompleted: { backgroundColor: "#DBEAFE" },
  statusCancelled: { backgroundColor: "#FEE2E2" },
  statusPending: { backgroundColor: "#FEF3C7" },
  aptStatusText: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  aptDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  aptInfoRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  aptPatientName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  aptPatientPhone: { fontSize: 12, color: COLORS.textLight },
  aptDoctorName: { fontSize: 12, color: COLORS.text },
  aptTime: { fontSize: 12, color: COLORS.textLight },
  aptFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
  },
  syncFootText: { fontSize: 10, color: COLORS.textLight, marginLeft: 3 },
  aptFeeText: { fontSize: 12, fontWeight: "800", color: COLORS.text },

  // Patients
  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  patientAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
  },
  patName: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  patDetail: { fontSize: 11, color: COLORS.textLight, marginTop: 1 },
  patMeta: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },

  emptyWrap: { alignItems: "center", justifyContent: "center", padding: 30 },
  emptyText: { fontSize: 13, color: COLORS.textLight, marginTop: 8 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  inputLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginTop: 10, marginBottom: 4 },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.text,
  },
  modalSubmitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  modalSubmitBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },

  // Reference Pills & Badges
  refPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  aptTypeBadgeText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "600",
    marginLeft: 6,
  },

  // Google Meet Consultation Box
  meetBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    marginVertical: 8,
  },
  meetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  meetBoxTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E3A8A",
    marginLeft: 6,
  },
  meetActiveBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meetActiveBadgeText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "700",
  },
  meetMissingBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meetMissingBadgeText: {
    color: "#B45309",
    fontSize: 10,
    fontWeight: "700",
  },
  meetUrlText: {
    fontSize: 11,
    color: "#2563EB",
    fontWeight: "600",
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  meetPlaceholderText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: "italic",
    marginBottom: 8,
  },
  meetActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  meetActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  meetActionBtnText: {
    fontSize: 11,
    fontWeight: "700",
  },
  meetQuickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },

  // Credentials Card & Actions
  credCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
  },
  credDoctorName: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },
  credDepartment: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
  },
  credDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 10,
  },
  credLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.textLight,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  credValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  credValueText: {
    fontSize: 13,
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  credCopyBtn: {
    padding: 4,
  },
  modalActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalActionBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
  },
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
    marginBottom: 12,
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

  // Schedule Modal styles
  selectorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    width: 200,
    position: "relative",
  },
  selectorCardActive: {
    borderColor: "#0B7A75",
    backgroundColor: "#F0FDFA",
    borderWidth: 1.5,
  },
  selectorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#CCFBF1",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  selectorDocName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  selectorDocDept: {
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },
  onlineBadgeDoc: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  toggleMiniBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleMiniBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleMiniBtnText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
  },
  toggleMiniBtnTextActive: {
    color: "#0B7A75",
    fontWeight: "800",
  },
  patCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  patCardActive: {
    borderColor: "#0B7A75",
    backgroundColor: "#F0FDFA",
    borderWidth: 1.5,
  },
  patCardAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  patCardName: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
  },
  patCardContact: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 1,
  },
  dateChip: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  dateChipActive: {
    borderColor: "#0B7A75",
    backgroundColor: "#F0FDFA",
    borderWidth: 1.5,
  },
  dateChipText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },
  dateChipTextActive: {
    color: "#0B7A75",
  },
  dateChipSub: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 2,
  },
  dateChipSubActive: {
    color: "#0D9488",
    fontWeight: "700",
  },
  slotChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  slotChipActive: {
    backgroundColor: "#0B7A75",
    borderColor: "#0B7A75",
  },
  slotChipBooked: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  slotChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  slotChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  slotChipTextBooked: {
    color: "#DC2626",
    fontWeight: "700",
  },
  bookedMiniTag: {
    marginLeft: 5,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  bookedMiniTagText: {
    color: "#DC2626",
    fontSize: 9,
    fontWeight: "800",
  },
  modeCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  modeCardActive: {
    borderColor: "#0B7A75",
    backgroundColor: "#F0FDFA",
    borderWidth: 1.5,
  },
  modeCardText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  modeCardTextActive: {
    color: "#0B7A75",
    fontWeight: "800",
  },
  summaryCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  summaryCardTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryCardText: {
    color: "#475569",
    fontSize: 12,
    marginTop: 3,
  },
});
