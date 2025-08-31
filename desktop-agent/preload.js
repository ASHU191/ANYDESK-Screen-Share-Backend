const { contextBridge, ipcRenderer } = require("electron")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // Server connection
  connectToServer: (serverUrl, token) => ipcRenderer.invoke("connect-to-server", { serverUrl, token }),
  disconnectFromServer: () => ipcRenderer.invoke("disconnect-from-server"),

  // Connection management
  generateConnectionCode: () => ipcRenderer.invoke("generate-connection-code"),
  acceptConnection: (sessionId) => ipcRenderer.invoke("accept-connection", sessionId),
  rejectConnection: (sessionId) => ipcRenderer.invoke("reject-connection", sessionId),

  // Screen capture
  getScreenSources: () => ipcRenderer.invoke("get-screen-sources"),
  startScreenCapture: (sourceId) => ipcRenderer.invoke("start-screen-capture", sourceId),
  stopScreenCapture: () => ipcRenderer.invoke("stop-screen-capture"),

  // Remote control
  enableRemoteControl: () => ipcRenderer.invoke("enable-remote-control"),
  disableRemoteControl: () => ipcRenderer.invoke("disable-remote-control"),

  // WebRTC signaling
  sendWebRTCOffer: (sessionId, offer) => ipcRenderer.invoke("send-webrtc-offer", { sessionId, offer }),
  sendWebRTCAnswer: (sessionId, answer) => ipcRenderer.invoke("send-webrtc-answer", { sessionId, answer }),
  sendWebRTCIceCandidate: (sessionId, candidate) =>
    ipcRenderer.invoke("send-webrtc-ice-candidate", { sessionId, candidate }),

  // System info
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // Event listeners
  onConnectionRequest: (callback) => ipcRenderer.on("connection-request", callback),
  onConnectionAccepted: (callback) => ipcRenderer.on("connection-accepted", callback),
  onConnectionRejected: (callback) => ipcRenderer.on("connection-rejected", callback),
  onSessionEnded: (callback) => ipcRenderer.on("session-ended", callback),
  onServerDisconnected: (callback) => ipcRenderer.on("server-disconnected", callback),
  onWebRTCOffer: (callback) => ipcRenderer.on("webrtc-offer", callback),
  onWebRTCAnswer: (callback) => ipcRenderer.on("webrtc-answer", callback),
  onWebRTCIceCandidate: (callback) => ipcRenderer.on("webrtc-ice-candidate", callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
