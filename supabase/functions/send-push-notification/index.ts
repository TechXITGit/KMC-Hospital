import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

serve(async (req: Request) => {
  // 1. Handle CORS preflight
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
        JSON.stringify({ error: "Missing server configuration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Authorize Caller
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let isServiceRoleCall = token === supabaseServiceKey;
    let callerUser: { id: string; email?: string } | null = null;
    let isCallerAdmin = false;

    if (!isServiceRoleCall) {
      const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const {
        data: { user },
        error: userErr,
      } = await callerClient.auth.getUser();

      if (userErr || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid session token" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      callerUser = user;
      const callerEmail = (user.email || "").toLowerCase().trim();
      const isRootAdmin = callerEmail === "techxitservices65@gmail.com";

      // Check admin status in profiles
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: profile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      isCallerAdmin = isRootAdmin || profile?.role === "admin";
    }

    // 3. Parse and Validate Request Payload
    const body: PushNotificationPayload = await req.json().catch(() => ({}));
    const { title, body: messageBody, data = {}, sound = "default", channelId = "default", priority = "high" } = body;

    if (!title || !messageBody) {
      return new Response(
        JSON.stringify({ error: "Validation Error: 'title' and 'body' are required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine target users
    let targetUserIds: string[] = [];
    if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
      targetUserIds = body.user_ids;
    } else if (body.user_id) {
      targetUserIds = [body.user_id];
    } else if (callerUser) {
      // Default to caller themselves if no target specified
      targetUserIds = [callerUser.id];
    }

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Validation Error: target 'user_id' or 'user_ids' required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security Check: Non-admins can only send notifications to their own user_id
    if (!isServiceRoleCall && !isCallerAdmin && callerUser) {
      const unauthorizedTargets = targetUserIds.filter((id) => id !== callerUser.id);
      if (unauthorizedTargets.length > 0) {
        return new Response(
          JSON.stringify({
            error: "Forbidden: Regular users may only trigger test notifications for their own account",
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Privileged Supabase Client
    const adminDb = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Record in public.notifications (In-App Notification History)
    const notificationInserts = targetUserIds.map((uid) => ({
      user_id: uid,
      title,
      body: messageBody,
      type: (data && data.type) || "general",
      data,
      read: false,
      created_at: new Date().toISOString(),
    }));

    try {
      await adminDb.from("notifications").insert(notificationInserts);
    } catch (insertErr) {
      console.warn("[send-push-notification] Warning recording in-app notification:", insertErr);
    }

    // 5. Fetch Active Push Tokens for Target Users
    const { data: activeTokens, error: tokenErr } = await adminDb
      .from("push_tokens")
      .select("id, user_id, expo_push_token, platform")
      .in("user_id", targetUserIds)
      .eq("active", true);

    if (tokenErr) {
      console.error("[send-push-notification] Error querying push_tokens:", tokenErr);
      return new Response(
        JSON.stringify({ error: "Failed to query active push tokens", details: tokenErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!activeTokens || activeTokens.length === 0) {
      console.log(`[send-push-notification] No active push tokens found for users: ${targetUserIds.join(", ")}`);
      return new Response(
        JSON.stringify({
          success: true,
          sent_count: 0,
          active_devices_found: 0,
          target_users: targetUserIds.length,
          message: "Notification recorded in-app, but target user(s) have no active push tokens registered.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Build Expo Push Payload
    // Expo Push API accepts batch arrays up to 100 messages
    const expoMessages = activeTokens.map((t) => ({
      to: t.expo_push_token,
      title,
      body: messageBody,
      data: {
        ...data,
        notification_title: title,
        timestamp: new Date().toISOString(),
      },
      sound,
      channelId,
      priority,
    }));

    // 7. Send Request to Expo Push Service
    const expoHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };

    if (expoAccessToken) {
      expoHeaders["Authorization"] = `Bearer ${expoAccessToken}`;
    }

    const expoResponse = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: expoHeaders,
      body: JSON.stringify(expoMessages),
    });

    const expoResult = await expoResponse.json().catch(() => null);

    if (!expoResponse.ok) {
      console.error("[send-push-notification] Expo Push Service HTTP error:", expoResponse.status, expoResult);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Expo Push Service returned an error",
          status: expoResponse.status,
          details: expoResult,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Process Delivery Tickets & Handle Inactive / Dead Tokens
    // Format of expoResult: { data: [ { status: 'ok', id: '...' }, { status: 'error', message: '...', details: { error: 'DeviceNotRegistered' } } ] }
    const tickets = Array.isArray(expoResult?.data) ? expoResult.data : [];
    const deadTokens: string[] = [];
    let successCount = 0;
    let failureCount = 0;

    tickets.forEach((ticket: any, idx: number) => {
      const associatedToken = activeTokens[idx];
      if (ticket.status === "ok") {
        successCount++;
      } else {
        failureCount++;
        console.warn(`[send-push-notification] Delivery failed for token: ${associatedToken?.expo_push_token}`, ticket);
        if (ticket.details?.error === "DeviceNotRegistered") {
          deadTokens.push(associatedToken?.expo_push_token);
        }
      }
    });

    // Automatically deactivate tokens that Expo reported as unregistered
    if (deadTokens.length > 0) {
      console.log(`[send-push-notification] Deactivating ${deadTokens.length} unregistered device token(s)`);
      await adminDb
        .from("push_tokens")
        .update({ active: false, updated_at: new Date().toISOString() })
        .in("expo_push_token", deadTokens);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: successCount,
        failed_count: failureCount,
        active_devices_found: activeTokens.length,
        unregistered_tokens_deactivated: deadTokens.length,
        tickets,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[send-push-notification] Uncaught error:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
