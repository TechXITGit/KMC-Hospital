import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";
import { useAuth } from "../../context/AuthContext";
import {
  fetchSuperAdminStats,
  fetchSuperAdminAllMeetings,
  subscribeToMeetingsRealtime,
  fetchSuperAdminOnlineRoster,
  fetchAllDoctorsForSuperAdmin,
  createDoctorBySuperAdmin,
  updateDoctorBySuperAdmin,
  deleteDoctorBySuperAdmin,
  toggleDoctorOnlineStatusBySuperAdmin,
  createSampleMeetingBySuperAdmin,
  scheduleMeetingBySuperAdmin,
  fetchDoctorSlotStatuses,
  fetchAllPatientsForSuperAdmin,
  createPatientBySuperAdmin,
  deletePatientBySuperAdmin,
  fetchAllAdminsForSuperAdmin,
  createAdminBySuperAdmin,
  deleteAdminBySuperAdmin,
  revokeAdminAccessBySuperAdmin,
  restoreAdminAccessBySuperAdmin,
  broadcastHospitalAnnouncement,
} from "../../services/superAdminService";

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
  const options = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const label =
      i === 0
        ? "Today"
        : i === 1
        ? "Tomorrow"
        : d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
    options.push({ dateStr, label });
  }
  return options;
};

