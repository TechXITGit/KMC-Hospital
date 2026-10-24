import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhxsiueizpzreoxfrbuy.supabase.co";
const supabaseAnonKey = "sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  console.log("Profiles error:", pErr);
  console.log("Profiles columns:", profiles ? Object.keys(profiles[0] || {}) : "none");
  console.log("All profiles:", profiles);

  // Also check admins fetch query:
  const { data: admins, error: aErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin");
  console.log("Admins query error:", aErr, "count:", admins?.length, admins);

  // Check patients query:
  const { data: patients, error: patErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "patient");
  console.log("Patients query error:", patErr, "count:", patients?.length, patients);

  // Check all appointments:
  const { data: apts, error: aptErr } = await supabase.from("appointments").select("id, token_number, doctor_name, patient_name, appointment_date, appointment_time, status, type");
  console.log("Appointments error:", aptErr, "count:", apts?.length, apts);
}

check();
