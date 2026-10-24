import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import { supabase } from "../utils/supabase";

/**
 * Detect if running inside Expo Go client on Android.
 * SDK 53+ removed remote push notifications from Expo Go Android,
 * requiring a Development Build (npx expo run:android) for push notifications.
 */
export const isExpoGo = (() => {
  try {
    if (typeof isRunningInExpoGo === "function" && isRunningInExpoGo()) {
      return true;
    }
  } catch {}
  try {
    if (Constants?.appOwnership === "expo") return true;
    if (Constants?.executionEnvironment === "storeClient") return true;
  } catch {}
  return false;
})();

export const isExpoGoAndroid = Platform.OS === "android" && isExpoGo;

// Configure how notifications are handled when the app is in the foreground
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.warn("[Notifications] Could not configure notification handler:", e?.message || e);
}

// Cache for current device push token (in memory)
let cachedPushToken = null;

/**
 * Get cached push token for current device
 */
export const getCachedPushToken = () => cachedPushToken;

/**
 * Configure Android notification channels
 */
export const setupNotificationChannelsAsync = async () => {
  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default Notifications",
        description: "General hospital updates and appointment notices",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#0B7A75",
        sound: "default",
      });

      // High priority channel reserved for future doctor-patient audio/video calls
      await Notifications.setNotificationChannelAsync("telehealth-calls", {
        name: "Telehealth Calls & Urgent",
        description: "Incoming doctor-to-patient consultation calls",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 200, 500],
        lightColor: "#D32F2F",
        sound: "default",
      });
    } catch (err) {
      console.warn("[Notifications] Error setting up Android channels:", err?.message || err);
    }
  }
};

/**
 * Request notification permissions and obtain Expo Push Token
 * Graceful fallback: never throws, never crashes
 */
export const registerForPushNotificationsAsync = async () => {
  try {
    // 0. Skip remote push registration on Expo Go Android (removed in SDK 53)
    if (isExpoGoAndroid) {
      console.log(
        "[Notifications] Remote push notifications are disabled in Expo Go Android (SDK 53+). " +
        "Run an Expo Development Build (npx expo run:android) to test remote push notifications."
      );
      return null;
    }

    // 1. Setup Android notification channels first
    await setupNotificationChannelsAsync();

    // 2. Request / Check Permissions
    const settings = await Notifications.getPermissionsAsync();
    let finalStatus = settings.status;

    if (settings.status !== "granted") {
      const request = await Notifications.requestPermissionsAsync();
      finalStatus = request.status;
    }

    if (finalStatus !== "granted") {
      console.log("[Notifications] Permission not granted for push notifications:", finalStatus);
      return null;
    }

    // 3. Resolve EAS Project ID
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    if (!projectId) {
      console.warn(
        "[Notifications] EAS projectId not found in app configuration.\n" +
        "Run 'npx eas-cli init' to configure EAS project, or test with development build."
      );
    }

    // 4. Request Expo Push Token
    const tokenOptions = projectId ? { projectId } : undefined;
    const pushTokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);
    const token = pushTokenData?.data;

    if (token) {
      console.log("[Notifications] Expo Push Token obtained:", token);
      cachedPushToken = token;
      return token;
    }

    return null;
  } catch (err) {
    console.warn(
      "[Notifications] Failed to get Expo push token (expected if running on simulator or unsupported Expo Go Android):",
      err?.message || err
    );
    return null;
  }
};

/**
 * Upsert Expo Push Token to Supabase public.push_tokens
 * Source of truth is the Supabase database.
 * Supports multiple devices per user.
 */
export const savePushTokenToSupabase = async (userId, token) => {
  if (!userId || !token) return false;

  try {
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
    const { error } = await supabase
      .from("push_tokens")
      .upsert(
        {
          user_id: userId,
          expo_push_token: token,
          platform,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "expo_push_token" }
      );

    if (error) {
      console.warn("[Notifications] Error saving push token to Supabase:", error.message);
      return false;
    }

    console.log("[Notifications] Push token successfully registered in Supabase for user:", userId);
    return true;
  } catch (err) {
    console.warn("[Notifications] Exception saving push token:", err?.message || err);
    return false;
  }
};

/**
 * Register push token for authenticated user and persist to Supabase
 */
export const registerAndSaveUserPushToken = async (userId) => {
  if (!userId) return null;
  const token = await registerForPushNotificationsAsync();
  if (token) {
    await savePushTokenToSupabase(userId, token);
  }
  return token;
};

/**
 * Deactivate push token for current device on user logout
 * Does not delete tokens belonging to user's other devices
 */
export const deactivateCurrentPushToken = async (tokenOverride = null) => {
  const tokenToDeactivate = tokenOverride || cachedPushToken;
  if (!tokenToDeactivate) return;

  try {
    const { error } = await supabase
      .from("push_tokens")
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("expo_push_token", tokenToDeactivate);

    if (error) {
      console.warn("[Notifications] Error deactivating push token:", error.message);
    } else {
      console.log("[Notifications] Successfully deactivated push token on logout.");
    }
  } catch (err) {
    console.warn("[Notifications] Exception deactivating push token:", err?.message || err);
  } finally {
    cachedPushToken = null;
  }
};

/**
 * Send a test push notification via the secure Supabase Edge Function
 */
export const sendTestPushNotification = async ({
  userId,
  title = "KMC Hospital Test",
  body = "Push notifications are working successfully.",
  data = { type: "test" },
}) => {
  try {
    const { data: result, error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        user_id: userId,
        title,
        body,
        data,
      },
    });

    if (error) {
      console.warn("[Notifications] Edge Function error sending push notification:", error);
      return { success: false, error: error.message || error };
    }

    return { success: true, result };
  } catch (err) {
    console.warn("[Notifications] Exception invoking send-push-notification:", err);
    return { success: false, error: err?.message || String(err) };
  }
};

/**
 * Listen for Expo push token changes / refresh
 * Gracefully no-ops in Expo Go Android to prevent runtime crash
 */
export const addPushTokenListener = (listener) => {
  if (isExpoGoAndroid) {
    return { remove: () => {} };
  }
  try {
    return Notifications.addPushTokenListener((tokenData) => {
      if (tokenData?.data) {
        cachedPushToken = tokenData.data;
      }
      if (typeof listener === "function") {
        listener(tokenData);
      }
    });
  } catch (err) {
    console.warn("[Notifications] addPushTokenListener skipped (Expo Go or unsupported):", err?.message || err);
    return { remove: () => {} };
  }
};

/**
 * Add listener for notifications received while app is in foreground
 */
export const addNotificationReceivedListener = (listener) => {
  try {
    return Notifications.addNotificationReceivedListener(listener);
  } catch (err) {
    console.warn("[Notifications] addNotificationReceivedListener error:", err?.message || err);
    return { remove: () => {} };
  }
};

/**
 * Add listener for when a user interacts with / taps a notification
 */
export const addNotificationResponseReceivedListener = (listener) => {
  try {
    return Notifications.addNotificationResponseReceivedListener(listener);
  } catch (err) {
    console.warn("[Notifications] addNotificationResponseReceivedListener error:", err?.message || err);
    return { remove: () => {} };
  }
};
