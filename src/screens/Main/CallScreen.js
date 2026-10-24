import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import COLORS from "../../constants/colors";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { WebRTCSession, RTCView, isWebRTCAvailable } from "../../services/webrtcService";
import { CallSignalingChannel } from "../../services/signalingService";
import {
  endCallSession,
  cancelDoctorCall,
  markCallMissed,
  markCallConnected,
  fetchCallDetails,
} from "../../services/callService";

export default function CallScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const {
    callId,
    callType = "video",
    role = "patient", // "doctor" | "patient"
    peerName = route.params?.peerName || route.params?.otherUserName || "Consultant",
    peerSubtitle = route.params?.peerSubtitle || (role === "doctor" ? "Patient Consultation" : "KMC Hospital Specialist"),
  } = route.params || {};

  const isVideo = callType === "video";
  const isDoctor = role === "doctor";
  const isNativeWebRTC = isWebRTCAvailable();

  const { language } = useLanguage ? useLanguage() : { language: "en" };

  // Call States: 'ringing' | 'connecting' | 'connected' | 'ended' | 'rejected' | 'missed' | 'failed'
  const [callStatus, setCallStatus] = useState(isDoctor ? "ringing" : "connecting");
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteTrackVersion, setRemoteTrackVersion] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [isHardwareMedia, setIsHardwareMedia] = useState(true);
  const [mediaErrorReason, setMediaErrorReason] = useState(null);
  const [isRequestingMedia, setIsRequestingMedia] = useState(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    isDoctor
      ? language === "hi" ? "मरीज़ को रिंग हो रही है..." : "Ringing patient..."
      : language === "hi" ? "कंसल्टेशन कनेक्ट हो रहा है..." : "Connecting consultation..."
  );

  const rtcSessionRef = useRef(null);
  const signalingRef = useRef(null);
  const missedTimerRef = useRef(null);
  const durationTimerRef = useRef(null);
  const offerRetryIntervalRef = useRef(null);
  const readyIntervalRef = useRef(null);
  const isConnectedRef = useRef(false);
  const answerReceivedRef = useRef(false);
  const offerReceivedRef = useRef(false);
  const mediaAcquisitionPromiseRef = useRef(null);
  const remoteVideoWebRef = useRef(null);
  const remoteAudioWebRef = useRef(null);
  const localVideoWebRef = useRef(null);

  // Clean exit helper
  const handleExit = useCallback(() => {
    if (offerRetryIntervalRef.current) {
      clearInterval(offerRetryIntervalRef.current);
      offerRetryIntervalRef.current = null;
    }
    if (readyIntervalRef.current) {
      clearInterval(readyIntervalRef.current);
      readyIntervalRef.current = null;
    }
    if (rtcSessionRef.current) {
      rtcSessionRef.current.close();
      rtcSessionRef.current = null;
    }
    if (signalingRef.current) {
      signalingRef.current.unsubscribe();
      signalingRef.current = null;
    }
    if (missedTimerRef.current) {
      clearTimeout(missedTimerRef.current);
      missedTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    navigation.goBack();
  }, [navigation]);

  // Duration Timer
  useEffect(() => {
    if (callStatus === "connected") {
      durationTimerRef.current = setInterval(() => {
        setDurationSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callStatus]);

  // Format Duration HH:MM:SS
  const formatDuration = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins < 10 ? "0" + mins : mins}:${secs < 10 ? "0" + secs : secs}`;
  };

  // Main Call & Signaling Lifecycle
  useEffect(() => {
    if (!callId) {
      Alert.alert("Error", "Missing call identifier");
      navigation.goBack();
      return;
    }

    let isMounted = true;

    // 1. Initialize WebRTC Session
    const session = new WebRTCSession({
      onIceCandidate: (candidate) => {
        signalingRef.current?.sendIceCandidate(candidate);
      },
      onRemoteStream: (stream, track) => {
        console.log(`[CallScreen] Remote stream/track received: ${track?.kind || "stream"}, tracks in stream: ${stream?.getTracks?.()?.map(t => t.kind + ':' + t.readyState + ':enabled=' + t.enabled).join(', ') || 'none'}`);
        if (isMounted) {
          setRemoteStream(stream);
          setRemoteTrackVersion((v) => v + 1);

          // Bind to audio element immediately (always in DOM)
          if (Platform.OS === "web" && remoteAudioWebRef.current) {
            if (remoteAudioWebRef.current.srcObject !== stream) {
              remoteAudioWebRef.current.srcObject = stream;
            }
            remoteAudioWebRef.current
              .play()
              .then(() => {
                setAudioAutoplayBlocked(false);
              })
              .catch((err) => {
                if (err?.name === "NotAllowedError") {
                  setAudioAutoplayBlocked(true);
                }
              });
          }

          // Bind to video element (may not exist yet if this is the first stream)
          if (Platform.OS === "web" && remoteVideoWebRef.current) {
            if (remoteVideoWebRef.current.srcObject !== stream) {
              remoteVideoWebRef.current.srcObject = stream;
            }
            remoteVideoWebRef.current.play().catch(() => {});
          }

          // Deferred retry: after React re-renders and creates the <video> element
          if (Platform.OS === "web") {
            setTimeout(() => {
              if (remoteVideoWebRef.current && stream) {
                if (remoteVideoWebRef.current.srcObject !== stream) {
                  remoteVideoWebRef.current.srcObject = stream;
                  console.log("[CallScreen] Deferred: bound remote stream to video element");
                }
                remoteVideoWebRef.current.play().catch(() => {});
              }
            }, 100);
          }
        }
      },
      onConnectionStateChange: (state) => {
        console.log("[CallScreen] Peer connection state:", state);
        if (state === "connected") {
          isConnectedRef.current = true;
          if (offerRetryIntervalRef.current) {
            clearInterval(offerRetryIntervalRef.current);
            offerRetryIntervalRef.current = null;
          }
          if (readyIntervalRef.current) {
            clearInterval(readyIntervalRef.current);
            readyIntervalRef.current = null;
          }
          if (missedTimerRef.current) {
            clearTimeout(missedTimerRef.current);
            missedTimerRef.current = null;
          }
          if (isMounted) {
            setCallStatus("connected");
            setStatusMessage(language === "hi" ? "कनेक्टेड" : "Connected");
          }
          markCallConnected(callId);
        } else if (state === "failed" || state === "disconnected") {
          if (isMounted && callStatus === "connected") {
            setStatusMessage(language === "hi" ? "पुनः कनेक्ट हो रहा है..." : "Reconnecting...");
          }
        }
      },
    });

    rtcSessionRef.current = session;

    // 2. Initialize Signaling Channel
    const signaling = new CallSignalingChannel(callId, user?.id || "anonymous");
    signalingRef.current = signaling;

    // Helper: Doctor sends SDP offer and gathered local ICE candidates
    const sendOfferWithCandidates = async () => {
      if (isConnectedRef.current || answerReceivedRef.current) return;
      // Wait for local media acquisition to settle so offer contains active audio/video tracks
      if (!session.localStream && mediaAcquisitionPromiseRef.current) {
        try {
          console.log("[CallScreen] Doctor awaiting local media before creating SDP offer...");
          await mediaAcquisitionPromiseRef.current;
        } catch (e) {}
      }
      try {
        console.log("[CallScreen] Doctor dispatching SDP offer with media tracks...");
        const offer = await session.createOffer();
        await signaling.sendOffer(offer);
        const candidates = session.getLocalCandidates();
        if (candidates.length > 0) {
          signaling.sendIceCandidates(candidates);
        }
      } catch (err) {
        console.warn("[CallScreen] Doctor error sending offer:", err);
      }
    };

    // 3. Start Media & Signaling Setup
    const setupCall = async () => {
      try {
        setIsRequestingMedia(true);
        if (isMounted) {
          setStatusMessage(
            language === "hi"
              ? "कैमरा और माइक्रोफ़ोन शुरू हो रहा है..."
              : "Requesting camera & microphone..."
          );
        }

        // STEP 1: Request and attach local camera/mic media FIRST!
        const mediaPromise = session.getUserMedia({
          video: isVideo,
          audio: true,
          isFrontCamera: true,
        });
        mediaAcquisitionPromiseRef.current = mediaPromise;

        try {
          const stream = await mediaPromise;
          console.log(`[CallScreen] getUserMedia result: stream=${!!stream}, tracks=${stream?.getTracks?.()?.map(t => t.kind + ':' + t.readyState + ':enabled=' + t.enabled).join(', ') || 'none'}, isHardwareMedia=${session.isHardwareMedia}, errorReason=${session.mediaErrorReason}`);
          if (isMounted && stream) {
            setLocalStream(stream);
            setIsHardwareMedia(session.isHardwareMedia !== false);
            setMediaErrorReason(session.mediaErrorReason || null);
            if (Platform.OS === "web" && localVideoWebRef.current) {
              localVideoWebRef.current.srcObject = stream;
              localVideoWebRef.current.muted = true;
              localVideoWebRef.current.play().catch(() => {});
            }
          }
        } catch (mErr) {
          console.warn("[CallScreen] Media prompt/acquisition notice:", mErr);
          if (isMounted) {
            setIsHardwareMedia(false);
            setMediaErrorReason(session.mediaErrorReason || "permission_denied");
          }
        } finally {
          if (isMounted) {
            setIsRequestingMedia(false);
            setStatusMessage(
              isDoctor
                ? language === "hi"
                  ? "मरीज़ को रिंग हो रही है..."
                  : "Ringing patient..."
                : language === "hi"
                ? "कंसल्टेशन कनेक्ट हो रहा है..."
                : "Connecting consultation..."
            );
          }
        }

        // STEP 2: Initialize PeerConnection with local tracks already bound!
        session.initPeerConnection();

        // Diagnostic: log peer connection state after initialization
        if (session.peerConnection) {
          const senders = session.peerConnection.getSenders ? session.peerConnection.getSenders() : [];
          console.log(`[CallScreen] After initPeerConnection: senders=${senders.length}, tracks=${senders.map(s => s.track ? s.track.kind + ':' + s.track.readyState : 'null').join(', ')}, signalingState=${session.peerConnection.signalingState}`);
        }

        // STEP 3: Subscribe to signaling channel
        signaling.subscribe({
          // Peer Ready Handshake
          onReady: async (payload) => {
            console.log("[CallScreen] Received peer ready signal, role:", payload?.role);
            if (isDoctor) {
              if (isMounted) {
                setCallStatus("connecting");
                setStatusMessage(
                  language === "hi"
                    ? "मरीज़ जुड़ गए हैं। कनेक्ट हो रहा है..."
                    : "Patient connected. Connecting..."
                );
              }
              if (missedTimerRef.current) {
                clearTimeout(missedTimerRef.current);
                missedTimerRef.current = null;
              }
              await sendOfferWithCandidates();
            } else {
              // Patient acknowledges doctor ready
              signaling.sendReady({ role: "patient" });
            }
          },

          // DOCTOR receives ANSWER from patient
          onAnswer: async (payload) => {
            console.log("[CallScreen] Doctor received answer");
            if (!isDoctor) return;
            answerReceivedRef.current = true;
            if (offerRetryIntervalRef.current) {
              clearInterval(offerRetryIntervalRef.current);
              offerRetryIntervalRef.current = null;
            }
            try {
              await session.setRemoteDescription(payload);
              const candidates = session.getLocalCandidates();
              if (candidates.length > 0) {
                signaling.sendIceCandidates(candidates);
              }
              if (isMounted) {
                setCallStatus("connecting");
                setStatusMessage(
                  language === "hi" ? "लाइन सुरक्षित की जा रही है..." : "Finalizing secure line..."
                );
              }
            } catch (err) {
              console.error("[CallScreen] Doctor failed processing answer:", err);
            }
          },

          // PATIENT receives OFFER from doctor
          onOffer: async (payload) => {
            console.log("[CallScreen] Patient received offer");
            if (isDoctor) return;
            offerReceivedRef.current = true;
            if (readyIntervalRef.current) {
              clearInterval(readyIntervalRef.current);
              readyIntervalRef.current = null;
            }
            // Ensure local media is attached before generating SDP answer
            if (!session.localStream && mediaAcquisitionPromiseRef.current) {
              try {
                console.log("[CallScreen] Patient awaiting media before creating answer...");
                await mediaAcquisitionPromiseRef.current;
              } catch (e) {}
            }
            try {
              await session.setRemoteDescription(payload);
              const answer = await session.createAnswer();
              await signaling.sendAnswer(answer);
              const candidates = session.getLocalCandidates();
              if (candidates.length > 0) {
                signaling.sendIceCandidates(candidates);
              }
              if (isMounted) {
                setCallStatus("connecting");
                setStatusMessage(
                  language === "hi"
                    ? "कंसल्टेशन कनेक्ट हो रहा है..."
                    : "Connecting consultation..."
                );
              }
            } catch (err) {
              console.error("[CallScreen] Patient failed processing offer:", err);
            }
          },

          // Either side receives ICE candidate
          onIceCandidate: (candidate) => {
            session.addIceCandidate(candidate);
          },

          // Channel connection established
          onSubscribed: () => {
            console.log(`[CallScreen] Channel SUBSCRIBED for ${isDoctor ? "Doctor" : "Patient"}`);
            signaling.sendReady({ role: isDoctor ? "doctor" : "patient" });

            if (!isDoctor) {
              // Patient announces readiness to receive offer repeatedly until offer arrives
              if (!readyIntervalRef.current) {
                let pings = 0;
                readyIntervalRef.current = setInterval(() => {
                  pings++;
                  if (offerReceivedRef.current || isConnectedRef.current || pings >= 15) {
                    clearInterval(readyIntervalRef.current);
                    readyIntervalRef.current = null;
                    return;
                  }
                  console.log(`[CallScreen] Patient repeating ready ping #${pings}...`);
                  signaling.sendReady({ role: "patient" });
                }, 1200);
              }
            } else {
              // Doctor checks offer transmission
              if (!offerRetryIntervalRef.current) {
                let attempts = 0;
                offerRetryIntervalRef.current = setInterval(() => {
                  attempts++;
                  if (isConnectedRef.current || answerReceivedRef.current || attempts >= 10) {
                    clearInterval(offerRetryIntervalRef.current);
                    offerRetryIntervalRef.current = null;
                    return;
                  }
                  if (callStatus === "connecting" || callStatus === "ringing") {
                    console.log(`[CallScreen] Doctor checking offer transmission #${attempts}...`);
                    sendOfferWithCandidates();
                  }
                }, 2000);
              }
            }
          },

          // Peer state broadcast
          onCallState: (state) => {
            if (state === "ended" || state === "rejected" || state === "cancelled") {
              if (isMounted) {
                setCallStatus(state);
                setStatusMessage(
                  language === "hi"
                    ? `कॉल समाप्त (${state})`
                    : `Call ${state}`
                );
                setTimeout(handleExit, 1500);
              }
            }
          },

          // Database row update
          onDbUpdate: (updatedCall) => {
            const st = updatedCall.status;
            if (st === "accepted" && isDoctor) {
              if (isMounted) {
                setCallStatus("connecting");
                setStatusMessage(
                  language === "hi"
                    ? "मरीज़ ने स्वीकार किया। कनेक्ट हो रहा है..."
                    : "Patient accepted. Connecting..."
                );
              }
              if (missedTimerRef.current) {
                clearTimeout(missedTimerRef.current);
                missedTimerRef.current = null;
              }
              sendOfferWithCandidates();
            } else if (st === "rejected" || st === "ended" || st === "cancelled" || st === "missed") {
              if (isMounted) {
                setCallStatus(st);
                setStatusMessage(
                  st === "rejected"
                    ? language === "hi"
                      ? "मरीज़ ने कॉल अस्वीकार कर दी"
                      : "Call declined by patient"
                    : language === "hi"
                    ? `कॉल ${st}`
                    : `Call ${st}`
                );
                setTimeout(handleExit, 2000);
              }
            }
          },
        });

        // Doctor ringing timer and immediate offer check
        if (isDoctor) {
          missedTimerRef.current = setTimeout(async () => {
            if (isMounted && callStatus === "ringing") {
              console.log("[CallScreen] Ringing timeout reached without answer");
              await markCallMissed(callId);
              setCallStatus("missed");
              setStatusMessage(
                language === "hi" ? "मरीज़ से कोई उत्तर नहीं मिला" : "No answer from patient"
              );
              setTimeout(handleExit, 2500);
            }
          }, 45000);

          const details = await fetchCallDetails(callId);
          if (details?.status === "accepted") {
            sendOfferWithCandidates();
          }
        }
      } catch (err) {
        console.error("[CallScreen] Error in call setup:", err);
        if (isMounted) {
          setCallStatus("failed");
          setStatusMessage(language === "hi" ? "कनेक्शन त्रुटि" : "Connection error");
        }
      }
    };

    setupCall();

    return () => {
      isMounted = false;
      if (offerRetryIntervalRef.current) {
        clearInterval(offerRetryIntervalRef.current);
        offerRetryIntervalRef.current = null;
      }
      if (readyIntervalRef.current) {
        clearInterval(readyIntervalRef.current);
        readyIntervalRef.current = null;
      }
      if (missedTimerRef.current) {
        clearTimeout(missedTimerRef.current);
        missedTimerRef.current = null;
      }
      session.close();
      signaling.unsubscribe();
    };
  }, [callId, isDoctor, isVideo, user?.id, handleExit]);

  // Handle End / Cancel Call
  const handleEndCallPress = async () => {
    if (callStatus === "ringing" && isDoctor) {
      // Doctor cancels ringing call
      await cancelDoctorCall(callId, user?.id);
    } else {
      await endCallSession(callId, user?.id);
    }
    signalingRef.current?.sendCallState("ended");
    handleExit();
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (rtcSessionRef.current) {
      const nextMuted = rtcSessionRef.current.toggleMute();
      setIsMuted(nextMuted);
    }
  };

  // Toggle Camera
  const handleToggleCamera = () => {
    if (rtcSessionRef.current) {
      const nextCameraOff = rtcSessionRef.current.toggleCamera();
      setIsCameraOff(nextCameraOff);
    }
  };

  // Switch Camera
  const handleSwitchCamera = async () => {
    if (rtcSessionRef.current) {
      const front = await rtcSessionRef.current.switchCamera();
      setIsFrontCamera(front);
    }
  };

  // Web media synchronization: ensure video and audio DOM nodes are bound and playing
  useEffect(() => {
    if (Platform.OS === "web" && remoteStream) {
      if (remoteVideoWebRef.current) {
        if (remoteVideoWebRef.current.srcObject !== remoteStream) {
          remoteVideoWebRef.current.srcObject = remoteStream;
        }
        remoteVideoWebRef.current.muted = true;
        remoteVideoWebRef.current.play().catch(() => {});
      }
      if (remoteAudioWebRef.current) {
        if (remoteAudioWebRef.current.srcObject !== remoteStream) {
          remoteAudioWebRef.current.srcObject = remoteStream;
        }
        remoteAudioWebRef.current
          .play()
          .then(() => {
            setAudioAutoplayBlocked(false);
          })
          .catch((err) => {
            if (err?.name === "NotAllowedError") {
              setAudioAutoplayBlocked(true);
            }
          });
      }
    }
  }, [remoteStream, remoteTrackVersion]);

  useEffect(() => {
    if (Platform.OS === "web" && localStream && localVideoWebRef.current) {
      if (localVideoWebRef.current.srcObject !== localStream) {
        localVideoWebRef.current.srcObject = localStream;
      }
      localVideoWebRef.current.muted = true;
      localVideoWebRef.current.play().catch(() => {});
    }
  }, [localStream, isCameraOff]);

  const unlockAudio = useCallback(() => {
    if (Platform.OS === "web") {
      if (remoteAudioWebRef.current) {
        remoteAudioWebRef.current
          .play()
          .then(() => {
            setAudioAutoplayBlocked(false);
          })
          .catch(() => {});
      }
      if (remoteVideoWebRef.current) {
        remoteVideoWebRef.current.play().catch(() => {});
      }
    }
  }, []);

  const handleRetryMedia = async () => {
    if (!rtcSessionRef.current) return;
    setIsRequestingMedia(true);
    try {
      const stream = await rtcSessionRef.current.getUserMedia({
        video: isVideo,
        audio: true,
        isFrontCamera,
      });
      if (stream) {
        setLocalStream(stream);
        setIsHardwareMedia(rtcSessionRef.current.isHardwareMedia !== false);
        setMediaErrorReason(rtcSessionRef.current.mediaErrorReason || null);
        await rtcSessionRef.current.addLocalStream(stream);
        if (Platform.OS === "web" && localVideoWebRef.current) {
          localVideoWebRef.current.srcObject = stream;
          localVideoWebRef.current.muted = true;
          localVideoWebRef.current.play().catch(() => {});
        }
      }
    } catch (err) {
      console.warn("[CallScreen] Retry getUserMedia notice:", err);
    } finally {
      setIsRequestingMedia(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={["top", "bottom"]}
      onTouchEnd={unlockAudio}
    >
      {/* Hidden Web Audio Receiver for 100% Reliable Sound Playback */}
      {Platform.OS === "web" && (
        <audio
          ref={remoteAudioWebRef}
          autoPlay
          playsInline
        />
      )}

      {/* Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.peerDetails}>
          <Text style={styles.peerNameText}>{peerName}</Text>
          <Text style={styles.peerSubtitleText}>{peerSubtitle}</Text>
        </View>

        {callStatus === "connected" ? (
          <View style={styles.timerPill}>
            <View style={styles.pulsingGreenDot} />
            <Text style={styles.timerText}>{formatDuration(durationSeconds)}</Text>
          </View>
        ) : (
          <View style={styles.statusPill}>
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.statusPillText}>{statusMessage}</Text>
          </View>
        )}
      </View>

      {/* Autoplay blocked banner notice (Web Audio Policy) */}
      {audioAutoplayBlocked && (
        <TouchableOpacity
          style={styles.autoplayBanner}
          onPress={unlockAudio}
          activeOpacity={0.8}
        >
          <Ionicons name="volume-high" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.autoplayBannerText}>
            {language === "hi"
              ? "आवाज सुनने के लिए स्क्रीन पर कहीं भी टैप करें"
              : "Tap anywhere on screen to enable audio sound"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Camera / Microphone Permission Warning Banner with Retry Action */}
      {(!isHardwareMedia || mediaErrorReason) && (
        <View style={styles.permissionWarningBanner}>
          <Ionicons
            name={mediaErrorReason === "insecure_origin" ? "shield-outline" : "videocam-off"}
            size={20}
            color="#EF4444"
            style={{ marginRight: 10 }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.permissionWarningTitle}>
              {language === "hi"
                ? mediaErrorReason === "insecure_origin"
                  ? "ब्राउज़र सुरक्षा प्रतिबंध (HTTPS/Localhost आवश्यक)"
                  : "कैमरा एवं माइक्रोफ़ोन अनुमति आवश्यक है"
                : mediaErrorReason === "insecure_origin"
                ? "Insecure Context: HTTPS or Localhost Required"
                : "Camera & Microphone Access Needed"}
            </Text>
            <Text style={styles.permissionWarningText}>
              {mediaErrorReason === "insecure_origin"
                ? language === "hi"
                  ? "ब्राउज़र केवल HTTPS या http://localhost पर कैमरा की अनुमति देता है।"
                  : "Browsers restrict camera & mic to HTTPS or http://localhost origins."
                : language === "hi"
                ? "लाइव वीडियो व ऑडियो देखने के लिए कैमरा और माइक की अनुमति दें।"
                : "Please allow camera & microphone access to stream live video."}
            </Text>
          </View>
          {mediaErrorReason === "insecure_origin" ? (
            <TouchableOpacity
              style={[styles.permissionRetryBtn, { backgroundColor: "#0284C7" }]}
              onPress={() => {
                Alert.alert(
                  language === "hi" ? "मोबाइल पर कैमरा कैसे चालू करें" : "How to Enable Camera on Mobile",
                  language === "hi"
                    ? "मोबाइल ब्राउज़र केवल HTTPS या localhost पर कैमरा की अनुमति देते हैं।\n\n1. टर्मिनल में Expo को टनल के साथ चलाएं:\n   npx expo start --tunnel\n\n2. या क्रोम में chrome://flags/#unsafely-treat-insecure-origin-as-secure पर जाकर इस URL को Allow करें।"
                    : "Mobile browsers only allow camera access on HTTPS or localhost.\n\n1. Run Expo with tunnel for free HTTPS:\n   npx expo start --tunnel\n\n2. Or allow this origin in chrome://flags/#unsafely-treat-insecure-origin-as-secure",
                  [{ text: "OK" }]
                );
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionRetryBtnText}>
                {language === "hi" ? "सॉल्यूशन" : "Help"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.permissionRetryBtn}
              onPress={handleRetryMedia}
              disabled={isRequestingMedia}
              activeOpacity={0.8}
            >
              {isRequestingMedia ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.permissionRetryBtnText}>
                  {language === "hi" ? "अनुमति दें" : "Grant Access"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Expo Go Preview Mode Notice Banner (Mobile Only) */}
      {!isNativeWebRTC && Platform.OS !== "web" && (
        <View style={styles.expoGoBanner}>
          <Ionicons name="information-circle" size={15} color="#F59E0B" style={{ marginRight: 6 }} />
          <Text style={styles.expoGoBannerText}>
            {language === "hi"
              ? "एक्सपो गो प्रिव्यू मोड · लाइव कैमरे के लिए एंड्रॉइड APK बिल्ड आवश्यक है"
              : "Expo Go Preview Mode · Live camera video requires Android APK build"}
          </Text>
        </View>
      )}

      {/* Main Canvas */}
      <View style={styles.canvasArea}>
        {/* Video Mode */}
        {isVideo ? (
          <View style={styles.videoContainer}>
            {/* Remote Peer Video Feed: Web HTML5 or Native RTCView */}
            {Platform.OS === "web" ? (
              <>
                <video
                  ref={remoteVideoWebRef}
                  autoPlay
                  playsInline
                  muted={true}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    backgroundColor: "#000",
                    display: remoteStream ? "block" : "none",
                  }}
                />
                {!remoteStream && (
                  <View style={styles.avatarPlaceholder}>
                    <View style={styles.avatarCircleLarge}>
                      <Ionicons name="person" size={72} color={COLORS.white} />
                    </View>
                    <Text style={styles.avatarPeerName}>{peerName}</Text>
                    <Text style={styles.avatarStatusDesc}>
                      {callStatus === "connected"
                        ? language === "hi"
                          ? "कंसल्टेशन सक्रिय है · एन्क्रिप्टेड लाइन"
                          : "Consultation Active · Encrypted Line"
                        : statusMessage}
                    </Text>
                  </View>
                )}
              </>
            ) : isNativeWebRTC && remoteStream && RTCView ? (
              <RTCView
                streamURL={remoteStream.toURL ? remoteStream.toURL() : ""}
                style={styles.fullRemoteVideo}
                objectFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <View style={styles.avatarCircleLarge}>
                  <Ionicons name="person" size={72} color={COLORS.white} />
                </View>
                <Text style={styles.avatarPeerName}>{peerName}</Text>
                <Text style={styles.avatarStatusDesc}>
                  {callStatus === "connected"
                    ? language === "hi"
                      ? "कंसल्टेशन सक्रिय है · एन्क्रिप्टेड लाइन"
                      : "Consultation Active · Encrypted Line"
                    : statusMessage}
                </Text>
              </View>
            )}

            {/* Local Video Picture-in-Picture Preview: Web HTML5 or Native RTCView */}
            {Platform.OS === "web" && localStream && !isCameraOff ? (
              <View style={styles.localPipWrap}>
                <video
                  ref={localVideoWebRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: isFrontCamera ? "scaleX(-1)" : "none",
                    borderRadius: 12,
                    backgroundColor: "#000",
                  }}
                />
              </View>
            ) : isNativeWebRTC && localStream && RTCView && !isCameraOff ? (
              <View style={styles.localPipWrap}>
                <RTCView
                  streamURL={localStream.toURL ? localStream.toURL() : ""}
                  style={styles.localPipVideo}
                  objectFit="cover"
                  mirror={isFrontCamera}
                  zOrder={1}
                />
              </View>
            ) : !isCameraOff ? (
              <View style={styles.localPipWrap}>
                <View style={styles.localPipSimulated}>
                  <Ionicons name="person" size={24} color={COLORS.white} />
                  <Text style={styles.localPipSimulatedText}>
                    {language === "hi" ? "आप" : "You"}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : (
          /* Audio-Only Mode */
          <View style={styles.audioContainer}>
            <View style={styles.audioAvatarWrap}>
              <View style={styles.audioPulseRing} />
              <View style={styles.audioAvatarCircle}>
                <Ionicons name="call" size={54} color={COLORS.primary} />
              </View>
            </View>
            <Text style={styles.audioPeerName}>{peerName}</Text>
            <Text style={styles.audioDepartment}>{peerSubtitle}</Text>
            <Text style={styles.audioStatusNote}>
              {callStatus === "connected"
                ? language === "hi"
                  ? "हाई डेफिनिशन एन्क्रिप्टेड ऑडियो कंसल्टेशन"
                  : "High Definition Encrypted Audio Consultation"
                : statusMessage}
            </Text>
          </View>
        )}
      </View>

      {/* Floating Call Controls Bar */}
      <View style={styles.controlsDock}>
        {/* Microphone Toggle */}
        <TouchableOpacity
          style={[styles.dockBtn, isMuted && styles.dockBtnActiveRed]}
          onPress={handleToggleMute}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isMuted ? "mic-off" : "mic"}
            size={24}
            color={isMuted ? COLORS.white : COLORS.text}
          />
          <Text style={[styles.dockBtnText, isMuted && { color: COLORS.white }]}>
            {isMuted
              ? language === "hi" ? "माइक चालू" : "Unmute"
              : language === "hi" ? "माइक बंद" : "Mute"}
          </Text>
        </TouchableOpacity>

        {/* Camera Toggle (Video Only) */}
        {isVideo && (
          <TouchableOpacity
            style={[styles.dockBtn, isCameraOff && styles.dockBtnActiveRed]}
            onPress={handleToggleCamera}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isCameraOff ? "videocam-off" : "videocam"}
              size={24}
              color={isCameraOff ? COLORS.white : COLORS.text}
            />
            <Text style={[styles.dockBtnText, isCameraOff && { color: COLORS.white }]}>
              {isCameraOff
                ? language === "hi" ? "कैमरा चालू" : "Camera On"
                : language === "hi" ? "कैमरा बंद" : "Camera Off"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Flip Camera (Video Only) */}
        {isVideo && !isCameraOff && (
          <TouchableOpacity
            style={styles.dockBtn}
            onPress={handleSwitchCamera}
            activeOpacity={0.8}
          >
            <Ionicons name="camera-reverse" size={24} color={COLORS.text} />
            <Text style={styles.dockBtnText}>
              {language === "hi" ? "कैमरा बदलें" : "Flip"}
            </Text>
          </TouchableOpacity>
        )}

        {/* End / Cancel Call Button */}
        <TouchableOpacity
          style={[styles.dockBtn, styles.endCallBtn]}
          onPress={handleEndCallPress}
          activeOpacity={0.8}
        >
          <Ionicons
            name="call"
            size={26}
            color={COLORS.white}
            style={{ transform: [{ rotate: "135deg" }] }}
          />
          <Text style={[styles.dockBtnText, { color: COLORS.white, fontWeight: "900" }]}>
            {callStatus === "ringing" && isDoctor
              ? language === "hi" ? "रद्द करें" : "Cancel"
              : language === "hi" ? "कॉल समाप्त" : "End Call"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A", // Professional dark navy
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    zIndex: 10,
  },
  peerDetails: {
    flex: 1,
  },
  peerNameText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.white,
  },
  peerSubtitleText: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  timerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  pulsingGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  timerText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 13,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  autoplayBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3B82F6",
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    zIndex: 20,
  },
  autoplayBannerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  permissionWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.18)",
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    zIndex: 20,
  },
  permissionWarningTitle: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "800",
  },
  permissionWarningText: {
    color: "#E2E8F0",
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  permissionRetryBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  permissionRetryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  canvasArea: {
    flex: 1,
    position: "relative",
  },
  videoContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#000",
  },
  fullRemoteVideo: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#1E293B",
  },
  avatarCircleLarge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  avatarPeerName: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.white,
    textAlign: "center",
  },
  avatarStatusDesc: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    textAlign: "center",
  },
  localPipWrap: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  localPipVideo: {
    width: "100%",
    height: "100%",
  },
  audioContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  audioAvatarWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  audioPulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(11, 122, 117, 0.2)",
  },
  audioAvatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EAF6F5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  audioPeerName: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.white,
    textAlign: "center",
  },
  audioDepartment: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: "700",
    marginTop: 6,
    textAlign: "center",
  },
  audioStatusNote: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 10,
    textAlign: "center",
  },
  controlsDock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  dockBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    minWidth: 64,
  },
  dockBtnActiveRed: {
    backgroundColor: "#EF4444",
  },
  dockBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 4,
  },
  endCallBtn: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 14,
  },
  expoGoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245, 158, 11, 0.3)",
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  expoGoBannerText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
  },
  localPipSimulated: {
    flex: 1,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  localPipSimulatedText: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
});
