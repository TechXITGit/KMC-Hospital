import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { useLanguage } from "../context/LanguageContext";
import { formatTimeTo12Hour } from "../utils/dateFormatter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(290, SCREEN_WIDTH - 48);

export default function AppointmentCard({ appointment, onPress }) {
  const { t } = useLanguage();
  const s = (appointment?.status || "").toLowerCase();
  const isCancelled = s === "cancelled";
  const isCompleted = s === "completed";

  const statusText = isCancelled
    ? (t.cancelled || "Cancelled")
    : isCompleted
    ? (t.completed || "Completed")
    : (t.confirmed || "Confirmed");

  const formattedTime = formatTimeTo12Hour(appointment?.time);

  return (
    <TouchableOpacity
      style={[styles.card, { width: CARD_WIDTH }]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.dateBox}>
        <Text style={styles.day}>{appointment?.day || "15"}</Text>
        <Text style={styles.month}>{appointment?.month || "Sep"}</Text>
      </View>
      <View style={styles.infoCol}>
        <Text style={styles.doctorName} numberOfLines={1} ellipsizeMode="tail">
          {appointment?.doctorName || "KMC Doctor"}
        </Text>
        <Text style={styles.department} numberOfLines={1} ellipsizeMode="tail">
          {appointment?.department || "General Specialist"}
        </Text>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={13} color={COLORS.textLight} />
          <Text style={styles.timeText} numberOfLines={1}>
            {formattedTime}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.statusBadge,
          isCancelled
            ? styles.badgeCancelled
            : isCompleted
            ? styles.badgeCompleted
            : styles.badgeConfirmed,
        ]}
      >
        <Text
          style={[
            styles.statusText,
            isCancelled
              ? styles.textCancelled
              : isCompleted
              ? styles.textCompleted
              : styles.textConfirmed,
          ]}
        >
          {statusText}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dateBox: {
    width: 48,
    height: 52,
    borderRadius: 10,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D2EFEF",
  },
  day: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
  month: { fontSize: 10, color: COLORS.textLight, textTransform: "uppercase", fontWeight: "700" },
  infoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  doctorName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  department: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { fontSize: 11, color: COLORS.textLight, marginLeft: 4 },
  statusBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "center",
  },
  badgeConfirmed: { backgroundColor: "#E7F6EC" },
  badgeCompleted: { backgroundColor: "#EBF3FE" },
  badgeCancelled: { backgroundColor: "#FDEAEA" },
  statusText: { fontSize: 10, fontWeight: "700" },
  textConfirmed: { color: COLORS.success },
  textCompleted: { color: "#2F80ED" },
  textCancelled: { color: COLORS.danger },
});
