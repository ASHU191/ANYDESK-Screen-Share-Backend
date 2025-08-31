import { io, type Socket } from "socket.io-client"
import { authService } from "./auth"

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"

class SocketService {
  private socket: Socket | null = null

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket
    }

    const token = authService.getToken()
    if (!token) {
      throw new Error("No authentication token available")
    }

    this.socket = io(SOCKET_URL, {
      auth: {
        token,
      },
    })

    this.socket.on("connect", () => {
      console.log("Connected to signaling server")
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from signaling server")
    })

    this.socket.on("connect_error", (error) => {
      console.error("Socket connection error:", error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket(): Socket | null {
    return this.socket
  }

  // Connection management events
  requestConnection(sessionId: number) {
    this.socket?.emit("request_connection", { sessionId })
  }

  acceptConnection(sessionId: number) {
    this.socket?.emit("accept_connection", { sessionId })
  }

  rejectConnection(sessionId: number) {
    this.socket?.emit("reject_connection", { sessionId })
  }

  // WebRTC signaling events
  sendOffer(sessionId: number, offer: RTCSessionDescriptionInit) {
    this.socket?.emit("webrtc_offer", { sessionId, offer })
  }

  sendAnswer(sessionId: number, answer: RTCSessionDescriptionInit) {
    this.socket?.emit("webrtc_answer", { sessionId, answer })
  }

  sendIceCandidate(sessionId: number, candidate: RTCIceCandidate) {
    this.socket?.emit("webrtc_ice_candidate", { sessionId, candidate })
  }

  // Remote control events
  sendMouseMove(sessionId: number, x: number, y: number) {
    this.socket?.emit("remote_mouse_move", { sessionId, x, y })
  }

  sendMouseClick(sessionId: number, button: string, x: number, y: number) {
    this.socket?.emit("remote_mouse_click", { sessionId, button, x, y })
  }

  sendKeyPress(sessionId: number, key: string, modifiers: string[]) {
    this.socket?.emit("remote_key_press", { sessionId, key, modifiers })
  }
}

export const socketService = new SocketService()
