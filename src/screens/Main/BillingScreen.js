import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { getLocalizedBillingRecords } from "../../constants/data";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { downloadBillingInvoicePdf } from "../../services/pdfService";

export default function BillingScreen() {
  const navigation = useNavigation();
  const { language, t } = useLanguage();
  const { profile } = useAuth();
  const [downloadingInv, setDownloadingInv] = useState(null);

  const localizedBillingRecords = getLocalizedBillingRecords(language);
  const patientName =
    profile?.fullName || profile?.name || (language === "hi" ? "सम्मानित मरीज" : "Valued Patient");

  const handleDownloadInvoice = async (inv) => {
    if (downloadingInv) return;
    try {
      setDownloadingInv(inv.id);
      await downloadBillingInvoicePdf({
        invoiceNo: inv.invoiceNo,
        patientName,
        doctorName: inv.doctor,
        service: inv.service,
        amount: inv.amount,
        paymentMode: inv.paymentMode,
        status: inv.status,
        date: inv.date,
      });
    } catch (err) {
      Alert.alert(
        language === "hi" ? "त्रुटि" : "Error",
        t.downloadFailed || (language === "hi" ? "रसीद डाउनलोड विफल हुई।" : "Failed to download invoice receipt.")
      );
    } finally {
      setDownloadingInv(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.billing || "Billing & Payments"}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Billing Overview Banner */}
        <View style={styles.overviewBanner}>
          <View style={styles.overviewCol}>
            <Text style={styles.overviewLabel}>
              {t.totalInvoices || (language === "hi" ? "कुल बिल" : "Total Invoices")}
            </Text>
            <Text style={styles.overviewValue}>{localizedBillingRecords.length}</Text>
          </View>
          <View style={styles.verticalLine} />
          <View style={styles.overviewCol}>
            <Text style={styles.overviewLabel}>
              {t.paymentStatus || (language === "hi" ? "भुगतान स्थिति" : "Payment Status")}
            </Text>
            <Text style={[styles.overviewValue, { color: "#86EFAC" }]}>
              {language === "hi" ? "100% पूर्ण" : "100% Cleared"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t.invoices || (language === "hi" ? "रसीदें एवं इनवॉइस" : "Invoices & Receipts")}</Text>

        {localizedBillingRecords.map((inv) => {
          const isBusy = downloadingInv === inv.id;
          return (
            <View key={inv.id} style={styles.invoiceCard}>
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={styles.invoiceNo}>#{inv.invoiceNo}</Text>
                  <Text style={styles.invoiceDate}>{inv.date}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>{inv.status}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t.service || (language === "hi" ? "सेवा" : "Service")}
                </Text>
                <Text style={styles.detailValue} numberOfLines={1}>{inv.service}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t.doctor || (language === "hi" ? "डॉक्टर" : "Doctor")}
                </Text>
                <Text style={styles.detailValue} numberOfLines={1}>{inv.doctor}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>
                  {t.paymentMethod || (language === "hi" ? "भुगतान माध्यम" : "Payment Method")}
                </Text>
                <Text style={styles.detailValue}>{inv.paymentMode}</Text>
              </View>

              <View style={styles.bottomRow}>
                <View>
                  <Text style={styles.amountLabel}>
                    {t.totalAmount || (language === "hi" ? "कुल राशि" : "Total Amount")}
                  </Text>
                  <Text style={styles.amountValue}>{inv.amount}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.receiptBtn, isBusy && { opacity: 0.7 }]}
                  onPress={() => handleDownloadInvoice(inv)}
                  disabled={isBusy}
                  activeOpacity={0.8}
                >
                  {isBusy ? (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="download-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
                  )}
                  <Text style={styles.receiptBtnText}>
                    {isBusy
                      ? (t.generatingPdf || (language === "hi" ? "तैयार हो रहा है..." : "Generating..."))
                      : (t.viewReceipt || (language === "hi" ? "रसीद डाउनलोड करें" : "View & Download Receipt"))}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
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
    paddingTop: 10,
    paddingBottom: 8,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  content: { paddingHorizontal: 20, paddingBottom: 50 },
  overviewBanner: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  overviewCol: { flex: 1, alignItems: "center" },
  overviewLabel: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  overviewValue: { fontSize: 20, fontWeight: "800", color: COLORS.white, marginTop: 4 },
  verticalLine: { width: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  invoiceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  invoiceNo: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  invoiceDate: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  statusBadge: { backgroundColor: "#DCFCE7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700", color: "#15803D" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  detailLabel: { fontSize: 12, color: COLORS.textLight },
  detailValue: { fontSize: 12, fontWeight: "600", color: COLORS.text, maxWidth: 200, textAlign: "right" },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  amountLabel: { fontSize: 10, color: COLORS.textLight, fontWeight: "600" },
  amountValue: { fontSize: 16, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  receiptBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF6F5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C6E8E6",
  },
  receiptBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.primaryDark },
});
