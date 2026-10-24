import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { getLocalizedMedicalRecords } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { downloadPrescriptionPdf, downloadLabReportPdf } from "../../services/pdfService";

export default function MedicalRecordsScreen() {
  const navigation = useNavigation();
  const { language, t } = useLanguage();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("rx"); // "rx" | "lab" | "vac"
  const [generatingId, setGeneratingId] = useState(null);

  const localizedRecords = getLocalizedMedicalRecords(language);
  const patientName =
    profile?.fullName || profile?.name || (language === "hi" ? "सम्मानित मरीज" : "Valued Patient");

  const handleUpload = () => {
    Alert.alert(
      t.uploadRecord || (language === "hi" ? "दस्तावेज़ अपलोड करें" : "Upload Record"),
      language === "hi"
        ? "मेडिकल दस्तावेज़ या पर्ची अपलोड करने का विकल्प चुनें:"
        : "Select an option to upload medical document or prescription:",
      [
        {
          text: language === "hi" ? "फोटो लें" : "Take Photo",
          onPress: () =>
            Alert.alert(
              language === "hi" ? "कैमरा" : "Camera",
              language === "hi"
                ? "पर्चे की फोटो खींचने की सुविधा उपलब्ध है।"
                : "Camera capture available for prescriptions."
            ),
        },
        {
          text: language === "hi" ? "गैलरी से चुनें" : "Choose from Gallery",
          onPress: () =>
            Alert.alert(
              language === "hi" ? "गैलरी" : "Gallery",
              language === "hi"
                ? "गैलरी से चयन उपलब्ध है।"
                : "Gallery picker available."
            ),
        },
        { text: t.cancel || "Cancel", style: "cancel" },
      ]
    );
  };

  const handleDownloadPrescription = async (item) => {
    if (generatingId) return;
    try {
      setGeneratingId(item.id);
      await downloadPrescriptionPdf({
        patientName,
        doctorName: item.doctorName,
        department: item.department,
        diagnosis: item.diagnosis,
        medicines: item.medicines,
        date: item.date,
        tokenNumber: `KMC-RX-${item.id}`,
      });
    } catch (err) {
      Alert.alert(
        language === "hi" ? "त्रुटि" : "Error",
        t.downloadFailed || (language === "hi" ? "दस्तावेज़ डाउनलोड विफल हुआ।" : "Failed to download document.")
      );
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDownloadLab = async (lab) => {
    if (generatingId) return;
    try {
      setGeneratingId(lab.id);
      await downloadLabReportPdf({
        patientName,
        testName: lab.testName,
        doctorName: lab.doctor,
        keyResults: lab.keyResults,
        status: lab.status,
        date: lab.date,
      });
    } catch (err) {
      Alert.alert(
        language === "hi" ? "त्रुटि" : "Error",
        t.downloadFailed || (language === "hi" ? "दस्तावेज़ डाउनलोड विफल हुआ।" : "Failed to download document.")
      );
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.medicalRecords || "Medical Records"}</Text>
        <TouchableOpacity onPress={handleUpload} style={styles.uploadBtn} activeOpacity={0.8}>
          <Ionicons name="cloud-upload-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "rx" && styles.tabItemActive]}
          onPress={() => setActiveTab("rx")}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabLabel, activeTab === "rx" && styles.tabLabelActive]}>
            {t.prescriptions || (language === "hi" ? "दवा के पर्चे" : "Prescriptions")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "lab" && styles.tabItemActive]}
          onPress={() => setActiveTab("lab")}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabLabel, activeTab === "lab" && styles.tabLabelActive]}>
            {t.labReports || (language === "hi" ? "लैब रिपोर्ट्स" : "Lab Reports")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "vac" && styles.tabItemActive]}
          onPress={() => setActiveTab("vac")}
          activeOpacity={0.85}
        >
          <Text style={[styles.tabLabel, activeTab === "vac" && styles.tabLabelActive]}>
            {t.vaccinations || (language === "hi" ? "टीकाकरण" : "Vaccinations")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Prescriptions Tab */}
        {activeTab === "rx" && (
          <View>
            {localizedRecords.prescriptions.map((item) => {
              const isBusy = generatingId === item.id;
              return (
                <View key={item.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.rxIconCircle}>
                      <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cardTitle}>{item.doctorName}</Text>
                      <Text style={styles.cardSub}>{item.department}</Text>
                    </View>
                    <Text style={styles.cardDate}>{item.date}</Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.sectionSmallTitle}>
                    {language === "hi" ? "निदान / मुख्य शिकायत:" : "Diagnosis / Complaint:"}
                  </Text>
                  <Text style={styles.diagnosisText}>{item.diagnosis}</Text>

                  <Text style={[styles.sectionSmallTitle, { marginTop: 10 }]}>
                    {language === "hi" ? "निर्धारित दवाएं:" : "Prescribed Medicines:"}
                  </Text>
                  {item.medicines.map((med, idx) => (
                    <View key={idx} style={styles.medRow}>
                      <Ionicons name="ellipse" size={6} color={COLORS.primary} style={{ marginTop: 6 }} />
                      <Text style={styles.medText}>{med}</Text>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.downloadRow, isBusy && { opacity: 0.7 }]}
                    onPress={() => handleDownloadPrescription(item)}
                    disabled={isBusy}
                    activeOpacity={0.8}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                    ) : (
                      <Ionicons name="download-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                    )}
                    <Text style={styles.downloadText}>
                      {isBusy
                        ? (t.generatingPdf || (language === "hi" ? "पीडीएफ बन रहा है..." : "Generating PDF..."))
                        : (t.downloadPdf || (language === "hi" ? "पर्चा डाउनलोड करें" : "Download PDF"))}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* Lab Reports Tab */}
        {activeTab === "lab" && (
          <View>
            {localizedRecords.labReports.map((lab) => {
              const isBusy = generatingId === lab.id;
              return (
                <View key={lab.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.rxIconCircle, { backgroundColor: "#EAF6F5" }]}>
                      <Ionicons name="flask-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.cardTitle}>{lab.testName}</Text>
                      <Text style={styles.cardSub}>
                        {language === "hi" ? "सलाहकार: " : "Ordered by "}
                        {lab.doctor}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{lab.status}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.sectionSmallTitle}>
                    {language === "hi" ? "मुख्य जांच परिणाम:" : "Key Findings:"}
                  </Text>
                  <Text style={styles.labResultsText}>{lab.keyResults}</Text>

                  <View style={styles.labFooter}>
                    <Text style={styles.cardDate}>{lab.date}</Text>
                    <TouchableOpacity
                      style={[styles.downloadRow, isBusy && { opacity: 0.7 }]}
                      onPress={() => handleDownloadLab(lab)}
                      disabled={isBusy}
                      activeOpacity={0.8}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                      ) : (
                        <Ionicons name="document-text-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                      )}
                      <Text style={styles.downloadText}>
                        {isBusy
                          ? (t.generatingPdf || (language === "hi" ? "पीडीएफ बन रहा है..." : "Generating PDF..."))
                          : (t.viewReport || (language === "hi" ? "रिपोर्ट देखें व डाउनलोड करें" : "View & Download Report"))}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Vaccinations Tab */}
        {activeTab === "vac" && (
          <View>
            {localizedRecords.vaccinations.map((vac) => (
              <View key={vac.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.rxIconCircle, { backgroundColor: "#FEF3C7" }]}>
                    <Ionicons name="shield-checkmark-outline" size={20} color="#D97706" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.cardTitle}>{vac.vaccineName}</Text>
                    <Text style={styles.cardSub}>
                      {language === "hi" ? "खुराक: " : "Dose: "}
                      {vac.dose}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: "#DCFCE7" }]}>
                    <Text style={[styles.statusText, { color: "#15803D" }]}>{vac.status}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.labFooter}>
                  <Text style={styles.cardDate}>
                    {language === "hi" ? "दिनांक: " : "Administered: "}
                    {vac.date}
                  </Text>
                  <View style={styles.badgeVerified}>
                    <Ionicons name="checkmark-circle" size={14} color="#15803D" style={{ marginRight: 4 }} />
                    <Text style={styles.badgeVerifiedText}>
                      {language === "hi" ? "केएमसी अस्पताल सत्यापित" : "Verified by KMC Pediatrics"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  uploadBtn: { padding: 4 },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 4,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  tabItemActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textLight },
  tabLabelActive: { color: COLORS.white },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
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
  cardHeader: { flexDirection: "row", alignItems: "center" },
  rxIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  cardSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  cardDate: { fontSize: 11, color: COLORS.textLight, fontWeight: "600" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  sectionSmallTitle: { fontSize: 11, fontWeight: "800", color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  diagnosisText: { fontSize: 13, color: COLORS.text, marginTop: 4, fontWeight: "500" },
  medRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 6 },
  medText: { fontSize: 13, color: COLORS.text, marginLeft: 8, flex: 1 },
  downloadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  downloadText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  statusBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: "700", color: "#15803D" },
  labResultsText: { fontSize: 13, color: COLORS.text, marginTop: 4, lineHeight: 18 },
  labFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  badgeVerified: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeVerifiedText: { fontSize: 10, fontWeight: "700", color: "#15803D" },
});
