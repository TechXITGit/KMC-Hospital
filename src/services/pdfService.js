import { Platform, Alert } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/**
 * Common KMC Hospital Letterhead & Styling CSS for PDFs
 */
const getKmcHospitalPdfStyles = () => `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', Arial, sans-serif; }
    body { padding: 36px; background-color: #ffffff; color: #1e293b; line-height: 1.5; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0B7A75; padding-bottom: 18px; margin-bottom: 24px; }
    .logo-area { display: flex; align-items: center; gap: 14px; }
    .hospital-title { font-size: 22px; font-weight: 800; color: #0B7A75; letter-spacing: -0.5px; }
    .hospital-sub { font-size: 11px; color: #64748b; font-weight: 600; margin-top: 2px; }
    .doc-type-badge { background: #EAF6F5; border: 1px solid #0B7A75; color: #0B7A75; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; text-transform: uppercase; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px; }
    .info-value { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .section-heading { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; border-left: 3px solid #0B7A75; padding-left: 8px; text-transform: uppercase; }
    .content-box { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
    .table-kmc { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .table-kmc th { background: #0B7A75; color: #ffffff; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; border-radius: 4px; }
    .table-kmc td { padding: 10px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #1e293b; }
    .badge-status { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-paid { background: #DCFCE7; color: #15803D; }
    .badge-confirmed { background: #E0F2FE; color: #0284C7; }
    .footer { margin-top: 40px; border-top: 1px solid #E2E8F0; padding-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer-left { font-size: 10px; color: #64748b; line-height: 1.4; }
    .signature-area { text-align: center; }
    .signature-line { width: 160px; border-top: 1px solid #94a3b8; margin-top: 45px; margin-bottom: 6px; }
    .signature-title { font-size: 11px; font-weight: 700; color: #0f172a; }
  </style>
`;

/**
 * Generic helper to print or share HTML document as PDF across Native and Web
 */
export const printOrShareHtml = async ({ html, fileName = "KMC_Document.pdf", title = "KMC Hospital Document" }) => {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 350);
          return { success: true };
        }
      }
    }

    // Native Mobile (iOS & Android)
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: title,
      });
      return { success: true, uri };
    } else {
      Alert.alert("PDF Generated", `Saved to device at: ${uri}`);
      return { success: true, uri };
    }
  } catch (err) {
    console.error("[PDF Service] Generation failed:", err);
    Alert.alert("Download Error", err?.message || "Could not generate PDF. Please try again.");
    return { success: false, error: err };
  }
};

/**
 * 1. Medical Records: Prescription PDF
 */
