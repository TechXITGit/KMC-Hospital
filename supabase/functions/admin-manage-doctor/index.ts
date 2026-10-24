import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authenticate the caller
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
        JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Privileged Admin Client (service_role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Verify caller has 'admin' role in public.profiles
    const isRootAdmin = callerUser.email?.toLowerCase() === "techxitservices65@gmail.com";

    const { data: callerProfile, error: profErr } = await adminClient
      .from("profiles")
      .select("id, role, email")
      .eq("id", callerUser.id)
      .maybeSingle();

    if (!isRootAdmin && (profErr || !callerProfile || callerProfile.role !== "admin")) {
      console.warn(`[admin-manage-doctor] Access denied for user ${callerUser.id}. Role: ${callerProfile?.role}`);
      return new Response(
        JSON.stringify({
          error: "Forbidden: You do not have administrator permissions to manage hospital doctors.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (isRootAdmin && callerProfile?.role !== "admin") {
      try {
        await adminClient.from("profiles").upsert(
          { id: callerUser.id, role: "admin", email: callerUser.email, updated_at: new Date().toISOString() },
          { onConflict: "id" }
        );
      } catch (upsertErr) {
        console.warn("[admin-manage-doctor] auto-heal admin profile warning:", upsertErr);
      }
    }

    // 3. Parse Action and Payload
    const body = await req.json();
    const { action } = body;

    console.log(`[admin-manage-doctor] Admin ${callerUser.email} requested action: ${action}`);

    // ACTION: INVITE OR LINK DOCTOR
    if (action === "invite_doctor") {
      const {
        doctorId,
        name,
        email,
        phone,
        department,
        specialization,
        qualification,
        experience,
        consultationFee,
        bio,
        clinicName,
        password,
      } = body;

      const cleanEmail = (email || "").trim().toLowerCase();
      if (!cleanEmail) {
        return new Response(
          JSON.stringify({ error: "Doctor email address is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check existing doctor record
      let targetDoctorId = doctorId;
      let existingDoctor = null;

      if (targetDoctorId) {
        const { data: doc } = await adminClient
          .from("doctors")
          .select("*")
          .eq("id", targetDoctorId)
          .maybeSingle();
        existingDoctor = doc;
      }

      if (!existingDoctor) {
        // Search by email or name
        const { data: docByEmail } = await adminClient
          .from("doctors")
          .select("*")
          .eq("email", cleanEmail)
          .maybeSingle();
        existingDoctor = docByEmail;
        if (existingDoctor) targetDoctorId = existingDoctor.id;
      }

      // If doctor still doesn't exist, create hospital doctor record first
      if (!existingDoctor) {
        targetDoctorId = targetDoctorId || `doc_${Date.now()}`;
        const newDocPayload = {
          id: targetDoctorId,
          name: name || "KMC Doctor",
          email: cleanEmail,
          phone: phone || "",
          department: department || "General Medicine",
          specialization: specialization || "Consultant",
          qualification: qualification || "MBBS",
          experience: experience || "5+ Yrs",
          consultation_fee: Number(consultationFee || 800),
          bio: bio || "",
          clinic_name: clinicName || "KMC Hospital, Jankipuram, Lucknow",
          active: true,
          verification_status: "verified",
          invitation_status: "invited",
          invited_at: new Date().toISOString(),
        };

        const { data: createdDoc, error: createDocErr } = await adminClient
          .from("doctors")
          .insert(newDocPayload)
          .select()
          .single();

        if (createDocErr) {
          return new Response(
            JSON.stringify({ error: `Failed to create doctor record: ${createDocErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        existingDoctor = createdDoc;
      }

      // Check if Auth user already exists
      let authUserId = existingDoctor.auth_user_id;
      const effectivePassword = (password && password.trim()) || `KMCdoc#${Math.floor(100000 + Math.random() * 900000)}`;
      let inviteLink: string | null = null;

      if (!authUserId) {
        const { data: newAuthUser, error: authErr } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          password: effectivePassword,
          email_confirm: true,
          user_metadata: {
            full_name: existingDoctor.name || name,
            name: existingDoctor.name || name,
            role: "doctor",
            doctor_id: targetDoctorId,
          },
        });

        if (authErr) {
          // If already registered, find user by email
          if (authErr.message?.includes("already been registered") || authErr.message?.includes("duplicate")) {
            // First check listUsers
            try {
              const { data: usersList } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
              const matchedUser = usersList?.users?.find((u: any) => u.email?.toLowerCase() === cleanEmail);
              if (matchedUser) {
                authUserId = matchedUser.id;
              }
            } catch (e) {
              console.warn("[admin-manage-doctor] listUsers error:", e);
            }

            if (!authUserId) {
              const { data: existingProf } = await adminClient
                .from("profiles")
                .select("id")
                .eq("email", cleanEmail)
                .maybeSingle();

              if (existingProf?.id) {
                authUserId = existingProf.id;
              }
            }

            if (!authUserId) {
              return new Response(
                JSON.stringify({ error: `Auth account exists for ${cleanEmail}, but UUID could not be resolved: ${authErr.message}` }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }

            // CRITICAL FIX: ALWAYS apply effectivePassword and confirm email
            await adminClient.auth.admin.updateUserById(authUserId, {
              password: effectivePassword,
              email_confirm: true,
            });
          } else {
            return new Response(
              JSON.stringify({ error: `Failed to create auth account: ${authErr.message}` }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (newAuthUser?.user) {
          authUserId = newAuthUser.user.id;
        }
      } else if (authUserId) {
        // Doctor was already linked; ensure password and confirmation are up to date
        await adminClient.auth.admin.updateUserById(authUserId, {
          password: effectivePassword,
          email_confirm: true,
        });
      }

      // Try generating magiclink / recovery action link
      try {
        const { data: linkData } = await adminClient.auth.admin.generateLink({
          type: "magiclink",
          email: cleanEmail,
        });
        inviteLink = linkData?.properties?.action_link || null;
      } catch (linkErr) {
        console.warn("[admin-manage-doctor] generateLink note:", linkErr);
      }

      // Upsert profile with 'doctor' role & update user metadata
      if (authUserId) {
        await adminClient.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            full_name: existingDoctor.name || name,
            name: existingDoctor.name || name,
            role: "doctor",
            doctor_id: targetDoctorId,
          },
        });

        await adminClient.from("profiles").upsert(
          {
            id: authUserId,
            email: cleanEmail,
            full_name: existingDoctor.name || name,
            name: existingDoctor.name || name,
            phone: phone || existingDoctor.phone || "",
            role: "doctor",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        // Link auth_user_id to doctor record
        const { data: updatedDoc, error: updateErr } = await adminClient
          .from("doctors")
          .update({
            auth_user_id: authUserId,
            email: cleanEmail,
            phone: phone || existingDoctor.phone || "",
            active: true,
            verification_status: "verified",
            invitation_status: "accepted",
            verified_at: new Date().toISOString(),
          })
          .eq("id", targetDoctorId)
          .select()
          .single();

        if (updateErr) {
          return new Response(
            JSON.stringify({ error: `Failed to link doctor record: ${updateErr.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: `Dr. ${existingDoctor.name} credentials configured and authorized successfully.`,
            doctor: updatedDoc,
            auth_user_id: authUserId,
            tempPassword: effectivePassword,
            inviteLink,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Could not establish auth credentials for doctor." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: ADD HOSPITAL DOCTOR (WITHOUT IMMEDIATE AUTH INVITE)
    if (action === "add_doctor") {
      const {
        name,
        email,
        phone,
        department,
        specialization,
        qualification,
        experience,
        consultationFee,
        bio,
        clinicName,
      } = body;

      if (!name || !name.trim()) {
        return new Response(
          JSON.stringify({ error: "Doctor name is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanEmail = (email || "").trim().toLowerCase();
      const targetDoctorId = `doc_${Date.now()}`;
      const newDocPayload = {
        id: targetDoctorId,
        name: name.trim(),
        email: cleanEmail || null,
        phone: phone ? phone.trim() : "",
        department: department || "General Medicine",
        specialization: specialization || "Consultant",
        qualification: qualification || "MBBS",
        experience: experience || "5+ Yrs",
        consultation_fee: Number(consultationFee || 800),
        bio: bio || "",
        clinic_name: clinicName || "KMC Hospital, Jankipuram, Lucknow",
        active: true,
        verification_status: "verified",
        invitation_status: "uninvited",
        auth_user_id: null,
      };

      const { data: createdDoc, error: createDocErr } = await adminClient
        .from("doctors")
        .insert(newDocPayload)
        .select()
        .single();

      if (createDocErr) {
        return new Response(
          JSON.stringify({ error: `Failed to add doctor: ${createDocErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Dr. ${createdDoc.name} added to hospital doctor directory.`,
          doctor: createdDoc,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: TOGGLE ACTIVE / SUSPEND
    if (action === "toggle_active") {
      const { doctorId, active } = body;
      if (!doctorId) {
        return new Response(
          JSON.stringify({ error: "doctorId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newActive = Boolean(active);
      const verificationStatus = newActive ? "verified" : "suspended";

      const { data: updatedDoc, error: toggleErr } = await adminClient
        .from("doctors")
        .update({
          active: newActive,
          verification_status: verificationStatus,
        })
        .eq("id", doctorId)
        .select()
        .single();

      if (toggleErr) {
        return new Response(
          JSON.stringify({ error: toggleErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Doctor status updated to ${newActive ? "Active" : "Suspended"}.`,
          doctor: updatedDoc,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: UPDATE DOCTOR
    if (action === "update_doctor") {
      const { doctorId, updateData } = body;
      if (!doctorId || !updateData) {
        return new Response(
          JSON.stringify({ error: "doctorId and updateData are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allowedFields = [
        "name",
        "department",
        "specialization",
        "qualification",
        "experience",
        "consultation_fee",
        "bio",
        "clinic_name",
        "phone",
        "email",
        "active",
        "verification_status",
      ];

      const safePayload: Record<string, any> = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          safePayload[field] = updateData[field];
        }
      }

      const { data: updatedDoc, error: updateErr } = await adminClient
        .from("doctors")
        .update(safePayload)
        .eq("id", doctorId)
        .select()
        .single();

      if (updateErr) {
        return new Response(
          JSON.stringify({ error: updateErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Doctor details updated successfully.",
          doctor: updatedDoc,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: RESET PASSWORD FOR DOCTOR
    if (action === "reset_password") {
      const { doctorId, newPassword } = body;
      if (!doctorId || !newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "doctorId and newPassword (min 6 chars) are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: doc } = await adminClient
        .from("doctors")
        .select("id, name, email, auth_user_id")
        .eq("id", doctorId)
        .single();

      if (!doc?.auth_user_id) {
        return new Response(
          JSON.stringify({ error: "This doctor does not have an active login account yet." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: resetErr } = await adminClient.auth.admin.updateUserById(doc.auth_user_id, {
        password: newPassword,
        email_confirm: true,
      });

      if (resetErr) {
        return new Response(
          JSON.stringify({ error: `Failed to reset password: ${resetErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Password updated successfully for Dr. ${doc.name}.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: VERIFY DOCTOR
    if (action === "verify_doctor") {
      const { doctorId } = body;
      if (!doctorId) {
        return new Response(
          JSON.stringify({ error: "doctorId is required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: updatedDoc, error: verErr } = await adminClient
        .from("doctors")
        .update({
          verification_status: "verified",
          verified_at: new Date().toISOString(),
          active: true,
        })
        .eq("id", doctorId)
        .select()
        .single();

      if (verErr) {
        return new Response(
          JSON.stringify({ error: verErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Dr. ${updatedDoc.name} marked as verified.`,
          doctor: updatedDoc,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: MANAGE DOCTOR AVAILABILITY
    if (action === "manage_availability") {
      const { doctorId, availability } = body;
      if (!doctorId || !Array.isArray(availability)) {
        return new Response(
          JSON.stringify({ error: "doctorId and availability array are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await adminClient.from("doctor_availability").delete().eq("doctor_id", doctorId);

      const rows = availability.map((item: any) => ({
        doctor_id: doctorId,
        day_of_week: item.day_of_week || item.day || "Mon",
        start_time: item.start_time || "09:00 AM",
        end_time: item.end_time || "02:00 PM",
        is_available: item.is_available !== false,
      }));

      if (rows.length > 0) {
        const { error: insErr } = await adminClient.from("doctor_availability").insert(rows);
        if (insErr) {
          return new Response(
            JSON.stringify({ error: insErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Doctor schedule updated successfully.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[admin-manage-doctor] Unhandled exception:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
