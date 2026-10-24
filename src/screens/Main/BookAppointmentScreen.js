import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import CustomButton from "../../components/CustomButton";
import { getLocalizedDepartments, getLocalizedDoctors, DOCTORS } from "../../constants/data";
import { useAppointments } from "../../context/AppointmentContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { formatAppointmentRef } from "../../utils/appointmentFormatter";
import { formatTimeTo12Hour } from "../../utils/dateFormatter";

const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:30 PM",
  "04:30 PM",
  "05:30 PM",
  "06:30 PM",
];

const DATES = ["Today", "Tomorrow", "Wed 16", "Thu 17", "Fri 18", "Sat 19"];

const formatDateLabel = (d, lang) => {
  if (lang !== "hi") return d;
  const map = {
    Today: "आज",
    Tomorrow: "कल",
    "Wed 16": "बुध 16",
    "Thu 17": "गुरु 17",
    "Fri 18": "शुक्र 18",
    "Sat 19": "शनि 19",
    "Sun 20": "रवि 20",
    "Mon 21": "सोम 21",
    "Tue 22": "मंगल 22",
  };
  return map[d] || d;
};

const DEPT_KEYWORDS_MAP = {
  d1: ["gynec", "obs", "स्त्री", "प्रसूति", "महिला"],
  d2: ["nicu", "neonat", "नवजात", "शिशु", "गहन"],
  d3: ["pediatric", "picu", "बाल", "शिशु"],
  d4: ["pediatric surg", "शल्य", "सर्जरी", "surgery"],
  d5: ["general surg", "laparoscop", "सामान्य", "लैप्रोस्कोपिक", "सर्जरी"],
  d6: ["ortho", "हड्डी", "जोड़", "अस्थि"],
  d7: ["emergency", "trauma", "आपातकालीन", "ट्रॉमा"],
  d8: ["pharmacy", "diagnostic", "फार्मेसी", "जांच", "पैथोलॉजी"],
};

