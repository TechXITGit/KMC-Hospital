import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://fhxsiueizpzreoxfrbuy.supabase.co";
const supabaseAnonKey = "sb_publishable_lQ1ojl6Ma5j71ipa72wVvw_eU0sbFa5";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSuperAdminPass() {
  const passwords = ["super@007", "Super@007!", "Super@007KMC!", "superadmin", "techxit@007", "123456", "admin123", "SuperAdmin@007"];
  for (const pw of passwords) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "superadmin@gmail.com",
      password: pw,
    });
    if (!error) {
      console.log("MATCH FOUND! Password for superadmin@gmail.com is:", pw);
      return;
    } else {
      console.log(`Password "${pw}" failed:`, error.message);
    }
  }
}

testSuperAdminPass();
