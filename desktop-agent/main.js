const { app, BrowserWindow, ipcMain, desktopCapturer, screen, dialog } = require("electron")
const path = require("path")
const robot = require("robotjs")
const io = require("socket.io-client")

// Keep a global reference of the window object
let mainWindow
let socket = null
let currentSession = null
let isControlEnabled = false
let screenStream = null

// Configure robotjs for better performance
robot.setXDisplayName(process.env.DISPLAY || ":0")
robot.setKeyboardDelay(1)
robot.setMouseDelay(1)

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: path.join(__dirname, "assets", "icon.png"),
    title: "RemoteDesk Agent",
    resizable: false,
    maximizable: false,
  })

  // Load the app
  mainWindow.loadFile("renderer/index.html")

  // Open DevTools in development
  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on("closed", () => {
    mainWindow = null
    if (socket) {
      socket.disconnect()
    }
  })
}

// App event listeners
app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC handlers for renderer communication
ipcMain.handle("connect-to-server", async (event, { serverUrl, token }) => {
  try {
    if (socket) {
      socket.disconnect()
    }

    socket = io(serverUrl, {
      auth: { token },
    })

    return new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log("Connected to signaling server")
        setupSocketListeners()
        resolve({ success: true })
      })

      socket.on("connect_error", (error) => {
        console.error("Connection error:", error)
        reject(new Error("Failed to connect to server"))
      })

      // Set timeout for connection
      setTimeout(() => {
        if (!socket.connected) {
          reject(new Error("Connection timeout"))
        }
      }, 10000)
    })
  } catch (error) {
    console.error("Connection error:", error)
    throw error
  }
})

ipcMain.handle("disconnect-from-server", async () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  currentSession = null
  isControlEnabled = false
  return { success: true }
})

ipcMain.handle("generate-connection-code", async () => {
  if (!socket || !socket.connected) {
    throw new Error("Not connected to server")
  }

  // This would typically be handled by the server
  // For now, we'll generate a simple code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase()
  return { code, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() }
})

ipcMain.handle("get-screen-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 150, height: 150 },
    })

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }))
  } catch (error) {
    console.error("Error getting screen sources:", error)
    throw error
  }
})

ipcMain.handle("start-screen-capture", async (event, sourceId) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sourceId,
          minWidth: 1280,
          maxWidth: 1920,
          minHeight: 720,
          maxHeight: 1080,
          minFrameRate: 15,
          maxFrameRate: 30,
        },
      },
    })

    screenStream = stream
    return { success: true }
  } catch (error) {
    console.error("Error starting screen capture:", error)
    throw error
  }
})

ipcMain.handle("stop-screen-capture", async () => {
  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop())
    screenStream = null
  }
  return { success: true }
})

ipcMain.handle("enable-remote-control", async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: ["Allow", "Deny"],
    defaultId: 0,
    title: "Remote Control Permission",
    message: "Allow remote control of this computer?",
    detail: "The remote user will be able to control your mouse and keyboard.",
  })

  isControlEnabled = result.response === 0
  return { enabled: isControlEnabled }
})

ipcMain.handle("disable-remote-control", async () => {
  isControlEnabled = false
  return { enabled: false }
})

// Socket event listeners
function setupSocketListeners() {
  socket.on("connection_request", (data) => {
    console.log("Connection request received:", data)
    mainWindow.webContents.send("connection-request", data)
  })

  socket.on("connection_accepted", (data) => {
    console.log("Connection accepted:", data)
    currentSession = data
    mainWindow.webContents.send("connection-accepted", data)
  })

  socket.on("connection_rejected", (data) => {
    console.log("Connection rejected:", data)
    mainWindow.webContents.send("connection-rejected", data)
  })

  socket.on("session_ended", (data) => {
    console.log("Session ended:", data)
    currentSession = null
    isControlEnabled = false
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop())
      screenStream = null
    }
    mainWindow.webContents.send("session-ended", data)
  })

  // WebRTC signaling events
  socket.on("webrtc_offer", (data) => {
    console.log("WebRTC offer received")
    mainWindow.webContents.send("webrtc-offer", data)
  })

  socket.on("webrtc_answer", (data) => {
    console.log("WebRTC answer received")
    mainWindow.webContents.send("webrtc-answer", data)
  })

  socket.on("webrtc_ice_candidate", (data) => {
    console.log("ICE candidate received")
    mainWindow.webContents.send("webrtc-ice-candidate", data)
  })

  // Remote control events
  socket.on("remote_mouse_move", (data) => {
    if (isControlEnabled) {
      robot.moveMouse(data.x, data.y)
    }
  })

  socket.on("remote_mouse_click", (data) => {
    if (isControlEnabled) {
      robot.moveMouse(data.x, data.y)
      robot.mouseClick(data.button || "left")
    }
  })

  socket.on("remote_key_press", (data) => {
    if (isControlEnabled) {
      try {
        // Handle modifier keys
        const modifiers = data.modifiers || []
        if (modifiers.length > 0) {
          robot.keyTap(data.key, modifiers)
        } else {
          robot.keyTap(data.key)
        }
      } catch (error) {
        console.error("Error processing key press:", error)
      }
    }
  })

  socket.on("disconnect", () => {
    console.log("Disconnected from server")
    currentSession = null
    isControlEnabled = false
    mainWindow.webContents.send("server-disconnected")
  })
}

// IPC handlers for WebRTC signaling
ipcMain.handle("send-webrtc-offer", async (event, { sessionId, offer }) => {
  if (socket && currentSession) {
    socket.emit("webrtc_offer", { sessionId, offer })
  }
})

ipcMain.handle("send-webrtc-answer", async (event, { sessionId, answer }) => {
  if (socket && currentSession) {
    socket.emit("webrtc_answer", { sessionId, answer })
  }
})

ipcMain.handle("send-webrtc-ice-candidate", async (event, { sessionId, candidate }) => {
  if (socket && currentSession) {
    socket.emit("webrtc_ice_candidate", { sessionId, candidate })
  }
})

ipcMain.handle("accept-connection", async (event, sessionId) => {
  if (socket) {
    socket.emit("accept_connection", { sessionId })
  }
})

ipcMain.handle("reject-connection", async (event, sessionId) => {
  if (socket) {
    socket.emit("reject_connection", { sessionId })
  }
})

// Get system information
ipcMain.handle("get-system-info", async () => {
  const displays = screen.getAllDisplays()
  return {
    platform: process.platform,
    arch: process.arch,
    displays: displays.map((display) => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      primary: display.primary,
    })),
  }
})
