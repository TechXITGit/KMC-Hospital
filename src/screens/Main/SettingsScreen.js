import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { HOSPITAL_INFO } from "../../constants/data";

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { language, setLanguage, t } = useLanguage();
  const { logout } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [modalType, setModalType] = useState(null); // "terms" | "privacy" | "about"
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const confirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch (e) {
      console.warn("Logout error:", e.message);
    } finally {
      setIsLoggingOut(false);
      setShowLogoutModal(false);
    }
  };

  const toggleLanguage = async () => {
    const nextLang = language === "en" ? "hi" : "en";
    await setLanguage(nextLang);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.settings}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Selection Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.language}</Text>
          <View style={styles.row}>
            <View>
              <Text style={styles.rowTitle}>{language === "en" ? "English" : "हिन्दी (Hindi)"}</Text>
              <Text style={styles.rowSub}>{t.switchLanguage}</Text>
            </View>
            <TouchableOpacity style={styles.langToggleBtn} onPress={toggleLanguage}>
              <Text style={styles.langToggleText}>
                {language === "en" ? "Switch to हिन्दी" : "Switch to English"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications Preferences */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.notificationPreferences}</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.appNotifications}</Text>
              <Text style={styles.rowSub}>{t.appointmentAlerts}</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{t.smsReminders}</Text>
              <Text style={styles.rowSub}>{t.smsBookings}</Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
            />
          </View>
        </View>

        {/* Legal & About */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.infoAndLegal}</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => setModalType("terms")}>
            <Text style={styles.menuItemText}>{t.termsConditions}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setModalType("privacy")}>
            <Text style={styles.menuItemText}>{t.privacyPolicy}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setModalType("about")}>
            <Text style={styles.menuItemText}>{t.aboutHospital}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => setShowLogoutModal(true)}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutText}>{t.logout || "Logout"}</Text>
        </TouchableOpacity>

        {/* App Version Info */}
        <View style={styles.footer}>
          <Text style={styles.footerApp}>{t.appName}</Text>
          <Text style={styles.footerVersion}>{t.appVersion}</Text>
          <Text style={styles.footerAddress}>{HOSPITAL_INFO.address}</Text>
        </View>
      </ScrollView>

      {/* Cross-Platform Logout Confirmation Modal (Web + Mobile) */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isLoggingOut) setShowLogoutModal(false);
        }}
      >
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconCircle}>
              <Ionicons name="log-out-outline" size={30} color={COLORS.danger} />
            </View>
            <Text style={styles.confirmTitle}>{t.logout || "Logout"}</Text>
            <Text style={styles.confirmSubtitle}>
              {t.logoutConfirm}
            </Text>

            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
              >
                <Text style={styles.confirmCancelText}>{t.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmActionBtn}
                onPress={confirmLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmActionText}>{t.logout || "Logout"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Info Modal */}
      <Modal visible={modalType !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {modalType === "terms"
                ? t.termsConditions
                : modalType === "privacy"
                ? t.privacyPolicy
                : t.aboutHospital}
            </Text>
            <ScrollView style={{ maxHeight: 350, marginVertical: 14 }}>
              {modalType === "terms" && (
                <Text style={styles.modalBody}>
                  {language === "hi"
                    ? `1. केएमसी अस्पताल लखनऊ ऑनलाइन अपॉइंटमेंट बुकिंग एवं रोगी देखभाल सेवाएं प्रदान करता है।\n\n` +
                      `2. गंभीर आपातकालीन स्थिति में ऑनलाइन वीडियो परामर्श अस्पताल आने का विकल्प नहीं है। तत्काल इमरजेंसी में आएं।\n\n` +
                      `3. कृपया अपने निर्धारित अपॉइंटमेंट समय से 15 मिनट पहले अस्पताल पहुंचें।\n\n` +
                      `4. अपॉइंटमेंट रद्द करने के लिए कृपया समय स्लॉट से कम से कम 2 घंटे पहले सूचित करें।`
                    : `1. KMC Hospital Lucknow provides appointment booking and patient care services.\n\n` +
                      `2. Online video consultation is not a substitute for emergency in-person medical care in critical conditions.\n\n` +
                      `3. Please arrive 15 minutes before your scheduled appointment time.\n\n` +
                      `4. For cancellations, please cancel at least 2 hours prior to the slot.`}
                </Text>
              )}
              {modalType === "privacy" && (
                <Text style={styles.modalBody}>
                  {language === "hi"
                    ? `केएमसी अस्पताल आपकी व्यक्तिगत चिकित्सा जानकारी की सुरक्षा को सर्वोच्च प्राथमिकता देता है:\n\n` +
                      `• आपकी मेडिकल रिपोर्ट्स और डॉक्टर के पर्चे पूर्णतः गोपनीय और सुरक्षित हैं।\n` +
                      `• मरीज का मोबाइल नंबर एवं प्रोफ़ाइल डेटा एन्क्रिप्टेड है।\n` +
                      `• हम किसी भी तीसरे पक्ष या विज्ञापनदाता के साथ मरीज का डेटा साझा नहीं करते हैं।`
                    : `KMC Hospital prioritizes your medical data privacy:\n\n` +
                      `• Your health records and consultation notes are strictly confidential.\n` +
                      `• Phone numbers and profile details are encrypted.\n` +
                      `• We do not sell or disclose patient records to any third-party advertisers.`}
                </Text>
              )}
              {modalType === "about" && (
                <Text style={styles.modalBody}>
                  {language === "hi"
                    ? `${HOSPITAL_INFO.fullName} (केएमसी अस्पताल)\n\n` +
                      `पता: ${HOSPITAL_INFO.address}\n\n` +
                      `24x7 आपातकालीन हेल्पलाइन: ${HOSPITAL_INFO.emergencyPrimary}\n` +
                      `वेबसाइट: ${HOSPITAL_INFO.website}\n\n` +
                      `लखनऊ में नवजात शिशु गहन चिकित्सा (NICU), बाल रोग, प्रसूति एवं स्त्री रोग, हड्डी रोग और उन्नत सर्जरी में उत्कृष्टता को समर्पित।`
                    : `${HOSPITAL_INFO.fullName} (KMC Hospital)\n\n` +
                      `Address: ${HOSPITAL_INFO.address}\n\n` +
                      `Emergency: ${HOSPITAL_INFO.emergencyPrimary}\n` +
                      `Website: ${HOSPITAL_INFO.website}\n\n` +
                      `Dedicated to excellence in pediatric, neonatal (NICU), maternal health, and advanced surgical care in Lucknow.`}
                </Text>
              )}
            </ScrollView>
            <CustomButton title={t.close} onPress={() => setModalType(null)} />
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  content: { padding: 20, paddingBottom: 40 },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  rowSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  langToggleBtn: {
    backgroundColor: "#EAF6F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  langToggleText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 14 },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  footer: { alignItems: "center", marginTop: 20, paddingHorizontal: 20 },
  footerApp: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  footerVersion: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  footerAddress: { fontSize: 10, color: COLORS.textLight, textAlign: "center", marginTop: 6, lineHeight: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  modalBody: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    padding: 16,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutText: { color: COLORS.danger, fontWeight: "700", marginLeft: 8, fontSize: 14 },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
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
  confirmIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  confirmSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});
