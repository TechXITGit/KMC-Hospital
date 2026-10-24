import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomInput from "../../components/CustomInput";
import CustomButton from "../../components/CustomButton";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { BLOOD_GROUPS } from "../../constants/data";
import { isValidName } from "../../utils/validators";

const GENDERS = ["Male", "Female", "Other"];

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const { profile, updateProfile } = useAuth();
  const { t } = useLanguage();

  const [fullName, setFullName] = useState(
    profile?.fullName || profile?.full_name || profile?.name || ""
  );
  const [email] = useState(profile?.email || "");
  const [mobileNumber, setMobileNumber] = useState(
    profile?.mobileNumber || profile?.phone || ""
  );
  const [dob, setDob] = useState(profile?.dob || "");
  const [gender, setGender] = useState(profile?.gender || "Male");
  const [bloodGroup, setBloodGroup] = useState(
    profile?.bloodGroup || profile?.blood_group || ""
  );
  const [emergencyContact, setEmergencyContact] = useState(
    profile?.emergencyContact || profile?.emergency_contact || ""
  );
  const [showBloodModal, setShowBloodModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDobChange = (txt) => {
    const cleaned = txt.replace(/[^0-9]/g, "").slice(0, 8);
    if (cleaned.length <= 2) {
      setDob(cleaned);
    } else if (cleaned.length <= 4) {
      setDob(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setDob(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`);
    }
  };

  const handleSave = async () => {
    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length < 2) {
      setError("Please enter a valid full name (minimum 2 characters)");
      return;
    }

    const cleanMobile = mobileNumber.replace(/[^0-9]/g, "");
    if (cleanMobile && cleanMobile.length !== 10) {
      setError("Mobile number must be exactly 10 digits");
      return;
    }

    const cleanEmergency = emergencyContact.replace(/[^0-9]/g, "");
    if (cleanEmergency && cleanEmergency.length !== 10) {
      setError("Emergency contact must be exactly 10 digits");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await updateProfile({
        fullName: cleanName,
        mobileNumber: cleanMobile,
        dob: dob.trim(),
        gender,
        bloodGroup,
        emergencyContact: cleanEmergency,
      });

      if (res?.error) {
        setError(res.error);
      } else {
        Alert.alert("Success", t.profileUpdated || "Profile updated successfully!", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err) {
      console.warn("[EditProfile] Save error:", err?.message || err);
      setError(err?.message || "Failed to update profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.editProfile || "Edit Profile"}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CustomInput
          label={t.fullName || "Full Name"}
          value={fullName}
          onChangeText={(txt) => {
            setFullName(txt);
            if (error) setError("");
          }}
          placeholder="e.g. Rahul Sharma"
          icon="person-outline"
        />

        <CustomInput
          label={`${t.emailAddress || "Email Address"} (${t.registeredEmail || "Registered Login ID"})`}
          value={email}
          placeholder="e.g. rahul@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          editable={false}
          icon="mail-outline"
        />

        <CustomInput
          label={t.mobileNumber || "Mobile Number"}
          value={mobileNumber}
          onChangeText={(txt) => {
            setMobileNumber(txt.replace(/[^0-9]/g, "").slice(0, 10));
            if (error) setError("");
          }}
          placeholder="10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          editable={true}
          prefix="+91"
          icon="call-outline"
        />

        <CustomInput
          label={`${t.dob || "Date of Birth"} (DD/MM/YYYY)`}
          value={dob}
          onChangeText={handleDobChange}
          placeholder="DD/MM/YYYY"
          keyboardType="number-pad"
          maxLength={10}
          icon="calendar-outline"
        />

        {/* Gender Selection */}
        <Text style={styles.label}>{t.gender || "Gender"}</Text>
        <View style={styles.genderRow}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genderChip, gender === g && styles.genderChipSelected]}
              onPress={() => setGender(g)}
            >
              <Text style={[styles.genderText, gender === g && styles.genderTextSelected]}>
                {g === "Male" ? (t.male || "Male") : g === "Female" ? (t.female || "Female") : (t.other || "Other")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Blood Group */}
        <Text style={styles.label}>{t.bloodGroup || "Blood Group"}</Text>
        <TouchableOpacity style={styles.selectBox} onPress={() => setShowBloodModal(true)}>
          <Text style={bloodGroup ? styles.selectValue : styles.selectPlaceholder}>
            {bloodGroup || t.selectBloodGroup || "Select Blood Group"}
          </Text>
          <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
        </TouchableOpacity>

        <CustomInput
          label={t.emergencyContact || "Emergency Contact Number"}
          value={emergencyContact}
          onChangeText={(txt) => {
            setEmergencyContact(txt.replace(/[^0-9]/g, "").slice(0, 10));
            if (error) setError("");
          }}
          placeholder="10-digit emergency number"
          keyboardType="phone-pad"
          maxLength={10}
          prefix="+91"
          icon="alert-circle-outline"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <CustomButton
          title={t.updateProfile || "Update Profile"}
          onPress={handleSave}
          loading={loading}
          style={{ marginTop: 20 }}
        />
      </ScrollView>

      {/* Blood Group Modal */}
      <Modal visible={showBloodModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t.selectBloodGroup}</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 8 },
  genderRow: { flexDirection: "row", marginBottom: 16 },
  genderChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
    backgroundColor: COLORS.card,
  },
  genderChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderText: { fontSize: 13, color: COLORS.text, fontWeight: "600" },
  genderTextSelected: { color: COLORS.white },
  selectBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 16,
  },
  selectValue: { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  selectPlaceholder: { color: COLORS.textLight, fontSize: 14 },
  errorText: { color: COLORS.danger, fontSize: 12, marginBottom: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  bloodChip: {
    flex: 1,
    margin: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  bloodChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  bloodChipText: { fontWeight: "700", color: COLORS.text },
  bloodChipTextSelected: { color: COLORS.white },
});
