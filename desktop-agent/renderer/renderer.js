class RemoteDesktopAgent {
  constructor() {
    this.isConnected = false
    this.currentSession = null
    this.selectedSource = null
    this.isScreenSharing = false
    this.isControlEnabled = false
    this.sessionStartTime = null
    this.sessionTimer = null
    this.peerConnection = null

    this.initializeEventListeners()
    this.initializeElectronListeners()
    this.updateUI()
  }

  initializeEventListeners() {
    // Connection
    document.getElementById("connectBtn").addEventListener("click", () => this.connectToServer())

    // Connection code
    document.getElementById("generateCodeBtn").addEventListener("click", () => this.generateConnectionCode())

    // Screen sharing
    document.getElementById("refreshSourcesBtn").addEventListener("click", () => this.refreshScreenSources())
    document.getElementById("startSharingBtn").addEventListener("click", () => this.startScreenSharing())
    document.getElementById("stopSharingBtn").addEventListener("click", () => this.stopScreenSharing())

    // Remote control
    document.getElementById("toggleControlBtn").addEventListener("click", () => this.toggleRemoteControl())

    // Session management
    document.getElementById("endSessionBtn").addEventListener("click", () => this.endSession())

    // Modal actions
    document.getElementById("acceptRequestBtn").addEventListener("click", () => this.acceptConnectionRequest())
    document.getElementById("rejectRequestBtn").addEventListener("click", () => this.rejectConnectionRequest())
  }

  initializeElectronListeners() {
    // Connection events
    window.electronAPI.onConnectionRequest((event, data) => {
      this.showConnectionRequest(data)
    })

    window.electronAPI.onConnectionAccepted((event, data) => {
      this.handleConnectionAccepted(data)
    })

    window.electronAPI.onConnectionRejected((event, data) => {
      this.handleConnectionRejected(data)
    })

    window.electronAPI.onSessionEnded((event, data) => {
      this.handleSessionEnded(data)
    })

    window.electronAPI.onServerDisconnected((event) => {
      this.handleServerDisconnected()
    })

    // WebRTC events
    window.electronAPI.onWebRTCOffer((event, data) => {
      this.handleWebRTCOffer(data)
    })

    window.electronAPI.onWebRTCAnswer((event, data) => {
      this.handleWebRTCAnswer(data)
    })

    window.electronAPI.onWebRTCIceCandidate((event, data) => {
      this.handleWebRTCIceCandidate(data)
    })
  }

  async connectToServer() {
    const serverUrl = document.getElementById("serverUrl").value
    const authToken = document.getElementById("authToken").value

    if (!serverUrl || !authToken) {
      alert("Please enter server URL and authentication token")
      return
    }

    try {
      this.updateConnectionStatus("connecting", "Connecting...")
      await window.electronAPI.connectToServer(serverUrl, authToken)
      this.isConnected = true
      this.updateConnectionStatus("online", "Connected")
      this.updateUI()
      await this.refreshScreenSources()
    } catch (error) {
      console.error("Connection failed:", error)
      alert(`Connection failed: ${error.message}`)
      this.updateConnectionStatus("offline", "Offline")
    }
  }

  async generateConnectionCode() {
    try {
      const result = await window.electronAPI.generateConnectionCode()
      document.getElementById("connectionCode").textContent = result.code
    } catch (error) {
      console.error("Failed to generate connection code:", error)
      alert(`Failed to generate connection code: ${error.message}`)
    }
  }

  async refreshScreenSources() {
    try {
      const sources = await window.electronAPI.getScreenSources()
      this.displayScreenSources(sources)
    } catch (error) {
      console.error("Failed to get screen sources:", error)
    }
  }

  displayScreenSources(sources) {
    const container = document.getElementById("screenSources")
    container.innerHTML = ""

    sources.forEach((source) => {
      const sourceElement = document.createElement("div")
      sourceElement.className = "screen-source"
      sourceElement.innerHTML = `
        <img src="${source.thumbnail}" alt="${source.name}">
        <div class="source-name">${source.name}</div>
      `

      sourceElement.addEventListener("click", () => {
        document.querySelectorAll(".screen-source").forEach((el) => el.classList.remove("selected"))
        sourceElement.classList.add("selected")
        this.selectedSource = source.id
        document.getElementById("startSharingBtn").disabled = false
      })

      container.appendChild(sourceElement)
    })
  }

  async startScreenSharing() {
    if (!this.selectedSource) {
      alert("Please select a screen or window to share")
      return
    }

    try {
      await window.electronAPI.startScreenCapture(this.selectedSource)
      this.isScreenSharing = true
      this.updateUI()
    } catch (error) {
      console.error("Failed to start screen sharing:", error)
      alert(`Failed to start screen sharing: ${error.message}`)
    }
  }

  async stopScreenSharing() {
    try {
      await window.electronAPI.stopScreenCapture()
      this.isScreenSharing = false
      this.updateUI()
    } catch (error) {
      console.error("Failed to stop screen sharing:", error)
    }
  }

  async toggleRemoteControl() {
    try {
      if (this.isControlEnabled) {
        await window.electronAPI.disableRemoteControl()
        this.isControlEnabled = false
      } else {
        const result = await window.electronAPI.enableRemoteControl()
        this.isControlEnabled = result.enabled
      }
      this.updateUI()
    } catch (error) {
      console.error("Failed to toggle remote control:", error)
    }
  }

  showConnectionRequest(data) {
    document.getElementById("requestingUser").textContent = data.guestUser.email
    document.getElementById("connectionModal").style.display = "flex"
    this.pendingRequest = data
  }

  async acceptConnectionRequest() {
    if (this.pendingRequest) {
      try {
        await window.electronAPI.acceptConnection(this.pendingRequest.sessionId)
        document.getElementById("connectionModal").style.display = "none"
        this.pendingRequest = null
      } catch (error) {
        console.error("Failed to accept connection:", error)
      }
    }
  }

  async rejectConnectionRequest() {
    if (this.pendingRequest) {
      try {
        await window.electronAPI.rejectConnection(this.pendingRequest.sessionId)
        document.getElementById("connectionModal").style.display = "none"
        this.pendingRequest = null
      } catch (error) {
        console.error("Failed to reject connection:", error)
      }
    }
  }

  handleConnectionAccepted(data) {
    this.currentSession = data
    this.sessionStartTime = Date.now()
    this.startSessionTimer()
    this.updateUI()
    this.initializeWebRTC()
  }

  handleConnectionRejected(data) {
    alert("Connection request was rejected")
  }

  handleSessionEnded(data) {
    this.currentSession = null
    this.sessionStartTime = null
    this.stopSessionTimer()
    this.isControlEnabled = false
    this.cleanupWebRTC()
    this.updateUI()
  }

  handleServerDisconnected() {
    this.isConnected = false
    this.currentSession = null
    this.sessionStartTime = null
    this.stopSessionTimer()
    this.isControlEnabled = false
    this.updateConnectionStatus("offline", "Offline")
    this.updateUI()
  }

  async endSession() {
    // Implementation would depend on the specific session management
    this.handleSessionEnded({})
  }

  startSessionTimer() {
    this.sessionTimer = setInterval(() => {
      if (this.sessionStartTime) {
        const duration = Date.now() - this.sessionStartTime
        const hours = Math.floor(duration / 3600000)
        const minutes = Math.floor((duration % 3600000) / 60000)
        const seconds = Math.floor((duration % 60000) / 1000)
        document.getElementById("sessionDuration").textContent = `${hours.toString().padStart(2, "0")}:${minutes
          .toString()
          .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      }
    }, 1000)
  }

  stopSessionTimer() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer)
      this.sessionTimer = null
    }
  }

  // WebRTC Implementation
  initializeWebRTC() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    })

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentSession) {
        window.electronAPI.sendWebRTCIceCandidate(this.currentSession.sessionId, event.candidate)
      }
    }

    this.peerConnection.onconnectionstatechange = () => {
      console.log("WebRTC connection state:", this.peerConnection.connectionState)
    }
  }

  async handleWebRTCOffer(data) {
    if (!this.peerConnection) {
      this.initializeWebRTC()
    }

    try {
      await this.peerConnection.setRemoteDescription(data.offer)
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)
      window.electronAPI.sendWebRTCAnswer(this.currentSession.sessionId, answer)
    } catch (error) {
      console.error("Error handling WebRTC offer:", error)
    }
  }

  async handleWebRTCAnswer(data) {
    try {
      await this.peerConnection.setRemoteDescription(data.answer)
    } catch (error) {
      console.error("Error handling WebRTC answer:", error)
    }
  }

  async handleWebRTCIceCandidate(data) {
    try {
      await this.peerConnection.addIceCandidate(data.candidate)
    } catch (error) {
      console.error("Error handling ICE candidate:", error)
    }
  }

  cleanupWebRTC() {
    if (this.peerConnection) {
      this.peerConnection.close()
      this.peerConnection = null
    }
  }

  updateConnectionStatus(status, text) {
    const statusDot = document.querySelector(".status-dot")
    const statusText = document.querySelector(".status-text")

    statusDot.className = `status-dot ${status}`
    statusText.textContent = text
  }

  updateUI() {
    // Show/hide sections based on connection state
    document.getElementById("connectionSection").style.display = this.isConnected ? "none" : "block"
    document.getElementById("codeSection").style.display = this.isConnected ? "block" : "none"
    document.getElementById("screenSection").style.display = this.isConnected ? "block" : "none"
    document.getElementById("controlSection").style.display = this.isConnected ? "block" : "none"
    document.getElementById("sessionSection").style.display = this.currentSession ? "block" : "none"

    // Update screen sharing buttons
    document.getElementById("startSharingBtn").style.display = this.isScreenSharing ? "none" : "inline-block"
    document.getElementById("stopSharingBtn").style.display = this.isScreenSharing ? "inline-block" : "none"

    // Update remote control status
    const controlIndicator = document.getElementById("controlIndicator")
    const controlBtn = document.getElementById("toggleControlBtn")

    if (this.isControlEnabled) {
      controlIndicator.innerHTML = `
        <span class="indicator-dot enabled"></span>
        <span class="indicator-text">Remote control enabled</span>
      `
      controlBtn.textContent = "Disable Remote Control"
      controlBtn.className = "btn btn-danger"
    } else {
      controlIndicator.innerHTML = `
        <span class="indicator-dot disabled"></span>
        <span class="indicator-text">Remote control disabled</span>
      `
      controlBtn.textContent = "Enable Remote Control"
      controlBtn.className = "btn btn-secondary"
    }

    // Update session info
    if (this.currentSession) {
      document.getElementById("connectedUser").textContent = this.currentSession.guestUser?.email || "Unknown"
    }
  }
}

// Initialize the application
document.addEventListener("DOMContentLoaded", () => {
  new RemoteDesktopAgent()
})