export default function SuperAdminDashboardScreen({ navigation }) {
  const { user, profile, logout } = useAuth();

  // Active Tab: 'meets' | 'doctors' | 'patients' | 'admins' | 'system'
  const [activeTab, setActiveTab] = useState("meets");

  // Loading & Refreshing States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalAppointments: 0,
    todayMeets: 0,
    activeCallsCount: 0,
    totalDoctors: 0,
    activeDoctors: 0,
    totalPatients: 0,
    totalAdmins: 0,
    totalRevenue: 0,
    estimatedOnline: 0,
  });

  // Data collections
  const [meetings, setMeetings] = useState([]);
  const [onlineRoster, setOnlineRoster] = useState({ allDoctors: [], allUsers: [], totalOnline: 0 });
  const [rosterFilter, setRosterFilter] = useState("all"); // 'all' | 'doctors' | 'patients' | 'admins'
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [admins, setAdmins] = useState([]);

  // Search queries
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [doctorModalVisible, setDoctorModalVisible] = useState(false);
  const [patientModalVisible, setPatientModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [scheduleForm, setScheduleForm] = useState({
    patientMode: "registered", // 'registered' | 'custom'
    selectedPatientId: "",
    customPatientName: "",
    customPatientPhone: "",
    customPatientEmail: "",
    selectedDoctorId: "",
    date: new Date().toISOString().split("T")[0],
    time: "10:00 AM",
    type: "Video Consultation",
    notes: "Telehealth Consultation & Checkup",
  });
  const [modalSlots, setModalSlots] = useState({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const modalTrackerRef = useRef({
    visible: false,
    docId: "",
    date: "",
  });

  const [newDoctor, setNewDoctor] = useState({
    name: "",
    department: "Cardiology",
    specialization: "Heart Specialist",
    email: "",
    phone: "",
    consultationFee: "800",
    experience: "5 years",
  });

  const [newPatient, setNewPatient] = useState({
    fullName: "",
    email: "",
    phone: "",
    gender: "Male",
    bloodGroup: "O+",
    dob: "1995-05-15",
  });

  const [newAdmin, setNewAdmin] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    department: "Hospital Administration",
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  const [broadcastData, setBroadcastData] = useState({
    title: "",
    message: "",
  });

  // Slot availability loader for the scheduler modal
  const loadModalSlotStatuses = useCallback(async (docId, dateVal) => {
    if (!docId || !dateVal) return;
    setLoadingSlots(true);
    try {
      const statuses = await fetchDoctorSlotStatuses(docId, dateVal);
      setModalSlots(statuses || {});
      setScheduleForm((prev) => {
        if (prev.time && (statuses?.[prev.time]?.status === "booked" || statuses?.[prev.time]?.booked)) {
          return { ...prev, time: "" };
        }
        return prev;
      });
    } catch (e) {
      console.warn("[SuperAdmin] loadModalSlotStatuses notice:", e);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  // Synchronize tracker ref for background realtime listener
  useEffect(() => {
    modalTrackerRef.current = {
      visible: scheduleModalVisible,
      docId: scheduleForm.selectedDoctorId,
      date: scheduleForm.date,
    };
  }, [scheduleModalVisible, scheduleForm.selectedDoctorId, scheduleForm.date]);

  // Load slot statuses whenever doctor, date, or modal visibility changes
  useEffect(() => {
    if (scheduleModalVisible && scheduleForm.selectedDoctorId && scheduleForm.date) {
      loadModalSlotStatuses(scheduleForm.selectedDoctorId, scheduleForm.date);
    }
  }, [scheduleModalVisible, scheduleForm.selectedDoctorId, scheduleForm.date, loadModalSlotStatuses]);

  // Load all Super Admin data
  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [statsData, meetsRes, rosterRes, docsRes, patsRes, adminsRes] = await Promise.all([
        fetchSuperAdminStats(),
        fetchSuperAdminAllMeetings(),
        fetchSuperAdminOnlineRoster(),
        fetchAllDoctorsForSuperAdmin(),
        fetchAllPatientsForSuperAdmin(),
        fetchAllAdminsForSuperAdmin(),
      ]);

      setStats(statsData);
      if (meetsRes.success) setMeetings(meetsRes.meetings);
      if (rosterRes.success) setOnlineRoster(rosterRes);
      if (docsRes.success) setDoctors(docsRes.doctors);
      if (patsRes.success) setPatients(patsRes.patients);
      if (adminsRes.success) setAdmins(adminsRes.admins);
    } catch (err) {
      console.warn("[SuperAdminDashboard] Error loading data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // Subscribe to realtime meeting changes & live broadcasts
    const unsubMeets = subscribeToMeetingsRealtime(() => {
      loadAllData(true);
      // If modal is open, refresh its slots in real-time too
      if (modalTrackerRef.current.visible && modalTrackerRef.current.docId && modalTrackerRef.current.date) {
        loadModalSlotStatuses(modalTrackerRef.current.docId, modalTrackerRef.current.date);
      }
    });

    // Auto-poll online presence every 10 seconds
    const interval = setInterval(() => {
      loadAllData(true);
    }, 10000);

    return () => {
      unsubMeets();
      clearInterval(interval);
    };
  }, [loadAllData, loadModalSlotStatuses]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAllData(true);
  };

  // ─── DOCTOR ACTIONS ────────────────────────────────────────────────────────
  const handleCreateDoctor = async () => {
    if (!newDoctor.name.trim() || !newDoctor.department.trim()) {
      Alert.alert("Required", "Doctor name and department are required.");
      return;
    }
    setSubmitting(true);
    const res = await createDoctorBySuperAdmin(newDoctor);
    setSubmitting(false);
    if (res.success) {
      setDoctorModalVisible(false);
      setNewDoctor({
        name: "",
        department: "Cardiology",
        specialization: "Heart Specialist",
        email: "",
        phone: "",
        consultationFee: "800",
        experience: "5 years",
      });
      Alert.alert("Doctor Added", "New doctor created and registered successfully.");
      loadAllData(true);
    } else {
      Alert.alert("Failed", res.error || "Could not add doctor.");
    }
  };

  const handleToggleDoctorStatus = async (doctor) => {
    const newActive = doctor.active === false ? true : false;
    const res = await updateDoctorBySuperAdmin(doctor.id, {
      active: newActive,
      verification_status: newActive ? "verified" : "suspended",
    });
    if (res.success) {
      loadAllData(true);
    } else {
      Alert.alert("Error", res.error || "Failed to update doctor status");
    }
  };

  const handleDeleteDoctor = (doctor) => {
    Alert.alert(
      "Delete Doctor",
      `Are you sure you want to permanently remove Dr. ${doctor.name}? This will remove their profile.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await deleteDoctorBySuperAdmin(doctor.id);
            if (res.success) {
              loadAllData(true);
            } else {
              Alert.alert("Error", res.error || "Failed to delete doctor");
            }
          },
        },
      ]
    );
  };

  const handleToggleDoctorOnline = async (doctor) => {
    const res = await toggleDoctorOnlineStatusBySuperAdmin(doctor.id, Boolean(doctor.is_online));
    if (res.success) {
      loadAllData(true);
    } else {
      Alert.alert("Error", res.error || "Failed to update doctor online status");
    }
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
      notes: "Telehealth Consultation & Checkup",
    });
    setModalSlots({});
    setScheduleModalVisible(true);
    if (firstDoc) {
      loadModalSlotStatuses(firstDoc, todayIso);
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

    // Strict slot conflict check
    if (modalSlots[scheduleForm.time]?.status === "booked" || modalSlots[scheduleForm.time]?.booked) {
      Alert.alert(
        "Slot Unavailable",
        `Dr. ${docObj.name} is already booked for ${scheduleForm.time} on ${scheduleForm.date}. Please pick an available slot.`
      );
      return;
    }

    setSubmitting(true);
    const res = await scheduleMeetingBySuperAdmin({
      patient: patObj,
      doctor: docObj,
      date: scheduleForm.date,
      time: scheduleForm.time,
      type: scheduleForm.type,
      notes: scheduleForm.notes,
    });
    setSubmitting(false);

    if (res.success) {
      setScheduleModalVisible(false);
      Alert.alert(
        "Meet Scheduled Successfully! 📅",
        `Consultation confirmed between Dr. ${docObj.name} and ${patObj.full_name || patObj.name}.\n\nDate: ${scheduleForm.date}\nTime: ${scheduleForm.time}\nMode: ${scheduleForm.type}\n\nBoth Patient's App and Doctor's Portal have been synchronized.`
      );
      loadAllData(true);
    } else {
      Alert.alert("Booking Failed", res.error || "Could not schedule consultation meet.");
    }
  };

  const handleCreateTestMeeting = () => {
    openScheduleMeetModal();
  };

  // ─── PATIENT ACTIONS ───────────────────────────────────────────────────────
  const handleCreatePatient = async () => {
    if (!newPatient.fullName.trim() || !newPatient.email.trim()) {
      Alert.alert("Required", "Patient full name and email are required.");
      return;
    }
    setSubmitting(true);
    const res = await createPatientBySuperAdmin(newPatient);
    setSubmitting(false);
    if (res.success) {
      setPatientModalVisible(false);
      setNewPatient({
        fullName: "",
        email: "",
        phone: "",
        gender: "Male",
        bloodGroup: "O+",
        dob: "1995-05-15",
      });
      Alert.alert("Patient Registered", "Patient profile created successfully.");
      loadAllData(true);
    } else {
      Alert.alert("Failed", res.error || "Could not register patient.");
    }
  };

  const handleDeletePatient = (patient) => {
    Alert.alert(
      "Delete Patient",
      `Are you sure you want to remove patient ${patient.full_name || patient.email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await deletePatientBySuperAdmin(patient.id);
            if (res.success) {
              loadAllData(true);
            } else {
              Alert.alert("Error", res.error || "Failed to delete patient");
            }
          },
        },
      ]
    );
  };

  // ─── ADMIN ACTIONS ─────────────────────────────────────────────────────────
  const handleCreateAdmin = async () => {
    if (!newAdmin.fullName.trim() || !newAdmin.email.trim()) {
      Alert.alert("Required", "Admin name and email are required.");
      return;
    }
    if (!newAdmin.password || newAdmin.password.length < 6) {
      Alert.alert("Password Required", "Please enter a valid password (minimum 6 characters) for this administrator.");
      return;
    }
    setSubmitting(true);
    const res = await createAdminBySuperAdmin(newAdmin);
    setSubmitting(false);
    if (res.success) {
      setAdminModalVisible(false);
      const createdEmail = newAdmin.email;
      const createdPassword = newAdmin.password;
      setNewAdmin({
        fullName: "",
        email: "",
        password: "",
        phone: "",
        department: "Hospital Administration",
      });
      setShowAdminPassword(false);
      Alert.alert(
        "Admin Created Successfully",
        `Hospital Administrator added!\n\nEmail: ${createdEmail}\nPassword: ${createdPassword}\n\nThey can now sign in to the Hospital Admin portal with these credentials.`
      );
      loadAllData(true);
    } else {
      Alert.alert("Failed", res.error || "Could not create admin.");
    }
  };

  const handleRevokeAdmin = (admin) => {
    Alert.alert(
      "Revoke Admin Access",
      `Are you sure you want to revoke administrative privileges for ${admin.full_name || admin.email}?\n\nThis administrator will be blocked from logging into the Hospital Admin portal.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke Access",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const res = await revokeAdminAccessBySuperAdmin(admin.email || admin.id);
            setLoading(false);
            if (res.success) {
              Alert.alert("Access Revoked", `Privileges for ${admin.email || admin.full_name} have been revoked.`);
              loadAllData(true);
            } else {
              Alert.alert("Error", res.error || "Failed to revoke admin privileges");
            }
          },
        },
      ]
    );
  };

  const handleRestoreAdmin = (admin) => {
    Alert.alert(
      "Restore Admin Access",
      `Are you sure you want to restore administrative privileges for ${admin.full_name || admin.email}?\n\nThey will regain full access to the Hospital Admin portal.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore Privileges",
          onPress: async () => {
            setLoading(true);
            const res = await restoreAdminAccessBySuperAdmin(admin.email || admin.id);
            setLoading(false);
            if (res.success) {
              Alert.alert("Access Restored", `Privileges for ${admin.email || admin.full_name} have been restored.`);
              loadAllData(true);
            } else {
              Alert.alert("Error", res.error || "Failed to restore admin privileges");
            }
          },
        },
      ]
    );
  };

  const handleDeleteAdmin = (admin) => {
    handleRevokeAdmin(admin);
  };

  // ─── BROADCAST ACTION ─────────────────────────────────────────────────────
  const handleSendBroadcast = async () => {
    if (!broadcastData.title.trim() || !broadcastData.message.trim()) {
      Alert.alert("Required", "Please provide announcement title and message.");
      return;
    }
    setSubmitting(true);
    const res = await broadcastHospitalAnnouncement(broadcastData);
    setSubmitting(false);
    if (res.success) {
      setBroadcastModalVisible(false);
      setBroadcastData({ title: "", message: "" });
      Alert.alert("Broadcast Dispatched", "Emergency alert sent to all patients and staff.");
    } else {
      Alert.alert("Failed", res.error || "Could not dispatch broadcast.");
    }
  };

  // Filtered Roster (Sorted so Online Users always appear at top)
  const combinedRoster = React.useMemo(() => {
    let list = [];
    if (rosterFilter === "all") {
      list = [
        ...onlineRoster.allDoctors,
        ...onlineRoster.allUsers.filter((u) => u.role === "admin"),
        ...onlineRoster.allUsers.filter((u) => u.role === "patient"),
      ];
    } else if (rosterFilter === "online") {
      list = [
        ...onlineRoster.allDoctors.filter((d) => d.isOnline),
        ...onlineRoster.allUsers.filter((u) => u.isOnline),
      ];
    } else if (rosterFilter === "doctors") {
      list = [...onlineRoster.allDoctors];
    } else if (rosterFilter === "admins") {
      list = onlineRoster.allUsers.filter((u) => u.role === "admin");
    } else if (rosterFilter === "patients") {
      list = onlineRoster.allUsers.filter((u) => u.role === "patient");
    }

    return [...list].sort((a, b) => {
      if (Boolean(a.isOnline) === Boolean(b.isOnline)) return 0;
      return a.isOnline ? -1 : 1;
    });
  }, [rosterFilter, onlineRoster]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0B7A75"
            colors={["#0B7A75"]}
          />
        }
      >
        {/* ─── HEADER ─── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.badgeRow}>
              <View style={styles.superBadge}>
                <MaterialCommunityIcons name="shield-crown" size={13} color="#92400E" />
                <Text style={styles.superBadgeText}>SUPER ADMIN</Text>
              </View>
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>SYSTEM LIVE</Text>
              </View>
            </View>
            <Text style={styles.headerTitle}>KMC Command Center</Text>
            <Text style={styles.headerSub}>Full Oversight & Telehealth Monitoring</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.btnIcon}
              onPress={() => loadAllData(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color="#334155" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnIcon, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}
              onPress={() => setBroadcastModalVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="megaphone" size={17} color="#DC2626" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnIcon, { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" }]}
              onPress={logout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── KPI METRIC CARDS (NON-STICKY, SCROLLS NATURALLY) ─── */}
        <View style={styles.kpiContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiScroll}>
            {/* Live Online */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="pulse" size={18} color="#047857" />
                </View>
                <View style={styles.kpiLiveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.kpiLiveText}>LIVE</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{onlineRoster.totalOnline || stats.estimatedOnline || 0}</Text>
              <Text style={styles.kpiLabel}>Online Users</Text>
              <Text style={styles.kpiSub}>
                {onlineRoster.onlineDoctorsCount || stats.onlineDoctorsCount || 0} Doctors • {onlineRoster.onlineUsersCount || 1} Staff & Patients
              </Text>
            </View>

            {/* Active Calls */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#EEF2FF" }]}>
                  <Ionicons name="videocam" size={18} color="#4F46E5" />
                </View>
                <View style={[styles.kpiTagBadge, { backgroundColor: "#EEF2FF" }]}>
                  <Text style={[styles.kpiTagText, { color: "#4F46E5" }]}>ROOMS</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{stats.activeCallsCount}</Text>
              <Text style={styles.kpiLabel}>Active Video Calls</Text>
              <Text style={styles.kpiSub}>Live telehealth meets</Text>
            </View>

            {/* Today Meets */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#FFFBEB" }]}>
                  <Ionicons name="calendar" size={18} color="#D97706" />
                </View>
                <View style={[styles.kpiTagBadge, { backgroundColor: "#FFFBEB" }]}>
                  <Text style={[styles.kpiTagText, { color: "#D97706" }]}>TODAY</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{stats.todayMeets}</Text>
              <Text style={styles.kpiLabel}>Scheduled Meets</Text>
              <Text style={styles.kpiSub}>{stats.totalAppointments} All-time</Text>
            </View>

            {/* Doctors Count */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#F0FDFA" }]}>
                  <Ionicons name="medkit" size={18} color="#0B7A75" />
                </View>
                <View style={[styles.kpiTagBadge, { backgroundColor: "#F0FDFA" }]}>
                  <Text style={[styles.kpiTagText, { color: "#0B7A75" }]}>ROSTER</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{stats.totalDoctors}</Text>
              <Text style={styles.kpiLabel}>Total Doctors</Text>
              <Text style={styles.kpiSub}>{stats.activeDoctors} Active & Ready</Text>
            </View>

            {/* Platform Revenue */}
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <View style={[styles.kpiIconBox, { backgroundColor: "#ECFDF5" }]}>
                  <Ionicons name="cash" size={18} color="#047857" />
                </View>
                <View style={[styles.kpiTagBadge, { backgroundColor: "#ECFDF5" }]}>
                  <Text style={[styles.kpiTagText, { color: "#047857" }]}>REVENUE</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>₹{stats.totalRevenue.toLocaleString("en-IN")}</Text>
              <Text style={styles.kpiLabel}>Platform Revenue</Text>
              <Text style={styles.kpiSub}>{stats.completedAppointments} Completed</Text>
            </View>
          </ScrollView>
        </View>

        {/* ─── NAVIGATION TABS (SCROLLS WITH PAGE) ─── */}
        <View style={styles.tabsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "meets" && styles.tabBtnActive]}
              onPress={() => setActiveTab("meets")}
            >
              <Ionicons
                name="videocam"
                size={15}
                color={activeTab === "meets" ? COLORS.white : "#64748B"}
              />
              <Text style={[styles.tabText, activeTab === "meets" && styles.tabTextActive]}>
                Live Meets & Presence
              </Text>
              {stats.activeCallsCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{stats.activeCallsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "doctors" && styles.tabBtnActive]}
              onPress={() => setActiveTab("doctors")}
            >
              <Ionicons
                name="medkit"
                size={15}
                color={activeTab === "doctors" ? COLORS.white : "#64748B"}
              />
              <Text style={[styles.tabText, activeTab === "doctors" && styles.tabTextActive]}>
                Doctors ({doctors.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "patients" && styles.tabBtnActive]}
              onPress={() => setActiveTab("patients")}
            >
              <Ionicons
                name="people"
                size={15}
                color={activeTab === "patients" ? COLORS.white : "#64748B"}
              />
              <Text style={[styles.tabText, activeTab === "patients" && styles.tabTextActive]}>
                Patients ({patients.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "admins" && styles.tabBtnActive]}
              onPress={() => setActiveTab("admins")}
            >
              <Ionicons
                name="shield-checkmark"
                size={15}
                color={activeTab === "admins" ? COLORS.white : "#64748B"}
              />
              <Text style={[styles.tabText, activeTab === "admins" && styles.tabTextActive]}>
                Admins ({admins.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "system" && styles.tabBtnActive]}
              onPress={() => setActiveTab("system")}
            >
              <Ionicons
                name="settings"
                size={15}
                color={activeTab === "system" ? COLORS.white : "#64748B"}
              />
              <Text style={[styles.tabText, activeTab === "system" && styles.tabTextActive]}>
                System Controls
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ─── TAB CONTENT (EMBEDDED IN MAIN SCROLLVIEW) ─── */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0B7A75" />
            <Text style={styles.loadingText}>Fetching Platform Intelligence...</Text>
          </View>
        ) : (
          <View style={styles.content}>
          {/* ═══════ TAB 1: LIVE MEETS & PRESENCE ═══════ */}
          {activeTab === "meets" && (
            <View style={styles.tabContentBlock}>
              {/* SECTION A: "KON KISSE KISKI MEET SCHEDULE HAI" */}
              <View style={styles.sectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Scheduled Meets & Consultations</Text>
                  
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    style={[styles.btnAddPrimary, { paddingVertical: 6, paddingHorizontal: 12, gap: 5 }]}
                    onPress={openScheduleMeetModal}
                  >
                    <Ionicons name="calendar" size={15} color={COLORS.white} />
                    <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: "800" }}>+ Schedule Meet</Text>
                  </TouchableOpacity>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{meetings.length} Meets</Text>
                  </View>
                </View>
              </View>

              {meetings.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="calendar-outline" size={42} color="#9CA3AF" />
                  <Text style={styles.emptyTitle}>No Scheduled Meets Right Now</Text>
                  <Text style={styles.emptySubtitle}>All upcoming meetings across the hospital will appear here in real-time.</Text>
                  <TouchableOpacity
                    style={[styles.btnAddPrimary, { marginTop: 14 }]}
                    onPress={openScheduleMeetModal}
                  >
                    <Ionicons name="calendar" size={16} color={COLORS.white} />
                    <Text style={styles.btnAddPrimaryText}>Schedule New Consultation Meet</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                meetings.map((meet) => (
                  <View
                    key={meet.id}
                    style={[
                      styles.meetingCard,
                      meet.isLiveNow && { borderColor: "#10B981", borderWidth: 2 },
                    ]}
                  >
                    {/* Live banner if ongoing */}
                    {meet.isLiveNow && (
                      <View style={styles.liveMeetBanner}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveMeetBannerText}>LIVE TELEHEALTH CONSULTATION IN PROGRESS</Text>
                      </View>
                    )}

                    <View style={styles.meetBody}>
                      {/* Doctor Side */}
                      <View style={styles.partyBox}>
                        <View style={styles.roleTagDoctor}>
                          <Text style={styles.roleTagText}>DOCTOR</Text>
                        </View>
                        <Text style={styles.partyName}>{meet.doctorName}</Text>
                        <Text style={styles.partySub}>{meet.doctorDept}</Text>
                        {meet.doctorPhone ? (
                          <Text style={styles.partyContact}>📞 {meet.doctorPhone}</Text>
                        ) : null}
                      </View>

                      {/* Arrow / Connection Indicator */}
                      <View style={styles.connectorBox}>
                        <Ionicons
                          name={meet.type === "video" ? "videocam" : "call"}
                          size={22}
                          color={meet.isLiveNow ? "#10B981" : "#0B7A75"}
                        />
                        <View style={styles.arrowLine} />
                        <Text style={styles.connectorType}>
                          {meet.type?.toUpperCase() || "VIDEO"}
                        </Text>
                      </View>

                      {/* Patient Side */}
                      <View style={styles.partyBox}>
                        <View style={styles.roleTagPatient}>
                          <Text style={styles.roleTagText}>PATIENT</Text>
                        </View>
                        <Text style={styles.partyName}>{meet.patientName}</Text>
                        <Text style={styles.partySub}>Patient</Text>
                        {meet.patientPhone ? (
                          <Text style={styles.partyContact}>📞 {meet.patientPhone}</Text>
                        ) : null}
                      </View>
                    </View>

                    {/* Schedule Details Footer */}
                    <View style={styles.meetFooter}>
                      <View style={styles.meetTimeInfo}>
                        <Ionicons name="time-outline" size={14} color="#6B7280" />
                        <Text style={styles.meetTimeText}>
                          {meet.date} • {meet.time}
                        </Text>
                      </View>

                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusPill,
                            (meet.status === "completed" || meet.isExpired) && { backgroundColor: "#F1F5F9" },
                            meet.status === "confirmed" && !meet.isExpired && { backgroundColor: "#ECFDF5" },
                            meet.status === "pending" && !meet.isExpired && { backgroundColor: "#FFFBEB" },
                            meet.status === "cancelled" && { backgroundColor: "#FEF2F2" },
                            meet.isLiveNow && { backgroundColor: "#10B981" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              (meet.status === "completed" || meet.isExpired) && { color: "#475569" },
                              meet.status === "confirmed" && !meet.isExpired && { color: "#047857" },
                              meet.status === "pending" && !meet.isExpired && { color: "#B45309" },
                              meet.status === "cancelled" && { color: "#DC2626" },
                              meet.isLiveNow && { color: "#FFFFFF", fontWeight: "800" },
                            ]}
                          >
                            {meet.isLiveNow ? "ACTIVE CALL" : (meet.status === "completed" || meet.isExpired ? "EXPIRED MEET" : meet.status?.toUpperCase())}
                          </Text>
                        </View>

                        {/* Join Room action if Super Admin wants to monitor */}
                        {meet.liveCallId && (
                          <TouchableOpacity
                            style={styles.btnJoinCall}
                            onPress={() => {
                              navigation.navigate("CallScreen", {
                                callId: meet.liveCallId,
                                callType: meet.type || "video",
                                role: "doctor",
                                peerName: `Consultation: ${meet.doctorName} & ${meet.patientName}`,
                              });
                            }}
                          >
                            <Ionicons name="eye" size={14} color={COLORS.white} />
                            <Text style={styles.btnJoinCallText}>Inspect Call</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                ))
              )}

              {/* ────────────────────────────────────────────────────────── */}
              {/* SECTION B: "KON ONLINE HAI" */}
              <View style={[styles.sectionHeader, { marginTop: 28 }]}>
                <View>
                  <Text style={styles.sectionTitle}>🟢 Live Online Presence</Text>
                  <Text style={styles.sectionSubtitle}>
                    Real-time Active Doctors, Patients & Administrators
                  </Text>
                </View>
                <View style={[styles.countBadge, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                  <Text style={[styles.countBadgeText, { color: "#047857" }]}>
                    {onlineRoster.totalOnline} Active
                  </Text>
                </View>
              </View>

              {/* Roster Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={[styles.filterPillsRow, { marginBottom: 0 }]}>
                  {[
                    { key: "all", label: `All (${onlineRoster.allDoctors.length + onlineRoster.allUsers.length})` },
                    { key: "online", label: `🟢 Online (${onlineRoster.totalOnline})` },
                    { key: "doctors", label: `Doctors (${onlineRoster.allDoctors.length})` },
                    { key: "admins", label: `Admins (${admins.length})` },
                    { key: "patients", label: `Patients (${patients.length})` },
                  ].map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.filterPill, rosterFilter === f.key && styles.filterPillActive]}
                      onPress={() => setRosterFilter(f.key)}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          rosterFilter === f.key && styles.filterPillTextActive,
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {combinedRoster.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="wifi-outline" size={40} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Users Found in Filter</Text>
                </View>
              ) : (
                combinedRoster.map((item, idx) => (
                  <View key={item.id || idx} style={styles.rosterCard}>
                    <View style={styles.rosterAvatar}>
                      <Ionicons
                        name={
                          item.role === "doctor"
                            ? "medkit"
                            : item.role === "admin"
                            ? "shield-checkmark"
                            : "person"
                        }
                        size={20}
                        color={
                          item.role === "doctor"
                            ? "#0B7A75"
                            : item.role === "admin"
                            ? "#6366F1"
                            : "#F59E0B"
                        }
                      />
                    </View>

                    <View style={styles.rosterInfo}>
                      <View style={styles.rosterNameRow}>
                        <Text style={styles.rosterName}>{item.name}</Text>
                        <View
                          style={[
                            styles.roleMiniTag,
                            item.role === "doctor" && { backgroundColor: "#F0FDFA", borderWidth: 1, borderColor: "#CCFBF1" },
                            item.role === "admin" && { backgroundColor: "#EEF2FF", borderWidth: 1, borderColor: "#C7D2FE" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleMiniTagText,
                              item.role === "doctor" && { color: "#0D9488" },
                              item.role === "admin" && { color: "#4F46E5" },
                            ]}
                          >
                            {item.role?.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.rosterSub}>{item.subtitle || item.email}</Text>
                      {item.phone ? <Text style={styles.rosterContact}>📞 {item.phone}</Text> : null}
                    </View>

                    <View style={styles.rosterStatusBox}>
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: item.isOnline ? "#10B981" : "#9CA3AF" },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: item.isOnline ? "#10B981" : "#6B7280" },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══════ TAB 2: DOCTOR MANAGEMENT ═══════ */}
          {activeTab === "doctors" && (
            <View style={styles.tabContentBlock}>
              <View style={styles.sectionHeaderWithButton}>
                <View>
                  <Text style={styles.sectionTitle}>Doctors Directory</Text>
                  <Text style={styles.sectionSubtitle}>
                    Add, edit, verify, or suspend hospital doctors
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnAddPrimary}
                  onPress={() => setDoctorModalVisible(true)}
                >
                  <Ionicons name="add" size={18} color={COLORS.white} />
                  <Text style={styles.btnAddPrimaryText}>Add Doctor</Text>
                </TouchableOpacity>
              </View>

              {doctors.map((doc) => (
                <View key={doc.id} style={styles.managementCard}>
                  <View style={styles.manageHeader}>
                    <View style={styles.docAvatar}>
                      <Ionicons name="medkit" size={24} color="#0B7A75" />
                    </View>
                    <View style={styles.manageInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <Text style={styles.manageTitle}>Dr. {doc.name}</Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: doc.is_online ? "#ECFDF5" : "#F1F5F9",
                            borderWidth: 1,
                            borderColor: doc.is_online ? "#A7F3D0" : "#E2E8F0",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 999,
                            gap: 5,
                          }}
                        >
                          <View
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 3,
                              backgroundColor: doc.is_online ? "#10B981" : "#94A3B8",
                            }}
                          />
                          <Text
                            style={{
                              color: doc.is_online ? "#047857" : "#64748B",
                              fontSize: 10,
                              fontWeight: "800",
                            }}
                          >
                            {doc.is_online ? "ONLINE NOW" : "OFFLINE"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.manageSub}>
                        {doc.department} • {doc.specialization}
                      </Text>
                      <Text style={styles.manageContact}>
                        ✉️ {doc.email || "No email"} | 📞 {doc.phone || "No phone"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.docDetailsRow}>
                    <Text style={styles.detailText}>Fee: ₹{doc.consultation_fee || 800}</Text>
                    <Text style={styles.detailText}>Exp: {doc.experience || "5 years"}</Text>
                    <Text style={styles.detailText}>Rating: ⭐ {doc.rating || "4.8"}</Text>
                  </View>

                  <View style={styles.manageActionsRow}>
                    {/* 1-Click Online Presence DB Toggle */}
                    <TouchableOpacity
                      style={[
                        styles.btnActionToggle,
                        doc.is_online
                          ? { backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" }
                          : { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" },
                      ]}
                      onPress={() => handleToggleDoctorOnline(doc)}
                    >
                      <Text
                        style={[
                          styles.btnActionToggleText,
                          doc.is_online ? { color: "#DC2626" } : { color: "#059669" },
                        ]}
                      >
                        {doc.is_online ? "🔴 Set Offline" : "🟢 Set Online"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.btnActionToggle,
                        doc.active === false
                          ? { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0" }
                          : { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" },
                      ]}
                      onPress={() => handleToggleDoctorStatus(doc)}
                    >
                      <Text
                        style={[
                          styles.btnActionToggleText,
                          doc.active === false ? { color: "#059669" } : { color: "#D97706" },
                        ]}
                      >
                        {doc.active === false ? "Activate" : "Suspend"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnActionDelete}
                      onPress={() => handleDeleteDoctor(doc)}
                    >
                      <Ionicons name="trash-outline" size={15} color="#DC2626" />
                      <Text style={styles.btnActionDeleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ═══════ TAB 3: PATIENT MANAGEMENT ═══════ */}
          {activeTab === "patients" && (
            <View style={styles.tabContentBlock}>
              <View style={styles.sectionHeaderWithButton}>
                <View>
                  <Text style={styles.sectionTitle}>Patient Accounts</Text>
                  <Text style={styles.sectionSubtitle}>
                    Register new patients or review profiles
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnAddPrimary}
                  onPress={() => setPatientModalVisible(true)}
                >
                  <Ionicons name="person-add" size={18} color={COLORS.white} />
                  <Text style={styles.btnAddPrimaryText}>Add Patient</Text>
                </TouchableOpacity>
              </View>

              {patients.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="people-outline" size={40} color="#94A3B8" />
                  <Text style={styles.emptyTitle}>No Registered Patients Yet</Text>
                </View>
              ) : (
                patients.map((pat) => (
                  <View key={pat.id} style={styles.managementCard}>
                    <View style={styles.manageHeader}>
                      <View style={[styles.docAvatar, { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A" }]}>
                        <Ionicons name="person" size={24} color="#D97706" />
                      </View>
                      <View style={styles.manageInfo}>
                        <Text style={styles.manageTitle}>{pat.full_name || "Patient"}</Text>
                        <Text style={styles.manageSub}>
                          Gender: {pat.gender || "Male"} • Blood: {pat.blood_group || "O+"}
                        </Text>
                        <Text style={styles.manageContact}>
                          ✉️ {pat.email} | 📞 {pat.phone || "No phone"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.docDetailsRow}>
                      <Text style={styles.detailText}>
                        Total Bookings: {pat.appointmentCount || 0}
                      </Text>
                      <Text style={styles.detailText}>DOB: {pat.dob || "N/A"}</Text>
                    </View>

                    <View style={styles.manageActionsRow}>
                      <TouchableOpacity
                        style={styles.btnActionDelete}
                        onPress={() => handleDeletePatient(pat)}
                      >
                        <Ionicons name="trash-outline" size={15} color="#DC2626" />
                        <Text style={styles.btnActionDeleteText}>Remove Patient</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* ═══════ TAB 4: HOSPITAL ADMINS ═══════ */}
          {activeTab === "admins" && (
            <View style={styles.tabContentBlock}>
              <View style={styles.sectionHeaderWithButton}>
                <View>
                  <Text style={styles.sectionTitle}>Hospital Administrators</Text>
                  <Text style={styles.sectionSubtitle}>
                    Grant and manage administrative rights
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.btnAddPrimary}
                  onPress={() => setAdminModalVisible(true)}
                >
                  <Ionicons name="shield-checkmark" size={18} color={COLORS.white} />
                  <Text style={styles.btnAddPrimaryText}>Add Admin</Text>
                </TouchableOpacity>
              </View>

              {admins.map((admin) => {
                const isRoot = admin.email?.toLowerCase() === "techxitservices65@gmail.com" || admin.id === "admin_techx_root";
                const isRevoked = admin.status === "revoked";
                return (
                  <View
                    key={admin.id}
                    style={[
                      styles.managementCard,
                      isRevoked && { borderColor: "#FECACA", backgroundColor: "#FFFBFB" },
                    ]}
                  >
                    <View style={styles.manageHeader}>
                      <View
                        style={[
                          styles.docAvatar,
                          {
                            backgroundColor: isRevoked ? "#FEE2E2" : "#EEF2FF",
                            borderColor: isRevoked ? "#FECACA" : "#C7D2FE",
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <Ionicons
                          name={isRevoked ? "shield-outline" : "shield-checkmark"}
                          size={22}
                          color={isRevoked ? "#DC2626" : "#4F46E5"}
                        />
                      </View>
                      <View style={styles.manageInfo}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={styles.manageTitle}>{admin.full_name || "Hospital Admin"}</Text>
                          {isRoot && (
                            <View style={{ backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FDE68A", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                              <Text style={{ color: "#92400E", fontSize: 10, fontWeight: "800" }}>PRIMARY</Text>
                            </View>
                          )}
                          <View
                            style={{
                              backgroundColor: isRevoked ? "#FEE2E2" : "#ECFDF5",
                              borderWidth: 1,
                              borderColor: isRevoked ? "#FECACA" : "#A7F3D0",
                              paddingHorizontal: 8,
                              paddingVertical: 2,
                              borderRadius: 999,
                            }}
                          >
                            <Text
                              style={{
                                color: isRevoked ? "#DC2626" : "#047857",
                                fontSize: 10,
                                fontWeight: "800",
                              }}
                            >
                              {isRevoked ? "🔴 ACCESS REVOKED" : "🟢 ACTIVE"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.manageSub}>{admin.department || "Hospital Administration & Operations"}</Text>
                        <Text style={styles.manageContact}>✉️ {admin.email}</Text>
                        {admin.phone ? <Text style={styles.manageContact}>📞 {admin.phone}</Text> : null}
                      </View>
                    </View>

                    <View style={styles.manageActionsRow}>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", width: "100%" }}>
                        {admin.phone ? (
                          <TouchableOpacity
                            style={[styles.btnActionToggle, { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#A7F3D0", flexDirection: "row", alignItems: "center", gap: 4 }]}
                            onPress={() => Linking.openURL(`tel:${admin.phone}`)}
                          >
                            <Ionicons name="call" size={13} color="#059669" />
                            <Text style={[styles.btnActionToggleText, { color: "#059669" }]}>Call Admin</Text>
                          </TouchableOpacity>
                        ) : null}

                        {!isRevoked && (
                          <TouchableOpacity
                            style={[styles.btnActionToggle, { backgroundColor: "#0B7A75", flexDirection: "row", alignItems: "center", gap: 4 }]}
                            onPress={() => navigation.navigate("AdminDashboard")}
                          >
                            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" />
                            <Text style={[styles.btnActionToggleText, { color: "#FFFFFF" }]}>Admin Portal</Text>
                          </TouchableOpacity>
                        )}

                        {isRevoked ? (
                          <TouchableOpacity
                            style={[styles.btnActionToggle, { backgroundColor: "#10B981", flexDirection: "row", alignItems: "center", gap: 4 }]}
                            onPress={() => handleRestoreAdmin(admin)}
                          >
                            <Ionicons name="refresh" size={13} color="#FFFFFF" />
                            <Text style={[styles.btnActionToggleText, { color: "#FFFFFF" }]}>Restore Privileges</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={[styles.btnActionDelete, { flexDirection: "row", alignItems: "center", gap: 4 }]}
                            onPress={() => handleRevokeAdmin(admin)}
                          >
                            <Ionicons name="ban-outline" size={14} color="#DC2626" />
                            <Text style={styles.btnActionDeleteText}>Revoke Privileges</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ═══════ TAB 5: SYSTEM CONTROLS ═══════ */}
          {activeTab === "system" && (
            <View style={styles.tabContentBlock}>
              <Text style={styles.sectionTitle}>Global System Operations</Text>
              <Text style={styles.sectionSubtitle}>
                Cross-role navigation and emergency control
              </Text>

              {/* Navigation previews */}
              <View style={styles.systemBox}>
                <Text style={styles.systemBoxTitle}>Inspect Other Role Views</Text>

                <TouchableOpacity
                  style={styles.systemNavBtn}
                  onPress={() => navigation.navigate("DoctorDashboard")}
                >
                  <Ionicons name="medkit" size={20} color="#0B7A75" />
                  <Text style={styles.systemNavBtnText}>Open Doctor Dashboard View</Text>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.systemNavBtn}
                  onPress={() => navigation.navigate("AdminDashboard")}
                >
                  <Ionicons name="business" size={20} color="#6366F1" />
                  <Text style={styles.systemNavBtnText}>Open Hospital Admin Dashboard</Text>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.systemNavBtn}
                  onPress={() => navigation.navigate("MainTabs")}
                >
                  <Ionicons name="person" size={20} color="#F59E0B" />
                  <Text style={styles.systemNavBtnText}>Open Patient Mobile App View</Text>
                  <Ionicons name="chevron-forward" size={18} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Emergency Alert */}
              <View style={[styles.systemBox, { borderColor: "#FECACA", borderWidth: 1, backgroundColor: "#FFFBFB" }]}>
                <Text style={[styles.systemBoxTitle, { color: "#DC2626" }]}>
                  🚨 Hospital Emergency Broadcast
                </Text>
                <Text style={styles.systemBoxSub}>
                  Broadcast emergency notifications directly to all patient and doctor phones.
                </Text>

                <TouchableOpacity
                  style={[styles.btnAddPrimary, { backgroundColor: "#DC2626", alignSelf: "flex-start", marginTop: 12 }]}
                  onPress={() => setBroadcastModalVisible(true)}
                >
                  <Ionicons name="megaphone" size={18} color="#FFFFFF" />
                  <Text style={styles.btnAddPrimaryText}>Send Emergency Announcement</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

            <View style={{ height: 40 }} />
          </View>
        )}
      </ScrollView>

      {/* ─── MODAL 1: ADD DOCTOR ─── */}
      <Modal visible={doctorModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Hospital Doctor</Text>
              <TouchableOpacity onPress={() => setDoctorModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Doctor Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Dr. Rajesh Kumar"
                value={newDoctor.name}
                onChangeText={(t) => setNewDoctor({ ...newDoctor, name: t })}
              />

              <Text style={styles.inputLabel}>Department *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Cardiology / Orthopedics / Pediatrics"
                value={newDoctor.department}
                onChangeText={(t) => setNewDoctor({ ...newDoctor, department: t })}
              />

              <Text style={styles.inputLabel}>Specialization</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Heart Surgeon / MD"
                value={newDoctor.specialization}
                onChangeText={(t) => setNewDoctor({ ...newDoctor, specialization: t })}
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="doctor@kmchospital.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newDoctor.email}
                onChangeText={(t) => setNewDoctor({ ...newDoctor, email: t })}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
                value={newDoctor.phone}
                onChangeText={(t) => setNewDoctor({ ...newDoctor, phone: t })}
              />

              <Text style={styles.inputLabel}>Consultation Fee (₹)</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="800"
                keyboardType="numeric"
                value={newDoctor.consultationFee}
                onChangeText={(t) => setNewDoctor({ ...newDoctor, consultationFee: t })}
              />

              <TouchableOpacity
                style={styles.btnModalSubmit}
                onPress={handleCreateDoctor}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Create Doctor</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 2: ADD PATIENT ─── */}
      <Modal visible={patientModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Patient</Text>
              <TouchableOpacity onPress={() => setPatientModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Rahul Sharma"
                value={newPatient.fullName}
                onChangeText={(t) => setNewPatient({ ...newPatient, fullName: t })}
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="patient@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newPatient.email}
                onChangeText={(t) => setNewPatient({ ...newPatient, email: t })}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
                value={newPatient.phone}
                onChangeText={(t) => setNewPatient({ ...newPatient, phone: t })}
              />

              <Text style={styles.inputLabel}>Blood Group</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="O+ / B+ / A+"
                value={newPatient.bloodGroup}
                onChangeText={(t) => setNewPatient({ ...newPatient, bloodGroup: t })}
              />

              <TouchableOpacity
                style={styles.btnModalSubmit}
                onPress={handleCreatePatient}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Register Patient</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 3: ADD ADMIN ─── */}
      <Modal visible={adminModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Hospital Administrator</Text>
              <TouchableOpacity onPress={() => setAdminModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Admin Officer Name"
                value={newAdmin.fullName}
                onChangeText={(t) => setNewAdmin({ ...newAdmin, fullName: t })}
              />

              <Text style={styles.inputLabel}>Email Address *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="admin@kmchospital.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={newAdmin.email}
                onChangeText={(t) => setNewAdmin({ ...newAdmin, email: t })}
              />

              <Text style={styles.inputLabel}>Login Password * (Min 6 characters)</Text>
              <View style={{ position: "relative", justifyContent: "center" }}>
                <TextInput
                  style={[styles.modalInput, { paddingRight: 44 }]}
                  placeholder="Enter login password for admin"
                  secureTextEntry={!showAdminPassword}
                  autoCapitalize="none"
                  value={newAdmin.password}
                  onChangeText={(t) => setNewAdmin({ ...newAdmin, password: t })}
                />
                <TouchableOpacity
                  style={{ position: "absolute", right: 12, top: 10, padding: 4 }}
                  onPress={() => setShowAdminPassword(!showAdminPassword)}
                >
                  <Ionicons
                    name={showAdminPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Department / Role Title</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Hospital Administration & Operations"
                value={newAdmin.department}
                onChangeText={(t) => setNewAdmin({ ...newAdmin, department: t })}
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="+91 9876543210"
                keyboardType="phone-pad"
                value={newAdmin.phone}
                onChangeText={(t) => setNewAdmin({ ...newAdmin, phone: t })}
              />

              <TouchableOpacity
                style={styles.btnModalSubmit}
                onPress={handleCreateAdmin}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Create Admin & Grant Access</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── MODAL 4: EMERGENCY BROADCAST ─── */}
      <Modal visible={broadcastModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: "#EF4444" }]}>
                🚨 Dispatch Hospital Alert
              </Text>
              <TouchableOpacity onPress={() => setBroadcastModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Alert Title *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Emergency Blood Donation / Weather Notice"
                value={broadcastData.title}
                onChangeText={(t) => setBroadcastData({ ...broadcastData, title: t })}
              />

              <Text style={styles.inputLabel}>Message Content *</Text>
              <TextInput
                style={[styles.modalInput, { height: 100, textAlignVertical: "top" }]}
                placeholder="Write message to be sent to all users..."
                multiline
                value={broadcastData.message}
                onChangeText={(t) => setBroadcastData({ ...broadcastData, message: t })}
              />

              <TouchableOpacity
                style={[styles.btnModalSubmit, { backgroundColor: "#EF4444" }]}
                onPress={handleSendBroadcast}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Send Emergency Alert</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* ─── MODAL 5: SCHEDULE CONSULTATION MEET ─── */}
      <Modal visible={scheduleModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Schedule Consultation Meet</Text>
                <Text style={{ color: "#64748B", fontSize: 12, marginTop: 2 }}>
                  Syncs live across Patient App & Doctor Portal
                </Text>
              </View>
              <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* STEP 1: SELECT REGISTERED DOCTOR */}
              <Text style={styles.inputLabel}>👨‍⚕️ 1. Select Registered Doctor *</Text>
              {doctors.length === 0 ? (
                <Text style={{ color: "#EF4444", fontSize: 13, marginBottom: 8 }}>
                  No doctors registered. Please add a doctor first.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
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
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <View style={[styles.selectorAvatar, { backgroundColor: isSelected ? "#CCFBF1" : "#F1F5F9" }]}>
                              <Ionicons name="medkit" size={16} color={isSelected ? "#0B7A75" : "#64748B"} />
                            </View>
                            <View>
                              <Text style={[styles.selectorTitle, isSelected && { color: "#0B7A75", fontWeight: "800" }]}>
                                Dr. {doc.name}
                              </Text>
                              <Text style={styles.selectorSub}>
                                {doc.department || doc.specialization} • ₹{doc.consultation_fee || 800}
                              </Text>
                            </View>
                            {isSelected && (
                              <Ionicons name="checkmark-circle" size={18} color="#0B7A75" style={{ marginLeft: 6 }} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {/* STEP 2: SELECT REGISTERED PATIENT */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 6 }}>
                <Text style={styles.inputLabel}>🧑‍🤝‍🧑 2. Select Registered Patient *</Text>
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
                patients.length === 0 ? (
                  <View style={{ padding: 12, backgroundColor: "#FFFBEB", borderRadius: 10, borderWidth: 1, borderColor: "#FDE68A", marginBottom: 12 }}>
                    <Text style={{ color: "#B45309", fontSize: 13, fontWeight: "600" }}>
                      No registered patients found. Switch to "+ Walk-In / New" to enter patient details directly.
                    </Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", gap: 8, paddingVertical: 4 }}>
                      {patients.map((pat) => {
                        const isSelected = String(scheduleForm.selectedPatientId) === String(pat.id);
                        return (
                          <TouchableOpacity
                            key={pat.id}
                            style={[
                              styles.selectorCard,
                              isSelected && styles.selectorCardActive,
                            ]}
                            onPress={() => setScheduleForm({ ...scheduleForm, selectedPatientId: pat.id })}
                            activeOpacity={0.7}
                          >
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <View style={[styles.selectorAvatar, { backgroundColor: isSelected ? "#FEF3C7" : "#F1F5F9" }]}>
                                <Ionicons name="person" size={16} color={isSelected ? "#D97706" : "#64748B"} />
                              </View>
                              <View>
                                <Text style={[styles.selectorTitle, isSelected && { color: "#0B7A75", fontWeight: "800" }]}>
                                  {pat.full_name || pat.name || "Patient"}
                                </Text>
                                <Text style={styles.selectorSub}>
                                  {pat.phone || pat.email || "Registered Patient"}
                                </Text>
                              </View>
                              {isSelected && (
                                <Ionicons name="checkmark-circle" size={18} color="#0B7A75" style={{ marginLeft: 6 }} />
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </ScrollView>
                )
              ) : (
                <View style={{ backgroundColor: "#F8FAFC", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Patient Full Name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Ayush Sharma"
                    value={scheduleForm.customPatientName}
                    onChangeText={(t) => setScheduleForm({ ...scheduleForm, customPatientName: t })}
                  />
                  <Text style={styles.inputLabel}>Mobile Phone Number *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="+91 9876543210"
                    keyboardType="phone-pad"
                    value={scheduleForm.customPatientPhone}
                    onChangeText={(t) => setScheduleForm({ ...scheduleForm, customPatientPhone: t })}
                  />
                  <Text style={styles.inputLabel}>Email Address</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="patient@gmail.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={scheduleForm.customPatientEmail}
                    onChangeText={(t) => setScheduleForm({ ...scheduleForm, customPatientEmail: t })}
                  />
                </View>
              )}

              {/* STEP 3: CONSULTATION DATE */}
              <Text style={styles.inputLabel}>📅 3. Select Consultation Date *</Text>
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
                <Text style={styles.inputLabel}>⏰ 4. Select Available Time Slot *</Text>
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
              <Text style={styles.inputLabel}>🩺 5. Consultation Mode</Text>
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
                    size={18}
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
                    size={18}
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
              <Text style={styles.inputLabel}>📝 Clinical Notes / Reason</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Reason for consultation, health follow-up, etc."
                value={scheduleForm.notes}
                onChangeText={(t) => setScheduleForm({ ...scheduleForm, notes: t })}
              />

              {/* CONFIRMATION SUMMARY CARD */}
              <View style={styles.summaryCard}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Ionicons name="checkmark-done-circle" size={16} color="#0B7A75" />
                  <Text style={styles.summaryCardTitle}>Consultation Booking Summary</Text>
                </View>
                <Text style={styles.summaryCardText}>
                  • Doctor: {doctors.find((d) => String(d.id) === String(scheduleForm.selectedDoctorId))?.name ? `Dr. ${doctors.find((d) => String(d.id) === String(scheduleForm.selectedDoctorId))?.name}` : "Selected Doctor"}
                </Text>
                <Text style={styles.summaryCardText}>
                  • Patient: {
                    scheduleForm.patientMode === "registered"
                      ? (patients.find((p) => String(p.id) === String(scheduleForm.selectedPatientId))?.full_name || "Selected Patient")
                      : (scheduleForm.customPatientName || "Walk-In Patient")
                  }
                </Text>
                <Text style={styles.summaryCardText}>
                  • Schedule: {scheduleForm.date} at {scheduleForm.time} ({scheduleForm.type})
                </Text>
                <Text style={[styles.summaryCardText, { color: "#047857", fontWeight: "700" }]}>
                  • Live Sync: Doctor Dashboard & Patient App will update instantly.
                </Text>
              </View>

              {/* SUBMIT BUTTON */}
              <TouchableOpacity
                style={[styles.btnModalSubmit, { marginTop: 16 }]}
                onPress={handleConfirmScheduleMeeting}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.btnModalSubmitText}>Confirm & Schedule Meet</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC", // Clean light slate-50 background
  },
  mainScroll: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  mainScrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  superBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  superBadgeText: {
    color: "#92400E",
    fontSize: 10,
    fontWeight: "800",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 5,
  },
  liveText: {
    color: "#047857",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  headerSub: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  kpiContainer: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 14,
  },
  kpiScroll: {
    paddingHorizontal: 16,
    gap: 12,
  },
  kpiCard: {
    width: 155,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  kpiIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  kpiLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kpiLiveText: {
    color: "#047857",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  kpiTagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  kpiTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  pulsingBadge: {
    flexDirection: "row",
    alignItems: "center",
  },
  kpiTag: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  kpiValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  kpiLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  kpiSub: {
    color: "#64748B",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  tabsBar: {
    backgroundColor: "#F8FAFC",
    paddingVertical: 4,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  tabBtnActive: {
    backgroundColor: "#0B7A75",
    borderColor: "#0B7A75",
  },
  tabText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  tabBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  tabBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    color: "#64748B",
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  tabContentBlock: {
    paddingBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionHeaderWithButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  countBadge: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: "#0B7A75",
    fontSize: 11,
    fontWeight: "800",
  },
  btnAddPrimary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B7A75",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 6,
    shadowColor: "#0B7A75",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  btnAddPrimaryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  meetingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  liveMeetBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderBottomWidth: 1,
    borderBottomColor: "#A7F3D0",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  liveMeetBannerText: {
    color: "#047857",
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  meetBody: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  partyBox: {
    flex: 1,
  },
  roleTagDoctor: {
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  roleTagPatient: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: "800",
  },
  partyName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
  },
  partySub: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  partyContact: {
    color: "#475569",
    fontSize: 11,
    marginTop: 3,
  },
  connectorBox: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  arrowLine: {
    width: 24,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },
  connectorType: {
    color: "#64748B",
    fontSize: 9,
    fontWeight: "800",
  },
  meetFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  meetTimeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  meetTimeText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  btnJoinCall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  btnJoinCallText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterPillActive: {
    backgroundColor: "#0B7A75",
    borderColor: "#0B7A75",
  },
  filterPillText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "700",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  rosterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  rosterAvatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rosterInfo: {
    flex: 1,
  },
  rosterNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rosterName: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  roleMiniTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  roleMiniTagText: {
    fontSize: 9,
    fontWeight: "800",
  },
  rosterSub: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  rosterContact: {
    color: "#475569",
    fontSize: 11,
    marginTop: 2,
  },
  rosterStatusBox: {
    alignItems: "flex-end",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  managementCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  manageHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  docAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  manageInfo: {
    flex: 1,
  },
  manageTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
  },
  manageSub: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 2,
  },
  manageContact: {
    color: "#475569",
    fontSize: 11,
    marginTop: 3,
  },
  docDetailsRow: {
    flexDirection: "row",
    gap: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 12,
  },
  detailText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  manageActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  btnActionToggle: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnActionToggleText: {
    fontSize: 11,
    fontWeight: "800",
  },
  btnActionDelete: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  btnActionDeleteText: {
    color: "#DC2626",
    fontSize: 11,
    fontWeight: "800",
  },
  systemBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  systemBoxTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  systemBoxSub: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  systemNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    borderRadius: 12,
    marginTop: 12,
    gap: 12,
  },
  systemNavBtnText: {
    flex: 1,
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 8,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 12,
    marginTop: 3,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "800",
  },
  inputLabel: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 5,
    marginTop: 10,
  },
  modalInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#0F172A",
  },
  btnModalSubmit: {
    backgroundColor: "#0B7A75",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 22,
    marginBottom: 20,
    shadowColor: "#0B7A75",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  btnModalSubmitText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  selectorCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    minWidth: 165,
  },
  selectorCardActive: {
    borderColor: "#0B7A75",
    backgroundColor: "#F0FDFA",
    borderWidth: 1.5,
  },
  selectorAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  selectorTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
  },
  selectorSub: {
    color: "#64748B",
    fontSize: 11,
    marginTop: 1,
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
  slotChipText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  slotChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  slotChipBooked: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
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
