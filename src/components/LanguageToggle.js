import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { useLanguage } from "../context/LanguageContext";

export default function LanguageToggle({ style, compact = false }) {
  const { language, setLanguage } = useLanguage();

  return (
    <View style={[styles.container, compact && styles.containerCompact, style]}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.segmentBtn,
          language === "en" && styles.segmentBtnActive,
          compact && styles.segmentBtnCompact,
        ]}
        onPress={() => setLanguage("en")}
      >
        <Ionicons
          name="language"
          size={compact ? 12 : 14}
          color={language === "en" ? COLORS.white : COLORS.textLight}
          style={{ marginRight: 4 }}
        />
        <Text
          style={[
            styles.segmentText,
            language === "en" && styles.segmentTextActive,
            compact && styles.segmentTextCompact,
          ]}
        >
          English
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.85}
        style={[
          styles.segmentBtn,
          language === "hi" && styles.segmentBtnActive,
          compact && styles.segmentBtnCompact,
        ]}
        onPress={() => setLanguage("hi")}
      >
        <Ionicons
          name="globe-outline"
          size={compact ? 12 : 14}
          color={language === "hi" ? COLORS.white : COLORS.textLight}
          style={{ marginRight: 4 }}
        />
        <Text
          style={[
            styles.segmentText,
            language === "hi" && styles.segmentTextActive,
            compact && styles.segmentTextCompact,
          ]}
        >
          हिन्दी
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "center",
  },
  containerCompact: {
    padding: 2,
    borderRadius: 16,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  segmentBtnCompact: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  segmentBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  segmentTextCompact: {
    fontSize: 11,
  },
  segmentTextActive: {
    color: COLORS.white,
    fontWeight: "700",
  },
});
