import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import EmergencyCard from "../../components/EmergencyCard";
import { getLocalizedQuickServices, HOSPITAL_INFO } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";

export default function ServiceDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { language, t } = useLanguage();

  const serviceParam = route.params?.service;
  const serviceId = route.params?.serviceId || serviceParam?.id || "qs1";
  const localizedServices = getLocalizedQuickServices(language);
  const service =
    localizedServices.find((s) => s.id === serviceId) || localizedServices[0];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.serviceDetails}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {/* Service Header Card */}
        <View style={styles.banner}>
          <View style={styles.iconCircle}>
            <Ionicons name={service.icon || "medkit"} size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.serviceTitle}>{service.title}</Text>
          <Text style={styles.serviceShort}>{service.shortDesc}</Text>
          <View style={styles.timingBadge}>
            <Ionicons name="time-outline" size={14} color={COLORS.primary} />
            <Text style={styles.timingText}>{service.timings}</Text>
          </View>
        </View>

        {/* Detailed Description */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.aboutService}</Text>
          <Text style={styles.descText}>{service.fullDesc}</Text>
        </View>

        {/* Highlights */}
        {service.highlights && service.highlights.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {language === "hi" ? "प्रमुख विशेषताएं" : "Key Service Highlights"}
            </Text>
            {service.highlights.map((item, index) => (
              <View key={index} style={styles.highlightRow}>
                <Ionicons name="shield-checkmark" size={18} color={COLORS.primary} />
                <Text style={styles.highlightText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Booking Action */}
        <View style={styles.actionCard}>
          <Text style={styles.actionCardTitle}>
            {language === "hi" ? "क्या आपको इस सेवा की आवश्यकता है?" : "Need this service?"}
          </Text>
          <Text style={styles.actionCardSub}>
            {language === "hi"
              ? "केएमसी अस्पताल हेल्पडेस्क से बात करें या ऑनलाइन अपॉइंटमेंट बुक करें।"
              : "Speak with KMC Hospital helpdesk or book an appointment online."}
          </Text>

          <CustomButton
            title={t.bookAppointment}
            onPress={() => navigation.navigate("BookAppointment")}
            style={{ marginTop: 14 }}
          />
        </View>

        {/* Emergency Helpline - Red Block */}
        <EmergencyCard
          title={language === "hi" ? "24x7 आपातकालीन सहायता" : "24x7 Emergency Helpline"}
          subtitle={
            language === "hi"
              ? "तत्काल एम्बुलेंस एवं ट्रॉमा सहायता"
              : "Immediate Ambulance & Trauma support"
          }
          phoneNumber={HOSPITAL_INFO.emergencyPrimary}
          style={{ marginTop: 16 }}
        />
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
  content: { padding: 20, paddingBottom: 100, flexGrow: 1 },
  banner: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  serviceTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  serviceShort: { fontSize: 13, color: COLORS.textLight, textAlign: "center", marginTop: 6 },
  timingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF6F5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 14,
  },
  timingText: { fontSize: 12, fontWeight: "600", color: COLORS.primary, marginLeft: 6 },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginBottom: 12 },
  descText: { fontSize: 13, color: COLORS.textLight, lineHeight: 21 },
  highlightRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  highlightText: { fontSize: 13, color: COLORS.text, marginLeft: 10, flex: 1, fontWeight: "500" },
  actionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionCardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  actionCardSub: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 10,
  },
  callButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 13, marginLeft: 8 },
});
