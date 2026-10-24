import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { HOSPITAL_INFO } from "../constants/data";
import { useLanguage } from "../context/LanguageContext";

export default function EmergencyCard({
  title,
  subtitle,
  phoneNumber = HOSPITAL_INFO.emergencyPrimary,
  icon = "alert-circle",
  buttonText,
  style,
}) {
  const { t } = useLanguage();

  const handleCall = () => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const displayTitle = title || t.emergencyHelp || "Emergency Helpline";
  const displaySubtitle = subtitle || `${phoneNumber} · 24x7`;
  const displayBtnText = buttonText || t.callNow || "Call Now";

  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={26} color={COLORS.white} />
      </View>
      <View style={{ flex: 1, marginRight: 10 }}>
        <Text style={styles.title}>{displayTitle}</Text>
        <Text style={styles.subtitle}>{displaySubtitle}</Text>
      </View>
      <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
        <Ionicons name="call" size={15} color={COLORS.accent} />
        <Text style={styles.callText}>{displayBtnText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  title: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  subtitle: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 2 },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  callText: { color: COLORS.accent, fontWeight: "700", fontSize: 12, marginLeft: 4 },
});
