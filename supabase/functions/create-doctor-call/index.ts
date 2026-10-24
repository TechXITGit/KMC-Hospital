import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateCallPayload {
  appointment_id: string;
  call_type?: "audio" | "video";
}

function isValidUUID(uuidStr: string | null | undefined): boolean {
  if (!uuidStr) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuidStr);
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing server configuration" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authenticate Caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: callerUser },
      error: userErr,
    } = await callerClient.auth.getUser();

    if (userErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Privileged DB Client
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Security: Validate Caller is an Active, Verified Doctor
    const { data: doctorRecord, error: docErr } = await adminDb
      .from("doctors")
      .select("id, name, department, active, verification_status, auth_user_id")
      .eq("auth_user_id", callerUser.id)
      .maybeSingle();

    if (docErr || !doctorRecord) {
      console.warn(`[create-doctor-call] Caller ${callerUser.id} is not linked to a doctor record.`);
      return new Response(
        JSON.stringify({ error: "Forbidden: Only registered hospital doctors can initiate consultation calls." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (doctorRecord.active === false || doctorRecord.verification_status === "suspended") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Doctor account is suspended or inactive." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parse Body
    const body: CreateCallPayload = await req.json().catch(() => ({}));
    const { appointment_id, call_type = "video" } = body;

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ error: "Validation Error: 'appointment_id' is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (call_type !== "video" && call_type !== "audio") {
      return new Response(
        JSON.stringify({ error: "Validation Error: 'call_type' must be 'audio' or 'video'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Security: Validate Appointment Ownership
    const { data: appointment, error: aptErr } = await adminDb
      .from("appointments")
      .select("id, patient_id, patient_name, patient_email, patient_phone, doctor_id, doctor_name, status, type, video_consultation")
      .eq("id", appointment_id)
      .maybeSingle();

    if (aptErr || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment not found in Supabase" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (appointment.doctor_id !== doctorRecord.id) {
      console.warn(`[create-doctor-call] Doctor ${doctorRecord.id} attempted to call appointment for doctor ${appointment.doctor_id}`);
      return new Response(
        JSON.stringify({ error: "Forbidden: This appointment is not assigned to you." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appointmentStatus = (appointment.status || "").toLowerCase();
    if (appointmentStatus === "cancelled") {
      return new Response(
        JSON.stringify({ error: "Cannot initiate call: Appointment has been cancelled." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Resolve Patient Auth UUID (patient_user_id)
    let patientUserId: string | null = null;

    if (isValidUUID(appointment.patient_id)) {
      patientUserId = appointment.patient_id;
    } else if (appointment.patient_email) {
      const { data: patientProfile } = await adminDb
        .from("profiles")
        .select("id")
        .eq("email", appointment.patient_email.toLowerCase().trim())
        .maybeSingle();

      if (patientProfile && isValidUUID(patientProfile.id)) {
        patientUserId = patientProfile.id;
      }
    }

    // 7. Duplicate Call Protection
    // Check if there is already an active/ringing call for this appointment
    const { data: existingCalls } = await adminDb
      .from("calls")
      .select("*")
      .eq("appointment_id", appointment_id)
      .in("status", ["ringing", "accepted", "connecting", "connected"])
      .order("created_at", { ascending: false });

    if (existingCalls && existingCalls.length > 0) {
      const activeCall = existingCalls[0];
      const ageInSeconds = (Date.now() - new Date(activeCall.created_at).getTime()) / 1000;

      if (ageInSeconds < 60) {
        console.log(`[create-doctor-call] Active call ${activeCall.id} already exists (age ${ageInSeconds}s). Returning existing call.`);
        return new Response(
          JSON.stringify({
            success: true,
            call: activeCall,
            doctor: { id: doctorRecord.id, name: doctorRecord.name, department: doctorRecord.department },
            is_reconnected: true,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // If ringing for > 60s without answer, mark as missed
        await adminDb
          .from("calls")
          .update({ status: "missed", ended_at: new Date().toISOString() })
          .eq("id", activeCall.id);
      }
    }

    // 8. Create Call Record in public.calls
    const newCallData = {
      appointment_id,
      doctor_id: doctorRecord.id,
      doctor_user_id: callerUser.id,
      patient_id: appointment.patient_id || patientUserId || "patient",
      patient_user_id: patientUserId,
      initiated_by: callerUser.id,
      call_type,
      status: "ringing",
      started_at: new Date().toISOString(),
    };

    const { data: newCall, error: callInsertErr } = await adminDb
      .from("calls")
      .insert(newCallData)
      .select()
      .single();

    if (callInsertErr || !newCall) {
      console.error("[create-doctor-call] Error inserting call:", callInsertErr);
      return new Response(
        JSON.stringify({ error: "Failed to create call session", details: callInsertErr?.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[create-doctor-call] Call created: ${newCall.id} (Doctor: ${doctorRecord.name}, Patient: ${appointment.patient_name})`);

    // 9. Send High-Priority Push Notification to Patient's Active Devices
    let pushResult: any = null;
    let tokensFound = 0;

    if (patientUserId) {
      const { data: pushTokens } = await adminDb
        .from("push_tokens")
        .select("expo_push_token")
        .eq("user_id", patientUserId)
        .eq("active", true);

      if (pushTokens && pushTokens.length > 0) {
        tokensFound = pushTokens.length;
        const pushMessages = pushTokens.map((t) => ({
          to: t.expo_push_token,
          title: `Incoming ${call_type === "video" ? "Video" : "Audio"} Call`,
          body: `Dr. ${doctorRecord.name} (${doctorRecord.department || "Specialist"}) is calling you.`,
          sound: "default",
          channelId: "telehealth-calls",
          priority: "high",
          data: {
            type: "incoming_call",
            call_id: newCall.id,
            appointment_id,
            doctor_id: doctorRecord.id,
            doctor_name: doctorRecord.name,
            department: doctorRecord.department,
            call_type,
            patient_name: appointment.patient_name,
            timestamp: new Date().toISOString(),
          },
        }));

        const expoHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };

        if (expoAccessToken) {
          expoHeaders["Authorization"] = `Bearer ${expoAccessToken}`;
        }

        try {
          const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: expoHeaders,
            body: JSON.stringify(pushMessages),
          });
          pushResult = await expoRes.json().catch(() => null);
        } catch (pushEx) {
          console.warn("[create-doctor-call] Expo push send warning:", pushEx);
        }
      }

      // Record in-app notification for patient
      try {
        await adminDb.from("notifications").insert({
          user_id: patientUserId,
          title: `Incoming ${call_type === "video" ? "Video" : "Audio"} Call`,
          body: `Dr. ${doctorRecord.name} initiated a consultation call with you.`,
          type: "call",
          data: {
            type: "incoming_call",
            call_id: newCall.id,
            appointment_id,
            doctor_id: doctorRecord.id,
            call_type,
          },
          read: false,
          created_at: new Date().toISOString(),
        });
      } catch (notifErr) {
        console.warn("[create-doctor-call] Notification record warning:", notifErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        call: newCall,
        doctor: {
          id: doctorRecord.id,
          name: doctorRecord.name,
          department: doctorRecord.department,
        },
        patient: {
          id: appointment.patient_id,
          name: appointment.patient_name,
        },
        patient_devices_alerted: tokensFound,
        push_result: pushResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-doctor-call] Uncaught server error:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
