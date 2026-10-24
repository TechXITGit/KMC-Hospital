import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import EmergencyCard from "../../components/EmergencyCard";
import { HOSPITAL_INFO, getLocalizedFaqs } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";

export default function HelpSupportScreen() {
  const navigation = useNavigation();
  const { language, t } = useLanguage();
  const [expandedFaq, setExpandedFaq] = useState(null);

  const localizedFaqs = getLocalizedFaqs(language);

  const handleCallHospital = () => {
    Linking.openURL(`tel:${HOSPITAL_INFO.emergencyPrimary}`);
  };

  const handleWhatsApp = () => {
    const msg = language === "hi"
      ? "नमस्ते केएमसी अस्पताल लखनऊ, मुझे सहायता चाहिए।"
      : "Hello KMC Hospital Lucknow, I need some assistance.";
    const text = encodeURIComponent(msg);
    Linking.openURL(`https://wa.me/918303666400?text=${text}`).catch(() => {
      Linking.openURL(`tel:${HOSPITAL_INFO.whatsapp}`);
    });
  };

  const handleMaps = () => {
    const query = encodeURIComponent(HOSPITAL_INFO.address);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  const toggleFaq = (index) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.helpSupport}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Emergency Ambulance Card - Standard Red Block */}
        <EmergencyCard
          title={language === "hi" ? "आपातकालीन एम्बुलेंस हेल्पलाइन" : "Emergency Ambulance Helpline"}
          subtitle={
            language === "hi"
              ? "24x7 तत्काल आपातकालीन एवं ट्रॉमा रिस्पॉन्स"
              : "24x7 Immediate Emergency & Trauma Response"
          }
          phoneNumber={HOSPITAL_INFO.ambulanceNumber}
          icon="ambulance"
          buttonText={language === "hi" ? "तुरंत कॉल करें" : "Call Now"}
          style={{ marginBottom: 16 }}
        />

        {/* Quick Contact Buttons */}
        <View style={styles.contactRow}>
          <TouchableOpacity style={styles.contactBtn} onPress={handleCallHospital}>
            <View style={[styles.contactIconCircle, { backgroundColor: "#EAF6F5" }]}>
              <Ionicons name="call" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.contactBtnText}>
              {language === "hi" ? "हेल्पलाइन" : "Helpline"}
            </Text>
            <Text style={styles.contactBtnSub}>
              {language === "hi" ? "रिसेप्शन" : "Reception"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactBtn} onPress={handleWhatsApp}>
            <View style={[styles.contactIconCircle, { backgroundColor: "#E7F6EC" }]}>
              <Ionicons name="logo-whatsapp" size={22} color={COLORS.success} />
            </View>
            <Text style={styles.contactBtnText}>WhatsApp</Text>
            <Text style={styles.contactBtnSub}>
              {language === "hi" ? "तुरंत चैट" : "Instant Chat"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactBtn} onPress={handleMaps}>
            <View style={[styles.contactIconCircle, { backgroundColor: "#EBF3FE" }]}>
              <Ionicons name="location" size={22} color="#2F80ED" />
            </View>
            <Text style={styles.contactBtnText}>
              {language === "hi" ? "रास्ता देखें" : "Directions"}
            </Text>
            <Text style={styles.contactBtnSub}>
              {language === "hi" ? "गूगल मैप्स" : "Google Maps"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hospital Address & Timings */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>
            {language === "hi" ? "अस्पताल का पता एवं समय" : "Hospital Location & Timings"}
          </Text>
          <View style={styles.infoItem}>
            <Ionicons name="business-outline" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>{HOSPITAL_INFO.address}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>{t.hospitalTimings}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
            <Text style={styles.infoText}>{t.opdHours}</Text>
          </View>
        </View>

        {/* FAQs */}
        <Text style={styles.sectionTitle}>{t.frequentlyAsked}</Text>
        {localizedFaqs.map((faq, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.faqCard}
            activeOpacity={0.8}
            onPress={() => toggleFaq(idx)}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{faq.q}</Text>
              <Ionicons
                name={expandedFaq === idx ? "chevron-up" : "chevron-down"}
                size={18}
                color={COLORS.textLight}
              />
            </View>
            {expandedFaq === idx && (
              <View style={styles.faqBody}>
                <Text style={styles.faqAnswer}>{faq.a}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
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
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  content: { padding: 20, paddingBottom: 40 },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  emergencyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyCardTitle: { color: COLORS.white, fontSize: 13, fontWeight: "600" },
  emergencyNumber: { color: COLORS.white, fontSize: 19, fontWeight: "800", marginTop: 2 },
  emergencyBadge: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  contactRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  contactBtn: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 4,
  },
  contactIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  contactBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  contactBtnSub: { fontSize: 10, color: COLORS.textLight, marginTop: 2 },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  infoItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  infoText: { fontSize: 13, color: COLORS.text, marginLeft: 10, flex: 1, lineHeight: 18 },
  faqCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  faqHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  faqQuestion: { fontSize: 13, fontWeight: "700", color: COLORS.text, flex: 1, paddingRight: 10 },
  faqBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  faqAnswer: { fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
});
