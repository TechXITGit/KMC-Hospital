import { Platform, PermissionsAndroid } from "react-native";

/**
 * Service to manage Camera and Microphone permissions across Android, iOS, and Web.
 *
 * Android native builds  → PermissionsAndroid (100% native Android permission dialog)
 * Web                    → navigator.mediaDevices.getUserMedia
 * iOS                    → Info.plist handles it; we return granted:true
 */

// ─── CHECK (non-prompting) ────────────────────────────────────────────────────

export const checkCameraAndAudioPermissions = async ({
  video = true,
  audio = true,
} = {}) => {


  // ── Android ──────────────────────────────────────────────────────────────
  if (Platform.OS === "android") {
    try {
      let cameraGranted = true;
      let audioGranted = true;

      if (video) {
        cameraGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
      }
      if (audio) {
        audioGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
      }

      return {
        granted: cameraGranted && audioGranted,
        camera: cameraGranted,
        audio: audioGranted,
        insecureOrigin: false,
      };
    } catch (err) {
      console.warn("[PermissionService] Android check error:", err);
      return { granted: false, camera: false, audio: false, insecureOrigin: false };
    }
  }

  // ── Web ──────────────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      return { granted: false, camera: false, audio: false, insecureOrigin: false };
    }

    const isSecure =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecure) {
      return { granted: false, camera: false, audio: false, insecureOrigin: true };
    }

    try {
      if (navigator?.permissions?.query) {
        const camStatus = video
          ? await navigator.permissions.query({ name: "camera" }).catch(() => null)
          : null;
        const micStatus = audio
          ? await navigator.permissions.query({ name: "microphone" }).catch(() => null)
          : null;

        const camGranted = !video || camStatus?.state === "granted";
        const micGranted = !audio || micStatus?.state === "granted";

        if (camGranted && micGranted) {
          return { granted: true, camera: camGranted, audio: micGranted, insecureOrigin: false };
        }
      }
    } catch (_e) {
      // Browser doesn't support permissions.query
    }

    return { granted: null, camera: null, audio: null, insecureOrigin: false };
  }

  // ── iOS ───────────────────────────────────────────────────────────────────
  return { granted: true, camera: true, audio: true, insecureOrigin: false };
};

// ─── REQUEST (prompting) ──────────────────────────────────────────────────────

export const requestCameraAndAudioPermissions = async ({
  video = true,
  audio = true,
} = {}) => {

  // ── Android ──────────────────────────────────────────────────────────────
  if (Platform.OS === "android") {

    // Native APK: PermissionsAndroid is always available and reliable
    if (
      PermissionsAndroid &&
      typeof PermissionsAndroid.requestMultiple === "function"
    ) {
      try {
        const perms = [];
        if (video) perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (audio) perms.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);

        if (perms.length === 0) {
          return { granted: true, camera: true, audio: true, insecureOrigin: false };
        }

        console.log("[PermissionService] Requesting Android permissions:", perms);
        const results = await PermissionsAndroid.requestMultiple(perms);
        console.log("[PermissionService] Android permission result:", results);

        const cameraStatus =
          !video ||
          results[PermissionsAndroid.PERMISSIONS.CAMERA] ===
            PermissionsAndroid.RESULTS.GRANTED;
        const audioStatus =
          !audio ||
          results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
            PermissionsAndroid.RESULTS.GRANTED;

        return {
          granted: cameraStatus && audioStatus,
          camera: cameraStatus,
          audio: audioStatus,
          insecureOrigin: false,
        };
      } catch (err) {
        console.warn("[PermissionService] Android PermissionsAndroid error:", err);
        return { granted: false, camera: false, audio: false, insecureOrigin: false };
      }
    }

    // Android PermissionsAndroid handled above; if it was somehow unavailable:
    return { granted: false, camera: false, audio: false, insecureOrigin: false };
  }

  // ── Web ──────────────────────────────────────────────────────────────────
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      return { granted: false, camera: false, audio: false, insecureOrigin: false };
    }

    const isSecure =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (!isSecure) {
      console.warn("[PermissionService] Insecure origin — camera/mic blocked by browser.");
      return { granted: false, camera: false, audio: false, insecureOrigin: true };
    }

    try {
      const getMedia =
        navigator?.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices) ||
        navigator?.getUserMedia?.bind(navigator) ||
        navigator?.webkitGetUserMedia?.bind(navigator) ||
        navigator?.mozGetUserMedia?.bind(navigator);

      if (!getMedia) {
        return { granted: false, camera: false, audio: false, insecureOrigin: true };
      }

      const testStream = await getMedia({
        video: Boolean(video),
        audio: Boolean(audio),
      });

      // Stop tracks immediately — we only needed the permission prompt
      if (testStream && testStream.getTracks) {
        testStream.getTracks().forEach((t) => t.stop());
      }

      return {
        granted: true,
        camera: Boolean(video),
        audio: Boolean(audio),
        insecureOrigin: false,
      };
    } catch (err) {
      console.warn(
        "[PermissionService] Web getUserMedia error:",
        err?.name,
        err?.message
      );
      const isDenied =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      return {
        granted: false,
        camera: false,
        audio: false,
        insecureOrigin: false,
        error: isDenied ? "permission_denied" : "device_unavailable",
      };
    }
  }

  // ── iOS ───────────────────────────────────────────────────────────────────
  return { granted: true, camera: true, audio: true, insecureOrigin: false };
};
