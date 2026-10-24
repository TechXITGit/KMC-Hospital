import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import EmergencyCard from "../../components/EmergencyCard";
import { getLocalizedDepartments, getLocalizedDoctors } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";

export default function DepartmentListScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { doctors } = useAppointments();

  const localizedDoctors = getLocalizedDoctors(language);
  const allDocs = (doctors && doctors.length > 0 ? doctors : localizedDoctors).filter(
    (d) => d.active !== false
  );
  const departmentsData = getLocalizedDepartments(language).filter(
    (d) =>
      d.id !== "d7" &&
      !(d.name || "").toLowerCase().includes("emergency") &&
      !(d.name || "").includes("आपातकालीन")
  );

  const deptKeywordsMap = {
    d1: ["gynec", "obs", "स्त्री", "प्रसूति", "महिला"],
    d2: ["nicu", "neonat", "नवजात", "शिशु"],
    d3: ["pediatric", "picu", "बाल", "शिशु"],
    d4: ["pediatric surg", "शल्य", "सर्जरी", "surgery"],
    d5: ["general surg", "laparoscop", "सामान्य", "सर्जरी"],
    d6: ["ortho", "हड्डी", "जोड़"],
    d8: ["pharmacy", "diagnostic", "फार्मेसी", "जांच"],
  };

  const renderItem = ({ item }) => {
    const keywords = deptKeywordsMap[item.id] || [];
    const doctorCount = allDocs.filter((d) => {
      const docDept = (d.department || "").toLowerCase();
      return (
        keywords.some((kw) => docDept.includes(kw.toLowerCase())) ||
        docDept.includes((item.name || "").toLowerCase())
      );
    }).length;

    const specialistLabel =
      language === "hi"
        ? `${doctorCount} विशेषज्ञ उपलब्ध`
        : `${doctorCount} specialist${doctorCount !== 1 ? "s" : ""}`;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => navigation.navigate("DepartmentDetail", { department: item })}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={item.icon} size={22} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {doctorCount > 0 ? specialistLabel : (language === "hi" ? "विशेषज्ञ उपलब्ध" : "Available")}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() =>
            navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")
          }
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.departments}</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={departmentsData}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={true}
        ListHeaderComponent={
          <EmergencyCard
            title={language === "hi" ? "आपातकालीन एवं ट्रॉमा सेवा" : "Emergency & Trauma Service"}
            subtitle={
              language === "hi"
                ? "24x7 गहन चिकित्सा एवं एम्बुलेंस हेल्पलाइन"
                : "24x7 Critical Care & Ambulance Helpline"
            }
            style={{ marginBottom: 16 }}
          />
        }
        renderItem={renderItem}
      />
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
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
});
