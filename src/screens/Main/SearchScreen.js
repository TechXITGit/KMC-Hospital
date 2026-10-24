import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";
import {
  getLocalizedDepartments,
  getLocalizedQuickServices,
  getLocalizedDoctors,
  DOCTORS,
} from "../../constants/data";

export default function SearchScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, language } = useLanguage();
  const { doctors, loadDoctors } = useAppointments();

  useFocusEffect(
    useCallback(() => {
      if (typeof loadDoctors === "function") {
        loadDoctors();
      }
    }, [])
  );

  const [searchText, setSearchText] = useState(route.params?.initialQuery || "");

  // Correct Android hardware back button handling:
  // Back navigation works IMMEDIATELY regardless of whether searchText has content!
  useEffect(() => {
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => backHandler.remove();
  }, [navigation]);

  const rawDoctors = doctors && doctors.length > 0 ? doctors : DOCTORS;
  const localizedDoctors = getLocalizedDoctors(rawDoctors, language).filter(
    (d) => d.active !== false
  );
  const localizedDepartments = getLocalizedDepartments(language);
  const localizedServices = getLocalizedQuickServices(language);

  const query = searchText.trim().toLowerCase();

  const searchResults = query
    ? {
        doctors: localizedDoctors.filter(
          (d) =>
            (d.name || "").toLowerCase().includes(query) ||
            (d.specialty || d.specialization || "").toLowerCase().includes(query) ||
            (d.department || "").toLowerCase().includes(query) ||
            (d.qualification || "").toLowerCase().includes(query)
        ),
        departments: localizedDepartments.filter(
          (dept) =>
            dept.name.toLowerCase().includes(query) ||
            (dept.overview && dept.overview.toLowerCase().includes(query))
        ),
        services: localizedServices.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.shortDesc.toLowerCase().includes(query)
        ),
      }
    : null;

  const hasResults =
    searchResults &&
    (searchResults.doctors.length > 0 ||
      searchResults.departments.length > 0 ||
      searchResults.services.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Search Header Bar with Responsive Back Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={t.searchPlaceholder || "Search doctors, departments, services..."}
            placeholderTextColor={COLORS.textLight}
            autoFocus={true}
            returnKeyType="search"
          />
          {Boolean(searchText) && (
            <TouchableOpacity onPress={() => setSearchText("")} style={styles.clearBtn}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {!query ? (
          <View style={styles.idleState}>
            <Ionicons name="search-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.idleTitle}>
              {t.searchPlaceholder || "Search doctors, departments, services..."}
            </Text>
            <Text style={styles.idleSub}>
              {language === "hi"
                ? "डॉक्टर का नाम, चिकित्सा विभाग या अस्पताल सेवा खोजें"
                : "Type doctor name, medical department, or hospital service"}
            </Text>
          </View>
        ) : !hasResults ? (
          <View style={styles.idleState}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.idleTitle}>
              {t.noSearchResults || "No doctors, departments, or services found."}
            </Text>
            <Text style={styles.idleSub}>
              {language === "hi"
                ? "कृपया शब्द सही से लिखें या दूसरा शब्द खोजें।"
                : "Please check your spelling or try searching for another term."}
            </Text>
          </View>
        ) : (
          <View style={styles.resultsArea}>
            <Text style={styles.resultsHeader}>
              {t.searchResultsFor || "Search results for"} "{searchText}"
            </Text>

            {/* Doctors Results */}
            {searchResults.doctors.length > 0 && (
              <View style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>
                  {t.topDoctors || "Doctors"} ({searchResults.doctors.length})
                </Text>
                {searchResults.doctors.map((doc) => {
                  const isDocOnline = Boolean(doc.isOnline || doc.is_online);
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={styles.resultItem}
                      activeOpacity={0.8}
                      onPress={() => navigation.navigate("DoctorProfile", { doctor: doc })}
                    >
                      <View style={styles.docIconBox}>
                        <Ionicons name="person" size={18} color={COLORS.primary} />
                        <View style={[styles.searchOnlineDot, isDocOnline ? styles.searchDotOnline : styles.searchDotOffline]} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                          <Text style={styles.resultItemTitle}>{doc.name}</Text>
                          <View style={[styles.searchStatusPill, isDocOnline ? styles.searchPillOnline : styles.searchPillOffline]}>
                            <Text style={[styles.searchStatusText, isDocOnline ? styles.searchTextOnline : styles.searchTextOffline]}>
                              {isDocOnline
                                ? language === "hi"
                                  ? "ऑनलाइन"
                                  : "Online"
                                : language === "hi"
                                ? "ऑफलाइन"
                                : "Offline"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.resultItemSub}>
                          {doc.specialty || doc.specialization} · {doc.department}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Departments Results */}
            {searchResults.departments.length > 0 && (
              <View style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>
                  {t.departments || "Departments"} ({searchResults.departments.length})
                </Text>
                {searchResults.departments.map((dept) => (
                  <TouchableOpacity
                    key={dept.id}
                    style={styles.resultItem}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate("DepartmentDetail", { department: dept })}
                  >
                    <View style={[styles.docIconBox, { backgroundColor: "#EFF6FF" }]}>
                      <Ionicons name={dept.icon || "medical"} size={18} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.resultItemTitle}>{dept.name}</Text>
                      <Text style={styles.resultItemSub}>
                        {language === "hi"
                          ? `${dept.doctorCount || "विशेषज्ञ"} डॉक्टर उपलब्ध`
                          : `${dept.doctorCount || "Specialist"} Doctors Available`}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Services Results */}
            {searchResults.services.length > 0 && (
              <View style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>
                  {t.quickServices || "Services"} ({searchResults.services.length})
                </Text>
                {searchResults.services.map((srv) => (
                  <TouchableOpacity
                    key={srv.id}
                    style={styles.resultItem}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate("ServiceDetail", { service: srv })}
                  >
                    <View style={[styles.docIconBox, { backgroundColor: "#FEF3C7" }]}>
                      <Ionicons name={srv.icon || "heart"} size={18} color="#D97706" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.resultItemTitle}>{srv.title}</Text>
                      <Text style={styles.resultItemSub}>{srv.shortDesc}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
    borderRadius: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  content: {
    padding: 18,
    paddingBottom: 50,
  },
  idleState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    paddingHorizontal: 24,
  },
  idleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 14,
    textAlign: "center",
  },
  idleSub: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  resultsArea: {
    width: "100%",
  },
  resultsHeader: {
    fontSize: 13,
    color: COLORS.textLight,
    marginBottom: 14,
    fontWeight: "600",
  },
  categoryBlock: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  docIconBox: {
    position: "relative",
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
  },
  searchOnlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  searchDotOnline: {
    backgroundColor: "#16A34A",
  },
  searchDotOffline: {
    backgroundColor: "#94A3B8",
  },
  resultItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  searchStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    marginLeft: 6,
  },
  searchPillOnline: {
    backgroundColor: "#DCFCE7",
  },
  searchPillOffline: {
    backgroundColor: "#F1F5F9",
  },
  searchStatusText: {
    fontSize: 9.5,
    fontWeight: "700",
  },
  searchTextOnline: {
    color: "#166534",
  },
  searchTextOffline: {
    color: "#64748B",
  },
  resultItemSub: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
});
