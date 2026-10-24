import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhxsiueizpzreoxfrbuy.supabase.co";
const supabaseAnonKey = "sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateAdminProfile() {
  const { data: auth, error } = await supabase.auth.signInWithPassword({
    email: "techxitservices65@gmail.com",
    password: "techxit@007",
  });
  if (error) {
    console.error("Auth error:", error);
    return;
  }

  // Update profile full_name to Tech X Hospital Admin
  const { data, error: uErr } = await supabase
    .from("profiles")
    .update({
      full_name: "Tech X Hospital Admin",
      name: "Tech X Hospital Admin",
      role: "admin",
      phone: "+91 8303666400",
    })
    .eq("email", "techxitservices65@gmail.com")
    .select();

  console.log("Updated admin profile in Supabase DB:", data, "Error:", uErr);
}

updateAdminProfile();
