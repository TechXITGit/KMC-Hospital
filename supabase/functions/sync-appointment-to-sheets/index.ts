import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const GOOGLE_SHEET_ID =
  Deno.env.get("GOOGLE_SHEET_ID") || "1-z1ECshE6mofgNktoh1aYg_ANAfIt3EXoXotvpPZNss";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Convert PEM string to ArrayBuffer for WebCrypto
 */
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleanPem = (pem || "").replace(/\\n/g, "\n");
  const b64 = cleanPem
    .replace(/-----BEGIN[ A-Z0-9_-]+-----/g, "")
    .replace(/-----END[ A-Z0-9_-]+-----/g, "")
    .replace(/\s+/g, "");
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Base64URL encoding helper
 */
function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate Google OAuth2 Access Token using Service Account Private Key via WebCrypto RS256
 */
async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  const privateKeyPem = serviceAccount.private_key;
  const clientEmail = serviceAccount.client_email;
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";

  const keyBuffer = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: { name: "SHA-256" },
    },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: tokenUri,
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaim = base64UrlEncode(JSON.stringify(claim));
  const signatureInput = new TextEncoder().encode(`${encodedHeader}.${encodedClaim}`);

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signatureInput
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureString = String.fromCharCode.apply(null, signatureArray);
  const encodedSignature = base64UrlEncode(signatureString);

  const jwt = `${encodedHeader}.${encodedClaim}.${encodedSignature}`;

  // Exchange JWT for Bearer token
  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to exchange Google JWT: ${errText}`);
  }

  const tokenData = await res.json();
  return tokenData.access_token;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { appointment_id } = await req.json();

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Initialize Supabase Admin client with Service Role Key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Fetch the appointment record from Supabase primary database
    const { data: appointment, error: aptError } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .maybeSingle();

    if (aptError || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found in Supabase", details: aptError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Load Google Service Account Key from Supabase Secret
    const saSecret = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!saSecret) {
      console.warn("[Google Sheets Sync] GOOGLE_SERVICE_ACCOUNT_KEY secret is not configured in Supabase.");
      return new Response(
        JSON.stringify({
          warning: "GOOGLE_SERVICE_ACCOUNT_KEY is not configured yet in Supabase secrets. Appointment is saved safely in Supabase DB.",
          synced: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let serviceAccount: any;
    try {
      // Handles raw JSON or base64 encoded JSON
      const trimmed = saSecret.trim();
      if (trimmed.startsWith("{")) {
        serviceAccount = JSON.parse(trimmed);
      } else {
        serviceAccount = JSON.parse(atob(trimmed));
      }
    } catch (parseErr) {
      throw new Error(`Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY secret: ${parseErr.message}`);
    }

    // 4. Authenticate with Google
    const accessToken = await getGoogleAccessToken(serviceAccount);

    // 5. Google Sheets Columns
    const HEADERS = [
      "Appointment ID",
      "Patient Name",
      "Patient Phone",
      "Doctor Name",
      "Department",
      "Appointment Date",
      "Appointment Time",
      "Consultation Fee",
      "Total Amount",
      "Payment Status",
      "Payment Method",
      "Payment ID",
      "Appointment Status",
      "Reason",
      "Created At",
    ];

    const rowData = [
      appointment.id || "",
      appointment.patient_name || "",
      appointment.patient_phone || "",
      appointment.doctor_name || "",
      appointment.department || "",
      appointment.appointment_date || "",
      appointment.appointment_time || appointment.start_time || "",
      appointment.consultation_fee ? `₹${appointment.consultation_fee}` : "₹800",
      appointment.total_amount ? `₹${appointment.total_amount}` : "₹800",
      appointment.payment_status || "pending",
      appointment.payment_method || "cash",
      appointment.payment_id || "",
      appointment.status || "confirmed",
      appointment.reason || "General Consultation",
      appointment.created_at || new Date().toISOString(),
    ];

    // 6. Check existing sheet headers and find duplicate appointment ID
    const getValuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/Sheet1!A:A`;
    const checkRes = await fetch(getValuesUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let existingRows: string[][] = [];
    if (checkRes.ok) {
      const checkData = await checkRes.json();
      existingRows = checkData.values || [];
    }

    // If sheet is completely empty, insert header row first
    if (existingRows.length === 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/Sheet1!A1:O1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ values: [HEADERS] }),
        }
      );
      existingRows.push(HEADERS);
    }

    // 7. Check if appointment ID already exists (Deduplication / Idempotent update)
    let existingRowIndex = -1;
    for (let i = 0; i < existingRows.length; i++) {
      if (existingRows[i] && existingRows[i][0] === appointment.id) {
        existingRowIndex = i + 1; // 1-indexed row number in Google Sheets
        break;
      }
    }

    if (existingRowIndex > 0) {
      // Update existing row
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/Sheet1!A${existingRowIndex}:O${existingRowIndex}?valueInputOption=USER_ENTERED`;
      const updateRes = await fetch(updateUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [rowData] }),
      });

      if (!updateRes.ok) {
        const updateErr = await updateRes.text();
        throw new Error(`Google Sheets row update error: ${updateErr}`);
      }
    } else {
      // Append as new row
      const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
      const appendRes = await fetch(appendUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [rowData] }),
      });

      if (!appendRes.ok) {
        const appendErr = await appendRes.text();
        throw new Error(`Google Sheets append error: ${appendErr}`);
      }
    }

    // 8. Mark appointment as synced in Supabase database
    await supabase
      .from("appointments")
      .update({
        google_sheets_synced: true,
        google_sheets_synced_at: new Date().toISOString(),
      })
      .eq("id", appointment.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Appointment successfully synced to Google Sheet!",
        appointment_id: appointment.id,
        is_update: existingRowIndex > 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Google Sheets Sync Exception]", err.message);
    // Never fail or disrupt the primary database
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Failed to sync to Google Sheets",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
