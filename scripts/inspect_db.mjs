import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhxsiueizpzreoxfrbuy.supabase.co";
const supabaseAnonKey = "sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("=== 1. Attempting login as techxitservices65@gmail.com ===");
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: "techxitservices65@gmail.com",
    password: "techxit@007",
  });
  if (adminErr) {
    console.log("Login techxitservices65 failed:", adminErr.message);
  } else {
    console.log("Login techxitservices65 SUCCESS! User id:", adminAuth.user?.id);
    console.log("User metadata:", adminAuth.user?.user_metadata);
    
    // Now with adminAuth session, let's query profiles:
    const adminClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${adminAuth.session.access_token}` } }
    });
    
    const { data: adminProfiles, error: pErr } = await adminClient.from("profiles").select("*");
    console.log("Profiles queried with admin token:", adminProfiles?.length, "Error:", pErr?.message);
    if (adminProfiles) {
      console.log("Roles found in profiles:", adminProfiles.map(p => ({ id: p.id, email: p.email, role: p.role, name: p.full_name || p.name })));
    }
  }

  console.log("\n=== 2. Check profiles with anon client ===");
  const { data: anonProfiles, error: anonErr } = await supabase.from("profiles").select("*");
  console.log("Anon profiles count:", anonProfiles?.length, "Error:", anonErr?.message);

  console.log("\n=== 3. Check appointments ===");
  const { data: apts, error: aptErr } = await supabase.from("appointments").select("*");
  console.log("Appointments count:", apts?.length, "Error:", aptErr?.message);
  if (apts && apts.length > 0) {
    console.log("Sample appointment:", apts[0]);
  }

  console.log("\n=== 4. Check calls ===");
  const { data: calls, error: callErr } = await supabase.from("calls").select("*");
  console.log("Calls count:", calls?.length, "Error:", callErr?.message);
  if (calls && calls.length > 0) {
    console.log("Sample call:", calls[0]);
  }

  console.log("\n=== 5. Check doctors ===");
  const { data: docs, error: docErr } = await supabase.from("doctors").select("id, name, is_online, auth_user_id");
  console.log("Doctors count:", docs?.length, "Online doctors:", docs?.filter(d => d.is_online));
}

inspect();