export default function BookAppointmentScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t, language } = useLanguage();
  const {
    bookAppointment,
    holdSlot,
    releaseSlot,
    getSlotStatuses,
    realtimeTrigger,
    doctors,
  } = useAppointments();
  const { user, profile } = useAuth();

  const localizedDepts = getLocalizedDepartments(language).filter(
    (d) =>
      d.id !== "d7" &&
      !(d.name || "").toLowerCase().includes("emergency") &&
      !(d.name || "").includes("आपातकालीन")
  );
  const rawDocs = doctors && doctors.length > 0 ? doctors : DOCTORS;
  const doctorList = getLocalizedDoctors(rawDocs, language).filter((d) => d.active !== false);

  const preselectedDoctor = route.params?.doctor
    ? getLocalizedDoctors([route.params.doctor], language)[0]
    : null;
  const preselectedDept = route.params?.department || preselectedDoctor?.department;

  const matchedDept = preselectedDept
    ? localizedDepts.find(
        (d) =>
          d.name === preselectedDept ||
          d.id === preselectedDept ||
          (d.name && preselectedDept && (
            d.name.toLowerCase().includes(preselectedDept.toLowerCase()) ||
            preselectedDept.toLowerCase().includes(d.name.toLowerCase())
          ))
      )
    : null;
  const initialDeptName = matchedDept?.name || preselectedDept || localizedDepts[0].name;

  const [department, setDepartment] = useState(initialDeptName);
  const [doctor, setDoctor] = useState(preselectedDoctor || doctorList[0]);
  const [date, setDate] = useState(DATES[0]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [consultType, setConsultType] = useState(route.params?.type || "Video Consultation");
  const [patientName, setPatientName] = useState(profile?.fullName || (language === "hi" ? "स्वयं" : "Self"));
  const [patientEmail, setPatientEmail] = useState(profile?.email || "");
  const [patientPhone, setPatientPhone] = useState(profile?.mobileNumber || "");
  const [reason, setReason] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // "cash" | "online"

  // Real-time slot statuses from Supabase
  const [slotStatuses, setSlotStatuses] = useState({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [holdingSlot, setHoldingSlot] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Hold timer countdown (5 minutes = 300 seconds)
  const [holdRemainingSeconds, setHoldRemainingSeconds] = useState(0);
  const holdTimerRef = useRef(null);

  // Confirmation Modal state
  const [confirmedApt, setConfirmedApt] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const filteredDoctors = department
    ? doctorList.filter((d) => {
        const docDept = (d.department || "").toLowerCase();
        const targetDept = (department || "").toLowerCase();
        if (docDept === targetDept) return true;
        const matchingKey = Object.keys(DEPT_KEYWORDS_MAP).find((k) =>
          DEPT_KEYWORDS_MAP[k].some((kw) => targetDept.includes(kw))
        );
        if (matchingKey) {
          return DEPT_KEYWORDS_MAP[matchingKey].some((kw) => docDept.includes(kw));
        }
        return false;
      })
    : doctorList;

  // Load slot statuses whenever doctor, date, or realtimeTrigger changes
  useEffect(() => {
    let isMounted = true;
    const loadStatuses = async () => {
      if (!doctor?.id || !date) return;
      setLoadingSlots(true);
      try {
        const statuses = await getSlotStatuses(doctor.id, date);
        if (isMounted) {
          setSlotStatuses(statuses || {});
        }
      } catch (err) {
        console.warn("[BookAppointment] Failed to load slot statuses:", err.message);
      } finally {
        if (isMounted) setLoadingSlots(false);
      }
    };

    loadStatuses();
    return () => {
      isMounted = false;
    };
  }, [doctor?.id, date, realtimeTrigger]);

  // Handle Hold Timer Countdown
  useEffect(() => {
    if (holdRemainingSeconds > 0) {
      holdTimerRef.current = setInterval(() => {
        setHoldRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(holdTimerRef.current);
            // Expire hold
            if (selectedSlot) {
              releaseSlot({ doctor, date, time: selectedSlot, user });
              setSelectedSlot(null);
              Alert.alert(t.holdExpired, t.holdExpiredMsg);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    };
  }, [holdRemainingSeconds, selectedSlot]);

  // Clean up held slot when leaving screen or unmounting
  useEffect(() => {
    return () => {
      if (selectedSlot && !confirmedApt) {
        releaseSlot({ doctor, date, time: selectedSlot, user });
      }
    };
  }, [selectedSlot, confirmedApt]);

  // Slot Selection with Concurrency Locking
  const handleSlotSelect = async (slot) => {
    const info = slotStatuses[slot];

    // 1. If slot is permanently booked
    if (info?.status === "booked") {
      Alert.alert(t.slotUnavailable, t.slotBookedMsg);
      return;
    }

    // 2. If slot is held by another user
    const currentUserId = user?.id || profile?.id || user?.email;
    if (info?.status === "held" && info.heldBy !== currentUserId) {
      Alert.alert(t.slotUnavailable, t.slotLockedMsg);
      return;
    }

    // 3. If user clicked the already held slot, no action needed
    if (selectedSlot === slot) return;

    // 4. Release previously held slot if any
    if (selectedSlot) {
      await releaseSlot({ doctor, date, time: selectedSlot, user });
    }

    // 5. Place hold on the new slot
    setHoldingSlot(true);
    const holdRes = await holdSlot({
      doctor,
      date,
      time: slot,
      user: {
        id: currentUserId,
        fullName: profile?.fullName || "Patient",
      },
      durationMinutes: 5,
    });
    setHoldingSlot(false);

    if (!holdRes.success) {
      Alert.alert(t.slotUnavailable, holdRes.message || "Could not reserve slot.");
      return;
    }

    setSelectedSlot(slot);
    setHoldRemainingSeconds(300); // 5 minutes countdown
  };

  // Confirm and Book Appointment
  const handleConfirmBooking = async () => {
    if (!doctor || !selectedSlot) {
      Alert.alert(t.selectionRequired, t.selectDoctorSlotAlert);
      return;
    }

    setBookingLoading(true);

    try {
      const feeNum = doctor.consultationFee || 800;
      const newApt = await bookAppointment(
        {
          doctor,
          department: department || doctor.department,
          date,
          time: selectedSlot,
          type: consultType,
          patientName: patientName || profile?.fullName || "Self",
          patientEmail: patientEmail || profile?.email || "",
          patientPhone: patientPhone || profile?.mobileNumber || "",
          fee: doctor.fee || `₹${feeNum}`,
          consultationFee: feeNum,
          totalAmount: feeNum,
          paymentMethod,
          paymentStatus: "pending",
          reason: reason.trim() || "Routine Consultation",
        },
        user || profile
      );

      setBookingLoading(false);
      setConfirmedApt(newApt);
      setShowConfirmModal(true);

      // Stop countdown
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      setHoldRemainingSeconds(0);
    } catch (err) {
      setBookingLoading(false);
      Alert.alert(t.bookingError, err.message || t.failedToConfirm);
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={styles.headerTitle}>{t.bookAppointment}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

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
        {/* Active Hold Countdown Banner */}
        {Boolean(selectedSlot) && holdRemainingSeconds > 0 && (
          <View style={styles.holdBanner}>
            <Ionicons name="time" size={20} color="#D97706" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.holdBannerTitle}>{t.slotReserved}</Text>
              <Text style={styles.holdBannerText}>
                {t.slotLockedFor}{" "}
                <Text style={{ fontWeight: "800", color: "#B45309" }}>
                  {formatTimer(holdRemainingSeconds)}
                </Text>{" "}
                {t.toCompleteBooking}
              </Text>
            </View>
          </View>
        )}

        {/* 1. Select Consultation Type */}
        <Text style={styles.sectionLabel}>{t.stepConsultType}</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity
            style={[
              styles.typeCard,
              consultType === "Video Consultation" && styles.typeCardActive,
            ]}
            onPress={() => setConsultType("Video Consultation")}
          >
            <Ionicons
              name="videocam"
              size={22}
              color={consultType === "Video Consultation" ? COLORS.white : COLORS.primary}
            />
            <Text
              style={[
                styles.typeText,
                consultType === "Video Consultation" && styles.typeTextActive,
              ]}
            >
              {t.videoConsultType}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeCard,
              consultType === "Hospital Visit" && styles.typeCardActive,
            ]}
            onPress={() => setConsultType("Hospital Visit")}
          >
            <Ionicons
              name="business"
              size={22}
              color={consultType === "Hospital Visit" ? COLORS.white : COLORS.primary}
            />
            <Text
              style={[
                styles.typeText,
                consultType === "Hospital Visit" && styles.typeTextActive,
              ]}
            >
              {t.hospitalVisitType}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 2. Select Department */}
        <Text style={styles.sectionLabel}>{t.stepDept}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {localizedDepts.map((d) => {
            const isSelected =
              department === d.name ||
              (department && d.name && (
                d.name.toLowerCase().includes(department.toLowerCase()) ||
                department.toLowerCase().includes(d.name.toLowerCase())
              ));
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => {
                  setDepartment(d.name);
                  const firstDoc = doctorList.find((doc) => {
                    const docDept = (doc.department || "").toLowerCase();
                    const targetDept = (d.name || "").toLowerCase();
                    if (docDept === targetDept) return true;
                    const matchingKey = Object.keys(DEPT_KEYWORDS_MAP).find((k) =>
                      DEPT_KEYWORDS_MAP[k].some((kw) => targetDept.includes(kw))
                    );
                    return matchingKey
                      ? DEPT_KEYWORDS_MAP[matchingKey].some((kw) => docDept.includes(kw))
                      : false;
                  });
                  if (firstDoc) setDoctor(firstDoc);
                  setSelectedSlot(null);
                }}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {d.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 3. Select Doctor */}
        <Text style={styles.sectionLabel}>{t.stepDoctor}</Text>
        <View style={{ marginBottom: 20 }}>
          {filteredDoctors.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.doctorRow, doctor?.id === d.id && styles.doctorRowSelected]}
              onPress={() => {
                setDoctor(d);
                setSelectedSlot(null);
              }}
            >
              <View style={styles.doctorAvatarWrap}>
                <Ionicons name="person" size={24} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.doctorName}>{d.name}</Text>
                <Text style={styles.doctorSpecialty}>{d.specialty}</Text>
                <Text style={styles.doctorFee}>{t.docConsultFee}: {d.fee || "₹800"}</Text>
              </View>
              <Ionicons
                name={doctor?.id === d.id ? "checkmark-circle" : "ellipse-outline"}
                size={22}
                color={doctor?.id === d.id ? COLORS.primary : COLORS.textLight}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* 4. Select Date */}
        <Text style={styles.sectionLabel}>{t.stepDate}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {DATES.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.chip, date === d && styles.chipSelected]}
              onPress={() => {
                setDate(d);
                setSelectedSlot(null);
              }}
            >
              <Text style={[styles.chipText, date === d && styles.chipTextSelected]}>
                {formatDateLabel(d, language)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 5. Real-Time Time Slots */}
        <View style={styles.slotHeaderRow}>
          <Text style={styles.sectionLabel}>{t.liveTimeSlots}</Text>
          {loadingSlots && <ActivityIndicator size="small" color={COLORS.primary} />}
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
            <Text style={styles.legendText}>{t.available}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
            <Text style={styles.legendText}>{t.locked}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.legendText}>{t.booked}</Text>
          </View>
        </View>

        <View style={styles.slotGrid}>
          {TIME_SLOTS.map((slot) => {
            const info = slotStatuses[slot];
            const isBooked = info?.status === "booked";
            const currentUserId = user?.id || profile?.id || user?.email;
            const isHeldByMe = selectedSlot === slot || (info?.status === "held" && info.heldBy === currentUserId);
            const isHeldByOther = info?.status === "held" && !isHeldByMe;

            let slotStyle = styles.slotAvailable;
            let textStyle = styles.slotTextAvailable;
            let badge = null;

            if (isBooked) {
              slotStyle = styles.slotBooked;
              textStyle = styles.slotTextBooked;
              badge = t.booked;
            } else if (isHeldByOther) {
              slotStyle = styles.slotHeld;
              textStyle = styles.slotTextHeld;
              badge = t.locked;
            } else if (isHeldByMe) {
              slotStyle = styles.slotSelected;
              textStyle = styles.slotTextSelected;
              badge = t.heldForYou;
            }

            return (
              <TouchableOpacity
                key={slot}
                disabled={isBooked || isHeldByOther || holdingSlot}
                style={[styles.slotCard, slotStyle]}
                onPress={() => handleSlotSelect(slot)}
                activeOpacity={0.8}
              >
                {isHeldByOther && (
                  <Ionicons name="lock-closed" size={12} color="#D97706" style={{ marginBottom: 2 }} />
                )}
                {isBooked && (
                  <Ionicons name="close-circle" size={12} color="#EF4444" style={{ marginBottom: 2 }} />
                )}
                {isHeldByMe && (
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.white} style={{ marginBottom: 2 }} />
                )}
                <Text style={[styles.slotTimeText, textStyle]}>{slot}</Text>
                {badge && (
                  <Text
                    style={[
                      styles.slotBadgeText,
                      isHeldByMe && { color: COLORS.white },
                      isBooked && { color: "#DC2626" },
                      isHeldByOther && { color: "#D97706" },
                    ]}
                  >
                    {badge}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 6. Reason for Visit */}
        <Text style={styles.sectionLabel}>{t.stepReason}</Text>
        <View style={styles.inputCard}>
          <Ionicons name="document-text-outline" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
          <TextInput
            style={styles.reasonInput}
            placeholder={t.reasonPlaceholder}
            placeholderTextColor={COLORS.textLight}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* 7. Payment Method */}
        <Text style={styles.sectionLabel}>{t.stepPayment}</Text>
        <View style={styles.paymentMethodRow}>
          <TouchableOpacity
            style={[
              styles.paymentMethodCard,
              paymentMethod === "cash" && styles.paymentMethodCardActive,
            ]}
            onPress={() => setPaymentMethod("cash")}
            activeOpacity={0.8}
          >
            <View style={styles.paymentIconWrap}>
              <Ionicons
                name="cash-outline"
                size={22}
                color={paymentMethod === "cash" ? COLORS.primary : COLORS.textLight}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.paymentTitle, paymentMethod === "cash" && styles.paymentTitleActive]}>
                {t.payCounter}
              </Text>
              <Text style={styles.paymentSub}>{t.payCounterSub}</Text>
            </View>
            <Ionicons
              name={paymentMethod === "cash" ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={paymentMethod === "cash" ? COLORS.primary : COLORS.textLight}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentMethodCard,
              paymentMethod === "online" && styles.paymentMethodCardActive,
            ]}
            onPress={() => setPaymentMethod("online")}
            activeOpacity={0.8}
          >
            <View style={styles.paymentIconWrap}>
              <Ionicons
                name="card-outline"
                size={22}
                color={paymentMethod === "online" ? COLORS.primary : COLORS.textLight}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.paymentTitle, paymentMethod === "online" && styles.paymentTitleActive]}>
                {t.payOnline}
              </Text>
              <Text style={styles.paymentSub}>{t.payOnlineSub}</Text>
            </View>
            <Ionicons
              name={paymentMethod === "online" ? "radio-button-on" : "radio-button-off"}
              size={20}
              color={paymentMethod === "online" ? COLORS.primary : COLORS.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* 8. Fee Summary */}
        <Text style={styles.sectionLabel}>{t.stepFee}</Text>
        <View style={styles.feeCard}>
          <View style={styles.feeRow}>
            <Text style={styles.feeItemLabel}>{t.docConsultFee}</Text>
            <Text style={styles.feeItemValue}>{doctor?.fee || "₹800"}</Text>
          </View>
          <View style={styles.feeRow}>
            <Text style={styles.feeItemLabel}>{t.hospitalPlatformFee}</Text>
            <Text style={[styles.feeItemValue, { color: "#059669", fontWeight: "800" }]}>{t.free}</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeRow}>
            <Text style={styles.feeTotalLabel}>{t.totalAmountToPay}</Text>
            <Text style={styles.feeTotalValue}>{doctor?.fee || "₹800"}</Text>
          </View>
        </View>

        {/* Submit Booking Button */}
        <CustomButton
          title={
            bookingLoading
              ? t.confirmingBooking
              : selectedSlot
              ? `${t.confirmAppointmentBtn} ${selectedSlot}`
              : t.selectSlotBtn
          }
          onPress={handleConfirmBooking}
          disabled={!selectedSlot || bookingLoading}
          loading={bookingLoading}
          style={{ marginTop: 24, marginBottom: 40 }}
        />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation & Meet Link Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderIcon}>
              <Ionicons name="checkmark-done" size={40} color={COLORS.white} />
            </View>

            <Text style={styles.modalTitle}>{t.appointmentConfirmedTitle}</Text>
            <Text style={styles.modalSubtitle}>
              {t.appointmentConfirmedSub}
            </Text>

            <View style={styles.tokenBox}>
              <Text style={styles.tokenLabel}>
                {confirmedApt?.type === "Video Consultation"
                  ? language === "hi"
                    ? "डिजिटल कंसल्टेशन आईडी"
                    : "Teleconsultation ID"
                  : language === "hi"
                  ? "ओपीडी अपॉइंटमेंट पर्ची"
                  : "OPD Appointment ID"}
              </Text>
              <Text style={styles.tokenValue}>
                {formatAppointmentRef(confirmedApt?.tokenNumber, confirmedApt?.type)}
              </Text>
            </View>

            <View style={styles.aptDetailRow}>
              <Ionicons name="person" size={16} color={COLORS.primary} />
              <Text style={styles.aptDetailText}>{confirmedApt?.doctorName}</Text>
            </View>
            <View style={styles.aptDetailRow}>
              <Ionicons name="calendar" size={16} color={COLORS.primary} />
              <Text style={styles.aptDetailText}>
                {confirmedApt?.date} at {confirmedApt?.time}
              </Text>
            </View>
            <View style={styles.aptDetailRow}>
              <Ionicons name="medkit" size={16} color={COLORS.primary} />
              <Text style={styles.aptDetailText}>
                {confirmedApt?.type === "Video Consultation" ? t.videoConsultType : t.hospitalVisitType}
              </Text>
            </View>
            <View style={styles.aptDetailRow}>
              <Ionicons name="cash" size={16} color={COLORS.primary} />
              <Text style={styles.aptDetailText}>
                {t.docConsultFee}: {confirmedApt?.fee} ({confirmedApt?.paymentMethod === "online" ? t.onlinePayment : t.paymentCounterDesk})
              </Text>
            </View>
            {Boolean(confirmedApt?.reason) && (
              <View style={styles.aptDetailRow}>
                <Ionicons name="document-text" size={16} color={COLORS.primary} />
                <Text style={styles.aptDetailText} numberOfLines={2}>
                  {t.reasonForConsultation}: {confirmedApt?.reason}
                </Text>
              </View>
            )}

            {/* In-Person Hospital OPD Visit Card */}
            {confirmedApt?.type === "Hospital Visit" && (
              <View style={styles.hospitalVisitModalCard}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <Ionicons name="business" size={18} color={COLORS.primary} />
                  <Text style={styles.hospitalVisitModalTitle}>{t.inHospitalVisitTitle}</Text>
                </View>
                <Text style={styles.hospitalVisitModalDesc}>
                  {t.opdInstructions}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <Ionicons name="location-outline" size={14} color={COLORS.textLight} />
                  <Text style={styles.hospitalVisitModalAddr}>
                    {t.hospitalAddressLabel}
                  </Text>
                </View>
              </View>
            )}

            {/* Direct Video Notice - ONLY for Video Consultation */}
            {confirmedApt?.type === "Video Consultation" && (
              <View style={[styles.meetBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", borderWidth: 1 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                  <Ionicons name="videocam" size={18} color="#059669" />
                  <Text style={[styles.meetTitle, { color: "#065F46", marginLeft: 6 }]}>
                    {language === "hi" ? "डायरेक्ट वीडियो परामर्श" : "Direct Video Consultation"}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: "#166534", lineHeight: 18, marginTop: 4 }}>
                  {language === "hi"
                    ? `आपके निर्धारित समय (${formatTimeTo12Hour(confirmedApt?.time)}) पर डॉक्टर सीधे आपको ऐप में वीडियो कॉल करेंगे। कॉल का नोटिफिकेशन प्राप्त करने के लिए ऐप नोटिफिकेशन ऑन रखें।`
                    : `At your scheduled time (${formatTimeTo12Hour(confirmedApt?.time)}), Dr. ${confirmedApt?.doctorName || "Doctor"} will initiate an encrypted video call directly in this app.`}
                </Text>
              </View>
            )}

            {/* Email Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionBtn, { flex: 1 }]}
                onPress={() => {
                  const isHospital = confirmedApt?.type === "Hospital Visit";
                  const cleanRef = formatAppointmentRef(confirmedApt?.tokenNumber, confirmedApt?.type);
                  const cleanTime = formatTimeTo12Hour(confirmedApt?.time);
                  const subject = encodeURIComponent(`KMC Hospital Appointment - ${cleanRef}`);
                  const bodyDetails = isHospital
                    ? `Mode: In-Person Hospital Visit (OPD)\nLocation: KMC Hospital, Sector B, Jankipuram, Lucknow\nPlease arrive 15 minutes prior to ${cleanTime} and present Consultation Slip ${cleanRef}.`
                    : `Mode: Encrypted Live Video Consultation (In-App)\nDoctor will call you directly at ${cleanTime}.`;
                  const body = encodeURIComponent(
                    `Hello,\n\nYour appointment with ${confirmedApt?.doctorName} is confirmed for ${confirmedApt?.date} at ${cleanTime}.\n\nReference ID: ${cleanRef}\n${bodyDetails}\n\nKMC Hospital, Jankipuram, Lucknow`
                  );
                  Linking.openURL(`mailto:${confirmedApt?.patientEmail || ""}?subject=${subject}&body=${body}`);
                }}
              >
                <Ionicons name="mail-outline" size={18} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>{t.emailDetails}</Text>
              </TouchableOpacity>
            </View>

            {/* Close / Go to Appointments */}
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setShowConfirmModal(false);
                navigation.navigate("MainTabs", { screen: "Appointment" });
              }}
            >
              <Text style={styles.doneBtnText}>{t.viewMyAppointments}</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  scrollContent: {
    padding: 18,
  },
  holdBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 16,
  },
  holdBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#92400E",
  },
  holdBannerText: {
    fontSize: 11,
    color: "#78350F",
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  typeCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginRight: 10,
  },
  typeCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
    marginTop: 6,
  },
  typeTextActive: {
    color: COLORS.white,
  },
  chipsScroll: {
    marginBottom: 20,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginRight: 10,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  doctorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  doctorRowSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#EAF6F5",
  },
  doctorAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E2F2F1",
    alignItems: "center",
    justifyContent: "center",
  },
  doctorName: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  doctorSpecialty: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  doctorFee: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 2,
  },
  slotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  legendContainer: {
    flexDirection: "row",
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 14,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textLight,
    fontWeight: "600",
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  slotCard: {
    width: "31%",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  slotAvailable: {
    backgroundColor: COLORS.card,
    borderColor: "#A7F3D0",
  },
  slotSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  slotHeld: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    opacity: 0.85,
  },
  slotBooked: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
    opacity: 0.6,
  },
  slotTimeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  slotTextAvailable: {
    color: COLORS.text,
  },
  slotTextSelected: {
    color: COLORS.white,
  },
  slotTextHeld: {
    color: "#B45309",
  },
  slotTextBooked: {
    color: "#B91C1C",
  },
  slotBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    alignItems: "center",
  },
  modalHeaderIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -46,
    borderWidth: 4,
    borderColor: COLORS.card,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 12,
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "700",
    marginTop: 2,
    marginBottom: 16,
  },
  tokenBox: {
    backgroundColor: "#EAF6F5",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
    width: "100%",
  },
  tokenLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 1,
  },
  tokenValue: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
    marginTop: 2,
  },
  aptDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  aptDetailText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
    marginLeft: 10,
  },
  hospitalVisitModalCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    width: "100%",
    marginTop: 10,
    marginBottom: 14,
  },
  hospitalVisitModalTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.primary,
    marginLeft: 6,
  },
  hospitalVisitModalDesc: {
    fontSize: 11.5,
    color: COLORS.text,
    lineHeight: 16,
    marginBottom: 4,
  },
  hospitalVisitModalAddr: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: "500",
    marginLeft: 4,
  },
  meetBox: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 14,
    padding: 12,
    width: "100%",
    marginTop: 10,
    marginBottom: 14,
  },
  meetTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065F46",
    marginLeft: 6,
  },
  meetLinkText: {
    fontSize: 11,
    color: "#047857",
    marginTop: 4,
    marginBottom: 8,
  },
  joinMeetBtn: {
    flexDirection: "row",
    backgroundColor: "#059669",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  joinMeetBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.white,
  },
  actionRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingVertical: 10,
    width: "48%",
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
    marginLeft: 6,
  },
  doneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  reasonInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 48,
    textAlignVertical: "top",
  },
  paymentMethodRow: {
    marginBottom: 20,
    gap: 10,
  },
  paymentMethodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 14,
  },
  paymentMethodCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#EAF6F5",
  },
  paymentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  paymentTitleActive: {
    color: COLORS.primary,
  },
  paymentSub: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 2,
  },
  feeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 20,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  feeItemLabel: {
    fontSize: 12,
    color: COLORS.textLight,
  },
  feeItemValue: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  feeDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  feeTotalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  feeTotalValue: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.primary,
  },
});
