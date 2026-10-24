import { supabase } from "../utils/supabase";

/**
 * Supabase Realtime Call Signaling Channel
 */
export class CallSignalingChannel {
  constructor(callId, userId) {
    this.callId = callId;
    this.userId = userId;
    this.channel = null;
    this.dbSubscription = null;

    // Event callbacks
    this.onReady = null;
    this.onOffer = null;
    this.onAnswer = null;
    this.onIceCandidate = null;
    this.onCallState = null;
    this.onDbUpdate = null;
    this.onSubscribed = null;
  }

  /**
   * Subscribe to Realtime channel for this call
   */
  subscribe({ onReady, onOffer, onAnswer, onIceCandidate, onCallState, onDbUpdate, onSubscribed } = {}) {
    this.onReady = onReady;
    this.onOffer = onOffer;
    this.onAnswer = onAnswer;
    this.onIceCandidate = onIceCandidate;
    this.onCallState = onCallState;
    this.onDbUpdate = onDbUpdate;
    this.onSubscribed = onSubscribed;

    const channelName = `call:${this.callId}`;
    console.log(`[Signaling] Subscribing to channel: ${channelName}`);

    this.channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    // 0. Listen for Peer Ready (Handshake: Doctor <-> Patient)
    this.channel.on("broadcast", { event: "ready" }, (payload) => {
      const data = payload?.payload || {};
      console.log("[Signaling] Received peer ready signal from:", data.from, "role:", data.role);
      if (typeof this.onReady === "function") {
        this.onReady(data);
      }
    });

    // 1. Listen for SDP Offer (Doctor -> Patient)
    this.channel.on("broadcast", { event: "offer" }, (payload) => {
      const data = payload?.payload || {};
      console.log("[Signaling] Received remote offer from:", data.from);
      if (typeof this.onOffer === "function") {
        this.onOffer(data);
      }
    });

    // 2. Listen for SDP Answer (Patient -> Doctor)
    this.channel.on("broadcast", { event: "answer" }, (payload) => {
      const data = payload?.payload || {};
      console.log("[Signaling] Received remote answer from:", data.from);
      if (typeof this.onAnswer === "function") {
        this.onAnswer(data);
      }
    });

    // 3. Listen for ICE Candidate exchange (single or batch)
    this.channel.on("broadcast", { event: "ice-candidate" }, (payload) => {
      const data = payload?.payload || {};
      if (typeof this.onIceCandidate === "function") {
        if (Array.isArray(data.candidates)) {
          data.candidates.forEach((cand) => this.onIceCandidate(cand));
        } else if (data.candidate) {
          this.onIceCandidate(data.candidate);
        }
      }
    });

    // 4. Listen for Peer Call State Updates
    this.channel.on("broadcast", { event: "call-state" }, (payload) => {
      const data = payload?.payload || {};
      console.log("[Signaling] Remote call-state event:", data.state);
      if (typeof this.onCallState === "function") {
        this.onCallState(data.state);
      }
    });

    // 5. Listen for Postgres changes on public.calls row
    this.channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "calls",
        filter: `id=eq.${this.callId}`,
      },
      (payload) => {
        console.log("[Signaling] DB call row updated:", payload.new?.status);
        if (typeof this.onDbUpdate === "function") {
          this.onDbUpdate(payload.new);
        }
      }
    );

    this.channel.subscribe((status, err) => {
      console.log(`[Signaling] Channel status: ${status}`, err || "");
      if (status === "SUBSCRIBED" && typeof this.onSubscribed === "function") {
        this.onSubscribed();
      }
    });

    return this.channel;
  }

  /**
   * Broadcast Peer Ready signal to announce active media & room presence
   */
  async sendReady(metadata = {}) {
    if (!this.channel) return;
    return this.channel.send({
      type: "broadcast",
      event: "ready",
      payload: {
        from: this.userId,
        ...metadata,
      },
    });
  }

  /**
   * Broadcast SDP Offer to remote peer
   */
  async sendOffer(offer) {
    if (!this.channel || !offer) return;
    return this.channel.send({
      type: "broadcast",
      event: "offer",
      payload: {
        sdp: offer.sdp,
        type: offer.type,
        from: this.userId,
      },
    });
  }

  /**
   * Broadcast SDP Answer to remote peer
   */
  async sendAnswer(answer) {
    if (!this.channel || !answer) return;
    return this.channel.send({
      type: "broadcast",
      event: "answer",
      payload: {
        sdp: answer.sdp,
        type: answer.type,
        from: this.userId,
      },
    });
  }

  /**
   * Broadcast single ICE candidate
   */
  async sendIceCandidate(candidate) {
    if (!this.channel || !candidate) return;
    return this.channel.send({
      type: "broadcast",
      event: "ice-candidate",
      payload: {
        candidate,
        from: this.userId,
      },
    });
  }

  /**
   * Broadcast multiple ICE candidates in batch
   */
  async sendIceCandidates(candidates) {
    if (!this.channel || !candidates || candidates.length === 0) return;
    return this.channel.send({
      type: "broadcast",
      event: "ice-candidate",
      payload: {
        candidates,
        from: this.userId,
      },
    });
  }

  /**
   * Broadcast Call State
   */
  async sendCallState(state) {
    if (!this.channel || !state) return;
    return this.channel.send({
      type: "broadcast",
      event: "call-state",
      payload: {
        state,
        from: this.userId,
      },
    });
  }

  /**
   * Leave channel and cleanup
   */
  unsubscribe() {
    if (this.channel) {
      console.log(`[Signaling] Leaving channel for call: ${this.callId}`);
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}

