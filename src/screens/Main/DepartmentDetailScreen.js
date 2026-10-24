import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import EmergencyCard from "../../components/EmergencyCard";
import { DEPARTMENTS, DOCTORS, getLocalizedDepartments, getLocalizedDoctors } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";

export default function DepartmentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, language } = useLanguage();
  const { doctors, loadDoctors } = useAppointments();

  useFocusEffect(
    useCallback(() => {
      if (typeof loadDoctors === "function") {
        loadDoctors();
      }
    }, [])
  );

  const departmentParam = route.params?.department;
  const deptId = route.params?.departmentId || departmentParam?.id || "d1";

  const localizedDepts = getLocalizedDepartments(language);
  const dept = localizedDepts.find((d) => d.id === deptId) || departmentParam || localizedDepts[0];

  const allDocs = getLocalizedDoctors(doctors && doctors.length > 0 ? doctors : DOCTORS, language).filter(
    (d) => d.active !== false
  );
  const deptKeywords = (dept.name || "").toLowerCase().split(/[&,\s/]+/).filter((w) => w.length > 3);

  const departmentDoctors = allDocs.filter((doc) => {
    const docDept = (doc.department || "").toLowerCase();
    if (docDept.includes((dept.name || "").toLowerCase()) || (dept.name || "").toLowerCase().includes(docDept)) {
      return true;
    }
    return deptKeywords.some((kw) => docDept.includes(kw));
  });

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home"))}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.departmentDetails}</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Main Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
      >
        {/* Department Banner */}
        <View style={styles.banner}>
          <View style={styles.iconCircle}>
            <Ionicons name={dept.icon || "medical"} size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.deptName}>{dept.name}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.specialistBadge}>
              <Ionicons name="people" size={14} color={COLORS.success} />
              <Text style={styles.specialistBadgeText}>
                {departmentDoctors.length} {language === "hi" ? "विशेषज्ञ उपलब्ध" : "Specialists Available"}
              </Text>
            </View>
            <View style={styles.timingBadge}>
              <Ionicons name="time-outline" size={14} color={COLORS.primary} />
              <Text style={styles.timingBadgeText}>
                {language === "hi" ? "24x7 आपातकालीन" : "24x7 Emergency"}
              </Text>
            </View>
          </View>
        </View>

        {/* Overview Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>
              {language === "hi" ? "विभाग का विवरण" : "Department Overview"}
            </Text>
          </View>
          <Text style={styles.overviewText}>
            {dept.overview ||
              (language === "hi"
                ? "केएमसी अस्पताल, जानकीपुरम, लखनऊ में अत्याधुनिक चिकित्सा विशेषज्ञता, 24 घंटे आपातकालीन सेवाएं और समर्पित रोगी देखभाल।"
                : "Providing state-of-the-art clinical expertise, 24x7 emergency coverage, advanced diagnostics, and compassionate patient care at KMC Hospital, Jankipuram, Lucknow.")}
          </Text>
        </View>

        {/* Key Facilities Card */}
        {dept.facilities && dept.facilities.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{t.keyFacilities}</Text>
            </View>
            {dept.facilities.map((fac, idx) => (
              <View key={idx} style={styles.facilityRow}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                <Text style={styles.facilityText}>{fac}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Specialists Section */}
        <View style={styles.specialistsSection}>
          <View style={styles.specialistsHeaderRow}>
            <Text style={styles.sectionTitleLarge}>{t.departmentSpecialists}</Text>
            <Text style={styles.specialistsCount}>({departmentDoctors.length})</Text>
          </View>

          {departmentDoctors.length > 0 ? (
            departmentDoctors.map((doc) => {
              const initials = doc.name
                .replace(/Dr\.|Prof\.|\(Dr\.\)/g, "")
                .trim()
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0])
                .join("");

              const isDocOnline = Boolean(doc.isOnline || doc.is_online);

              return (
                <TouchableOpacity
                  key={doc.id}
                  style={styles.doctorDetailCard}
                  activeOpacity={0.88}
                  onPress={() => navigation.navigate("DoctorProfile", { doctor: doc })}
                >
                  <View style={styles.doctorTopRow}>
                    <View style={styles.avatarWrap}>
                      <View style={styles.doctorAvatar}>
                        <Text style={styles.doctorAvatarText}>{initials || "DR"}</Text>
                      </View>
                      <View
                        style={[
                          styles.avatarStatusBadge,
                          isDocOnline ? styles.avatarStatusOnline : styles.avatarStatusOffline,
                        ]}
                      >
                        <View style={[styles.avatarStatusDot, isDocOnline ? styles.dotOnline : styles.dotOffline]} />
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 14 }}>
                      <Text style={styles.doctorName}>{doc.name}</Text>
                      <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
                      <View style={styles.doctorMetaRow}>
                        <View
                          style={[
                            styles.onlineTag,
                            isDocOnline ? styles.onlineTagOnline : styles.onlineTagOffline,
                          ]}
                        >
                          <View
                            style={[
                              styles.onlineTagDot,
                              isDocOnline ? styles.onlineTagDotOnline : styles.onlineTagDotOffline,
                            ]}
                          />
                          <Text
                            style={[
                              styles.onlineTagText,
                              isDocOnline ? styles.onlineTagTextOnline : styles.onlineTagTextOffline,
                            ]}
                          >
                            {isDocOnline
                              ? language === "hi"
                                ? "ऑनलाइन"
                                : "Online"
                              : language === "hi"
                              ? "ऑफलाइन"
                              : "Offline"}
                          </Text>
                        </View>
                        <Text style={styles.dotSeparator}>·</Text>
                        <View style={styles.verifiedRow}>
                          <Ionicons name="shield-checkmark" size={13} color={COLORS.primary} />
                          <Text style={styles.verifiedText}>
                            {language === "hi" ? "सत्यापित" : "Verified"}
                          </Text>
                        </View>
                        <Text style={styles.dotSeparator}>·</Text>
                        <Text style={styles.expText}>{doc.experience}</Text>
                        <Text style={styles.dotSeparator}>·</Text>
                        <Text style={styles.feeBadge}>{doc.fee || "₹800"}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.doctorBottomRow}>
                    <View style={styles.timingRow}>
                      <Ionicons name="calendar-outline" size={13} color={COLORS.textLight} />
                      <Text style={styles.timingText} numberOfLines={1}>
                        {doc.availableDays || (language === "hi" ? "इस सप्ताह उपलब्ध" : "Available this week")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.bookMiniBtn}
                      onPress={() =>
                        navigation.navigate("BookAppointment", {
                          doctor: doc,
                          department: dept.name,
                        })
                      }
                    >
                      <Text style={styles.bookMiniBtnText}>{t.bookNow}</Text>
                      <Ionicons name="arrow-forward" size={13} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyDoctorCard}>
              <Ionicons name="medical-outline" size={36} color={COLORS.textLight} />
              <Text style={styles.emptyDoctorText}>
                {language === "hi"
                  ? "विशेषज्ञ ओपीडी अपॉइंटमेंट सामान्य अस्पताल समय-सारणी के माध्यम से उपलब्ध हैं।"
                  : "Specialist OPD appointments are available through general hospital scheduling."}
              </Text>
              <CustomButton
                title={t.bookAppointment}
                onPress={() =>
                  navigation.navigate("BookAppointment", { department: dept.name })
                }
                style={{ marginTop: 14, width: "100%" }}
              />
            </View>
          )}
        </View>

        {/* Hospital Helpline Banner - Consistent Red Block Emergency Card */}
        <EmergencyCard
          title={`${t.emergencyAssistanceFor || "Emergency Assistance for"} ${dept.name}`}
          subtitle={`${t.casualtyHelpline || "24x7 KMC Casualty"}: +91 8303666400`}
          style={{ marginHorizontal: 0, marginTop: 16 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  banner: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  deptName: { fontSize: 19, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  badgeRow: { flexDirection: "row", marginTop: 10, flexWrap: "wrap", justifyContent: "center" },
  specialistBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F6EC",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  specialistBadgeText: { color: COLORS.success, fontSize: 11, fontWeight: "700", marginLeft: 4 },
  timingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF6F5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timingBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: "700", marginLeft: 4 },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginLeft: 8 },
  sectionTitleLarge: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  overviewText: { fontSize: 13, color: COLORS.textLight, lineHeight: 21 },
  facilityRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  facilityText: { fontSize: 13, color: COLORS.text, marginLeft: 10, fontWeight: "500", flex: 1 },
  specialistsSection: { marginTop: 4, marginBottom: 16 },
  specialistsHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  specialistsCount: { fontSize: 14, fontWeight: "700", color: COLORS.primary, marginLeft: 6 },
  doctorDetailCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  doctorTopRow: { flexDirection: "row", alignItems: "center" },
  avatarWrap: {
    position: "relative",
    width: 54,
    height: 54,
  },
  doctorAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarStatusBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
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
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: "#16A34A",
  },
  dotOffline: {
    backgroundColor: "#94A3B8",
  },
  doctorAvatarText: { color: COLORS.white, fontWeight: "800", fontSize: 18 },
  doctorName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  doctorSpecialty: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  onlineTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  onlineTagOnline: {
    backgroundColor: "#DCFCE7",
  },
  onlineTagOffline: {
    backgroundColor: "#F1F5F9",
  },
  onlineTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  onlineTagDotOnline: {
    backgroundColor: "#16A34A",
  },
  onlineTagDotOffline: {
    backgroundColor: "#94A3B8",
  },
  onlineTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  onlineTagTextOnline: {
    color: "#166534",
  },
  onlineTagTextOffline: {
    color: "#64748B",
  },
  doctorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    marginLeft: 3,
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: COLORS.textLight,
    fontSize: 12,
  },
  expText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "500",
  },
  feeBadge: { fontSize: 12, fontWeight: "800", color: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  doctorBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  timingRow: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8 },
  timingText: { fontSize: 11, color: COLORS.textLight, marginLeft: 4 },
  bookMiniBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  bookMiniBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 12, marginRight: 4 },
  emptyDoctorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyDoctorText: { fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 10, lineHeight: 18 },
  helpBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    marginTop: 6,
  },
  helpBannerTitle: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  helpBannerSub: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
});
