import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { useLanguage } from "../../context/LanguageContext";

const OPTIONS = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

export default function LanguageSelectScreen({ navigation }) {
  const [selected, setSelected] = useState("en");
  const { setLanguage } = useLanguage();

  const handleContinue = async () => {
    await setLanguage(selected);
    navigation.navigate("CreateProfile");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Select your language</Text>
        <Text style={styles.subtitle}>अपनी भाषा चुनें</Text>

        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.code}
            style={[styles.option, selected === opt.code && styles.optionSelected]}
            onPress={() => setSelected(opt.code)}
          >
            <View>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionNative}>{opt.native}</Text>
            </View>
            <Ionicons
              name={selected === opt.code ? "radio-button-on" : "radio-button-off"}
              size={22}
              color={selected === opt.code ? COLORS.primary : COLORS.textLight}
            />
          </TouchableOpacity>
        ))}

        <CustomButton title="Continue" onPress={handleContinue} style={{ marginTop: 30 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  backBtn: { marginLeft: 20, marginTop: 12, padding: 4, alignSelf: "flex-start" },
  content: { paddingHorizontal: 24, marginTop: 30 },
  title: { fontSize: 22, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  subtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 36,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 16,
  },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: "#EAF6F5" },
  optionLabel: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  optionNative: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
});
