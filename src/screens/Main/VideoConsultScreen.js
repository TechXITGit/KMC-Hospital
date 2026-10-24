import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import EmergencyCard from "../../components/EmergencyCard";
import { DOCTORS, getLocalizedDoctors } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";

const CATEGORIES = [
  { id: "all", en: "All Specialists", hi: "सभी विशेषज्ञ" },
  { id: "nicu", en: "Neonatology (NICU)", hi: "नवजात शिशु (NICU)" },
  { id: "obgyn", en: "Obstetrics & Gynaecology", hi: "प्रसूति एवं स्त्री रोग" },
  { id: "ortho", en: "Orthopaedics", hi: "हड्डी एवं जोड़ रोग" },
  { id: "pedsurg", en: "Pediatric Surgery", hi: "बाल शल्य चिकित्सा" },
];

export default function VideoConsultScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { doctors, loadDoctors } = useAppointments();
  const [selectedCatId, setSelectedCatId] = useState("all");

  useFocusEffect(
    useCallback(() => {
      if (typeof loadDoctors === "function") {
        loadDoctors();
      }
    }, [])
  );

  const allDocs = getLocalizedDoctors(doctors && doctors.length > 0 ? doctors : DOCTORS, language).filter(
    (d) => d.active !== false
  );

  const selectedCategoryObj = CATEGORIES.find((c) => c.id === selectedCatId) || CATEGORIES[0];
  const selectedCategoryName = language === "hi" ? selectedCategoryObj.hi : selectedCategoryObj.en;

  const filteredDoctors =
    selectedCatId === "all"
      ? allDocs
      : allDocs.filter((d) => {
          const docDept = (d.department || "").toLowerCase();
          const enMatch = (selectedCategoryObj.en || "").toLowerCase();
          const hiMatch = (selectedCategoryObj.hi || "").toLowerCase();
          return docDept.includes(enMatch) || enMatch.includes(docDept) || docDept.includes(hiMatch);
        });

  const handleSelectDoctorForConsult = (doctor) => {
    const docToBook = doctor || allDocs[0] || DOCTORS[0];
    handleBookSlot(docToBook);
  };

  const handleBookSlot = (doctor) => {
    navigation.navigate("BookAppointment", {
      type: "Video Consultation",
      doctor,
      department: doctor?.department,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate("Home");
            }
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.videoConsult || "Video Consultation"}</Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>{language === "hi" ? "ऑनलाइन" : "Online"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroLeft}>
            <View style={styles.heroPill}>
              <Ionicons name="shield-checkmark" size={13} color="#CCFBF1" />
              <Text style={styles.heroPillText}>
                {language === "hi" ? "100% सुरक्षित और निजी" : "100% Encrypted & Private"}
              </Text>
            </View>
            <Text style={styles.heroTitle}>
              {language === "hi" ? "वीडियो कॉल से शीर्ष डॉक्टरों से परामर्श करें" : "Consult Top Doctors via Video Call"}
            </Text>
            <Text style={styles.heroSubtitle}>
              {language === "hi"
                ? "तुरंत जुड़ें · अनुभवी विशेषज्ञ · डिजिटल पर्ची उपलब्ध"
                : "Connect within 2 minutes · Verified KMC Specialists · Official Digital Prescription"}
            </Text>
            <TouchableOpacity
              style={styles.heroCta}
              activeOpacity={0.85}
              onPress={() => handleSelectDoctorForConsult(allDocs[0] || DOCTORS[0])}
            >
              <Ionicons name="calendar" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.heroCtaText}>
                {language === "hi" ? "ऑनलाइन स्लॉट बुक करें" : "Book Video Consult"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Filters */}
        <View style={styles.categorySection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCatId === cat.id;
              const label = language === "hi" ? cat.hi : cat.en;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  onPress={() => setSelectedCatId(cat.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Section Heading */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t.availableToday || (language === "hi" ? "वीडियो कॉल हेतु उपलब्ध विशेषज्ञ" : "Available Specialists for Video Call")}
          </Text>
          <Text style={styles.doctorCount}>
            {language === "hi"
              ? `${filteredDoctors.length} डॉक्टर उपलब्ध`
              : `${filteredDoctors.length} ${filteredDoctors.length === 1 ? "Doctor" : "Doctors"}`}
          </Text>
        </View>

        {/* Doctor Video Cards */}
        <View style={styles.doctorListWrap}>
          {filteredDoctors.map((doc) => {
            const isDocOnline = Boolean(doc.isOnline || doc.is_online);
            return (
              <View key={doc.id} style={styles.doctorCard}>
                <View style={styles.cardHeader}>
                  {/* Doctor Avatar */}
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarInitials}>
                      {doc.name
                        .replace("Dr. ", "")
                        .replace("Prof. (Dr.) ", "")
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                    <View style={styles.onlineBadge}>
                      <View style={[styles.onlineDot, isDocOnline ? styles.onlineDotActive : styles.onlineDotInactive]} />
                    </View>
                  </View>

                  {/* Doctor Meta */}
                  <View style={styles.docMeta}>
                    <Text style={styles.docName} numberOfLines={1}>
                      {doc.name}
                    </Text>
                    <Text style={styles.docSpecialty} numberOfLines={1}>
                      {doc.specialty}
                    </Text>
                    <Text style={styles.docDept}>{doc.department}</Text>

                    {/* Online / Offline Status Badge */}
                    <View style={styles.docStatusRow}>
                      <View style={[styles.statusTag, isDocOnline ? styles.statusTagOnline : styles.statusTagOffline]}>
                        <View style={[styles.statusMiniDot, isDocOnline ? styles.statusMiniDotOnline : styles.statusMiniDotOffline]} />
                        <Text style={[styles.statusTagText, isDocOnline ? styles.statusTagTextOnline : styles.statusTagTextOffline]}>
                          {isDocOnline
                            ? (language === "hi" ? "ऑनलाइन उपलब्ध" : "Online Available")
                            : (language === "hi" ? "ऑफलाइन" : "Offline")}
                        </Text>
                      </View>
                    </View>

                    {/* Verified badge and Experience */}
                    <View style={styles.verifiedDocRow}>
                      <Ionicons name="shield-checkmark" size={13} color={COLORS.primary} />
                      <Text style={styles.verifiedDocText}>
                        {t.verifiedSpecialist || (language === "hi" ? "सत्यापित विशेषज्ञ" : "Verified Specialist")}
                      </Text>
                      <Text style={styles.dotSeparator}>·</Text>
                      <Text style={styles.expText}>{doc.experience}</Text>
                    </View>
                  </View>
                </View>

                {/* Consultation Fee & Time */}
                <View style={styles.cardDivider} />
                <View style={styles.cardInfoRow}>
                  <View style={styles.infoCol}>
                    <Text style={styles.infoLabel}>{t.docConsultFee}</Text>
                    <Text style={styles.infoValue}>{doc.fee}</Text>
                  </View>
                  <View style={styles.infoColRight}>
                    <Text style={styles.infoLabel}>{language === "hi" ? "स्थिति / समय" : "Status / Wait"}</Text>
                    <View style={[styles.waitTimeBadge, isDocOnline ? styles.waitTimeBadgeOnline : styles.waitTimeBadgeOffline]}>
                      <Ionicons name={isDocOnline ? "time-outline" : "moon-outline"} size={12} color={isDocOnline ? "#059669" : "#64748B"} />
                      <Text style={[styles.waitTimeText, isDocOnline ? styles.waitTimeTextOnline : styles.waitTimeTextOffline]}>
                        {isDocOnline
                          ? (language === "hi" ? "< 5 मिनट" : "< 5 mins")
                          : (language === "hi" ? "ऑफलाइन" : "Offline")}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.bookSlotBtn, { flex: 1, backgroundColor: isDocOnline ? COLORS.primary : "#475569" }]}
                    activeOpacity={0.85}
                    onPress={() => handleBookSlot(doc)}
                  >
                    <Ionicons name={isDocOnline ? "videocam" : "calendar-outline"} size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                    <Text style={[styles.bookSlotBtnText, { color: COLORS.white, fontWeight: "700" }]}>
                      {isDocOnline
                        ? (language === "hi" ? "ऑनलाइन वीडियो परामर्श बुक करें" : "Book Live Video Consultation")
                        : (language === "hi" ? "अपॉइंटमेंट स्लॉट बुक करें" : "Book Consultation Slot")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {/* How it Works Section */}
        <View style={styles.howItWorksCard}>
          <Text style={styles.howTitle}>
            {language === "hi" ? "वीडियो परामर्श कैसे काम करता है" : "How Video Consultation Works"}
          </Text>
          <View style={styles.stepRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNum}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>
                {language === "hi" ? "ऑनलाइन वीडियो अपॉइंटमेंट बुक करें" : "Book an Online Video Appointment"}
              </Text>
              <Text style={styles.stepDesc}>
                {language === "hi"
                  ? "विशेषज्ञ डॉक्टर चुनें और अपनी सुविधा का समय स्लॉट निर्धारित करें।"
                  : "Select your specialist and pick a convenient appointment slot."}
              </Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNum}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>
                {language === "hi" ? "निर्धारित समय पर डॉक्टर सीधे आपको कॉल करेंगे" : "Doctor Calls You at Scheduled Time"}
              </Text>
              <Text style={styles.stepDesc}>
                {language === "hi"
                  ? "आपके अपॉइंटमेंट समय पर डॉक्टर ऐप में वीडियो कॉल करेंगे। स्क्रीन पर उत्तर दें।"
                  : "Your doctor initiates the secure call. Answer the prompt in this app to connect."}
              </Text>
            </View>
          </View>

          <View style={styles.stepRow}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNum}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepHeading}>
                {language === "hi" ? "आमने-सामने परामर्श एवं डिजिटल पर्ची" : "Face-to-Face Consult & Digital Prescription"}
              </Text>
              <Text style={styles.stepDesc}>
                {language === "hi"
                  ? "विशेषज्ञ से पूरी जांच कराएं और मेडिकल रिकॉर्ड्स में डिजिटल प्रिस्क्रिप्शन प्राप्त करें।"
                  : "Consult with your specialist and receive your prescription in your medical records."}
              </Text>
            </View>
          </View>
        </View>

        {/* 24x7 Emergency Help Banner - Consistent Red Block Emergency Card */}
        <EmergencyCard
          title={t.criticalMedicalEmergency || "Critical Medical Emergency?"}
          subtitle={
            language === "hi"
              ? "ऑनलाइन परामर्श की प्रतीक्षा न करें। तुरंत केएमसी अस्पताल आएं या 24x7 कॉल करें"
              : "Do not wait for online consult. Please visit KMC Hospital or call 24x7"
          }
          style={{ marginHorizontal: 20, marginBottom: 28 }}
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
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#16A34A",
    marginRight: 5,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  scrollContent: {
    paddingBottom: 60,
  },
  heroBanner: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  heroLeft: {
    flex: 1,
  },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  heroPillText: {
    fontSize: 11,
    color: "#CCFBF1",
    fontWeight: "600",
    marginLeft: 4,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.white,
    lineHeight: 26,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 17,
    marginBottom: 16,
  },
  heroCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heroCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  categorySection: {
    marginTop: 18,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  categoryChipTextActive: {
    color: COLORS.white,
    fontWeight: "700",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  doctorCount: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: "500",
  },
  doctorListWrap: {
    paddingHorizontal: 20,
  },
  doctorCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    position: "relative",
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  onlineBadge: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#16A34A",
  },
  onlineDotActive: {
    backgroundColor: "#16A34A",
  },
  onlineDotInactive: {
    backgroundColor: "#94A3B8",
  },
  docStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  statusTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagOnline: {
    backgroundColor: "#DCFCE7",
  },
  statusTagOffline: {
    backgroundColor: "#F1F5F9",
  },
  statusMiniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusMiniDotOnline: {
    backgroundColor: "#16A34A",
  },
  statusMiniDotOffline: {
    backgroundColor: "#94A3B8",
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  statusTagTextOnline: {
    color: "#166534",
  },
  statusTagTextOffline: {
    color: "#64748B",
  },
  docMeta: {
    flex: 1,
    marginLeft: 14,
  },
  docName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 2,
  },
  docSpecialty: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primaryDark,
    marginBottom: 2,
  },
  docDept: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  verifiedDocRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  verifiedDocText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    marginLeft: 3,
  },
  dotSeparator: {
    marginHorizontal: 5,
    color: COLORS.textLight,
  },
  expText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "500",
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  cardInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  infoCol: {},
  infoColRight: {
    alignItems: "flex-end",
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  waitTimeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  waitTimeBadgeOnline: {
    backgroundColor: "#DCFCE7",
  },
  waitTimeBadgeOffline: {
    backgroundColor: "#F1F5F9",
  },
  waitTimeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    marginLeft: 4,
  },
  waitTimeTextOnline: {
    color: "#059669",
  },
  waitTimeTextOffline: {
    color: "#64748B",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  instantCallBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingVertical: 11,
    borderRadius: 12,
  },
  instantCallBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
  bookSlotBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 11,
    borderRadius: 12,
  },
  bookSlotBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  howItWorksCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  howTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    marginTop: 2,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 11,
    color: COLORS.textLight,
    lineHeight: 15,
  },
  emergencyHelp: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#B91C1C",
    marginBottom: 2,
  },
  emergencyDesc: {
    fontSize: 11,
    color: "#7F1D1D",
    lineHeight: 15,
  },
});
