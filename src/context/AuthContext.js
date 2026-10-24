import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../utils/supabase";
import {
  signUpWithEmail,
  signInWithEmail,
  signInWithGoogle as googleOAuthService,
  signOutUser,
  requestPasswordReset,
} from "../services/authService";
import { getUserProfile, saveUserProfile } from "../services/supabaseService";
import {
  registerAndSaveUserPushToken,
  savePushTokenToSupabase,
  deactivateCurrentPushToken,
  addPushTokenListener,
} from "../services/notificationService";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [userRole, setUserRole] = useState("patient"); // "patient" | "doctor" | "admin" | "super_admin"
  const [doctorRecord, setDoctorRecord] = useState(null);
  const [isDoctorSuspended, setIsDoctorSuspended] = useState(false);
  const [isDoctorVerified, setIsDoctorVerified] = useState(false);
  const [isDoctorLinked, setIsDoctorLinked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const userRef = React.useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Backward compatibility fields
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [authType, setAuthType] = useState("email");
  const [authIdentifier, setAuthIdentifier] = useState("");
  const [isPhoneVerified, setIsPhoneVerified] = useState(true);

  const syncPromiseRef = React.useRef(null);

  // Sync profile data and verified server role from Supabase
  const syncProfile = async (activeUser) => {
    if (!activeUser) return null;
    if (syncPromiseRef.current) {
      return syncPromiseRef.current;
    }

    const syncJob = (async () => {
      try {
        const emailVal = (activeUser.email || "").toLowerCase().trim();
        const idVal = activeUser.id;
        const meta = activeUser.user_metadata || {};

        let verifiedRole = "patient";
        let matchedDoctor = null;
        let suspended = false;
        let verified = false;
        let linked = false;
        let dbProfile = null;

        // 1. Primary: Server-side get_my_role RPC (source of truth)
        try {
          const { data: roleData, error: roleErr } = await supabase.rpc("get_my_role");
          if (!roleErr && roleData && roleData.authenticated) {
            verifiedRole = roleData.role || "patient";
            dbProfile = roleData.profile || null;

            if (verifiedRole === "doctor") {
              if (!roleData.unlinked && roleData.doctor_id) {
                linked = true;
                verified = roleData.verification_status === "verified";
                suspended = roleData.active === false || roleData.verification_status === "suspended";
                matchedDoctor = {
                  id: roleData.doctor_id,
                  name: roleData.doctor_name,
                  department: roleData.department,
                  specialization: roleData.specialization,
                  email: roleData.email,
                  active: roleData.active,
                  verification_status: roleData.verification_status,
                  auth_user_id: idVal,
                };
              } else {
                linked = false;
                verified = false;
                suspended = false;
                matchedDoctor = null;
              }
            }
          } else {
            // Fallback if RPC temporarily unavailable
            const prof = await getUserProfile(idVal) || (emailVal ? await getUserProfile(emailVal) : null);
            dbProfile = prof;
            verifiedRole = prof?.role || meta.role || "patient";

            if (verifiedRole === "doctor") {
              const { data: docData } = await supabase
                .from("doctors")
                .select("*")
                .eq("auth_user_id", idVal)
                .maybeSingle();

              if (docData) {
                matchedDoctor = docData;
                linked = true;
                verified = docData.verification_status === "verified";
                suspended = docData.active === false || docData.verification_status === "suspended";
              }
            }
          }
        } catch (rpcEx) {
          console.warn("[Auth] get_my_role RPC exception:", rpcEx.message);
        }

        // Super Administrator guarantee
        if (emailVal === "superadmin@gmail.com" || meta.role === "super_admin" || dbProfile?.role === "super_admin") {
          verifiedRole = "super_admin";
          // Self-heal profiles row for super_admin
          supabase
            .from("profiles")
            .upsert({
              id: idVal,
              email: emailVal,
              role: "super_admin",
              full_name: dbProfile?.full_name || meta.full_name || "KMC Super Administrator",
              updated_at: new Date().toISOString(),
            }, { onConflict: "id" })
            .then(() => {});
        } else if (emailVal === "techxitservices65@gmail.com") {
          let isRevoked = false;
          try {
            const revokedRaw = await AsyncStorage.getItem("@kmc_superadmin_revoked_admins");
            const revokedList = revokedRaw ? JSON.parse(revokedRaw) : [];
            isRevoked = Array.isArray(revokedList) && revokedList.includes("techxitservices65@gmail.com");
          } catch (_) {}

          if (isRevoked) {
            verifiedRole = "patient";
          } else {
            // Root hospital administrator guarantee
            verifiedRole = "admin";
            // Self-heal profiles row so id = auth UUID and role = 'admin'
            supabase
              .from("profiles")
              .upsert({
                id: idVal,
                email: emailVal,
                role: "admin",
                full_name: dbProfile?.full_name || meta.full_name || meta.name || "Hospital Admin",
                updated_at: new Date().toISOString(),
              }, { onConflict: "id" })
              .then(() => {});
          }
        }

        // Global check: if verifiedRole is admin but in revoked list, demote
        if (verifiedRole === "admin") {
          try {
            const revokedRaw = await AsyncStorage.getItem("@kmc_superadmin_revoked_admins");
            const revokedList = revokedRaw ? JSON.parse(revokedRaw) : [];
            if (Array.isArray(revokedList) && revokedList.includes(emailVal)) {
              verifiedRole = "patient";
            }
          } catch (_) {}
        }

        if (!["patient", "doctor", "admin", "super_admin"].includes(verifiedRole)) {
          verifiedRole = "patient";
        }

        const mergedProfile = {
          id: idVal,
          fullName:
            dbProfile?.full_name ||
            meta.full_name ||
            meta.name ||
            (verifiedRole === "doctor" && matchedDoctor ? matchedDoctor.name : "KMC User"),
          email: emailVal,
          mobileNumber: dbProfile?.phone || matchedDoctor?.phone || meta.phone || "",
          gender: dbProfile?.gender || "Male",
          dob: dbProfile?.dob || "",
          bloodGroup: dbProfile?.blood_group || "B+",
          emergencyContact: dbProfile?.emergency_contact || "",
          role: verifiedRole,
          authType: "supabase",
          authIdentifier: emailVal || idVal,
        };

        setProfile(mergedProfile);
        setUserRole(verifiedRole);
        setDoctorRecord(matchedDoctor);
        setIsDoctorSuspended(suspended);
        setIsDoctorVerified(verified);
        setIsDoctorLinked(linked);
        setEmail(emailVal);
        setPhoneNumber(mergedProfile.mobileNumber);
        setAuthIdentifier(emailVal || idVal);

        await AsyncStorage.setItem("@kmc_profile", JSON.stringify(mergedProfile));
        await AsyncStorage.setItem("@kmc_role", verifiedRole);
        if (matchedDoctor) {
          await AsyncStorage.setItem("@kmc_doctor_record", JSON.stringify(matchedDoctor));
        } else {
          await AsyncStorage.removeItem("@kmc_doctor_record");
        }
        await AsyncStorage.setItem("@kmc_authenticated", "true");

        const isDoctorAuthorized =
          verifiedRole === "doctor" &&
          matchedDoctor &&
          matchedDoctor.active === true &&
          verified &&
          linked;

        return {
          profile: mergedProfile,
          role: verifiedRole,
          doctorRecord: matchedDoctor,
          isDoctorAuthorized,
          isDoctorLinked: linked,
          isDoctorSuspended: suspended,
          isDoctorVerified: verified,
        };
      } catch (err) {
        console.warn("[Auth] Profile sync error:", err.message);
        return null;
      } finally {
        syncPromiseRef.current = null;
      }
    })();

    syncPromiseRef.current = syncJob;
    return syncJob;
  };

  // Bootstrap session from Supabase & AsyncStorage
  const bootstrapFromStorage = async () => {
    try {
      const localRole = await AsyncStorage.getItem("@kmc_role");
      const localAuth = await AsyncStorage.getItem("@kmc_authenticated");
      const localProfile = await AsyncStorage.getItem("@kmc_profile");

      if (localAuth === "true" && localRole === "super_admin") {
        const superAdminUser = {
          id: "4aaf3887-3995-4901-849c-9c190045b50f",
          email: "superadmin@gmail.com",
          user_metadata: {
            full_name: "KMC Super Administrator",
            name: "KMC Super Administrator",
            role: "super_admin",
          },
          app_metadata: { role: "super_admin" },
          role: "authenticated",
        };
        const parsed = localProfile
          ? JSON.parse(localProfile)
          : {
              id: superAdminUser.id,
              fullName: "KMC Super Administrator",
              email: "superadmin@gmail.com",
              role: "super_admin",
            };
        setUser(superAdminUser);
        setSession({ access_token: "super_admin_jwt_session_token", user: superAdminUser });
        setProfile(parsed);
        setUserRole("super_admin");
        setIsAuthenticated(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        await syncProfile(data.session.user);
        setIsAuthenticated(true);
        registerAndSaveUserPushToken(data.session.user.id).catch(() => {});
      } else {
        // Fallback: check local storage cache
        const localDoc = await AsyncStorage.getItem("@kmc_doctor_record");

        if (localAuth === "true" && localProfile) {
          const parsed = JSON.parse(localProfile);
          setProfile(parsed);
          setUserRole(localRole || parsed.role || "patient");
          if (localDoc) {
            try {
              const parsedDoc = JSON.parse(localDoc);
              setDoctorRecord(parsedDoc);
              setIsDoctorLinked(Boolean(parsedDoc.auth_user_id));
              setIsDoctorVerified(parsedDoc.verification_status === "verified");
              setIsDoctorSuspended(parsedDoc.active === false || parsedDoc.verification_status === "suspended");
            } catch (e) {}
          }
          setEmail(parsed.email || "");
          setPhoneNumber(parsed.mobileNumber || "");
          setIsAuthenticated(true);
        }
      }
    } catch (e) {
      console.warn("[Auth] Bootstrapping exception:", e.message);
    } finally {
      setIsBootstrapping(false);
    }
  };

  // Listen to Supabase Auth state changes
  useEffect(() => {
    bootstrapFromStorage();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log("[Supabase Auth Event]", event);
      const currentRole = await AsyncStorage.getItem("@kmc_role");
      if (currentRole === "super_admin") {
        // Super Admin session is maintained independently
        return;
      }

      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        await syncProfile(currentSession.user);
        setIsAuthenticated(true);
        registerAndSaveUserPushToken(currentSession.user.id).catch(() => {});
      } else if (event === "SIGNED_OUT") {
        deactivateCurrentPushToken().catch(() => {});
        setSession(null);
        setUser(null);
        setProfile(null);
        setUserRole("patient");
        setDoctorRecord(null);
        setIsDoctorSuspended(false);
        setIsDoctorVerified(false);
        setIsDoctorLinked(false);
        setIsAuthenticated(false);
        await AsyncStorage.multiRemove([
          "@kmc_authenticated",
          "@kmc_profile",
          "@kmc_role",
          "@kmc_doctor_record",
        ]);
      }
    });

    let tokenSub = null;
    try {
      tokenSub = addPushTokenListener((tokenData) => {
        if (userRef.current?.id && tokenData?.data) {
          savePushTokenToSupabase(userRef.current.id, tokenData.data).catch(() => {});
        }
      });
    } catch (err) {
      console.warn("[AuthContext] Push token listener setup skipped:", err?.message || err);
    }

    return () => {
      subscription?.unsubscribe();
      tokenSub?.remove?.();
    };
  }, []);

  // Sign In with Email & Password
  const signIn = async (emailInput, passwordInput, targetRole = null) => {
    const cleanEmail = (emailInput || "").trim().toLowerCase();

    // 1. Direct Super Administrator Bypass
    if (
      cleanEmail === "superadmin@gmail.com" &&
      (passwordInput === "super@007" || passwordInput === "Super@007KMC!" || passwordInput === "superadmin")
    ) {
      await supabase.auth.signOut().catch(() => {});
      const superAdminUser = {
        id: "4aaf3887-3995-4901-849c-9c190045b50f",
        email: "superadmin@gmail.com",
        user_metadata: {
          full_name: "KMC Super Administrator",
          name: "KMC Super Administrator",
          role: "super_admin",
        },
        app_metadata: { role: "super_admin" },
        role: "authenticated",
      };
      const superAdminProfile = {
        id: superAdminUser.id,
        fullName: "KMC Super Administrator",
        email: "superadmin@gmail.com",
        mobileNumber: "+91 8303666400",
        role: "super_admin",
        gender: "Not specified",
        dob: "",
        bloodGroup: "O+",
        authType: "super_admin",
        authIdentifier: "superadmin@gmail.com",
      };

      setUser(superAdminUser);
      setSession({ access_token: "super_admin_jwt_session_token", user: superAdminUser });
      setProfile(superAdminProfile);
      setUserRole("super_admin");
      setDoctorRecord(null);
      setIsDoctorSuspended(false);
      setIsDoctorVerified(false);
      setIsDoctorLinked(false);
      setEmail("superadmin@gmail.com");
      setPhoneNumber("+91 8303666400");
      setAuthIdentifier("superadmin@gmail.com");
      setIsAuthenticated(true);

      await AsyncStorage.setItem("@kmc_profile", JSON.stringify(superAdminProfile));
      await AsyncStorage.setItem("@kmc_role", "super_admin");
      await AsyncStorage.setItem("@kmc_authenticated", "true");
      await AsyncStorage.removeItem("@kmc_doctor_record");

      return {
        success: true,
        user: superAdminUser,
        verifiedRole: "super_admin",
      };
    }

    const res = await signInWithEmail({ email: emailInput, password: passwordInput });
    if (res.success && res.user) {
      setUser(res.user);
      setSession(res.session);
      const syncRes = await syncProfile(res.user);
      const verifiedRole = syncRes?.role || "patient";
      const doc = syncRes?.doctorRecord;

      // Role Verification & Guarding
      if (targetRole === "doctor") {
        if (verifiedRole !== "doctor") {
          await logout();
          return {
            success: false,
            message: "Access Denied: This account is registered as a patient, not an authorized hospital doctor. Please use the Patient Sign In tab.",
          };
        }
        if (!syncRes?.isDoctorLinked || !doc?.auth_user_id) {
          await logout();
          return {
            success: false,
            message: "Doctor Account Not Linked: Your account has not been linked to a hospital doctor profile yet. Please contact hospital administration.",
          };
        }
        if (syncRes?.isDoctorSuspended || doc?.active === false || doc?.verification_status === "suspended") {
          await logout();
          return {
            success: false,
            message: "Doctor Account Suspended: Your doctor account has been suspended by KMC Administration. Please contact administration at +91 8303666400.",
          };
        }
        if (!syncRes?.isDoctorVerified || doc?.verification_status !== "verified") {
          await logout();
          return {
            success: false,
            message: "Doctor Account Pending Verification: Your doctor credentials are under administrative review.",
          };
        }
      } else if (targetRole === "admin") {
        if (verifiedRole !== "admin" && verifiedRole !== "super_admin") {
          await logout();
          return {
            success: false,
            message: "Access Denied: Administrative privileges required. Please use the Patient or Doctor Sign In portal.",
          };
        }
      }

      setIsAuthenticated(true);

      return {
        ...res,
        verifiedRole,
        doctorRecord: doc,
        isDoctorAuthorized: syncRes?.isDoctorAuthorized,
      };
    }
    return res;
  };

  // Sign Up with Email & Password (PATIENTS ONLY)
  const signUp = async ({ email: emailInput, password: passwordInput, fullName, phone }) => {
    const res = await signUpWithEmail({
      email: emailInput,
      password: passwordInput,
      fullName,
      phone,
    });
    if (res.success && res.user) {
      setUser(res.user);
      setSession(res.session);
      if (res.session) {
        setIsAuthenticated(true);
        await syncProfile(res.user);
      }
    }
    return res;
  };

  // Continue with Google
  const signInWithGoogle = async () => {
    const res = await googleOAuthService();
    if (res.success && res.user) {
      setUser(res.user);
      setSession(res.session);
      setIsAuthenticated(true);
      await syncProfile(res.user);
    }
    return res;
  };

  // Save/Create Profile
  const saveProfile = async (profileData) => {
    const activeId = user?.id || profile?.id || email || "user";
    const full = {
      ...profile,
      ...profileData,
      id: activeId,
      email: email || profileData.email || "",
      mobileNumber: phoneNumber || profileData.mobileNumber || "",
      role: userRole || "patient",
    };

    setProfile(full);
    setIsAuthenticated(true);
    await AsyncStorage.setItem("@kmc_profile", JSON.stringify(full));
    await AsyncStorage.setItem("@kmc_authenticated", "true");

    saveUserProfile(full).catch((err) => {
      console.warn("[Auth] Supabase profile sync error:", err.message);
    });

    return full;
  };

  // Update Profile
  const updateProfile = async (updatedFields) => {
    // Exclude role tampering from client update
    const safeUpdates = { ...updatedFields };
    delete safeUpdates.role;

    const baseProfile = profile || {};
    const updated = {
      ...baseProfile,
      ...safeUpdates,
      id: user?.id || baseProfile.id,
      email: user?.email || baseProfile.email || safeUpdates.email,
    };

    setProfile(updated);
    await AsyncStorage.setItem("@kmc_profile", JSON.stringify(updated));

    try {
      const saved = await saveUserProfile(updated);
      if (saved) {
        const finalProfile = { ...updated, ...saved };
        setProfile(finalProfile);
        await AsyncStorage.setItem("@kmc_profile", JSON.stringify(finalProfile));
        return { success: true, profile: finalProfile };
      }
    } catch (err) {
      console.warn("[AuthContext] updateProfile database error:", err?.message || err);
    }

    return { success: true, profile: updated };
  };

  // Explicit helper to re-fetch backend role
  const refreshRole = async () => {
    if (user) {
      return await syncProfile(user);
    }
    return null;
  };

  // Logout
  const logout = async () => {
    try {
      await deactivateCurrentPushToken();
      await signOutUser();
    } catch (e) {
      // ignore
    } finally {
      setIsAuthenticated(false);
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole("patient");
      setDoctorRecord(null);
      setIsDoctorSuspended(false);
      setEmail("");
      setPhoneNumber("");
      await AsyncStorage.multiRemove([
        "@kmc_authenticated",
        "@kmc_profile",
        "@kmc_role",
        "@kmc_doctor_record",
      ]);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        userRole,
        doctorRecord,
        isDoctorSuspended,
        isDoctorVerified,
        isDoctorLinked,
        isDoctorActive: doctorRecord?.active === true,
        isDoctorAuthorized:
          userRole === "doctor" &&
          doctorRecord?.active === true &&
          doctorRecord?.verification_status === "verified" &&
          Boolean(doctorRecord?.auth_user_id),
        isDoctor: userRole === "doctor",
        isAdmin: userRole === "admin" || userRole === "super_admin",
        isSuperAdmin: userRole === "super_admin",
        isPatient: userRole === "patient",
        isAuthenticated,
        isBootstrapping,
        phoneNumber,
        email,
        authType,
        authIdentifier,
        isPhoneVerified,
        signIn,
        signUp,
        signInWithGoogle,
        requestPasswordReset,
        saveProfile,
        updateProfile,
        refreshRole,
        bootstrapFromStorage,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
