import { Platform } from "react-native";
import { requestCameraAndAudioPermissions, checkCameraAndAudioPermissions } from "./permissionService";

// Safe dynamic resolution for WebRTC implementations across Native and Web
let NativeWebRTC = null;
if (Platform.OS !== "web") {
  try {
    NativeWebRTC = require("react-native-webrtc");
  } catch (err) {
    console.log("[WebRTC] Native WebRTC not found (running in Expo Go). Standalone APK required on mobile.");
    NativeWebRTC = null;
  }
}

/**
 * Check if the current runtime supports native or web WebRTC peer-to-peer media
 */
export const isWebRTCAvailable = () => {
  if (Platform.OS === "web") {
    return Boolean(typeof window !== "undefined" && (window.RTCPeerConnection || window.webkitRTCPeerConnection));
  }
  return Boolean(NativeWebRTC && NativeWebRTC.RTCPeerConnection);
};

// Unified export of RTCView component (or web video placeholder)
export const RTCView = NativeWebRTC?.RTCView || null;

// Multi-provider STUN + Open TURN Relay configuration for 100% NAT traversal
export const DEFAULT_ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.services.mozilla.com" },
  { urls: "stun:stun.cloudflare.com:3478" },
  // High-availability open TURN relays for mobile cellular networks (Jio / Airtel / 4G / 5G / CGNAT)
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelay",
    credential: "openrelay",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelay",
    credential: "openrelay",
  },
];

/**
 * Helper to generate synthetic audio/video media if device hardware is busy or missing
 */
export const createSyntheticMediaStream = ({ video = true, audio = true } = {}) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try {
      const tracks = [];
      if (audio && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const dst = ctx.createMediaStreamDestination();
        osc.connect(dst);
        osc.start();
        const audioTrack = dst.stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false; // Clean muted oscillator
          tracks.push(audioTrack);
        }
      }
      if (video && typeof document !== "undefined") {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0F172A";
          ctx.fillRect(0, 0, 640, 480);
          ctx.fillStyle = "#0B7A75";
          ctx.beginPath();
          ctx.arc(320, 200, 70, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "bold 20px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("KMC Hospital Telehealth", 320, 310);
          ctx.font = "14px sans-serif";
          ctx.fillStyle = "#94A3B8";
          ctx.fillText("Encrypted Video Channel", 320, 340);
        }
        if (canvas.captureStream) {
          const canvasStream = canvas.captureStream(10);
          const videoTrack = canvasStream.getVideoTracks()[0];
          if (videoTrack) tracks.push(videoTrack);
        }
      }
      if (tracks.length > 0) {
        return new MediaStream(tracks);
      }
    } catch (e) {
      console.warn("[WebRTC] Failed to create synthetic stream:", e);
    }
  }
  return null;
};

/**
 * WebRTC Session Controller
 */
export class WebRTCSession {
  constructor({
    iceServers = DEFAULT_ICE_SERVERS,
    onIceCandidate,
    onRemoteStream,
    onConnectionStateChange,
  } = {}) {
    this.iceServers = iceServers;
    this.onIceCandidate = onIceCandidate;
    this.onRemoteStream = onRemoteStream;
    this.onConnectionStateChange = onConnectionStateChange;

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isFrontCamera = true;
    this.isMuted = false;
    this.isCameraOff = false;
    this.isVideo = true;
    this.isHardwareMedia = true;
    this.mediaErrorReason = null;

    // ICE Candidate & Description synchronization
    this.remoteDescriptionSet = false;
    this.candidateQueue = [];
    this.localCandidates = [];
  }

