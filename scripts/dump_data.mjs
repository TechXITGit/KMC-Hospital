import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhxsiueizpzreoxfrbuy.supabase.co";
const supabaseAnonKey = "sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspectProfiles() {
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: "techxitservices65@gmail.com",
    password: "techxit@007",
  });
  if (error) {
    console.error("Auth error:", error);
    return;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${auth.session.access_token}` } }
  });

  const { data: profiles, error: pErr } = await client.from("profiles").select("*");
  console.log("=== ALL PROFILES ===");
  console.log(JSON.stringify(profiles, null, 2));

  const { data: apts, error: aErr } = await client.from("appointments").select("*");
  console.log("=== ALL APPOINTMENTS ===");
  console.log(JSON.stringify(apts, null, 2));
}

inspectProfiles();
