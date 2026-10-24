import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase.js";
import { saveUserProfile } from "./supabaseService.js";

// Register browser for auth session redirect handling on web
if (Platform.OS === "web") {
  try {
    WebBrowser.maybeCompleteAuthSession();
  } catch (e) {
    // ignore
  }
}

/**
 * Sign up with Email and Password using Supabase Auth
 */
export const signUpWithEmail = async ({ email, password, fullName, phone }) => {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName || "",
          phone: phone || "",
        },
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const user = data?.user;
    if (user) {
      // Save user profile to Supabase 'profiles' table
      await saveUserProfile({
        id: user.id,
        fullName: fullName || user.user_metadata?.full_name || "KMC User",
        email: cleanEmail,
        mobileNumber: phone || "",
      });
    }

    return {
      success: true,
      user,
      session: data?.session,
      message: data?.session
        ? "Account created and signed in successfully!"
        : "Sign up successful! Please check your email for confirmation if required.",
    };
  } catch (err) {
    console.warn("[Auth] Sign up exception:", err.message);
    return { success: false, message: err.message || "Sign up failed" };
  }
};

/**
 * Sign in with Email and Password using Supabase Auth
 */
export const signInWithEmail = async ({ email, password }) => {
  try {
    const cleanEmail = (email || "").trim().toLowerCase();

    // Dedicated Super Administrator credential handler
    if (
      cleanEmail === "superadmin@gmail.com" &&
      (password === "super@007" || password === "Super@007KMC!" || password === "superadmin")
    ) {
      const superAdminUser = {
        id: "4aaf3887-3995-4901-849c-9c190045b50f",
        email: "superadmin@gmail.com",
        user_metadata: {
          full_name: "KMC Super Administrator",
          name: "KMC Super Administrator",
          role: "super_admin",
        },
        app_metadata: {
          role: "super_admin",
        },
        role: "authenticated",
      };
      return {
        success: true,
        user: superAdminUser,
        session: {
          access_token: "super_admin_jwt_session_token",
          user: superAdminUser,
        },
      };
    }

    // Check if this admin account's access has been revoked by Super Admin
    try {
      const revokedRaw = await AsyncStorage.getItem("@kmc_superadmin_revoked_admins");
      const revokedList = revokedRaw ? JSON.parse(revokedRaw) : [];
      if (Array.isArray(revokedList) && revokedList.includes(cleanEmail)) {
        return {
          success: false,
          message: "Access Revoked: Your administrative privileges have been revoked by the Super Administrator. Please contact hospital management.",
        };
      }
    } catch (_) {}

    // Check if this is an admin account created by Super Admin in local storage
    try {
      const adminsRaw = await AsyncStorage.getItem("@kmc_superadmin_admins");
      const adminsList = adminsRaw ? JSON.parse(adminsRaw) : [];
      if (Array.isArray(adminsList)) {
        const matchedCreatedAdmin = adminsList.find((a) => a.email?.toLowerCase() === cleanEmail);
        if (matchedCreatedAdmin) {
          if (matchedCreatedAdmin.status === "revoked") {
            return {
              success: false,
              message: "Access Revoked: Your administrative privileges have been revoked by the Super Administrator.",
            };
          }
          if (matchedCreatedAdmin.password && matchedCreatedAdmin.password === password) {
            const adminUser = {
              id: matchedCreatedAdmin.id,
              email: cleanEmail,
              user_metadata: {
                full_name: matchedCreatedAdmin.full_name,
                name: matchedCreatedAdmin.full_name,
                role: "admin",
              },
              app_metadata: { role: "admin" },
              role: "authenticated",
            };
            return {
              success: true,
              user: adminUser,
              session: {
                access_token: "admin_custom_token_" + Date.now(),
                user: adminUser,
              },
            };
          }
        }
      }
    } catch (_) {}

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    // Double check that an authenticated user isn't in the revoked list
    try {
      const revokedRaw = await AsyncStorage.getItem("@kmc_superadmin_revoked_admins");
      const revokedList = revokedRaw ? JSON.parse(revokedRaw) : [];
      if (Array.isArray(revokedList) && revokedList.includes(cleanEmail)) {
        await supabase.auth.signOut().catch(() => {});
        return {
          success: false,
          message: "Access Revoked: Your administrative privileges have been revoked by the Super Administrator.",
        };
      }
    } catch (_) {}

    return {
      success: true,
      user: data.user,
      session: data.session,
    };
  } catch (err) {
    console.warn("[Auth] Sign in exception:", err.message);
    return { success: false, message: err.message || "Sign in failed" };
  }
};

/**
 * Sign in with Google OAuth via Supabase
 */
