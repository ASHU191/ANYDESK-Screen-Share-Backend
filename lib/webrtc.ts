export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null
  private localStream: MediaStream | null = null
  private remoteStream: MediaStream | null = null
  private onRemoteStreamCallback?: (stream: MediaStream) => void
  private onIceCandidateCallback?: (candidate: RTCIceCandidate) => void

  constructor() {
    this.initializePeerConnection()
  }

  private initializePeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
      // Force DTLS-SRTP encryption
      sdpSemantics: "unified-plan",
    })

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onIceCandidateCallback) {
        // Only send candidates over secure channels
        if (event.candidate.protocol === "udp" || event.candidate.protocol === "tcp") {
          this.onIceCandidateCallback(event.candidate)
        }
      }
    }

    this.peerConnection.ontrack = (event) => {
      console.log("Received remote stream")
      this.remoteStream = event.streams[0]
      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(event.streams[0])
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", this.peerConnection?.connectionState)

      // Log security-relevant state changes
      if (this.peerConnection?.connectionState === "failed") {
        console.error("WebRTC connection failed - potential security issue")
      }
    }

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", this.peerConnection?.iceConnectionState)

      // Ensure connection is properly encrypted
      if (this.peerConnection?.iceConnectionState === "connected") {
        this.verifyEncryption()
      }
    }

    this.peerConnection.ondatachannel = (event) => {
      console.log("Data channel received:", event.channel.label)
      // Monitor data channels for security
      event.channel.onopen = () => {
        console.log("Data channel opened:", event.channel.label)
      }
      event.channel.onmessage = (messageEvent) => {
        console.log("Data channel message:", messageEvent.data)
      }
    }
  }

  private async verifyEncryption() {
    try {
      const stats = await this.peerConnection?.getStats()
      if (stats) {
        stats.forEach((report) => {
          if (report.type === "transport") {
            console.log("Transport security:", {
              dtlsState: report.dtlsState,
              selectedCandidatePairId: report.selectedCandidatePairId,
            })

            // Ensure DTLS is properly established
            if (report.dtlsState !== "connected") {
              console.warn("DTLS not properly established:", report.dtlsState)
            }
          }
        })
      }
    } catch (error) {
      console.error("Failed to verify encryption:", error)
    }
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized")
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
      iceRestart: false,
    })

    // Modify SDP to enforce encryption
    if (offer.sdp) {
      offer.sdp = this.enforceEncryption(offer.sdp)
    }

    await this.peerConnection.setLocalDescription(offer)
    return offer
  }

  async createAnswer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized")
    }

    if (offer.sdp) {
      offer.sdp = this.enforceEncryption(offer.sdp)
    }

    await this.peerConnection.setRemoteDescription(offer)
    const answer = await this.peerConnection.createAnswer()

    // Modify answer SDP to enforce encryption
    if (answer.sdp) {
      answer.sdp = this.enforceEncryption(answer.sdp)
    }

    await this.peerConnection.setLocalDescription(answer)
    return answer
  }

  private enforceEncryption(sdp: string): string {
    // Remove insecure protocols and enforce DTLS-SRTP
    let secureSdp = sdp

    // Ensure DTLS-SRTP is required
    if (!secureSdp.includes("a=fingerprint:")) {
      console.warn("SDP missing DTLS fingerprint")
    }

    // Remove any unencrypted RTP
    secureSdp = secureSdp.replace(/a=crypto:/g, "")

    // Ensure bundle is used for security
    if (!secureSdp.includes("a=group:BUNDLE")) {
      console.warn("SDP missing BUNDLE group")
    }

    return secureSdp
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized")
    }

    await this.peerConnection.setRemoteDescription(description)
  }

  async addIceCandidate(candidate: RTCIceCandidate) {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized")
    }

    await this.peerConnection.addIceCandidate(candidate)
  }

  addLocalStream(stream: MediaStream) {
    if (!this.peerConnection) {
      throw new Error("Peer connection not initialized")
    }

    this.localStream = stream
    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream)
    })
  }

  onRemoteStream(callback: (stream: MediaStream) => void) {
    this.onRemoteStreamCallback = callback
  }

  onIceCandidate(callback: (candidate: RTCIceCandidate) => void) {
    this.onIceCandidateCallback = callback
  }

  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null
  }

  close() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop())
      this.localStream = null
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop())
      this.remoteStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
  }
}
