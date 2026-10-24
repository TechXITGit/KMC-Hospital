import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useLanguage } from "../../context/LanguageContext";

export default function VideoCallRoomScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { t } = useLanguage();
  const doctor = route.params?.doctor || {
    name: "Dr. Puneet Kumar Tulsyan",
    specialty: "Neonatologist & Pediatrician",
    department: "Neonatology (NICU)",
  };

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  const handleEndCall = () => {
    if (Platform.OS === "web") {
      navigation.goBack();
    } else {
      Alert.alert(t.endCall, "Are you sure you want to end this consultation?", [
        { text: "Continue Call", style: "cancel" },
        {
          text: t.endCall,
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleEndCall}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.doctorInfo}>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialty}>{doctor.specialty || doctor.department}</Text>
        </View>
        <View style={styles.timerBadge}>
          <View style={styles.pulsingDot} />
          <Text style={styles.timerText}>{formatTime(seconds)}</Text>
        </View>
      </View>

      {/* Main Video View (Doctor Video Feed Simulation) */}
      <View style={styles.videoCanvas}>
        <View style={styles.doctorVideoPlaceholder}>
          <View style={styles.doctorAvatar}>
            <Ionicons name="person" size={54} color={COLORS.white} />
          </View>
          <Text style={styles.statusText}>{doctor.name}</Text>
          <Text style={styles.connectedText}>Connected via Secure KMC Encrypted Line</Text>
        </View>

        {/* Patient Self PIP Preview */}
        <View style={styles.pipView}>
          {isCameraOff ? (
            <View style={styles.pipOff}>
              <Ionicons name="videocam-off" size={20} color={COLORS.white} />
              <Text style={styles.pipText}>Camera Off</Text>
            </View>
          ) : (
            <View style={styles.pipOn}>
              <Ionicons name="person-circle" size={32} color="rgba(255,255,255,0.7)" />
              <Text style={styles.pipLabel}>You</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Floating Control Bar */}
      <View style={styles.controlsBar}>
        {/* Mic toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Ionicons
            name={isMuted ? "mic-off" : "mic"}
            size={22}
            color={isMuted ? COLORS.danger : COLORS.white}
          />
          <Text style={styles.controlLabel}>{isMuted ? t.unmute : t.mute}</Text>
        </TouchableOpacity>

        {/* Camera toggle */}
        <TouchableOpacity
          style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
          onPress={() => setIsCameraOff(!isCameraOff)}
        >
          <Ionicons
            name={isCameraOff ? "videocam-off" : "videocam"}
            size={22}
            color={isCameraOff ? COLORS.danger : COLORS.white}
          />
          <Text style={styles.controlLabel}>{isCameraOff ? t.cameraOn : t.cameraOff}</Text>
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
          <Ionicons name="call" size={24} color={COLORS.white} style={{ transform: [{ rotate: "135deg" }] }} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0E1817" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    zIndex: 10,
  },
  backBtn: { padding: 4, marginRight: 12 },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 16, fontWeight: "700", color: COLORS.white },
  specialty: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.danger,
    marginRight: 6,
  },
  timerText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  videoCanvas: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: "#162524",
    overflow: "hidden",
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  doctorVideoPlaceholder: { alignItems: "center" },
  doctorAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  statusText: { fontSize: 18, fontWeight: "700", color: COLORS.white },
  connectedText: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 6 },
  pipView: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 16,
    backgroundColor: "#203433",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  pipOn: { flex: 1, alignItems: "center", justifyContent: "center" },
  pipOff: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111" },
  pipText: { color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 4 },
  pipLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, marginTop: 4, fontWeight: "600" },
  controlsBar: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  controlBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  controlBtnActive: { backgroundColor: "rgba(230,57,70,0.25)" },
  controlLabel: { fontSize: 10, color: COLORS.white, marginTop: 4 },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
});
