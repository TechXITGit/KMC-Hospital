import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhxsiueizpzreoxfrbuy.supabase.co";
const supabaseAnonKey = "sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAdminAccess() {
  // Sign in with techxitservices65@gmail.com
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "techxitservices65@gmail.com",
    password: "techxit@007",
  });
  console.log("Sign in error:", error);
  console.log("Token:", data?.session?.access_token ? "GOT REAL JWT" : "NO TOKEN");

  // Now query profiles directly with the supabase client (session is active on client!)
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, full_name, email, role");
  console.log("Profiles with authenticated session:", profiles?.length, profiles);

  // Now query appointments:
  const { data: apts, error: aErr } = await supabase
    .from("appointments")
    .select("id, token_number, patient_name, doctor_name, appointment_date, status");
  console.log("Appointments with authenticated session:", apts?.length, apts);
}

testAdminAccess();
