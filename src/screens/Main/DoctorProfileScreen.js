import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";
import { getLocalizedDoctors } from "../../constants/data";

export default function DoctorProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, language } = useLanguage();
  const { doctors } = useAppointments();

  const rawDoctor = route.params?.doctor;

  // Live binding: prioritize real-time state from AppointmentContext, fallback to route param
  const liveDoctor = (doctors || []).find((d) => d.id === rawDoctor?.id) || rawDoctor;
  const activeDoc = getLocalizedDoctors([liveDoctor], language)[0] || liveDoctor;

  const initials = activeDoc?.name
    ? activeDoc.name
        .replace("Dr.", "")
        .replace("Prof.", "")
        .replace("(Dr.)", "")
        .trim()
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
    : "DR";

  const isOnline = Boolean(activeDoc?.isOnline || activeDoc?.is_online);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Screen Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t.doctorProfile || (language === "hi" ? "डॉक्टर प्रोफाइल" : "Doctor Profile")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Avatar with Online/Offline Indicator */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "DR"}</Text>
          </View>
          <View
            style={[
              styles.avatarStatusBadge,
              isOnline ? styles.avatarStatusOnline : styles.avatarStatusOffline,
            ]}
          >
            <View style={[styles.avatarStatusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          </View>
        </View>

        <Text style={styles.name}>{activeDoc?.name}</Text>
        <Text style={styles.specialty}>{activeDoc?.specialty}</Text>

        {/* Row 1: Badges (Online/Offline Status + Verified Specialist) */}
        <View style={styles.badgesRow}>
          <View
            style={[
              styles.statusPill,
              isOnline ? styles.statusPillOnline : styles.statusPillOffline,
            ]}
          >
            <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]} />
            <Text
              style={[
                styles.statusPillText,
                isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline,
              ]}
            >
              {isOnline
                ? (language === "hi" ? "ऑनलाइन (उपलब्ध)" : "Online (Available)")
                : (language === "hi" ? "ऑफलाइन (अनुपलब्ध)" : "Offline (Unavailable)")}
            </Text>
          </View>

          <View style={styles.verifiedBadgeBox}>
            <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
            <Text style={styles.verifiedBadgeText}>
              {language === "hi" ? "सत्यापित विशेषज्ञ" : "Verified Specialist"}
            </Text>
          </View>
        </View>

        {/* Row 2: Consultation Fee Card - Perfectly Aligned */}
        <View style={styles.feeCard}>
          <View style={styles.feeCardLeft}>
            <View style={styles.feeIconBox}>
              <Ionicons name="wallet-outline" size={19} color={COLORS.primary} />
            </View>
            <View style={styles.feeTextWrap}>
              <Text style={styles.feeTitle}>
                {t.consultFee || (language === "hi" ? "परामर्श शुल्क" : "Consultation Fee")}
              </Text>
              <Text style={styles.feeSubtitle}>
                {language === "hi" ? "ओपीडी व वीडियो परामर्श के लिए" : "For OPD & Video Consult"}
              </Text>
            </View>
          </View>
          <View style={styles.feePriceBox}>
            <Text style={styles.feeValue}>{activeDoc?.fee || "₹800"}</Text>
          </View>
        </View>

        {/* Doctor Information Card */}
        <View style={styles.infoCard}>
          <InfoRow
            icon="school-outline"
            label={t.qualification || "Qualification"}
            value={activeDoc?.qualification}
          />
          <InfoRow
            icon="ribbon-outline"
            label={t.experienceLabel || "Experience"}
            value={activeDoc?.experience}
          />
          <InfoRow
            icon="business-outline"
            label={t.departmentLabel || "Department"}
            value={activeDoc?.department}
          />
          <InfoRow
            icon="calendar-outline"
            label={t.opdAvailability || "OPD Availability"}
            value={
              activeDoc?.availableDays ||
              (language === "hi"
                ? "सोम - शनि (सुबह 10:00 - दोपहर 02:00)"
                : "Mon - Sat (10:00 AM - 02:00 PM)")
            }
          />
          <InfoRow
            icon="location-outline"
            label={t.clinicLocation || "Clinic / Location"}
            value={
              activeDoc?.clinicName ||
              (language === "hi"
                ? "केएमसी अस्पताल, जानकीपुरम, लखनऊ"
                : "KMC Hospital, Jankipuram, Lucknow")
            }
          />
        </View>

        {/* About Doctor */}
        {(activeDoc?.about || activeDoc?.bio) && (
          <View style={styles.aboutCard}>
            <Text style={styles.aboutTitle}>{t.aboutDoctor || "About Doctor"}</Text>
            <Text style={styles.aboutText}>{activeDoc?.about || activeDoc?.bio}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <CustomButton
          title={t.bookHospitalVisit || "Book Hospital Visit"}
          onPress={() =>
            navigation.navigate("BookAppointment", {
              doctor: activeDoc,
              type: "Hospital Visit",
            })
          }
          style={{ marginTop: 20, width: "100%" }}
        />
        <CustomButton
          title={t.bookVideoConsult || "Book Video Consultation"}
          variant="outline"
          onPress={() =>
            navigation.navigate("BookAppointment", {
              doctor: activeDoc,
              type: "Video Consultation",
            })
          }
          style={{ marginTop: 12, width: "100%" }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  content: { alignItems: "center", padding: 18, paddingBottom: 40 },
  avatarWrap: {
    position: "relative",
    width: 84,
    height: 84,
    marginTop: 6,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarStatusBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarStatusOnline: {
    backgroundColor: "#DCFCE7",
  },
  avatarStatusOffline: {
    backgroundColor: "#F1F5F9",
  },
  avatarStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotOnline: {
    backgroundColor: "#16A34A",
  },
  dotOffline: {
    backgroundColor: "#94A3B8",
  },
  avatarText: { color: COLORS.white, fontWeight: "700", fontSize: 26 },
  name: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 12, textAlign: "center" },
  specialty: { fontSize: 13, color: COLORS.textLight, marginTop: 4, textAlign: "center" },

  // Badges Row
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    width: "100%",
    flexWrap: "wrap",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusPillOnline: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  statusPillOffline: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 5,
  },
  statusDotOnline: {
    backgroundColor: "#16A34A",
  },
  statusDotOffline: {
    backgroundColor: "#94A3B8",
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  statusPillTextOnline: {
    color: "#166534",
  },
  statusPillTextOffline: {
    color: "#64748B",
  },
  verifiedBadgeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  verifiedBadgeText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#166534",
    marginLeft: 4,
  },

  // Consultation Fee Card - Highly polished and aligned
  feeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  feeCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  feeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
  },
  feeTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  feeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  feeSubtitle: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 1,
  },
  feePriceBox: {
    backgroundColor: "#EAF6F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  feeValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },

  // Info Card
  infoCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  infoLabel: { fontSize: 11, color: COLORS.textLight },
  infoValue: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 2, lineHeight: 18 },
  aboutCard: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aboutTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  aboutText: { fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
});
