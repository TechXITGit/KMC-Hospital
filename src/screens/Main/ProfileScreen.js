import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { profile, logout, isAdmin, isDoctor, userRole } = useAuth();
  const { language, t } = useLanguage();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (e) {
      console.warn("[Profile] Logout error:", e?.message);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  // Safe calculation of user initials with robust fallback
  const safeFullName = String(profile?.fullName || profile?.full_name || profile?.name || "KMC User").trim();
  const initials =
    safeFullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join("") || "U";

  // Role display label and colors (strictly non-editable)
  const roleLabel = isAdmin
    ? (t.adminRole || "Administrator")
    : isDoctor
    ? (t.doctorRole || "Doctor")
    : (t.patientRole || "Patient");

  const menuItems = [
    ...(isAdmin
      ? [
          {
            icon: "shield-checkmark",
            label: language === "hi" ? "अस्पताल प्रशासन पोर्टल" : "Hospital Administration Portal",
            route: "AdminDashboard",
            highlight: true,
          },
        ]
      : []),
    {
      icon: "person-outline",
      label: t.editProfile || "Edit Profile",
      route: "EditProfile",
    },
    {
      icon: "calendar-outline",
      label: t.appointment || "Appointments",
      route: "AppointmentTab",
    },
    ...(isDoctor || isAdmin
      ? [
          {
            icon: "medkit-outline",
            label: t.doctorAppointmentPortal || "Doctor Appointment Portal",
            route: "DoctorDashboard",
          },
        ]
      : []),
    {
      icon: "document-text-outline",
      label: t.medicalRecords || "Medical Records",
      route: "MedicalRecords",
    },
    {
      icon: "card-outline",
      label: t.billing || "Billing & Payments",
      route: "Billing",
    },
    {
      icon: "help-circle-outline",
      label: t.helpSupport || "Help & Support",
      route: "HelpSupport",
    },
    {
      icon: "settings-outline",
      label: t.settings || "Settings",
      route: "Settings",
    },
  ];

  const handleMenuPress = (item) => {
    if (item.route === "AppointmentTab") {
      if (isDoctor) {
        navigation.navigate("DoctorDashboard");
      } else if (isAdmin) {
        navigation.navigate("AdminDashboard");
      } else {
        navigation.navigate("MainTabs", { screen: "Appointment" });
      }
    } else if (item.route) {
      try {
        navigation.navigate(item.route);
      } catch (err) {
        console.warn("[Profile] Navigation error:", err?.message);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.profile || "Profile"}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Details Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>

          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {safeFullName}
          </Text>

          {/* Official Role Badge (Non-Editable) */}
          <View
            style={[
              styles.roleBadge,
              isAdmin
                ? styles.roleBadgeAdmin
                : isDoctor
                ? styles.roleBadgeDoctor
                : styles.roleBadgePatient,
            ]}
          >
            <Ionicons
              name={
                isAdmin
                  ? "shield-checkmark"
                  : isDoctor
                  ? "medkit"
                  : "person"
              }
              size={12}
              color={isAdmin ? "#DC2626" : isDoctor ? "#0284C7" : COLORS.primary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.roleBadgeText,
                isAdmin
                  ? { color: "#991B1B" }
                  : isDoctor
                  ? { color: "#0369A1" }
                  : { color: COLORS.primaryDark },
              ]}
            >
              {roleLabel}
            </Text>
          </View>

          {(profile?.mobileNumber || profile?.phone) ? (
            <Text style={styles.phone}>+91 {profile.mobileNumber || profile.phone}</Text>
          ) : null}

          {profile?.email ? (
            <Text style={styles.emailText}>{profile.email}</Text>
          ) : null}

          <View style={styles.infoRow}>
            <InfoChip label={t.gender || "Gender"} value={profile?.gender} />
            <InfoChip label={t.dob || "Date of Birth"} value={profile?.dob} />
            <InfoChip label={t.bloodGroup || "Blood Group"} value={profile?.bloodGroup || profile?.blood_group} />
          </View>
        </View>

        {/* Navigation Menu */}
        <View style={styles.menu}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.label || item.route}
              style={[
                styles.menuItem,
                item.highlight && styles.menuItemHighlight,
              ]}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.highlight ? "#DC2626" : COLORS.primary}
              />
              <Text
                style={[
                  styles.menuLabel,
                  item.highlight && { color: "#991B1B", fontWeight: "800" },
                ]}
              >
                {item.label}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={item.highlight ? "#DC2626" : COLORS.textLight}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogoutPress}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>{t.logout || "Logout"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isLoggingOut) setShowLogoutModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="log-out-outline" size={30} color={COLORS.danger} />
            </View>
            <Text style={styles.modalTitle}>{t.logout || "Logout"}</Text>
            <Text style={styles.modalSubtitle}>
              {t.logoutConfirm || "Are you sure you want to log out from KMC Hospital?"}
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.modalCancelText}>{t.cancel || "Cancel"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={confirmLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t.logout || "Logout"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function InfoChip({ label, value }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value || "-"}</Text>
    </View>
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
    paddingBottom: 8,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    alignItems: "center",
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: { color: COLORS.white, fontWeight: "800", fontSize: 24 },
  name: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 12 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
  },
  roleBadgePatient: {
    backgroundColor: "#EAF6F5",
    borderColor: "#B4E2DF",
  },
  roleBadgeDoctor: {
    backgroundColor: "#F0F9FF",
    borderColor: "#BAE6FD",
  },
  roleBadgeAdmin: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  phone: { fontSize: 13, color: COLORS.textLight, marginTop: 6 },
  emailText: { fontSize: 12, color: COLORS.primaryDark, marginTop: 2, fontWeight: "600" },
  infoRow: { flexDirection: "row", marginTop: 18, width: "100%", justifyContent: "space-between" },
  chip: { alignItems: "center", flex: 1 },
  chipLabel: { fontSize: 10, color: COLORS.textLight, textTransform: "uppercase", fontWeight: "700" },
  chipValue: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  menu: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemHighlight: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  menuLabel: { flex: 1, marginLeft: 14, fontSize: 13, fontWeight: "600", color: COLORS.text },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    padding: 16,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: { color: COLORS.danger, fontWeight: "700", marginLeft: 8, fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 19,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
});
