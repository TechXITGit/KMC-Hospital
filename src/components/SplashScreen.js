import React from "react";
import { View, Text, StyleSheet, Image, ActivityIndicator } from "react-native";
import COLORS from "../constants/colors";
import { useLanguage } from "../context/LanguageContext";

export default function SplashScreen() {
  const { language } = useLanguage();

  return (
    <View style={styles.container}>
      <View style={styles.centerContent}>
        {/* Hospital Branding Logo */}
        <View style={styles.logoCircle}>
          <Image
            source={require("../../assets/kmc_logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.hospitalName}>KMC Hospital</Text>
        <Text style={styles.tagline}>Jankipuram, Lucknow</Text>

        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginBottom: 8 }} />
          <Text style={styles.loadingText}>
            {language === "hi"
              ? "सुरक्षित अस्पताल सेवाएं लोड हो रही हैं..."
              : "Initializing secure hospital services..."}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {language === "hi"
            ? "24x7 आपातकालीन सहायता: +91 8303666400"
            : "24x7 Emergency Helpline: +91 8303666400"}
        </Text>
        <Text style={styles.versionText}>KMC Health Portal · v1.0.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logo: {
    width: 68,
    height: 68,
  },
  hospitalName: {
    fontSize: 26,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: "center",
  },
  loadingBox: {
    marginTop: 36,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
  },
  versionText: {
    fontSize: 10,
    color: COLORS.textLight,
    marginTop: 4,
  },
});
