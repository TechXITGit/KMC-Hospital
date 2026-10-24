import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../constants/colors";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

const formatFirstName = (rawName, isHindi = false) => {
  const guestDefault = isHindi ? "अतिथि" : "Guest";
  const userDefault = isHindi ? "उपयोगकर्ता" : "User";
  if (!rawName) return guestDefault;
  const str = String(rawName).trim();
  if (!str) return guestDefault;

  // If it's an email address
  if (str.includes("@")) {
    const handle = str.split("@")[0];
    return handle.charAt(0).toUpperCase() + handle.slice(1);
  }

  // If starts with doctor / professor prefix
  const docMatch = str.match(/^(Dr\.|Dr|Prof\.\s*\(Dr\.\)|Prof\.|Prof|डॉ\.|डॉ)\s+([A-Za-z0-9\u0900-\u097F]+)/i);
  if (docMatch) {
    return isHindi ? `डॉ. ${docMatch[2]}` : `Dr. ${docMatch[2]}`;
  }

  // Normal full name: return first word
  const parts = str.split(/\s+/);
  return parts[0] || userDefault;
};

export default function Header({ greeting, name }) {
  const navigation = useNavigation();
  const { language, setLanguage } = useLanguage();
  const { isAdmin, isDoctor } = useAuth();
  const firstName = formatFirstName(name, language === "hi");

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/kmc_logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View style={styles.greetingWrap}>
          <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {firstName}
          </Text>
        </View>
      </View>

      <View style={styles.right}>
        {/* Admin Portal Quick Switch */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminHeaderPill}
            onPress={() => navigation.navigate("AdminDashboard")}
            activeOpacity={0.8}
          >
            <Ionicons name="shield-checkmark" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.adminHeaderPillText}>
              {language === "hi" ? "प्रशासन" : "Admin"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Doctor Portal Quick Switch */}
        {isDoctor && !isAdmin && (
          <TouchableOpacity
            style={[styles.adminHeaderPill, { backgroundColor: "#0284C7" }]}
            onPress={() => navigation.navigate("DoctorDashboard")}
            activeOpacity={0.8}
          >
            <Ionicons name="medkit" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.adminHeaderPillText}>
              {language === "hi" ? "डॉक्टर" : "Doctor"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Quick Language Toggle */}
        <TouchableOpacity
          style={styles.langBadge}
          onPress={() => setLanguage(language === "hi" ? "en" : "hi")}
          activeOpacity={0.8}
        >
          <Ionicons name="language-outline" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
          <Text style={styles.langText}>{language === "hi" ? "हिन्दी" : "English"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Ionicons name="notifications-outline" size={22} color={COLORS.text} />
          <View style={styles.dot} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.navigate("Profile")}
        >
          <Ionicons name="person-circle-outline" size={26} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    flexShrink: 0,
  },
  logoImage: {
    width: 40,
    height: 40,
  },
  greetingWrap: {
    marginLeft: 10,
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  greeting: { fontSize: 12, color: COLORS.textLight, fontWeight: "500" },
  name: { fontSize: 16, fontWeight: "700", color: COLORS.text, flexShrink: 1 },
  right: { flexDirection: "row", alignItems: "center", flexShrink: 0 },
  iconBtn: { marginLeft: 14 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    position: "absolute",
    top: -1,
    right: -1,
  },
  langBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    borderWidth: 1,
    borderColor: "#CCFBF1",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  langText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  adminHeaderPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  adminHeaderPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
