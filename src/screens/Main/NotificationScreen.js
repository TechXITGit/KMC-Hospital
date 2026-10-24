import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../utils/supabase";
import { formatNotificationTime } from "../../utils/dateFormatter";

const INITIAL_NOTIFICATIONS = [
  {
    id: "n1",
    icon: "calendar",
    title: "Appointment Reminder",
    title_hi: "अपॉइंटमेंट रिमाइंडर",
    message: "You have an upcoming consultation with Dr. Neeta Khare at 11:00 AM.",
    message_hi: "डॉ. नीता खरे के साथ आपका परामर्श सुबह 11:00 बजे निर्धारित है।",
    time: "2h ago",
    time_hi: "2 घंटे पहले",
    read: false,
    route: "Appointment",
  },
  {
    id: "n2",
    icon: "medkit",
    title: "Prescription & Pharmacy",
    title_hi: "दवा का पर्चा तैयार है",
    message: "Your prescribed medicine list from Dr. Puneet Kumar is ready in Medical Records.",
    message_hi: "डॉ. पुनीत कुमार द्वारा लिखा गया पर्चा मेडिकल रिकॉर्ड्स में उपलब्ध है।",
    time: "1d ago",
    time_hi: "1 दिन पहले",
    read: false,
    route: "MedicalRecords",
  },
  {
    id: "n3",
    icon: "heart",
    title: "New Health Guide",
    title_hi: "नया स्वास्थ्य सुझाव",
    message: "New article: 'Nutrition & Diet Guidelines During Pregnancy' is now live.",
    message_hi: "नया लेख: 'गर्भावस्था में खान-पान एवं पोषण' अब ऐप पर उपलब्ध है।",
    time: "2d ago",
    time_hi: "2 दिन पहले",
    read: true,
    route: "HealthTipDetail",
  },
  {
    id: "n4",
    icon: "card",
    title: "Billing Invoice Generated",
    title_hi: "बिल रसीद उपलब्ध",
    message: "Invoice #INV-2026-1042 for ₹1,450 has been recorded successfully.",
    message_hi: "इनवॉइस #INV-2026-1042 (₹1,450) सफलतापूर्वक दर्ज किया गया है।",
    time: "3d ago",
    time_hi: "3 दिन पहले",
    read: true,
    route: "Billing",
  },
];

const getNotificationIcon = (type = "") => {
  const t = String(type).toLowerCase();
  if (t.includes("appointment")) return "calendar";
  if (t.includes("record") || t.includes("prescription")) return "medkit";
  if (t.includes("billing") || t.includes("payment")) return "card";
  if (t.includes("test")) return "flask-outline";
  if (t.includes("call")) return "call-outline";
  return "notifications-outline";
};

const formatRelativeTime = (isoString) => {
  if (!isoString) return "Recently";
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "Recently";
  }
};

export default function NotificationScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDbNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        const mapped = data.map((item) => ({
          id: item.id,
          icon: getNotificationIcon(item.type),
          title: item.title,
          message: formatNotificationTime(item.body),
          time: formatRelativeTime(item.created_at),
          read: item.read,
          route: item.data?.route || (item.type === "appointment" ? "Appointment" : null),
          raw: item,
        }));
        setNotifications(mapped);
      }
    } catch (err) {
      console.warn("[NotificationScreen] Fetch notifications error:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDbNotifications();
  }, [fetchDbNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDbNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user?.id) {
      try {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id);
      } catch (err) {
        console.warn("[NotificationScreen] Mark all read error:", err);
      }
    }
  };

  const handlePress = async (item) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
    );

    if (item.raw?.id) {
      try {
        await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", item.raw.id);
      } catch (err) {
        console.warn("[NotificationScreen] Mark read error:", err);
      }
    }

    if (item.route === "Appointment") {
      navigation.navigate("MainTabs", { screen: "Appointment" });
    } else if (item.route) {
      navigation.navigate(item.route);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.notifications}</Text>
        <TouchableOpacity onPress={handleMarkAllRead}>
          <Text style={styles.markReadText}>
            {language === "hi" ? "सभी पढ़े हुए मार्क करें" : "Mark all read"}
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        renderItem={({ item }) => {
          const displayTitle = (language === "hi" && item.title_hi) ? item.title_hi : item.title;
          const displayMsg = (language === "hi" && item.message_hi) ? item.message_hi : item.message;
          const displayTime = (language === "hi" && item.time_hi) ? item.time_hi : item.time;

          return (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.cardUnread]}
              activeOpacity={0.8}
              onPress={() => handlePress(item)}
            >
              <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
                <Ionicons
                  name={item.icon || "notifications"}
                  size={18}
                  color={item.read ? COLORS.textLight : COLORS.primary}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, !item.read && styles.titleUnread]}>
                    {displayTitle}
                  </Text>
                  {!item.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.message}>{displayMsg}</Text>
                <Text style={styles.time}>{displayTime}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
    paddingBottom: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  markReadText: { fontSize: 12, color: COLORS.primary, fontWeight: "600" },
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardUnread: { borderColor: COLORS.primary, backgroundColor: "#FAFDFD" },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapUnread: { backgroundColor: "#EAF6F5" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  titleUnread: { fontWeight: "800", color: COLORS.text },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  message: { fontSize: 12, color: COLORS.textLight, marginTop: 3, lineHeight: 17 },
  time: { fontSize: 10, color: COLORS.textLight, marginTop: 6 },
});
