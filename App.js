import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LanguageProvider } from "./src/context/LanguageContext";
import { AppointmentProvider } from "./src/context/AppointmentContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { navigate } from "./src/navigation/navigationRef";
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "./src/services/notificationService";
import {
  subscribeToIncomingCalls,
  patientAnswerCall,
  patientRejectCall,
  fetchCallDetails,
} from "./src/services/callService";
import IncomingCallModal from "./src/components/IncomingCallModal";
import ErrorBoundary from "./src/components/ErrorBoundary";

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  const [incomingCall, setIncomingCall] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setIncomingCall(null);
      return;
    }

    // 1. Subscribe to Realtime Incoming Calls for this patient
    const unsubscribe = subscribeToIncomingCalls(user.id, (callData) => {
      if (callData.isDismissed) {
        setIncomingCall(null);
      } else {
        setIncomingCall(callData);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    // 2. Cold Start Notification Tap
    try {
      Notifications.getLastNotificationResponseAsync()
        ?.then(async (response) => {
          const data = response?.notification?.request?.content?.data || {};
          if (data.type === "incoming_call" && data.call_id) {
            const details = await fetchCallDetails(data.call_id);
            if (details && details.status === "ringing") {
              setIncomingCall(details);
            }
          }
        })
        ?.catch(() => {});
    } catch (err) {
      console.warn("[App] Error checking cold start notification:", err?.message || err);
    }

    // 3. Foreground Notification Listener
    const receivedSubscription = addNotificationReceivedListener(async (notification) => {
      const data = notification?.request?.content?.data || {};
      console.log(
        "[Push Notification] Foreground notification:",
        notification?.request?.content?.title,
        "-",
        notification?.request?.content?.body
      );
      if (data.type === "incoming_call" && data.call_id) {
        const details = await fetchCallDetails(data.call_id);
        if (details && details.status === "ringing") {
          setIncomingCall(details);
        }
      }
    });

    // 4. Background / Tapped Notification Listener
    const responseSubscription = addNotificationResponseReceivedListener(async (response) => {
      const data = response?.notification?.request?.content?.data || {};
      console.log("[Push Notification] Notification response tapped:", data);
      if (data.type === "incoming_call" && data.call_id) {
        const details = await fetchCallDetails(data.call_id);
        if (details && details.status === "ringing") {
          setIncomingCall(details);
        }
      }
    });

    return () => {
      receivedSubscription?.remove?.();
      responseSubscription?.remove?.();
    };
  }, []);

  const handleAnswerIncomingCall = (call) => {
    setIncomingCall(null);
    // Non-blocking database update so CallScreen mounts and establishes signaling immediately
    patientAnswerCall(call.id);
    navigate("CallScreen", {
      callId: call.id,
      callType: call.call_type || "video",
      role: "patient",
      peerName: call.doctors?.name || call.doctor_name || "Doctor",
      peerSubtitle: call.doctors?.department || call.department || "Specialist",
    });
  };

  const handleRejectIncomingCall = async (call) => {
    setIncomingCall(null);
    await patientRejectCall(call.id, user?.id);
  };

  return (
    <>
      <StatusBar style="dark" />
      <AppNavigator />
      <IncomingCallModal
        visible={Boolean(incomingCall)}
        call={incomingCall}
        onAnswer={handleAnswerIncomingCall}
        onReject={handleRejectIncomingCall}
      />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppointmentProvider>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </AppointmentProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