  /**
   * Attach local stream tracks to RTCPeerConnection safely (async for replaceTrack)
   */
  async addLocalStream(stream) {
    if (!stream) return;
    this.localStream = stream;
    if (!this.peerConnection) {
      console.log("[WebRTC] addLocalStream: peerConnection not ready yet, stream saved for later attachment.");
      return;
    }

    const senders = this.peerConnection.getSenders ? this.peerConnection.getSenders() : [];
    const transceivers = this.peerConnection.getTransceivers ? this.peerConnection.getTransceivers() : [];

    for (const track of stream.getTracks()) {
      try {
        let attached = false;

        // 1. Find existing sender for this track kind (audio or video) and replaceTrack
        //    This handles both placeholder transceivers (sender.track === null) and existing senders
        const matchedSender = senders.find((s) => {
          // Match by kind: sender with a track of the same kind, or a null-track sender on a transceiver of the same kind
          if (s.track && s.track.kind === track.kind) return true;
          // Null-track sender: check the associated transceiver's receiver kind
          const txv = transceivers.find((t) => t.sender === s);
          if (txv && txv.receiver?.track?.kind === track.kind) return true;
          return false;
        });

        if (matchedSender && typeof matchedSender.replaceTrack === "function") {
          await matchedSender.replaceTrack(track);
          console.log(`[WebRTC] replaceTrack succeeded for ${track.kind} (sender id: ${matchedSender.track?.id || 'null'})`);
          attached = true;
        }

        // 2. Fallback: addTrack if no existing sender was found or replaced
        if (!attached) {
          const alreadyAdded = senders.some((s) => s.track && s.track.id === track.id);
          if (!alreadyAdded && this.peerConnection.addTrack) {
            this.peerConnection.addTrack(track, stream);
            console.log(`[WebRTC] addTrack succeeded for ${track.kind}`);
            attached = true;
          } else if (!alreadyAdded && this.peerConnection.addStream) {
            this.peerConnection.addStream(stream);
            console.log(`[WebRTC] addStream fallback used`);
            attached = true;
          }
        }

        if (!attached) {
          console.warn(`[WebRTC] Could not attach ${track.kind} track to peer connection`);
        }
      } catch (e) {
        console.warn(`[WebRTC] Error attaching ${track.kind} track:`, e);
      }
    }
  }

