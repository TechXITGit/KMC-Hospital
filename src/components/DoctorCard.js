import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { useLanguage } from "../context/LanguageContext";

export default function DoctorCard({ doctor, onPress }) {
  const { language } = useLanguage();
  const isOnline = Boolean(doctor.isOnline || doctor.is_online);

  const initials = doctor.name
    .replace("Dr.", "")
    .replace("Prof.", "")
    .replace("(Dr.)", "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
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

      <Text style={styles.name} numberOfLines={1}>
        {doctor.name}
      </Text>
      <Text style={styles.specialty} numberOfLines={2}>
        {doctor.specialty}
      </Text>

      {/* Online / Offline Status Badge */}
      <View
        style={[
          styles.onlinePill,
          isOnline ? styles.onlinePillActive : styles.onlinePillInactive,
        ]}
      >
        <View style={[styles.statusDot, isOnline ? styles.statusDotGreen : styles.statusDotGray]} />
        <Text
          style={[
            styles.onlinePillText,
            isOnline ? styles.onlinePillTextGreen : styles.onlinePillTextGray,
          ]}
        >
          {isOnline
            ? language === "hi"
              ? "ऑनलाइन"
              : "Online"
            : language === "hi"
            ? "ऑफलाइन"
            : "Offline"}
        </Text>
      </View>

      <View style={styles.expRow}>
        <Ionicons name="ribbon-outline" size={12} color={COLORS.primary} />
        <Text style={styles.expText} numberOfLines={1}>{doctor.experience}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 154,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarWrap: {
    position: "relative",
    width: 52,
    height: 52,
    marginBottom: 10,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  avatarText: { color: COLORS.white, fontWeight: "700", fontSize: 16 },
  name: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  specialty: { fontSize: 11, color: COLORS.textLight, marginTop: 4, height: 30 },
  onlinePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    marginTop: 6,
  },
  onlinePillActive: {
    backgroundColor: "#DCFCE7",
  },
  onlinePillInactive: {
    backgroundColor: "#F1F5F9",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusDotGreen: {
    backgroundColor: "#16A34A",
  },
  statusDotGray: {
    backgroundColor: "#94A3B8",
  },
  onlinePillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  onlinePillTextGreen: {
    color: "#166534",
  },
  onlinePillTextGray: {
    color: "#64748B",
  },
  expRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  expText: { fontSize: 11, color: COLORS.primary, marginLeft: 4, fontWeight: "600" },
});
