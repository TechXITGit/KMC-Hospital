import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { useAppointments } from "../../context/AppointmentContext";
import { useLanguage } from "../../context/LanguageContext";
import { HOSPITAL_INFO } from "../../constants/data";
import { formatAppointmentRef } from "../../utils/appointmentFormatter";
import { formatTimeTo12Hour, isMeetExpired } from "../../utils/dateFormatter";
import { downloadAppointmentSlipPdf } from "../../services/pdfService";
import { supabase } from "../../utils/supabase";
import { requestCameraAndAudioPermissions } from "../../services/permissionService";

export default function AppointmentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, language } = useLanguage();
  const { cancelAppointment, getAppointmentById } = useAppointments();

  const appointmentParam = route.params?.appointment;
  const appointmentId = appointmentParam?.id;
  const currentAppointment = getAppointmentById(appointmentId) || appointmentParam;

  // Cancellation Modal & Local State
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [localStatus, setLocalStatus] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [activeCall, setActiveCall] = useState(null);

  useEffect(() => {
    if (!appointmentId) return;
    let isSubscribed = true;

    const checkActiveCall = async () => {
      try {
        const { data } = await supabase
          .from("calls")
          .select("*")
          .eq("appointment_id", appointmentId)
          .in("status", ["ringing", "accepted", "connecting", "connected"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (isSubscribed && data) {
          setActiveCall(data);
        }
      } catch (err) {
        // non-fatal
      }
    };

    checkActiveCall();

    const channel = supabase
      .channel(`apt_call:${appointmentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls",
          filter: `appointment_id=eq.${appointmentId}`,
        },
        (payload) => {
          const c = payload.new;
          if (c && ["ringing", "accepted", "connecting", "connected"].includes(c.status)) {
            setActiveCall(c);
          } else {
            setActiveCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [appointmentId]);

  const formattedTime = formatTimeTo12Hour(currentAppointment?.time);

  if (!currentAppointment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t.appointmentDetails}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.notFoundWrap}>
          <Text style={styles.notFoundText}>{t.appointmentNotFound}</Text>
          <CustomButton
            title={t.backToAppointments}
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const effectiveStatus = (localStatus || currentAppointment.status || "Confirmed").toLowerCase();
  const isCancelled = effectiveStatus === "cancelled";
  const isCompleted =
    effectiveStatus === "completed" ||
    isMeetExpired(currentAppointment.date, currentAppointment.time, effectiveStatus);

  const statusDisplay = isCancelled
    ? t.cancelled
    : isCompleted
    ? (language === "hi" ? "Expired Meet (समाप्त)" : "Expired Meet")
    : t.confirmed;

  const handleOpenCancelModal = () => {
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelAppointment(currentAppointment.id);
      setLocalStatus("cancelled");
      setCancelModalVisible(false);
    } catch (err) {
      Alert.alert(t.bookingError, err.message || "Failed to cancel appointment");
    } finally {
      setCancelling(false);
    }
  };

  const handleGetDirections = () => {
    const query = encodeURIComponent(HOSPITAL_INFO.address);
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    });
  };

  const handleCallHospital = () => {
    Linking.openURL(`tel:${HOSPITAL_INFO.emergencyPrimary}`);
  };

  const handleDownloadSlip = async () => {
    if (downloadingPdf) return;
    try {
      setDownloadingPdf(true);
      await downloadAppointmentSlipPdf({
        tokenNumber: formatAppointmentRef(currentAppointment.tokenNumber, currentAppointment.type),
        type: currentAppointment.type,
        patientName: currentAppointment.patientName || "Valued Patient",
        doctorName: currentAppointment.doctorName || "Doctor",
        department: currentAppointment.department || "Specialist",
        date: currentAppointment.date || "Scheduled Date",
        time: formattedTime,
      });
    } catch (err) {
      Alert.alert("Download Error", "Could not generate appointment slip. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const isVideoConsult =
    currentAppointment.type === "Video Consultation" ||
    Boolean(currentAppointment.video_consultation);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.appointmentDetails}</Text>
        <TouchableOpacity onPress={handleDownloadSlip} style={styles.shareBtn}>
          <Ionicons name="share-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { flexGrow: 1, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        {/* Token / Reference Card */}
        <View style={styles.tokenCard}>
          <View style={styles.tokenTopRow}>
            <View>
              <Text style={styles.tokenLabel}>
                {isVideoConsult
                  ? language === "hi"
                    ? "डिजिटल कंसल्टेशन आईडी"
                    : "Teleconsultation ID"
                  : language === "hi"
                  ? "ओपीडी पर्ची संख्या"
                  : "OPD Appointment ID"}
              </Text>
              <Text style={styles.tokenValue}>
                {formatAppointmentRef(currentAppointment.tokenNumber, currentAppointment.type)}
              </Text>
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
                {statusDisplay}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Date & Slot Info */}
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.metaLabel}>{t.date}</Text>
              <Text style={styles.metaValue}>{currentAppointment.date}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.metaLabel}>{t.timeSlot}</Text>
              <Text style={styles.metaValue}>{formattedTime}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.metaLabel}>{t.mode}</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {isVideoConsult ? (language === "hi" ? "वीडियो" : "Online") : (language === "hi" ? "अस्पताल" : "OPD")}
              </Text>
            </View>
          </View>
        </View>

        {/* Doctor Details Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.doctorDetails}</Text>
          <View style={styles.doctorRow}>
            <View style={styles.doctorAvatar}>
              <Ionicons name="person" size={24} color={COLORS.white} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.doctorName}>{currentAppointment.doctorName}</Text>
              <Text style={styles.doctorSpecialty}>
                {currentAppointment.doctorSpecialty || currentAppointment.department}
              </Text>
              <Text style={styles.deptBadge}>{currentAppointment.department}</Text>
            </View>
          </View>
        </View>

        {/* Consultation & Payment Details Card */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.consultationBillingDetails}</Text>

          {Boolean(currentAppointment.reason) && (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.metaLabel}>{t.reasonForConsultation}</Text>
              <Text style={[styles.metaValue, { marginTop: 2, fontWeight: "600" }]}>
                {currentAppointment.reason}
              </Text>
            </View>
          )}

          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.metaLabel}>{t.docConsultFee}</Text>
              <Text style={[styles.metaValue, { color: COLORS.primary, fontWeight: "800" }]}>
                {currentAppointment.fee || `₹${currentAppointment.consultationFee || 800}`}
              </Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.metaLabel}>{t.paymentMode}</Text>
              <Text style={styles.metaValue}>
                {currentAppointment.paymentMethod === "online"
                  ? t.onlinePayment
                  : t.paymentCounterDesk}
              </Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.metaLabel}>{t.paymentStatus}</Text>
              <Text
                style={[
                  styles.metaValue,
                  {
                    color:
                      currentAppointment.paymentStatus === "paid"
                        ? COLORS.success
                        : "#D97706",
                  },
                ]}
              >
                {currentAppointment.paymentStatus === "paid" ? t.paid : t.pending}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Patient Details Row */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={styles.metaLabel}>{t.patient}</Text>
              <Text style={[styles.metaValue, { marginTop: 2 }]}>
                {currentAppointment.patientName || t.self}
                {currentAppointment.patientPhone ? ` · +91 ${currentAppointment.patientPhone}` : ""}
              </Text>
            </View>

            {/* Sync Badge */}
            <View style={styles.syncBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#059669" style={{ marginRight: 4 }} />
              <Text style={styles.syncText}>
                {currentAppointment.googleSheetsSynced ? t.sheetsSynced : t.hospitalVerified}
              </Text>
            </View>
          </View>
        </View>

        {/* In-Person Hospital OPD Visit Card - ONLY for Hospital Visit */}
        {!isVideoConsult && (
          <View style={[styles.sectionCard, { backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="business" size={20} color={COLORS.primary} />
              <Text style={[styles.sectionTitle, { color: COLORS.primary, marginLeft: 8, marginBottom: 0 }]}>
                {t.inHospitalVisitTitle}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 19, marginBottom: 8 }}>
              {t.opdVisitInstruction}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: COLORS.text, fontWeight: "600" }}>
                {t.opdWing}: {currentAppointment.department || "General OPD"}
              </Text>
            </View>
          </View>
        )}

        {/* Video Teleconsult / Direct Doctor Calling - ONLY for Video Consultation */}
        {isVideoConsult && (
          <View style={[styles.sectionCard, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Ionicons name="videocam" size={22} color="#059669" />
              <Text style={[styles.sectionTitle, { color: "#065F46", marginLeft: 8, marginBottom: 0 }]}>
                {language === "hi" ? "डायरेक्ट डॉक्टर वीडियो परामर्श" : "Direct Doctor Telehealth Consult"}
              </Text>
            </View>

            {/* Doctor Call Notice Banner */}
            <View
              style={{
                backgroundColor: "#DCFCE7",
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: "#86EFAC",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                <Ionicons name="notifications-outline" size={16} color="#15803D" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#166534" }}>
                  {language === "hi" ? "डॉक्टर सीधे आपको कॉल करेंगे" : "Your Doctor Will Call You Directly"}
                </Text>
              </View>
              <Text style={{ fontSize: 12, color: "#166534", lineHeight: 18 }}>
                {language === "hi"
                  ? `आपके निर्धारित परामर्श समय (${formattedTime}) पर डॉक्टर सीधे आपको ऐप में कॉल करेंगे। कृपया कॉल प्राप्त करने के लिए ऐप नोटिफिकेशन ऑन रखें।`
                  : `At your scheduled time (${formattedTime}), Dr. ${currentAppointment.doctorName || "Doctor"} will initiate an encrypted video call. You will receive an incoming call prompt on your screen to Answer.`}
              </Text>
            </View>

            {/* If there is an active ongoing call, show prominent Join button */}
            {Boolean(activeCall) && (
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#10B981",
                  paddingVertical: 14,
                  borderRadius: 12,
                  marginBottom: 14,
                  shadowColor: "#10B981",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 5,
                }}
                activeOpacity={0.85}
                onPress={async () => {
                  try {
                    const permResult = await requestCameraAndAudioPermissions({
                      video: activeCall.call_type !== "voice",
                      audio: true,
                    });
                    if (!permResult.granted) {
                      Alert.alert(
                        "Permission Required",
                        "Camera and Microphone access is required for video calls. Please allow access and try again.",
                        [{ text: "OK" }]
                      );
                      return;
                    }
                  } catch (e) {
                    console.warn("[AppointmentDetail] Permission request error:", e);
                  }
                  navigation.navigate("CallScreen", {
                    callId: activeCall.id,
                    callType: activeCall.call_type || "video",
                    role: "patient",
                    peerName: currentAppointment.doctorName || "Doctor",
                    peerSubtitle: currentAppointment.department || "Consultant Specialist",
                  });
                }}
              >
                <Ionicons name="videocam" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" }}>
                  {language === "hi" ? "लाइव वीडियो कॉल में शामिल हों" : "Join Active Video Call"}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.outlineActionBtn, { flex: 1 }]}
                onPress={() => {
                  const subject = encodeURIComponent(`KMC Hospital Appointment - ${currentAppointment.tokenNumber}`);
                  const body = encodeURIComponent(
                    `Consultation with ${currentAppointment.doctorName}\n` +
                    `Date: ${currentAppointment.date} at ${formattedTime}\n` +
                    `Token: ${currentAppointment.tokenNumber}\n` +
                    `Mode: Encrypted Live Video Consultation (In-App)\n\n` +
                    `KMC Hospital, Jankipuram, Lucknow`
                  );
                  Linking.openURL(`mailto:${currentAppointment.patientEmail || ""}?subject=${subject}&body=${body}`);
                }}
              >
                <Ionicons name="mail-outline" size={16} color="#059669" />
                <Text style={[styles.outlineActionText, { color: "#059669" }]}>{t.emailDetails}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Hospital Location & Contact */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.hospitalLocation}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="business" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.hospitalName}>{HOSPITAL_INFO.name}</Text>
              <Text style={styles.hospitalAddress}>{currentAppointment.hospitalAddress || HOSPITAL_INFO.address}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.outlineActionBtn} onPress={handleGetDirections}>
              <Ionicons name="navigate-outline" size={18} color={COLORS.primary} />
              <Text style={styles.outlineActionText}>{t.getDirections}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outlineActionBtn} onPress={handleCallHospital}>
              <Ionicons name="call-outline" size={18} color={COLORS.primary} />
              <Text style={styles.outlineActionText}>{t.callNow}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        {!isCancelled && !isCompleted && (
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.downloadSlipBtn}
              onPress={handleDownloadSlip}
              activeOpacity={0.85}
            >
              <Ionicons name="download-outline" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
              <Text style={styles.downloadSlipText}>{t.downloadSlip}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelActionBtn}
              onPress={handleOpenCancelModal}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.cancelActionText}>{t.cancelAppointment}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Reliable In-App Confirmation Modal for Cancellation */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !cancelling && setCancelModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cancelModalCard}>
            <View style={styles.cancelIconWrap}>
              <Ionicons name="alert-circle-outline" size={38} color={COLORS.danger} />
            </View>

            <Text style={styles.cancelModalTitle}>{t.cancelConfirmTitle}</Text>
            <Text style={styles.cancelModalDesc}>{t.cancelConfirmDesc}</Text>

            <View style={styles.cancelDetailBox}>
              <Text style={styles.cancelTokenText}>
                Reference: <Text style={{ fontWeight: "800", color: COLORS.text }}>{formatAppointmentRef(currentAppointment.tokenNumber, currentAppointment.type)}</Text>
              </Text>
              <Text style={styles.cancelDocText}>
                {currentAppointment.doctorName} · {currentAppointment.date} ({formattedTime})
              </Text>
            </View>

            {cancelling ? (
              <View style={styles.cancellingBox}>
                <ActivityIndicator size="small" color={COLORS.danger} />
                <Text style={styles.cancellingText}>{t.cancelling}</Text>
              </View>
            ) : (
              <View style={styles.modalActionStack}>
                <TouchableOpacity
                  style={styles.modalCancelConfirmBtn}
                  onPress={handleConfirmCancel}
                  activeOpacity={0.85}
                >
                  <Ionicons name="close-circle" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.modalCancelConfirmText}>{t.yesCancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalKeepBtn}
                  onPress={() => setCancelModalVisible(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalKeepText}>{t.noKeep}</Text>
                </TouchableOpacity>
              </View>
            )}
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
  shareBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  content: { padding: 20, paddingBottom: 40 },
  notFoundWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
  notFoundText: { fontSize: 16, color: COLORS.textLight, marginBottom: 20 },
  tokenCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 16,
  },
  tokenTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  tokenLabel: { fontSize: 11, color: COLORS.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  tokenValue: { fontSize: 20, fontWeight: "800", color: COLORS.primary, marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeConfirmed: { backgroundColor: "#E7F6EC" },
  badgeCompleted: { backgroundColor: "#EBF3FE" },
  badgeCancelled: { backgroundColor: "#FDEAEA" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusConfirmed: { color: COLORS.success },
  statusCompleted: { color: "#2F80ED" },
  statusCancelled: { color: COLORS.danger },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  gridCol: { flex: 1 },
  metaLabel: { fontSize: 11, color: COLORS.textLight },
  metaValue: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginBottom: 14 },
  doctorRow: { flexDirection: "row", alignItems: "center" },
  doctorAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  doctorSpecialty: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  deptBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF6F5",
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start" },
  hospitalName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  hospitalAddress: { fontSize: 12, color: COLORS.textLight, marginTop: 4, lineHeight: 17 },
  actionRow: { flexDirection: "row", marginTop: 16, justifyContent: "space-between" },
  outlineActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginHorizontal: 4,
    backgroundColor: COLORS.background,
  },
  outlineActionText: { fontSize: 12, fontWeight: "600", color: COLORS.primary, marginLeft: 6 },
  bottomActions: { marginTop: 10 },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  syncText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },

  // Cancel Confirmation Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  cancelModalCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cancelIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  cancelModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
    marginBottom: 8,
  },
  cancelModalDesc: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  cancelDetailBox: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 20,
  },
  cancelTokenText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
  },
  cancelDocText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },
  cancellingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  cancellingText: {
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.danger,
  },
  modalActionStack: {
    width: "100%",
    gap: 10,
  },
  modalCancelConfirmBtn: {
    flexDirection: "row",
    width: "100%",
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalCancelConfirmText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },
  modalKeepBtn: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  modalKeepText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  downloadSlipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  downloadSlipText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 15,
  },
  cancelActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    height: 48,
    borderRadius: 14,
  },
  cancelActionText: {
    color: COLORS.danger,
    fontWeight: "800",
    fontSize: 14,
  },
});