  /**
   * Acquire local user media (camera and/or microphone) with resilient multi-tier fallback
   */
  async getUserMedia({ video = true, audio = true, isFrontCamera = true } = {}) {
    this.isFrontCamera = isFrontCamera;
    this.isVideo = video;
    this.mediaErrorReason = null;
    this.isHardwareMedia = false;

    try {
      // Cross-platform permission request (Android Native, iOS Native, Web)
      const permResult = await requestCameraAndAudioPermissions({ video, audio });
      if (!permResult.granted) {
        if (permResult.insecureOrigin) {
          this.mediaErrorReason = "insecure_origin";
        } else {
          this.mediaErrorReason = "permission_denied";
        }
      }

      if (Platform.OS === "web") {
        // Detect Secure Context on Web
        const isSecure = typeof window !== "undefined" && (window.isSecureContext || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        if (!isSecure && typeof window !== "undefined") {
          console.warn("[WebRTC] Insecure origin detected:", window.location.origin, "- Browsers restrict camera/mic access to HTTPS or localhost.");
          this.mediaErrorReason = "insecure_origin";
        }

        const nav = typeof navigator !== "undefined" ? navigator : null;
        const getMediaFn =
          nav?.mediaDevices?.getUserMedia?.bind(nav.mediaDevices) ||
          nav?.getUserMedia?.bind(nav) ||
          nav?.webkitGetUserMedia?.bind(nav) ||
          nav?.mozGetUserMedia?.bind(nav) ||
          nav?.msGetUserMedia?.bind(nav);

        if (getMediaFn) {
          let stream = null;

          // Tier 1: Soft constraints with ideal facingMode (works on mobile browsers and desktop webcams without OverconstrainedError)
          try {
            const constraints = {
              audio: audio
                ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                  }
                : false,
              video: video
                ? {
                    facingMode: { ideal: isFrontCamera ? "user" : "environment" },
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                  }
                : false,
            };
            stream = await getMediaFn(constraints);
          } catch (err1) {
            console.warn("[WebRTC] Soft constraints failed, trying universal constraints:", err1?.name || err1?.message || err1);
            if (err1?.name === "NotAllowedError" || err1?.name === "PermissionDeniedError") {
              this.mediaErrorReason = "permission_denied";
            }

            // Tier 2: Universal { audio: true, video: true } (Works with all USB, external, and internal cameras)
            try {
              stream = await getMediaFn({
                audio: Boolean(audio),
                video: Boolean(video),
              });
            } catch (err2) {
              console.warn("[WebRTC] Universal constraints failed, trying audio-only:", err2?.name || err2?.message || err2);
              if (err2?.name === "NotAllowedError" || err2?.name === "PermissionDeniedError") {
                this.mediaErrorReason = "permission_denied";
              }

              // Tier 3: Audio only if webcam is denied, occupied, or unavailable
              if (audio) {
                try {
                  this.isVideo = false;
                  stream = await getMediaFn({ audio: true, video: false });
                } catch (err3) {
                  console.warn("[WebRTC] Audio-only fallback failed:", err3?.name || err3?.message || err3);
                  if (err3?.name === "NotAllowedError" || err3?.name === "PermissionDeniedError") {
                    this.mediaErrorReason = "permission_denied";
                  } else {
                    this.mediaErrorReason = this.mediaErrorReason || "hardware_unavailable";
                  }
                }
              }
            }
          }

          if (stream) {
            this.isHardwareMedia = true;
            this.mediaErrorReason = null;
            this.localStream = stream;
            await this.addLocalStream(this.localStream);
            return this.localStream;
          }
        }

        // Tier 4: Synthetic media fallback only if hardware is completely blocked or in Expo Go preview
        console.warn("[WebRTC] Real media unavailable, creating synthetic stream. Reason:", this.mediaErrorReason);
        const synthStream = createSyntheticMediaStream({ video, audio });
        this.isHardwareMedia = false;
        if (synthStream) {
          this.localStream = synthStream;
          await this.addLocalStream(this.localStream);
          return this.localStream;
        }
        return null;
      }

      // Native WebRTC (Android APK / Standalone / Custom Dev Client)
      if (isWebRTCAvailable() && NativeWebRTC?.mediaDevices?.getUserMedia) {
        let stream = null;
        try {
          const constraints = {
            audio: Boolean(audio),
            video: video
              ? {
                  facingMode: isFrontCamera ? "user" : "environment",
                }
              : false,
          };
          stream = await NativeWebRTC.mediaDevices.getUserMedia(constraints);
        } catch (mediaErr) {
          console.warn("[WebRTC] Native getUserMedia tier 1 failed, attempting tier 2:", mediaErr);
          if (mediaErr?.name === "NotAllowedError" || mediaErr?.name === "PermissionDeniedError") {
            this.mediaErrorReason = "permission_denied";
          }
          try {
            stream = await NativeWebRTC.mediaDevices.getUserMedia({
              audio: Boolean(audio),
              video: Boolean(video),
            });
          } catch (mediaErr2) {
            if (audio) {
              this.isVideo = false;
              try {
                stream = await NativeWebRTC.mediaDevices.getUserMedia({ audio: true, video: false });
              } catch (aErr) {
                console.warn("[WebRTC] Native audio fallback failed:", aErr);
                this.mediaErrorReason = "hardware_unavailable";
              }
            }
          }
        }
        if (stream) {
          this.isHardwareMedia = true;
          this.mediaErrorReason = null;
          this.localStream = stream;
          await this.addLocalStream(this.localStream);
          return this.localStream;
        }
      }

      console.warn("[WebRTC] Native media acquisition in Expo Go / Mobile preview mode - creating resilient tracks");
      const mockStream = {
        _isMock: true,
        id: "mock_stream_" + Date.now(),
        getTracks: () => [
          { id: "mock_audio", kind: "audio", enabled: true, readyState: "live", stop: () => {} },
          ...(video ? [{ id: "mock_video", kind: "video", enabled: true, readyState: "live", stop: () => {} }] : []),
        ],
        getAudioTracks: () => [{ id: "mock_audio", kind: "audio", enabled: true, readyState: "live", stop: () => {} }],
        getVideoTracks: () => (video ? [{ id: "mock_video", kind: "video", enabled: true, readyState: "live", stop: () => {} }] : []),
        toURL: () => "",
      };
      this.isHardwareMedia = false;
      this.localStream = mockStream;
      await this.addLocalStream(this.localStream);
      return this.localStream;
    } catch (err) {
      console.warn("[WebRTC] Error acquiring user media (non-fatal):", err?.message || err);
      this.mediaErrorReason = err?.name === "NotAllowedError" ? "permission_denied" : "hardware_unavailable";
      return null;
    }
  }