export const downloadPrescriptionPdf = async ({
  patientName = "Valued Patient",
  doctorName = "KMC Specialist",
  department = "General Medicine",
  diagnosis = "Regular Checkup",
  medicines = [],
  date = new Date().toISOString().split("T")[0],
  tokenNumber = "KMC-RX-101",
}) => {
  const cleanDate = String(date).replace(/[^a-zA-Z0-9-]/g, "_");
  const fileName = `KMC_Prescription_${cleanDate}.pdf`;

  const medicinesRows = (medicines || [])
    .map(
      (m, idx) => `
      <tr>
        <td style="width: 35px; text-align: center;">${idx + 1}</td>
        <td><strong>${m}</strong></td>
        <td>As Directed by Doctor</td>
      </tr>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KMC Hospital - Prescription</title>
        ${getKmcHospitalPdfStyles()}
      </head>
      <body>
        <div class="header">
          <div class="logo-area">
            <div>
              <div class="hospital-title">KMC HOSPITAL</div>
              <div class="hospital-sub">Sector G, Jankipuram, Lucknow · Ph: +91 8303666400</div>
            </div>
          </div>
          <div class="doc-type-badge">Official Prescription</div>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Patient Name</span>
            <span class="info-value">${patientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Prescribing Doctor</span>
            <span class="info-value">${doctorName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Department</span>
            <span class="info-value">${department}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Date of Consultation</span>
            <span class="info-value">${date}</span>
          </div>
        </div>

        <div class="section-heading">Clinical Diagnosis & Findings</div>
        <div class="content-box">
          <p style="font-size: 13px; color: #334155;">${diagnosis || "Clinical assessment completed. Continue recommended lifestyle and follow-up."}</p>
        </div>

        <div class="section-heading">Prescribed Medications (Rx)</div>
        <div class="content-box">
          <table class="table-kmc">
            <thead>
              <tr>
                <th style="width: 35px; text-align: center;">#</th>
                <th>Medicine Name / Dosage</th>
                <th>Instructions / Frequency</th>
              </tr>
            </thead>
            <tbody>
              ${medicinesRows || '<tr><td colspan="3" style="text-align:center;">No medications listed.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-left">
            This is a computer-generated medical record verified by KMC Telehealth.<br>
            Emergency Helpline: +91 8303666400 · Ambulance Available 24x7
          </div>
          <div class="signature-area">
            <div class="signature-line"></div>
            <div class="signature-title">${doctorName}</div>
            <div style="font-size: 10px; color: #64748b;">Authorized Signatory · KMC Hospital</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return await printOrShareHtml({ html, fileName, title: `KMC Prescription - ${doctorName}` });
};

/**
 * 2. Medical Records: Lab Report PDF
 */
export const downloadLabReportPdf = async ({
  patientName = "Valued Patient",
  testName = "Laboratory Investigation",
  doctorName = "KMC Specialist",
  keyResults = "Normal findings within reference limits",
  status = "Normal",
  date = new Date().toISOString().split("T")[0],
}) => {
  const cleanDate = String(date).replace(/[^a-zA-Z0-9-]/g, "_");
  const fileName = `KMC_LabReport_${cleanDate}.pdf`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KMC Hospital - Diagnostic Lab Report</title>
        ${getKmcHospitalPdfStyles()}
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">KMC HOSPITAL PATHOLOGY LAB</div>
            <div class="hospital-sub">Diagnostic Services · Sector G, Jankipuram, Lucknow · Ph: +91 8303666400</div>
          </div>
          <div class="doc-type-badge">Lab Report</div>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Patient Name</span>
            <span class="info-value">${patientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Referred By</span>
            <span class="info-value">${doctorName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Test Name</span>
            <span class="info-value">${testName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Report Date</span>
            <span class="info-value">${date}</span>
          </div>
        </div>

        <div class="section-heading">Test Investigation Findings</div>
        <div class="content-box">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
            <span style="font-weight: 700; font-size: 14px; color: #0f172a;">${testName}</span>
            <span class="badge-status badge-paid">${status || "Normal"}</span>
          </div>
          <p style="font-size: 13px; color: #334155; line-height: 1.6;">${keyResults}</p>
        </div>

        <div class="footer">
          <div class="footer-left">
            Certified Pathological Examination Report · KMC Hospital Diagnostic Lab<br>
            Please consult your physician for detailed interpretation.
          </div>
          <div class="signature-area">
            <div class="signature-line"></div>
            <div class="signature-title">Lab Director / Chief Pathologist</div>
            <div style="font-size: 10px; color: #64748b;">KMC Pathology Services</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return await printOrShareHtml({ html, fileName, title: `KMC Lab Report - ${testName}` });
};

/**
 * 3. Billing & Payments: Invoice / Receipt PDF
 */
export const downloadBillingInvoicePdf = async ({
  invoiceNo = "INV-1001",
  patientName = "Valued Patient",
  doctorName = "Dr. Specialist",
  service = "Doctor Consultation",
  amount = "₹500",
  paymentMode = "UPI / Hospital Counter",
  status = "Paid",
  date = new Date().toISOString().split("T")[0],
}) => {
  const cleanInvNo = String(invoiceNo).replace(/[^a-zA-Z0-9-]/g, "");
  const fileName = `KMC_Invoice_${cleanInvNo}_${date}.pdf`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KMC Hospital - Tax Invoice & Payment Receipt</title>
        ${getKmcHospitalPdfStyles()}
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">KMC HOSPITAL</div>
            <div class="hospital-sub"> Sector G, Jankipuram, Lucknow · GSTIN: 09AAAFK1234F1Z5</div>
          </div>
          <div class="doc-type-badge">Tax Invoice & Receipt</div>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Invoice Number</span>
            <span class="info-value">#${invoiceNo}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Invoice Date</span>
            <span class="info-value">${date}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Billed To (Patient)</span>
            <span class="info-value">${patientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Consulting Doctor</span>
            <span class="info-value">${doctorName}</span>
          </div>
        </div>

        <div class="section-heading">Billing Details</div>
        <div class="content-box">
          <table class="table-kmc">
            <thead>
              <tr>
                <th>Service Description</th>
                <th>Payment Mode</th>
                <th>Status</th>
                <th style="text-align: right;">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${service}</strong></td>
                <td>${paymentMode}</td>
                <td><span class="badge-status badge-paid">${status}</span></td>
                <td style="text-align: right; font-weight: 800; font-size: 14px; color: #0B7A75;">${amount}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-left">
            Received with thanks · Official Hospital Computerized Payment Voucher.<br>
            All charges inclusive of applicable hospital amenities and statutory taxes.
          </div>
          <div class="signature-area">
            <div class="signature-line"></div>
            <div class="signature-title">Accounts & Billing Officer</div>
            <div style="font-size: 10px; color: #64748b;">KMC Hospital Administration</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return await printOrShareHtml({ html, fileName, title: `KMC Invoice #${invoiceNo}` });
};

/**
 * 4. Appointments: Official Consultation Slip PDF
 */
export const downloadAppointmentSlipPdf = async ({
  tokenNumber = "KMC-V885",
  type = "Video Consultation",
  patientName = "Valued Patient",
  doctorName = "Doctor",
  department = "Specialist",
  date = "Today",
  time = "10:00 AM",
}) => {
  const cleanToken = String(tokenNumber).replace(/[^a-zA-Z0-9-]/g, "");
  const fileName = `KMC_Appointment_Slip_${cleanToken}.pdf`;
  const isVideo = (type || "").toLowerCase().includes("video");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>KMC Hospital - Appointment Slip</title>
        ${getKmcHospitalPdfStyles()}
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">KMC HOSPITAL</div>
            <div class="hospital-sub"> Jankipuram, Lucknow · Helpline: +91 8303666400</div>
          </div>
          <div class="doc-type-badge">Consultation Slip</div>
        </div>

        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Token / Queue ID</span>
            <span class="info-value" style="font-size: 16px; color: #0B7A75;">#${tokenNumber}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Consultation Mode</span>
            <span class="info-value">${isVideo ? "Online Video Consultation" : "In-Hospital OPD Visit"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Patient Name</span>
            <span class="info-value">${patientName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Doctor</span>
            <span class="info-value">${doctorName} (${department})</span>
          </div>
          <div class="info-item">
            <span class="info-label">Scheduled Date</span>
            <span class="info-value">${date}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Time Slot</span>
            <span class="info-value" style="color: #0284C7;">${time}</span>
          </div>
        </div>

        <div class="section-heading">Patient Instructions</div>
        <div class="content-box">
          <ul style="padding-left: 18px; color: #334155; font-size: 12px; line-height: 1.7;">
            ${isVideo 
              ? `<li>Your consultation will occur via encrypted video stream inside the KMC Hospital App.</li>
                 <li>Please ensure you have a stable internet connection and quiet environment.</li>
                 <li>Doctor will initiate the consultation call at your scheduled appointment time.</li>`
              : `<li>Please arrive at KMC Hospital OPD Registration Desk 15 minutes before your scheduled slot.</li>
                 <li>Present this Token Slip (#${tokenNumber}) to receive your clinic consultation card.</li>
                 <li>Hospital Address: B-1/6 Sector G, Sahara State Road, Jankipuram, Lucknow.</li>`
            }
          </ul>
        </div>

        <div class="footer">
          <div class="footer-left">
            KMC Hospital · Jankipuram, Lucknow<br>
            Appointment Support Desk: +91 8303666400
          </div>
          <div class="signature-area">
            <div class="signature-line"></div>
            <div class="signature-title">Reception / Token Dispatch</div>
            <div style="font-size: 10px; color: #64748b;">KMC Hospital Management</div>
          </div>
        </div>
      </body>
    </html>
  `;

  return await printOrShareHtml({ html, fileName, title: `KMC Appointment Slip #${tokenNumber}` });
};
