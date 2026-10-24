import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";
import CustomInput from "../../components/CustomInput";
import CustomButton from "../../components/CustomButton";
import LanguageToggle from "../../components/LanguageToggle";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { isValidEmail } from "../../utils/validators";

export default function LoginScreen({ navigation }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [forgotError, setForgotError] = useState("");

  const { signIn, signUp, signInWithGoogle, requestPasswordReset } = useAuth();
  const { t } = useLanguage();

  const handleEmailAuth = async () => {
    setError("");
    setSuccessMsg("");

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError(t.invalidEmail || "Please enter a valid email address");
      return;
    }

    if (!password || password.length < 6) {
      setError(t.passwordMinLength || "Password must be at least 6 characters long");
      return;
    }

    setLoading(true);

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError(t.enterFullNameError || "Please enter your full name");
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError(t.passwordMismatch || "Passwords do not match");
        setLoading(false);
        return;
      }

      // Public signup is strictly locked to patient role
      const res = await signUp({
        email: cleanEmail,
        password,
        fullName: fullName.trim(),
        phone: phone.trim(),
      });
      setLoading(false);

      if (!res.success) {
        setError(res.message || "Failed to create account. Please try again.");
      } else {
        setSuccessMsg(t.accountCreatedSuccess || res.message || "Account created successfully!");
      }
    } else {
      // Unified login for all roles (patient, doctor, admin)
      const res = await signIn(cleanEmail, password);
      setLoading(false);

      if (!res.success) {
        setError(
          res.message?.includes("Invalid login credentials")
            ? (t.invalidCredentialsError || "Invalid email or password. Please check your credentials.")
            : res.message || (t.signInFailedError || "Sign in failed. Please try again.")
        );
      }
      // On success, AuthContext state updates (isAuthenticated = true, userRole = verifiedRole).
      // AppNavigator reactively mounts the appropriate dashboard without unhandled navigation dispatch.
    }
  };

  const handleGoogleAuth = async () => {
    setError("");
    setSuccessMsg("");
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    setGoogleLoading(false);

    if (!res.success && res.message && !res.message.includes("cancelled")) {
      setError(res.message);
    }
  };

  const handleForgotPasswordSubmit = async () => {
    setForgotError("");
    setForgotMessage("");

    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setForgotError(t.invalidEmail || "Please enter a valid email address");
      return;
    }

    setForgotLoading(true);
    const res = await requestPasswordReset(cleanEmail);
    setForgotLoading(false);

    if (!res.success) {
      if (res.restricted) {
        if (res.reason === "doctor") {
          setForgotError(t.doctorResetRestricted || res.message);
        } else if (res.reason === "admin") {
          setForgotError(t.adminResetRestricted || res.message);
        } else {
          setForgotError(res.message);
        }
      } else {
        setForgotError(res.message || "Failed to send reset instructions.");
      }
    } else {
      setForgotMessage(t.resetLinkSent || "Password reset instructions have been sent to your email.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollWrap}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar: Hospital Helpline & Real Segmented Language Toggle */}
          <View style={styles.topBar}>
            <View style={styles.helplineMini}>
              <Ionicons name="call" size={13} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.helplineMiniText}>24x7: 8303666400</Text>
            </View>
            <LanguageToggle compact />
          </View>

          {/* Hospital Branding Header */}
          <View style={styles.logoWrap}>
            <View style={styles.logoContainer}>
              <Image
                source={require("../../../assets/kmc_logo.png")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>KMC Hospital</Text>
            <Text style={styles.tagline}>Jankipuram, Lucknow</Text>
            <View style={styles.badgeWrap}>
              <Ionicons name="shield-checkmark" size={13} color={COLORS.primary} />
              <Text style={styles.badgeText}>Powered by Tech X IT Services</Text>
            </View>
          </View>

          {/* Single Unified Form Card */}
          <View style={styles.formCard}>
            {/* Segmented Mode Switch: Sign In vs Sign Up */}
            <View style={styles.tabContainer}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.tabButton,
                  mode === "signin" && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setMode("signin");
                  setError("");
                  setSuccessMsg("");
                }}
              >
                <Ionicons
                  name="log-in-outline"
                  size={17}
                  color={mode === "signin" ? COLORS.white : COLORS.textLight}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    mode === "signin" && styles.tabButtonTextActive,
                  ]}
                >
                  {t.signIn || "Sign In"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.tabButton,
                  mode === "signup" && styles.tabButtonActive,
                ]}
                onPress={() => {
                  setMode("signup");
                  setError("");
                  setSuccessMsg("");
                }}
              >
                <Ionicons
                  name="person-add-outline"
                  size={17}
                  color={mode === "signup" ? COLORS.white : COLORS.textLight}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabButtonText,
                    mode === "signup" && styles.tabButtonTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t.signUp || "Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitle}>
              {mode === "signin"
                ? (t.signInTitle || "Sign In to Your Account")
                : (t.createAccount || "Create Patient Account")}
            </Text>
            <Text style={styles.cardSubtitle}>
              {mode === "signin"
                ? (t.signInSubtitle || "Enter your registered credentials to access consultations")
                : (t.createAccountSubtitle || "Register with KMC Hospital to book appointments & consult specialists")}
            </Text>

            {/* Sign Up Specific Field: Full Name */}
            {mode === "signup" && (
              <CustomInput
                label={`${t.fullName || "Full Name"} *`}
                value={fullName}
                onChangeText={(txt) => {
                  setFullName(txt);
                  if (error) setError("");
                }}
                placeholder={t.fullNamePlaceholder || "e.g. Ayushmaan Singh"}
                icon="person-outline"
              />
            )}

            {/* Email Field */}
            <CustomInput
              label={`${t.loginWithEmail || "Email Address"} *`}
              value={email}
              onChangeText={(txt) => {
                setEmail(txt);
                if (error) setError("");
              }}
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            {/* Password Field with Integrated Eye Toggle */}
            <CustomInput
              label={`${t.password || "Password"} *`}
              value={password}
              onChangeText={(txt) => {
                setPassword(txt);
                if (error) setError("");
              }}
              placeholder={t.passwordPlaceholder || "Minimum 6 characters"}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              icon="lock-closed-outline"
              rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            {/* Sign Up Specific Field: Confirm Password with Integrated Eye Toggle */}
            {mode === "signup" && (
              <CustomInput
                label={`${t.confirmPassword || "Confirm Password"} *`}
                value={confirmPassword}
                onChangeText={(txt) => {
                  setConfirmPassword(txt);
                  if (error) setError("");
                }}
                placeholder={t.confirmPassword || "Re-enter your password"}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                icon="shield-checkmark-outline"
                rightIcon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            )}

            {/* Sign Up Optional Field: Mobile Number */}
            {mode === "signup" && (
              <CustomInput
                label={`${t.mobileNumber || "Mobile Number"} (${t.optional || "Optional"})`}
                value={phone}
                onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ""))}
                placeholder={t.mobilePlaceholderOptional || "10-digit mobile (Optional)"}
                keyboardType="phone-pad"
                maxLength={10}
                icon="call-outline"
              />
            )}

            {/* Forgot Password Trigger (Only in Sign In Mode) */}
            {mode === "signin" && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => {
                  setForgotEmail(email);
                  setForgotError("");
                  setForgotMessage("");
                  setShowForgotModal(true);
                }}
              >
                <Text style={styles.forgotBtnText}>{t.forgotPassword || "Forgot Password?"}</Text>
              </TouchableOpacity>
            )}

            {/* Error Message Display */}
            {Boolean(error) && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#D9381E" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Success Message Display */}
            {Boolean(successMsg) && (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color="#0B7A75" />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            )}

            {/* Main Action Button */}
            <CustomButton
              title={
                mode === "signin"
                  ? (t.signIn || "Sign In")
                  : (t.createAccount || "Create Patient Account")
              }
              onPress={handleEmailAuth}
              loading={loading}
              style={{ marginTop: 14 }}
            />

            {/* Toggle Mode Footer Link */}
            <TouchableOpacity
              style={styles.switchModeRow}
              onPress={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
                setSuccessMsg("");
              }}
            >
              <Text style={styles.switchModePrompt}>
                {mode === "signin"
                  ? (t.dontHaveAccount || "Don't have an account? ")
                  : (t.alreadyHaveAccount || "Already have an account? ")}
              </Text>
              <Text style={styles.switchModeAction}>
                {mode === "signin"
                  ? (t.signUp || "Sign Up")
                  : (t.signIn || "Sign In")}
              </Text>
            </TouchableOpacity>

            {/* Google OAuth Option for Patients */}
            <View style={styles.dividerWrap}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.orContinueWith || "OR CONTINUE WITH"}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.googleBtn}
              activeOpacity={0.85}
              onPress={handleGoogleAuth}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={18} color="#EA4335" style={{ marginRight: 8 }} />
                  <Text style={styles.googleBtnText}>{t.continueWithGoogle || "Continue with Google"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!forgotLoading) setShowForgotModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="key-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.modalTitle}>{t.forgotPasswordTitle || "Reset Your Password"}</Text>
            <Text style={styles.modalSubtitle}>
              {t.forgotPasswordPrompt || "Enter your registered email address to receive password reset instructions."}
            </Text>

            <CustomInput
              label={t.loginWithEmail || "Email Address"}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              placeholder="patient@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            {Boolean(forgotError) && (
              <View style={[styles.errorBox, { width: "100%", marginVertical: 8 }]}>
                <Ionicons name="alert-circle" size={16} color="#D9381E" />
                <Text style={styles.errorText}>{forgotError}</Text>
              </View>
            )}

            {Boolean(forgotMessage) && (
              <View style={[styles.successBox, { width: "100%", marginVertical: 8 }]}>
                <Ionicons name="checkmark-circle" size={16} color="#0B7A75" />
                <Text style={styles.successText}>{forgotMessage}</Text>
              </View>
            )}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowForgotModal(false)}
                disabled={forgotLoading}
              >
                <Text style={styles.modalCancelText}>{t.cancel || "Cancel"}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleForgotPasswordSubmit}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>{t.sendResetLink || "Send Reset Link"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollWrap: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  helplineMini: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  helplineMiniText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
  },
  logoWrap: {
    alignItems: "center",
    marginVertical: 16,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 2,
    fontWeight: "500",
  },
  badgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    backgroundColor: "#EAF6F5",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C6E8E6",
  },
  badgeText: {
    fontSize: 11,
    color: COLORS.primaryDark,
    fontWeight: "700",
    marginLeft: 4,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textLight,
  },
  tabButtonTextActive: {
    color: COLORS.white,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 16,
    lineHeight: 18,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 12,
    paddingVertical: 4,
  },
  forgotBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF2F2",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#F8B4B4",
  },
  errorText: {
    color: "#D9381E",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    fontWeight: "500",
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF6F5",
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#B4E2DF",
  },
  successText: {
    color: "#0B7A75",
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    fontWeight: "600",
  },
  switchModeRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 4,
  },
  switchModePrompt: {
    fontSize: 13,
    color: COLORS.textLight,
  },
  switchModeAction: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
  },
  dividerWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  
  
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
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
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    marginTop: 16,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalConfirmBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
  },
});