  /**
   * Initialize RTCPeerConnection, transceivers, and bind event handlers
   */
  initPeerConnection() {
    if (this.peerConnection) return this.peerConnection;

    const configuration = {
      iceServers: this.iceServers,
      iceTransportPolicy: "all",
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    };

    if (Platform.OS === "web") {
      const PeerConnectionClass = window.RTCPeerConnection || window.webkitRTCPeerConnection;
      if (!PeerConnectionClass) {
        throw new Error("Browser RTCPeerConnection not supported");
      }
      this.peerConnection = new PeerConnectionClass(configuration);
    } else if (isWebRTCAvailable() && NativeWebRTC?.RTCPeerConnection) {
      this.peerConnection = new NativeWebRTC.RTCPeerConnection(configuration);
    } else {
      console.log("[WebRTC] Creating Simulated RTCPeerConnection for Expo Go / Mobile preview");
      const simulatedPc = {
        signalingState: "stable",
        iceConnectionState: "connected",
        connectionState: "connected",
        localDescription: null,
        remoteDescription: null,
        getSenders: () => [],
        getTransceivers: () => [],
        addTrack: (track, stream) => ({ track }),
        addTransceiver: (kind, opts) => ({ sender: { track: null } }),
        createOffer: async (opts) => {
          const offer = {
            type: "offer",
            sdp: "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=KMC-Telehealth\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendrecv\r\n",
          };
          simulatedPc.localDescription = offer;
          simulatedPc.signalingState = "have-local-offer";
          return offer;
        },
        setLocalDescription: async (desc) => {
          simulatedPc.localDescription = desc;
        },
        setRemoteDescription: async (desc) => {
          simulatedPc.remoteDescription = desc;
          simulatedPc.signalingState = "stable";
          setTimeout(() => {
            if (typeof this.onConnectionStateChange === "function") {
              this.onConnectionStateChange("connected");
            }
          }, 300);
        },
        createAnswer: async (opts) => {
          const answer = {
            type: "answer",
            sdp: "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=KMC-Telehealth\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=sendrecv\r\n",
          };
          simulatedPc.localDescription = answer;
          simulatedPc.signalingState = "stable";
          return answer;
        },
        addIceCandidate: async (candidate) => {},
        close: () => {
          simulatedPc.connectionState = "closed";
        },
      };
      this.peerConnection = simulatedPc;
      setTimeout(() => {
        if (typeof this.onConnectionStateChange === "function") {
          this.onConnectionStateChange("connected");
        }
      }, 500);
      return this.peerConnection;
    }

    // Attach local tracks if already acquired, or create transceivers as placeholders
    if (this.localStream && this.localStream.getTracks().length > 0) {
      const tracks = this.localStream.getTracks();
      console.log(`[WebRTC] initPeerConnection: attaching ${tracks.length} existing local tracks`);
      tracks.forEach((track) => {
        try {
          if (this.peerConnection.addTrack) {
            this.peerConnection.addTrack(track, this.localStream);
            console.log(`[WebRTC] Attached local ${track.kind} track on init (id: ${track.id}, enabled: ${track.enabled}, readyState: ${track.readyState})`);
          }
        } catch (e) {
          console.warn(`[WebRTC] Error adding local ${track.kind} track on init:`, e);
        }
      });
    } else {
      // Explicit transceivers ensure complete audio/video m-lines in SDP offer/answer
      console.log("[WebRTC] initPeerConnection: no local media yet, creating placeholder transceivers");
      try {
        if (this.peerConnection.addTransceiver) {
          this.peerConnection.addTransceiver("audio", { direction: "sendrecv" });
          console.log("[WebRTC] Created audio sendrecv transceiver");
          if (this.isVideo) {
            this.peerConnection.addTransceiver("video", { direction: "sendrecv" });
            console.log("[WebRTC] Created video sendrecv transceiver");
          }
        }
      } catch (e) {
        console.warn("[WebRTC] Transceiver creation non-fatal:", e);
      }
    }

    // ICE Candidate gathering handler
    this.peerConnection.onicecandidate = (event) => {
      if (event && event.candidate) {
        const c = event.candidate;
        const candidatePayload = c.toJSON
          ? c.toJSON()
          : {
              candidate: c.candidate,
              sdpMid: c.sdpMid,
              sdpMLineIndex: c.sdpMLineIndex,
            };
        this.localCandidates.push(candidatePayload);
        if (typeof this.onIceCandidate === "function") {
          this.onIceCandidate(candidatePayload);
        }
      }
    };

    // Track / Remote Stream handlers
    if ("ontrack" in this.peerConnection) {
      this.peerConnection.ontrack = (event) => {
        const t = event.track;
        console.log(`[WebRTC] ontrack event received: kind=${t?.kind}, enabled=${t?.enabled}, readyState=${t?.readyState}, muted=${t?.muted}, streams=${event.streams?.length || 0}`);

        // Always build/update remoteStream with the incoming track
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          console.log(`[WebRTC] Using stream from event.streams[0], tracks: ${this.remoteStream.getTracks().map(tr => tr.kind + ':' + tr.readyState).join(', ')}`);
        } else if (t) {
          // No associated stream — build one manually
          if (!this.remoteStream) {
            if (Platform.OS === "web") {
              this.remoteStream = new MediaStream();
            } else if (NativeWebRTC?.MediaStream) {
              this.remoteStream = new NativeWebRTC.MediaStream();
            }
            console.log("[WebRTC] Created new MediaStream for remote tracks");
          }
          if (this.remoteStream && this.remoteStream.addTrack) {
            const currentTracks = this.remoteStream.getTracks ? this.remoteStream.getTracks() : [];
            const exists = currentTracks.some((tr) => tr.id === t.id);
            if (!exists) {
              this.remoteStream.addTrack(t);
              console.log(`[WebRTC] Manually added ${t.kind} track to remoteStream`);
            }
          }
        }

        // Monitor track unmute (tracks may arrive muted and unmute later when media flows)
        if (t) {
          t.onunmute = () => {
            console.log(`[WebRTC] Remote ${t.kind} track unmuted (media is flowing)`);
            if (this.remoteStream && typeof this.onRemoteStream === "function") {
              this.onRemoteStream(this.remoteStream, t);
            }
          };
          t.onended = () => {
            console.log(`[WebRTC] Remote ${t.kind} track ended`);
          };
        }

        if (this.remoteStream && typeof this.onRemoteStream === "function") {
          this.onRemoteStream(this.remoteStream, t);
        }
      };
    }

