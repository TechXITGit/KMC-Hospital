import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

const OTP_LENGTH = 6;

export default function OTPScreen({ navigation, route }) {
  const [otp, setOtp] = useState(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(30);
  const inputs = useRef([]);
  const { phoneNumber, email, authType, authIdentifier, verifyOtp, sendOtp } = useAuth();
  const { t } = useLanguage();

  const currentType = route.params?.authType || authType || (phoneNumber ? "mobile" : "email");
  const currentIdentifier = route.params?.identifier || authIdentifier || (currentType === "email" ? email : phoneNumber);
  const infoMsg = route.params?.infoMsg;

  useEffect(() => {
    if (timer <= 0) return;
    const id = setTimeout(() => setTimer((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timer]);

  const handleChange = (text, index) => {
    const cleaned = text.replace(/[^0-9]/g, "");
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);
    if (cleaned && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length < OTP_LENGTH) {
      setError(t.invalidOtp || "Please enter the complete 6-digit OTP");
      return;
    }
    setError("");
    setLoading(true);
    const result = await verifyOtp(code);
    setLoading(false);

    if (result.success) {
      if (result.isNewUser) {
        navigation.navigate("SelectLanguage");
      }
      // If returning user with profile, AuthContext triggers MainTabs automatically
    } else {
      setError(result.message || "Invalid OTP code, please try again");
    }
  };

  const handleResend = async () => {
    setTimer(30);
    setError("");
    await sendOtp(currentIdentifier, currentType);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        style={{ flex: 1 }}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>
            {currentType === "email" ? "Verify Email" : "Verify OTP"}
          </Text>

          <Text style={styles.subtitle}>
            {t.otpSentTo || "Enter the 6-digit verification code sent to"}{" "}
            <Text style={{ fontWeight: "700", color: COLORS.primaryDark }}>
              {currentType === "email"
                ? currentIdentifier
                : `+91 ${currentIdentifier}`}
            </Text>
          </Text>

          {infoMsg ? (
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle" size={18} color={COLORS.primary} />
              <Text style={styles.infoBannerText}>{infoMsg}</Text>
            </View>
          ) : (
            <View style={styles.devBanner}>
              <Ionicons name="flash" size={15} color="#D97706" />
              <Text style={styles.devBannerText}>
                Dev Test Code: Enter <Text style={{ fontWeight: "700" }}>123456</Text> to verify instantly
              </Text>
            </View>
          )}

          <View style={styles.otpRow}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputs.current[index] = ref)}
                style={[styles.otpBox, digit && styles.otpBoxFilled]}
                value={digit}
                onChangeText={(text) => handleChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                autoFocus={index === 0}
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <CustomButton
            title={t.verifyOtp || "Verify & Continue"}
            onPress={handleVerify}
            loading={loading}
            style={{ marginTop: 16 }}
          />

          <TouchableOpacity
            style={styles.resendWrap}
            disabled={timer > 0}
            onPress={handleResend}
          >
            <Text style={[styles.resendText, timer > 0 && { color: COLORS.textLight }]}>
              {timer > 0
                ? `${t.resendOtp || "Resend Code"} in 00:${timer < 10 ? "0" + timer : timer}`
                : t.resendOtp || "Resend Code"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeWrap}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="pencil-outline" size={14} color={COLORS.primary} style={{ marginRight: 4 }} />
            <Text style={styles.changeNumber}>
              {currentType === "email" ? "Change Email Address" : "Change Mobile Number"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backBtn: {
    marginLeft: 20,
    marginTop: 14,
    padding: 4,
    alignSelf: "flex-start",
  },
  content: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 20,
    lineHeight: 20,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDFA",
    borderRadius: 12,
    padding: 12,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#CCFBF1",
  },
  infoBannerText: {
    fontSize: 12,
    color: "#0F766E",
    marginLeft: 8,
    flex: 1,
    lineHeight: 17,
    fontWeight: "500",
  },
  devBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderRadius: 12,
    padding: 11,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  devBannerText: {
    fontSize: 12,
    color: "#92400E",
    marginLeft: 8,
    flex: 1,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  otpBoxFilled: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0FDFA",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    fontWeight: "500",
  },
  resendWrap: {
    alignItems: "center",
    marginTop: 22,
  },
  resendText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  changeWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  changeNumber: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: "600",
  },
});
