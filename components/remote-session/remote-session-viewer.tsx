"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Monitor, MousePointer, Keyboard, X, Maximize2, Minimize2 } from "lucide-react"
import { socketService } from "@/lib/socket"

interface RemoteSessionViewerProps {
  sessionData: {
    sessionId: number
    hostUser: {
      email: string
      firstName: string
      lastName: string
    }
    connectionCode: string
  }
  onSessionEnd: () => void
}

export function RemoteSessionViewer({ sessionData, onSessionEnd }: RemoteSessionViewerProps) {
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "rejected" | "ended">(
    "connecting",
  )
  const [isControlEnabled, setIsControlEnabled] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [error, setError] = useState("")

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    setupSocketListeners()
    initializeWebRTC()

    return () => {
      cleanup()
    }
  }, [])

  const setupSocketListeners = () => {
    const socket = socketService.getSocket()
    if (!socket) return

    socket.on("connection_accepted", (data) => {
      console.log("Connection accepted:", data)
      setConnectionStatus("connected")
    })

    socket.on("connection_rejected", (data) => {
      console.log("Connection rejected:", data)
      setConnectionStatus("rejected")
      setError("The host rejected your connection request")
    })

    socket.on("session_ended", (data) => {
      console.log("Session ended:", data)
      setConnectionStatus("ended")
      cleanup()
    })

    socket.on("webrtc_offer", async (data) => {
      await handleWebRTCOffer(data)
    })

    socket.on("webrtc_answer", async (data) => {
      await handleWebRTCAnswer(data)
    })

    socket.on("webrtc_ice_candidate", async (data) => {
      await handleWebRTCIceCandidate(data)
    })
  }

  const initializeWebRTC = () => {
    peerConnectionRef.current = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
    })

    const pc = peerConnectionRef.current

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketService.sendIceCandidate(sessionData.sessionId, event.candidate)
      }
    }

    pc.ontrack = (event) => {
      console.log("Received remote stream")
      remoteStreamRef.current = event.streams[0]
      if (videoRef.current) {
        videoRef.current.srcObject = event.streams[0]
      }
    }

    pc.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", pc.connectionState)
      if (pc.connectionState === "connected") {
        setIsControlEnabled(true)
      } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        setError("Connection lost")
        setConnectionStatus("ended")
      }
    }
  }

  const handleWebRTCOffer = async (data: { offer: RTCSessionDescriptionInit }) => {
    const pc = peerConnectionRef.current
    if (!pc) return

    try {
      await pc.setRemoteDescription(data.offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socketService.sendAnswer(sessionData.sessionId, answer)
    } catch (error) {
      console.error("Error handling WebRTC offer:", error)
      setError("Failed to establish connection")
    }
  }

  const handleWebRTCAnswer = async (data: { answer: RTCSessionDescriptionInit }) => {
    const pc = peerConnectionRef.current
    if (!pc) return

    try {
      await pc.setRemoteDescription(data.answer)
    } catch (error) {
      console.error("Error handling WebRTC answer:", error)
    }
  }

  const handleWebRTCIceCandidate = async (data: { candidate: RTCIceCandidate }) => {
    const pc = peerConnectionRef.current
    if (!pc) return

    try {
      await pc.addIceCandidate(data.candidate)
    } catch (error) {
      console.error("Error handling ICE candidate:", error)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!isControlEnabled || !videoRef.current) return

    const rect = videoRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * videoRef.current.videoWidth
    const y = ((e.clientY - rect.top) / rect.height) * videoRef.current.videoHeight

    socketService.sendMouseMove(sessionData.sessionId, Math.round(x), Math.round(y))
  }

  const handleMouseClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    if (!isControlEnabled || !videoRef.current) return

    const rect = videoRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * videoRef.current.videoWidth
    const y = ((e.clientY - rect.top) / rect.height) * videoRef.current.videoHeight

    const button = e.button === 0 ? "left" : e.button === 2 ? "right" : "middle"
    socketService.sendMouseClick(sessionData.sessionId, button, Math.round(x), Math.round(y))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (!isControlEnabled) return

    e.preventDefault()
    const modifiers = []
    if (e.ctrlKey) modifiers.push("ctrl")
    if (e.shiftKey) modifiers.push("shift")
    if (e.altKey) modifiers.push("alt")
    if (e.metaKey) modifiers.push("cmd")

    socketService.sendKeyPress(sessionData.sessionId, e.key, modifiers)
  }

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      videoRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
    setIsFullscreen(!isFullscreen)
  }

  const endSession = () => {
    cleanup()
    onSessionEnd()
  }

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop())
      remoteStreamRef.current = null
    }
    socketService.disconnect()
  }

  const getStatusBadge = () => {
    const statusConfig = {
      connecting: { variant: "outline" as const, text: "Connecting..." },
      connected: { variant: "default" as const, text: "Connected" },
      rejected: { variant: "destructive" as const, text: "Rejected" },
      ended: { variant: "secondary" as const, text: "Ended" },
    }

    const config = statusConfig[connectionStatus]
    return <Badge variant={config.variant}>{config.text}</Badge>
  }

  if (connectionStatus === "rejected") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Connection Rejected
            <Button variant="outline" onClick={onSessionEnd}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              {sessionData.hostUser.firstName} {sessionData.hostUser.lastName} rejected your connection request.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Session Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Monitor className="h-5 w-5" />
              <div>
                <CardTitle className="text-lg">
                  Remote Session - {sessionData.hostUser.firstName} {sessionData.hostUser.lastName}
                </CardTitle>
                <p className="text-sm text-muted-foreground">Code: {sessionData.connectionCode}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              <Button variant="outline" onClick={endSession}>
                <X className="h-4 w-4 mr-2" />
                End Session
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Remote Screen Viewer */}
      <Card>
        <CardContent className="p-0">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-auto max-h-[70vh] cursor-crosshair"
              onMouseMove={handleMouseMove}
              onClick={handleMouseClick}
              onContextMenu={(e) => e.preventDefault()}
              onKeyDown={handleKeyPress}
              tabIndex={0}
            />

            {connectionStatus === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center">
                  <Monitor className="h-12 w-12 mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-medium">Waiting for host approval...</p>
                  <p className="text-sm opacity-75">The host needs to accept your connection request</p>
                </div>
              </div>
            )}

            {connectionStatus === "connected" && (
              <div className="absolute top-4 right-4 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="bg-black/50 hover:bg-black/70 text-white border-white/20"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Control Status */}
      {connectionStatus === "connected" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <MousePointer className="h-4 w-4 text-accent" />
                  <span className="text-sm">Mouse Control: {isControlEnabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Keyboard className="h-4 w-4 text-accent" />
                  <span className="text-sm">Keyboard Control: {isControlEnabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">Click on the screen to control the remote computer</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