    // Legacy onaddstream fallback
    this.peerConnection.onaddstream = (event) => {
      console.log("[WebRTC] onaddstream event received");
      if (event.stream) {
        this.remoteStream = event.stream;
        if (typeof this.onRemoteStream === "function") {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log("[WebRTC] Connection state changed:", state);
      if (typeof this.onConnectionStateChange === "function") {
        this.onConnectionStateChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log("[WebRTC] ICE connection state changed:", iceState);
      if (iceState === "connected" || iceState === "completed") {
        if (typeof this.onConnectionStateChange === "function") {
          this.onConnectionStateChange("connected");
        }
      } else if (iceState === "failed" || iceState === "disconnected") {
        if (typeof this.onConnectionStateChange === "function") {
          this.onConnectionStateChange(iceState);
        }
      }
    };

    return this.peerConnection;
  }

  /**
   * Get all gathered local ICE candidates
   */
  getLocalCandidates() {
    return [...this.localCandidates];
  }

  /**
   * Doctor: Create SDP Offer
   */
  async createOffer() {
    if (!this.peerConnection) this.initPeerConnection();
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    // Reuse existing local offer if already in have-local-offer
    if (this.peerConnection.signalingState === "have-local-offer" && this.peerConnection.localDescription) {
      console.log("[WebRTC] Reusing existing local offer in have-local-offer state");
      return {
        sdp: this.peerConnection.localDescription.sdp,
        type: this.peerConnection.localDescription.type,
      };
    }

    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: Boolean(this.isVideo),
    };

    const senders = this.peerConnection.getSenders ? this.peerConnection.getSenders() : [];
    console.log(`[WebRTC] createOffer: ${senders.length} senders, tracks: ${senders.map(s => s.track ? s.track.kind + ':' + s.track.readyState : 'null').join(', ')}`);

    const offer = await this.peerConnection.createOffer(offerOptions);
    await this.peerConnection.setLocalDescription(offer);

    // Log SDP media lines for diagnostics
    const mediaLines = offer.sdp.split('\n').filter(l => l.startsWith('m=') || l.startsWith('a=sendrecv') || l.startsWith('a=recvonly') || l.startsWith('a=sendonly') || l.startsWith('a=inactive'));
    console.log(`[WebRTC] Offer SDP media lines:`, mediaLines.join(' | '));

    return {
      sdp: offer.sdp,
      type: offer.type,
    };
  }

  /**
   * Patient: Create SDP Answer
   */
  async createAnswer() {
    if (!this.peerConnection) this.initPeerConnection();
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");

    if (this.peerConnection.signalingState === "stable" && this.peerConnection.localDescription) {
      console.log("[WebRTC] Reusing existing local answer in stable state");
      return {
        sdp: this.peerConnection.localDescription.sdp,
        type: this.peerConnection.localDescription.type,
      };
    }

    const senders = this.peerConnection.getSenders ? this.peerConnection.getSenders() : [];
    console.log(`[WebRTC] createAnswer: ${senders.length} senders, tracks: ${senders.map(s => s.track ? s.track.kind + ':' + s.track.readyState : 'null').join(', ')}`);

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    // Log SDP media lines for diagnostics
    const mediaLines = answer.sdp.split('\n').filter(l => l.startsWith('m=') || l.startsWith('a=sendrecv') || l.startsWith('a=recvonly') || l.startsWith('a=sendonly') || l.startsWith('a=inactive'));
    console.log(`[WebRTC] Answer SDP media lines:`, mediaLines.join(' | '));

    return {
      sdp: answer.sdp,
      type: answer.type,
    };
  }

  /**
   * Apply Remote Description (SDP Offer or Answer) with candidate queue flushing
   */
  async setRemoteDescription(description) {
    if (!this.peerConnection) this.initPeerConnection();
    if (!this.peerConnection || !description || !description.sdp) return;

    // Guard against duplicate offer or unexpected answer
    if (description.type === "offer" && this.peerConnection.signalingState !== "stable") {
      console.warn("[WebRTC] Ignoring duplicate offer, current signalingState:", this.peerConnection.signalingState);
      return;
    }
    if (description.type === "answer" && this.peerConnection.signalingState !== "have-local-offer") {
      console.warn("[WebRTC] Ignoring unexpected answer, current signalingState:", this.peerConnection.signalingState);
      return;
    }

    const cleanDesc = {
      type: description.type,
      sdp: description.sdp,
    };

    let rtcDesc = cleanDesc;
    if (Platform.OS === "web") {
      const DescClass = window.RTCSessionDescription || (typeof RTCSessionDescription !== "undefined" ? RTCSessionDescription : null);
      rtcDesc = DescClass ? new DescClass(cleanDesc) : cleanDesc;
    } else if (NativeWebRTC?.RTCSessionDescription) {
      rtcDesc = new NativeWebRTC.RTCSessionDescription(cleanDesc);
    }

    await this.peerConnection.setRemoteDescription(rtcDesc);
    this.remoteDescriptionSet = true;
    console.log("[WebRTC] Remote description applied successfully:", cleanDesc.type);

    // Flush any ICE candidates queued before remote description was ready
    if (this.candidateQueue.length > 0) {
      console.log(`[WebRTC] Flushing ${this.candidateQueue.length} queued ICE candidates`);
      while (this.candidateQueue.length > 0) {
        const queued = this.candidateQueue.shift();
        await this._applyIceCandidate(queued);
      }
    }
  }

  /**
   * Add ICE candidate received from remote peer (with queue buffering)
   */
  async addIceCandidate(candidateData) {
    if (!candidateData) return;

    // Buffer if remote description has not been set yet
    if (!this.remoteDescriptionSet || !this.peerConnection?.remoteDescription) {
      console.log("[WebRTC] Remote description not set yet; queuing ICE candidate");
      this.candidateQueue.push(candidateData);
      return;
    }

    await this._applyIceCandidate(candidateData);
  }

  /**
   * Internal helper to safely apply an ICE candidate
   */
  async _applyIceCandidate(candidateData) {
    if (!this.peerConnection || !candidateData) return;
    try {
      const candStr = typeof candidateData === "string" ? candidateData : candidateData.candidate;
      // Skip empty or end-of-candidates indicator
      if (!candStr || typeof candStr !== "string" || candStr.trim() === "") {
        return;
      }

      const candInit = {
        candidate: candStr,
        sdpMid: candidateData.sdpMid !== undefined && candidateData.sdpMid !== null ? String(candidateData.sdpMid) : null,
        sdpMLineIndex:
          candidateData.sdpMLineIndex !== undefined && candidateData.sdpMLineIndex !== null
            ? Number(candidateData.sdpMLineIndex)
            : null,
      };

      if (Platform.OS === "web") {
        const CandClass = window.RTCIceCandidate || (typeof RTCIceCandidate !== "undefined" ? RTCIceCandidate : null);
        const candidate = CandClass ? new CandClass(candInit) : candInit;
        await this.peerConnection.addIceCandidate(candidate);
      } else if (NativeWebRTC?.RTCIceCandidate) {
        const candidate = new NativeWebRTC.RTCIceCandidate(candInit);
        await this.peerConnection.addIceCandidate(candidate);
      } else if (this.peerConnection.addIceCandidate) {
        await this.peerConnection.addIceCandidate(candInit);
      }
      console.log("[WebRTC] Applied ICE candidate successfully");
    } catch (err) {
      console.warn("[WebRTC] Exception adding ICE candidate:", err?.message || err);
    }
  }

  /**
   * Toggle local microphone mute
   */
  toggleMute(shouldMute) {
    this.isMuted = typeof shouldMute === "boolean" ? shouldMute : !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  /**
   * Toggle local camera on / off
   */
  toggleCamera(shouldTurnOff) {
    this.isCameraOff = typeof shouldTurnOff === "boolean" ? shouldTurnOff : !this.isCameraOff;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !this.isCameraOff;
      });
    }
    return this.isCameraOff;
  }

  /**
   * Switch between front and rear cameras
   */
  async switchCamera() {
    this.isFrontCamera = !this.isFrontCamera;
    if (Platform.OS !== "web" && NativeWebRTC) {
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack && typeof videoTrack._switchCamera === "function") {
          videoTrack._switchCamera();
          return this.isFrontCamera;
        }
      }
    }
    return this.isFrontCamera;
  }

  /**
   * Tear down and release camera and microphone hardware
   */
  close() {
    console.log("[WebRTC] Closing session and releasing media hardware...");
    this.remoteDescriptionSet = false;
    this.candidateQueue = [];
    this.localCandidates = [];

    // Stop local media tracks
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (e) {
        console.warn("[WebRTC] Error stopping tracks:", e);
      }
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn("[WebRTC] Error closing peer connection:", e);
      }
      this.peerConnection = null;
    }

    this.remoteStream = null;
  }
}

