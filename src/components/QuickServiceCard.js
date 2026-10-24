import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";

export default function QuickServiceCard({ title, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <Ionicons name={icon} size={24} color={COLORS.primary} />
      <Text style={styles.label} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 92,
    height: 92,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 6,
  },
  label: {
    marginTop: 8,
    fontSize: 11,
    textAlign: "center",
    color: COLORS.text,
    fontWeight: "600",
  },
});
