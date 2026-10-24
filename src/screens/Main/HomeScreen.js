import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Header from "../../components/Header";
import SearchBar from "../../components/SearchBar";
import QuickServiceCard from "../../components/QuickServiceCard";
import DepartmentCard from "../../components/DepartmentCard";
import DoctorCard from "../../components/DoctorCard";
import HealthTipCard from "../../components/HealthTipCard";
import EmergencyCard from "../../components/EmergencyCard";
import AppointmentCard from "../../components/AppointmentCard";
import CustomButton from "../../components/CustomButton";
import COLORS from "../../constants/colors";
import {
  getLocalizedQuickServices,
  getLocalizedDepartments,
  getLocalizedDoctors,
  getLocalizedHealthTips,
  DEPARTMENTS,
  DOCTORS,
  QUICK_SERVICES,
} from "../../constants/data";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";

export default function HomeScreen() {
  const navigation = useNavigation();
  const { profile, isAdmin, isDoctor } = useAuth();
  const { t, language } = useLanguage();
  const { appointments, doctors, loadDoctors, loadAppointments } = useAppointments();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadDoctors(), loadAppointments()]);
    } catch (e) {}
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadDoctors();
    }, [])
  );

  const upcomingAppointments = appointments.filter((a) => a.status === "Confirmed");

  // Dynamic doctor list
  const liveDoctorList = doctors && doctors.length > 0 ? doctors : DOCTORS;
  const activeDoctorList = liveDoctorList.filter((d) => d.active !== false);

  // Localized dynamic datasets
  const localizedServices = useMemo(() => getLocalizedQuickServices(language), [language]);
  const localizedDepartments = useMemo(() => getLocalizedDepartments(language), [language]);
  const localizedDoctors = useMemo(
    () => getLocalizedDoctors(activeDoctorList, language),
    [activeDoctorList, language]
  );
  const localizedHealthTips = useMemo(() => getLocalizedHealthTips(language), [language]);

  const query = search.trim().toLowerCase();
  const searchResults = query
    ? {
        doctors: localizedDoctors.filter(
          (d) =>
            (d.name || "").toLowerCase().includes(query) ||
            (d.specialty || "").toLowerCase().includes(query) ||
            (d.department || "").toLowerCase().includes(query)
        ),
        departments: localizedDepartments.filter((dept) =>
          dept.name.toLowerCase().includes(query)
        ),
        services: localizedServices.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.shortDesc.toLowerCase().includes(query)
        ),
      }
    : null;

  const hasSearchResults =
    searchResults &&
    (searchResults.doctors.length > 0 ||
      searchResults.departments.length > 0 ||
      searchResults.services.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Header greeting={t?.welcomeBack || "Welcome back,"} name={profile?.fullName || profile?.full_name || profile?.name} />

        {/* Hospital Admin Access Banner */}
        {isAdmin && (
          <TouchableOpacity
            style={styles.adminBanner}
            onPress={() => navigation.navigate("AdminDashboard")}
            activeOpacity={0.85}
          >
            <View style={styles.adminBannerIcon}>
              <Ionicons name="shield-checkmark" size={22} color={COLORS.white} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.adminBannerTitle}>
                {t.hospitalAdminPortal || "Hospital Administration Portal"}
              </Text>
              <Text style={styles.adminBannerSub}>
                {t.hospitalAdminPortalSub || "Manage Doctors, Create Profiles, Availability & Appointments"}
              </Text>
            </View>
            <Ionicons name="chevron-forward-circle" size={22} color="#DC2626" />
          </TouchableOpacity>
        )}

        {/* Doctor Portal Access Banner */}
        {isDoctor && !isAdmin && (
          <TouchableOpacity
            style={[styles.adminBanner, { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" }]}
            onPress={() => navigation.navigate("DoctorDashboard")}
            activeOpacity={0.85}
          >
            <View style={[styles.adminBannerIcon, { backgroundColor: "#0284C7" }]}>
              <Ionicons name="medkit" size={22} color={COLORS.white} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.adminBannerTitle, { color: "#0369A1" }]}>
                {t.doctorConsultPortal || "Doctor Consultation Portal"}
              </Text>
              <Text style={[styles.adminBannerSub, { color: "#0284C7" }]}>
                {t.doctorConsultPortalSub || "View Assigned Appointments & Teleconsultations"}
              </Text>
            </View>
            <Ionicons name="chevron-forward-circle" size={22} color="#0284C7" />
          </TouchableOpacity>
        )}

        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder={t.searchPlaceholder}
          onPress={() => navigation.navigate("SearchScreen")}
          onFilterPress={() => navigation.navigate("SearchScreen")}
        />

        {/* Live Search Overlay if user has typed in SearchBar */}
        {query ? (
          <View style={styles.searchResultsContainer}>
            <View style={styles.searchHeaderRow}>
              <Text style={styles.searchResultTitle}>
                {t.searchResultsFor || "Search results for"} "{search}"
              </Text>
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={styles.clearSearchText}>{t.clear || "Clear"}</Text>
              </TouchableOpacity>
            </View>

            {!hasSearchResults ? (
              <View style={styles.noResultsBox}>
                <Ionicons name="search-outline" size={36} color={COLORS.textLight} />
                <Text style={styles.noResultsText}>
                  {t.noSearchResults || "No doctors, departments, or services found."}
                </Text>
              </View>
            ) : (
              <>
                {searchResults.doctors.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.categoryTitle}>
                      {t.doctorsCountLabel || "Doctors"} ({searchResults.doctors.length})
                    </Text>
                    {searchResults.doctors.map((doc) => (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.searchResultRow}
                        onPress={() => navigation.navigate("DoctorProfile", { doctor: doc })}
                      >
                        <Ionicons name="person-circle" size={32} color={COLORS.primary} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={styles.resultItemTitle}>{doc.name}</Text>
                          <Text style={styles.resultItemSub}>{doc.specialty}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchResults.departments.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.categoryTitle}>
                      {t.departmentsCountLabel || "Departments"} ({searchResults.departments.length})
                    </Text>
                    {searchResults.departments.map((dept) => (
                      <TouchableOpacity
                        key={dept.id}
                        style={styles.searchResultRow}
                        onPress={() =>
                          navigation.navigate("DepartmentDetail", { department: dept })
                        }
                      >
                        <Ionicons name={dept.icon || "medical"} size={24} color={COLORS.primary} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={styles.resultItemTitle}>{dept.name}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {searchResults.services.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.categoryTitle}>
                      {t.quickServices || "Services"} ({searchResults.services.length})
                    </Text>
                    {searchResults.services.map((srv) => (
                      <TouchableOpacity
                        key={srv.id}
                        style={styles.searchResultRow}
                        onPress={() =>
                          navigation.navigate("ServiceDetail", { service: srv })
                        }
                      >
                        <Ionicons name={srv.icon || "medkit"} size={24} color={COLORS.primary} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                          <Text style={styles.resultItemTitle}>{srv.title}</Text>
                          <Text style={styles.resultItemSub}>{srv.shortDesc}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ) : (
          /* Main Dashboard Content */
          <>
            {/* Book Appointment banner */}
            <TouchableOpacity
              style={styles.bookBanner}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("BookAppointment")}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.bookBannerTitle}>{t.bookAppointment}</Text>
                <Text style={styles.bookBannerSubtitle}>
                  {t.consultSpecialistsSub || "Consult our specialists at your convenience"}
                </Text>
              </View>
              <CustomButton
                title={t.bookNow}
                onPress={() => navigation.navigate("BookAppointment")}
                style={styles.bookNowBtn}
              />
            </TouchableOpacity>

            {/* Quick Services */}
            <SectionHeader title={t.quickServices} />
            <FlatList
              data={localizedServices}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <QuickServiceCard
                  title={item.title}
                  icon={item.icon}
                  onPress={() => navigation.navigate("ServiceDetail", { service: item })}
                />
              )}
            />

            {/* Real Upcoming Appointments */}
            {upcomingAppointments.length > 0 && (
              <>
                <SectionHeader
                  title={t.upcomingAppointment}
                  actionLabel={t.viewAll}
                  onActionPress={() => navigation.navigate("MainTabs", { screen: "Appointment" })}
                />
                <FlatList
                  data={upcomingAppointments}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={styles.horizontalList}
                  renderItem={({ item }) => (
                    <AppointmentCard
                      appointment={item}
                      onPress={() =>
                        navigation.navigate("AppointmentDetail", { appointment: item })
                      }
                    />
                  )}
                />
              </>
            )}

            {/* Departments */}
            <SectionHeader
              title={t.departments}
              actionLabel={t.viewAll}
              onActionPress={() => navigation.navigate("DepartmentList")}
            />
            <View style={styles.departmentGrid}>
              {localizedDepartments.slice(0, 6).map((dept) => (
                <DepartmentCard
                  key={dept.id}
                  name={dept.name}
                  icon={dept.icon}
                  onPress={() =>
                    navigation.navigate("DepartmentDetail", { department: dept })
                  }
                />
              ))}
            </View>

            {/* Top Doctors */}
            <SectionHeader title={t.topDoctors} />
            <FlatList
              data={localizedDoctors}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <DoctorCard
                  doctor={item}
                  onPress={() => navigation.navigate("DoctorProfile", { doctor: item })}
                />
              )}
            />

            {/* Health Tips */}
            <SectionHeader title={t.healthTips} />
            <View style={{ paddingHorizontal: 20 }}>
              {localizedHealthTips.map((tip) => (
                <HealthTipCard
                  key={tip.id}
                  title={tip.title}
                  summary={tip.summary}
                  onPress={() => navigation.navigate("HealthTipDetail", { tip })}
                />
              ))}
            </View>

            {/* Emergency Helpline */}
            <View style={{ marginTop: 6 }}>
              <EmergencyCard />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ title, actionLabel, onActionPress }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel ? (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={styles.sectionAction}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: {
    paddingBottom: 40,
  },
  bookBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 18,
  },
  bookBannerTitle: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  bookBannerSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    marginTop: 4,
    maxWidth: 170,
  },
  bookNowBtn: { height: 40, paddingHorizontal: 16, backgroundColor: COLORS.secondary },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  sectionAction: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  horizontalList: { paddingHorizontal: 20 },
  departmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  searchResultsContainer: { paddingHorizontal: 20, marginTop: 10, paddingBottom: 40 },
  searchHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  searchResultTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  clearSearchText: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  noResultsBox: { alignItems: "center", paddingVertical: 30 },
  noResultsText: { fontSize: 13, color: COLORS.textLight, marginTop: 10 },
  categoryTitle: { fontSize: 12, fontWeight: "700", color: COLORS.textLight, marginBottom: 8 },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultItemTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  resultItemSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    borderRadius: 14,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 12,
  },
  adminBannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  adminBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#991B1B",
  },
  adminBannerSub: {
    fontSize: 11,
    color: "#B91C1C",
    marginTop: 2,
  },
});
