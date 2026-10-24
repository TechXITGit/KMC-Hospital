import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { getLocalizedHealthTips } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";

export default function HealthTipDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { language, t } = useLanguage();

  const tipParam = route.params?.tip;
  const tipId = route.params?.tipId || tipParam?.id || "ht1";
  const localizedTips = getLocalizedHealthTips(language);
  const tip = localizedTips.find((item) => item.id === tipId) || localizedTips[0];

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${tip.title}\n\n${tip.summary}\n\n${language === "hi" ? "केएमसी हॉस्पिटल लखनऊ ऐप पर पढ़ें!" : "Read more on KMC Hospital App Lucknow!"}`,
      });
    } catch (e) {
      // ignore
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.healthArticle}</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Ionicons name="share-social-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { flexGrow: 1, paddingBottom: 100 }]}
        showsVerticalScrollIndicator={true}
        bounces={true}
      >
        <View style={styles.metaRow}>
          <Text style={styles.categoryBadge}>
            {tip.category || (language === "hi" ? "स्वास्थ्य गाइड" : "Health Guide")}
          </Text>
          <Text style={styles.readTime}>
            {tip.readTime || (language === "hi" ? "3 मिनट पढ़ें" : "3 min read")}
          </Text>
        </View>

        <Text style={styles.title}>{tip.title}</Text>

        {/* Doctor Verification Badge */}
        <View style={styles.doctorBadge}>
          <Ionicons name="checkmark-seal" size={20} color={COLORS.primary} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.reviewedLabel}>{t.reviewedBy}</Text>
            <Text style={styles.doctorName}>
              {tip.author || (language === "hi" ? "केएमसी अस्पताल मेडिकल टीम" : "KMC Hospital Medical Team")}
            </Text>
          </View>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryText}>{tip.summary}</Text>
        </View>

        {/* Content Body */}
        <View style={styles.bodyCard}>
          <Text style={styles.contentText}>{tip.content || tip.summary}</Text>
        </View>
      </ScrollView>
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
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  categoryBadge: {
    backgroundColor: "#EAF6F5",
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  readTime: { fontSize: 12, color: COLORS.textLight, marginLeft: 10 },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text, lineHeight: 28, marginBottom: 16 },
  doctorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  reviewedLabel: { fontSize: 11, color: COLORS.textLight },
  doctorName: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginTop: 1 },
  summaryCard: {
    backgroundColor: "#F0FAF9",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryText: { fontSize: 13, color: COLORS.text, fontStyle: "italic", lineHeight: 20 },
  bodyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contentText: { fontSize: 14, color: COLORS.text, lineHeight: 24 },
});
