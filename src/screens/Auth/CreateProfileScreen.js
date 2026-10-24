import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";
import CustomInput from "../../components/CustomInput";
import CustomButton from "../../components/CustomButton";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { BLOOD_GROUPS } from "../../constants/data";
import { isValidName, isValidMobile, isValidEmail } from "../../utils/validators";

const GENDERS = ["Male", "Female", "Other"];

export default function CreateProfileScreen({ navigation }) {
  const { phoneNumber, email, authType, authIdentifier, saveProfile } = useAuth();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState(""); // DD/MM/YYYY
  const [bloodGroup, setBloodGroup] = useState("");
  const [showBloodModal, setShowBloodModal] = useState(false);
  const [mobileInput, setMobileInput] = useState(authType === "mobile" ? (phoneNumber || authIdentifier) : "");
  const [emailInput, setEmailInput] = useState(authType === "email" ? (email || authIdentifier) : "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!isValidName(fullName) || !gender || !dob || !bloodGroup) {
      setError(t.fillAllFields || "Please fill all required fields");
      return;
    }

    if (authMethodIsEmail && mobileInput && !isValidMobile(mobileInput)) {
      setError(t.invalidMobile || "Please enter a valid 10-digit mobile number");
      return;
    }

    if (!authMethodIsEmail && emailInput && !isValidEmail(emailInput)) {
      setError(t.invalidEmail || "Please enter a valid email address");
      return;
    }

    setError("");
    setLoading(true);

    const finalPhone = authMethodIsEmail ? mobileInput : (phoneNumber || authIdentifier || mobileInput);
    const finalEmail = authMethodIsEmail ? (email || authIdentifier || emailInput) : emailInput;

    await saveProfile({
      fullName,
      gender,
      dob,
      bloodGroup,
      mobileNumber: finalPhone,
      email: finalEmail,
    });

    setLoading(false);
  };

  const authMethodIsEmail = authType === "email" || String(authIdentifier).includes("@");

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>{t.createProfile || "Create Your Profile"}</Text>
          <Text style={styles.subtitle}>
            This helps our doctors provide personalized and accurate care for you and your family.
          </Text>
        </View>

        {/* Full Name */}
        <CustomInput
          label={`${t.fullName || "Full Name"} *`}
          value={fullName}
          onChangeText={(txt) => {
            setFullName(txt);
            if (error) setError("");
          }}
          placeholder="e.g. Priya Sharma"
        />

        {/* Gender Selection */}
        <Text style={styles.label}>{`${t.gender || "Gender"} *`}</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderChip, gender === g && styles.genderChipSelected]}
              onPress={() => {
                setGender(g);
                if (error) setError("");
              }}
            >
              <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                {g === "Male" ? t.male || "Male" : g === "Female" ? t.female || "Female" : t.other || "Other"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date of Birth */}
        <CustomInput
          label={`${t.dob || "Date of Birth"} *`}
          value={dob}
          onChangeText={(txt) => {
            setDob(txt.replace(/[^0-9/]/g, ""));
            if (error) setError("");
          }}
          placeholder="DD/MM/YYYY"
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* Primary Verified Credential + Secondary Field */}
        {authMethodIsEmail ? (
          <>
            <View style={styles.verifiedRow}>
              <CustomInput
                label={`${t.emailAddress || "Email Address"} (Verified)`}
                icon="mail-outline"
                value={email || authIdentifier}
                editable={false}
              />
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <CustomInput
              label={t.mobileNumber || "Mobile Number (For SMS Alerts)"}
              value={mobileInput}
              onChangeText={setMobileInput}
              placeholder="10-digit mobile number"
              keyboardType="number-pad"
              maxLength={10}
              prefix="+91"
            />
          </>
        ) : (
          <>
            <View style={styles.verifiedRow}>
              <CustomInput
                label={`${t.mobileNumber || "Mobile Number"} (Verified)`}
                value={phoneNumber || authIdentifier}
                editable={false}
                prefix="+91"
              />
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#059669" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <CustomInput
              label={t.emailAddress || "Email Address (Optional)"}
              icon="mail-outline"
              value={emailInput}
              onChangeText={setEmailInput}
              placeholder="e.g. name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}

        {/* Blood Group */}
        <Text style={styles.label}>{`${t.bloodGroup || "Blood Group"} *`}</Text>
        <TouchableOpacity
          style={styles.selectBox}
          onPress={() => setShowBloodModal(true)}
        >
          <Text style={bloodGroup ? styles.selectValue : styles.selectPlaceholder}>
            {bloodGroup || t.selectBloodGroup || "Select Blood Group"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
        </TouchableOpacity>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <CustomButton
          title={t.saveAndContinue || "Save & Continue"}
          onPress={handleSubmit}
          loading={loading}
          style={{ marginTop: 24 }}
        />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Blood Group Bottom Modal */}
      <Modal visible={showBloodModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t.selectBloodGroup || "Select Blood Group"}</Text>
            <FlatList
              data={BLOOD_GROUPS}
              numColumns={4}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.bloodChip, bloodGroup === item && styles.bloodChipSelected]}
                  onPress={() => {
                    setBloodGroup(item);
                    setShowBloodModal(false);
                    if (error) setError("");
                  }}
                >
                  <Text
                    style={[
                      styles.bloodChipText,
                      bloodGroup === item && styles.bloodChipTextSelected,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <CustomButton
              title="Close"
              variant="outline"
              onPress={() => setShowBloodModal(false)}
            />
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
  backBtn: {
    marginLeft: 20,
    marginTop: 14,
    padding: 4,
    alignSelf: "flex-start",
  },
  scrollContent: {
    padding: 22,
    paddingTop: 10,
    paddingBottom: 60,
  },
  headerBlock: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: 5,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  genderRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  genderChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0FDFA",
  },
  genderText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
  },
  genderTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
  verifiedRow: {
    position: "relative",
  },
  verifiedBadge: {
    position: "absolute",
    right: 12,
    top: 36,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "700",
    marginLeft: 3,
  },
  selectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  selectPlaceholder: {
    fontSize: 15,
    color: COLORS.textLight,
  },
  selectValue: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "600",
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 10,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  bloodChip: {
    flex: 1,
    margin: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    backgroundColor: COLORS.card,
  },
  bloodChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0FDFA",
  },
  bloodChipText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  bloodChipTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
});
