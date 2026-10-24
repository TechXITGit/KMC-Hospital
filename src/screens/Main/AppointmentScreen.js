import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { useLanguage } from "../../context/LanguageContext";
import { useAppointments } from "../../context/AppointmentContext";
import { formatAppointmentRef } from "../../utils/appointmentFormatter";
import { formatTimeTo12Hour, isMeetExpired, compareMeetsByDate } from "../../utils/dateFormatter";

export default function AppointmentScreen() {
  const navigation = useNavigation();
  const { t } = useLanguage();
  const { appointments } = useAppointments();
  const [tab, setTab] = useState("upcoming"); // "upcoming" | "past"

  // Track meets by date: filter and sort chronologically
  const upcomingList = appointments
    .filter((apt) => {
      const s = (apt.status || "").toLowerCase();
      const expired = s === "completed" || s === "cancelled" || isMeetExpired(apt.date || apt.appointment_date, apt.time || apt.appointment_time, s);
      return !expired;
    })
    .sort(compareMeetsByDate);

  const pastList = appointments
    .filter((apt) => {
      const s = (apt.status || "").toLowerCase();
      const expired = s === "completed" || s === "cancelled" || isMeetExpired(apt.date || apt.appointment_date, apt.time || apt.appointment_time, s);
      return expired;
    })
    .sort(compareMeetsByDate);

  const activeList = tab === "upcoming" ? upcomingList : pastList;

  const renderAppointmentItem = ({ item }) => {
    const s = (item.status || "").toLowerCase();
    const isCancelled = s === "cancelled";
    const isCompleted = s === "completed" || isMeetExpired(item.date || item.appointment_date, item.time || item.appointment_time, s);
    const statusTextDisplay = isCancelled
      ? t.cancelled
      : isCompleted
      ? "Expired Meet"
      : t.confirmed;

    const isVideo =
      item.type === "Video Consultation" || Boolean(item.video_consultation);

    const formattedTime = formatTimeTo12Hour(item.time);

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate("AppointmentDetail", { appointment: item })}
      >
        <View style={styles.cardTop}>
          <View style={styles.dateBadge}>
            <Text style={styles.dateDay}>{item.day || "15"}</Text>
            <Text style={styles.dateMonth}>{item.month || "Sep"}</Text>
          </View>

          <View style={styles.doctorInfoCol}>
            <Text style={styles.doctorName} numberOfLines={1} ellipsizeMode="tail">
              {item.doctorName}
            </Text>
            <Text style={styles.department} numberOfLines={1} ellipsizeMode="tail">
              {item.department}
            </Text>
            <View style={styles.timeRow}>
              <Ionicons name="time-outline" size={13} color={COLORS.textLight} />
              <Text style={styles.timeText} numberOfLines={1}>
                {item.date}, {formattedTime}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              isCancelled
                ? styles.badgeCancelled
                : isCompleted
                ? styles.badgeCompleted
                : styles.badgeConfirmed,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                isCancelled
                  ? styles.statusCancelled
                  : isCompleted
                  ? styles.statusCompleted
                  : styles.statusConfirmed,
              ]}
            >
              {statusTextDisplay}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBottom}>
          <View style={styles.refRowWrap}>
            <View
              style={[
                styles.refPill,
                {
                  backgroundColor: isVideo ? "#EFF6FF" : "#F0FDF4",
                  borderColor: isVideo ? "#BFDBFE" : "#BBF7D0",
                },
              ]}
            >
              <Text
                style={[
                  styles.refPillText,
                  { color: isVideo ? "#1D4ED8" : "#15803D" },
                ]}
              >
                {formatAppointmentRef(item.tokenNumber, item.type)}
              </Text>
            </View>

            {/* Human-friendly consultation type (NEVER displays technical WebRTC term) */}
            <View
              style={[
                styles.consultTypeBadge,
                isVideo ? styles.consultTypeVideo : styles.consultTypeOpd,
              ]}
            >
              <Ionicons
                name={isVideo ? "videocam-outline" : "business-outline"}
                size={12}
                color={isVideo ? "#0284C7" : COLORS.textLight}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.consultTypeText,
                  { color: isVideo ? "#0284C7" : COLORS.text },
                ]}
              >
                {isVideo
                  ? (t.videoConsultationBadge || "Video Consultation")
                  : (t.opdVisitBadge || "OPD Visit")}
              </Text>
            </View>
          </View>

          <View style={styles.viewDetailBtn}>
            <Text style={styles.viewDetailText}>{t.viewDetails || "View Details"}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Clean, Professional Hospital Header: Appointments Title on left, + New Button inside header layout on right */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() =>
              navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Home")
            }
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t.appointment || "Appointments"}
          </Text>
        </View>

        {/* Responsive "+ New" button safely inside header row with no overlap or clipping */}
        <TouchableOpacity
          style={styles.newBookingBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("BookAppointment")}
        >
          <Ionicons name="add" size={18} color={COLORS.white} />
          <Text style={styles.newBookingText}>{t.newAppointment || "+ New"}</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "upcoming" && styles.tabBtnActive]}
          onPress={() => setTab("upcoming")}
        >
          <Text style={[styles.tabText, tab === "upcoming" && styles.tabTextActive]}>
            {t.upcoming || "Upcoming"} ({upcomingList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "past" && styles.tabBtnActive]}
          onPress={() => setTab("past")}
        >
          <Text style={[styles.tabText, tab === "past" && styles.tabTextActive]}>
            {t.past || "Past"} ({pastList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={54} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>
            {tab === "upcoming" ? t.noAppointments : t.noPastAppointments}
          </Text>
          <CustomButton
            title={t.bookAppointment}
            onPress={() => navigation.navigate("BookAppointment")}
            style={{ marginTop: 20, width: 220 }}
          />
        </View>
      ) : (
        <FlatList
          data={activeList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderAppointmentItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    flexShrink: 1,
  },
  newBookingBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  newBookingText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 13,
    marginLeft: 2,
  },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 4,
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
  },
  tabTextActive: {
    color: COLORS.white,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  emptyTitle: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 14,
    textAlign: "center",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateBadge: {
    width: 48,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D2EFEF",
  },
  dateDay: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.primary,
  },
  dateMonth: {
    fontSize: 10,
    color: COLORS.textLight,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  doctorInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  doctorName: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  department: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  badgeConfirmed: { backgroundColor: "#E7F6EC" },
  badgeCompleted: { backgroundColor: "#EBF3FE" },
  badgeCancelled: { backgroundColor: "#FDEAEA" },
  statusText: { fontSize: 10, fontWeight: "700" },
  statusConfirmed: { color: COLORS.success },
  statusCompleted: { color: "#2F80ED" },
  statusCancelled: { color: COLORS.danger },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 12,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  refRowWrap: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  refPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  refPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  consultTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  consultTypeVideo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  consultTypeOpd: {
    backgroundColor: "#F8FAFC",
    borderColor: COLORS.border,
  },
  consultTypeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  viewDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewDetailText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    marginRight: 2,
  },
});