export const signInWithGoogle = async () => {
  try {
    if (Platform.OS === "web") {
      const redirectUrl = typeof window !== "undefined" ? window.location.origin : undefined;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      return { success: true, data };
    }

    // Native Mobile (Expo iOS & Android)
    const redirectTo = makeRedirectUri({
      scheme: "kmchospital",
      path: "auth/callback",
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    if (!data?.url) {
      throw new Error("No authorization URL returned from Supabase");
    }

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

    if (res.type === "success" && res.url) {
      let params = {};
      try {
        const parsed = QueryParams.getQueryParams(res.url);
        if (parsed?.params) params = { ...params, ...parsed.params };
        if (parsed?.errorCode) throw new Error(parsed.errorCode);
      } catch (_) {}

      // Fallback manual extractor for hash fragments (#access_token=...) or queries (?code=...)
      try {
        const urlStr = res.url;
        const qIdx = urlStr.indexOf("?");
        const hIdx = urlStr.indexOf("#");
        if (qIdx !== -1) {
          const qPart = hIdx !== -1 && hIdx > qIdx ? urlStr.substring(qIdx + 1, hIdx) : urlStr.substring(qIdx + 1);
          new URLSearchParams(qPart).forEach((v, k) => {
            if (!params[k]) params[k] = v;
          });
        }
        if (hIdx !== -1) {
          const hPart = urlStr.substring(hIdx + 1);
          new URLSearchParams(hPart).forEach((v, k) => {
            if (!params[k]) params[k] = v;
          });
        }
      } catch (_) {}

      // 1. Handle PKCE Code Flow
      if (params.code) {
        const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (sessionError) throw sessionError;
        return {
          success: true,
          user: sessionData?.user,
          session: sessionData?.session,
        };
      }

      // 2. Handle Implicit Token Flow
      const { access_token, refresh_token } = params;
      if (access_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || "",
        });
        if (sessionError) throw sessionError;

        return {
          success: true,
          user: sessionData?.user,
          session: sessionData?.session,
        };
      }
    }

    return { success: false, message: "Google Sign In was cancelled" };
  } catch (err) {
    console.warn("[Auth] Google Sign In exception:", err.message);
    return { success: false, message: err.message || "Google Sign In failed" };
  }
};

/**
 * Sign out user
 */
export const signOutUser = async () => {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (err) {
    console.warn("[Auth] Sign out error:", err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Get active session
 */
export const getCurrentSession = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session || null;
  } catch (e) {
    return null;
  }
};

/**
 * Request Password Reset with role security checks
 * Only patient accounts can request password resets.
 * Doctor and Admin accounts are blocked with official hospital support notices.
 */
export const requestPasswordReset = async (email) => {
  try {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, message: "Please enter a valid email address." };
    }

    // 1. Backend Security Check via RPC
    try {
      const { data: checkData, error: checkErr } = await supabase.rpc(
        "check_password_reset_eligibility",
        { p_email: cleanEmail }
      );

      if (!checkErr && checkData && checkData.allowed === false) {
        return {
          success: false,
          restricted: true,
          reason: checkData.reason,
          message: checkData.message,
        };
      }
    } catch (rpcEx) {
      console.warn("[Auth] check_password_reset_eligibility RPC fallback:", rpcEx.message);
    }

    // 2. Client-side double check in doctors table and profiles table
    if (cleanEmail === "techxitservices65@gmail.com") {
      return {
        success: false,
        restricted: true,
        reason: "admin",
        message: "Password reset is not available for administrator accounts. Please contact the system administrator.",
      };
    }

    try {
      const { data: docData } = await supabase
        .from("doctors")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (docData) {
        return {
          success: false,
          restricted: true,
          reason: "doctor",
          message: "Password reset is not available for doctor accounts. Please contact the hospital administrator.",
        };
      }

      const { data: profData } = await supabase
        .from("profiles")
        .select("role")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (profData?.role === "doctor") {
        return {
          success: false,
          restricted: true,
          reason: "doctor",
          message: "Password reset is not available for doctor accounts. Please contact the hospital administrator.",
        };
      } else if (profData?.role === "admin") {
        return {
          success: false,
          restricted: true,
          reason: "admin",
          message: "Password reset is not available for administrator accounts. Please contact the system administrator.",
        };
      }
    } catch (queryEx) {
      // ignore
    }

    // 3. Initiate standard Supabase password reset for patient
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (resetErr) {
      return { success: false, message: resetErr.message || "Failed to send reset link." };
    }

    return {
      success: true,
      message: "Password reset link has been sent to your email.",
    };
  } catch (err) {
    console.warn("[Auth] Password reset exception:", err.message);
    return { success: false, message: err.message || "An unexpected error occurred." };
  }
};

