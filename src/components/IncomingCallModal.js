import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import COLORS from "../constants/colors";
import { requestCameraAndAudioPermissions } from "../services/permissionService";

export default function IncomingCallModal({
  visible,
  call,
  onAnswer,
  onReject,
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible, pulseAnim]);

  if (!call) return null;

  const doctorName = call.doctors?.name || call.doctor_name || "Hospital Specialist";
  const department = call.doctors?.department || call.department || "Consultant Doctor";
  const isVideo = call.call_type === "video";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Incoming Call Badge */}
          <View style={styles.badge}>
            <Ionicons
              name={isVideo ? "videocam" : "call"}
              size={15}
              color={COLORS.white}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.badgeText}>
              {isVideo ? "Incoming Video Consultation" : "Incoming Voice Consultation"}
            </Text>
          </View>

          {/* Animated Avatar Circle */}
          <View style={styles.avatarWrap}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
            <View style={styles.avatarCircle}>
              <Ionicons name="medical" size={44} color={COLORS.primary} />
            </View>
          </View>

          {/* Caller Details */}
          <Text style={styles.doctorName}>{doctorName}</Text>
          <Text style={styles.department}>{department}</Text>
          <Text style={styles.hospitalNotice}>KMC Hospital Telehealth Line</Text>

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            {/* Reject Button */}
            <TouchableOpacity
              style={[styles.btnAction, styles.btnReject]}
              activeOpacity={0.8}
              onPress={() => onReject(call)}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="call" size={26} color={COLORS.white} style={{ transform: [{ rotate: "135deg" }] }} />
              </View>
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Answer Button */}
            <TouchableOpacity
              style={[styles.btnAction, styles.btnAnswer]}
              activeOpacity={0.8}
              onPress={async () => {
                try {
                  const permResult = await requestCameraAndAudioPermissions({ video: isVideo, audio: true });
                  if (!permResult.granted) {
                    // Still proceed with call — CallScreen will handle no-permission state
                    console.warn("[IncomingCallModal] Permission not granted, proceeding anyway");
                  }
                } catch (e) {
                  console.warn("[IncomingCallModal] Permission request error:", e);
                }
                onAnswer(call);
              }}
            >
              <View style={[styles.iconCircle, { backgroundColor: "#10B981" }]}>
                <Ionicons name={isVideo ? "videocam" : "call"} size={26} color={COLORS.white} />
              </View>
              <Text style={[styles.btnLabel, { color: "#10B981" }]}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 15, 29, 0.88)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 15,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  avatarWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  pulseRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(11, 122, 117, 0.15)",
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  doctorName: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  department: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  hospitalNotice: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 6,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    marginTop: 36,
    paddingHorizontal: 16,
  },
  btnAction: {
    alignItems: "center",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  btnLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#EF4444",
    marginTop: 10,
  },
});
