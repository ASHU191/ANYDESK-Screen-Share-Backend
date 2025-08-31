const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const cors = require("cors")
const helmet = require("helmet")
const jwt = require("jsonwebtoken")
const bcrypt = require("bcryptjs")
const { Pool } = require("pg")
const { v4: uuidv4 } = require("uuid")
require("dotenv").config()

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Middleware
const {
  createAuthLimiter,
  createConnectionLimiter,
  createGeneralLimiter,
  registerValidation,
  loginValidation,
  connectionCodeValidation,
  handleValidationErrors,
  generateSecureConnectionCode,
  validatePasswordStrength,
  getClientIP,
  securityHeaders,
} = require("./middleware/security")
const AuditLogger = require("./middleware/audit")

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
)

app.use(securityHeaders)
app.use(createGeneralLimiter())

// Initialize audit logger
const auditLogger = new AuditLogger(pool)

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
  }),
)
app.use(express.json())

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key"

// Utility functions
const generateConnectionCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

// Socket.IO authentication middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) {
    return next(new Error("Authentication error"))
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return next(new Error("Authentication error"))
    }
    socket.user = user
    next()
  })
}

// REST API Routes

// User Registration
app.post("/api/auth/register", createAuthLimiter(), registerValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body
    const clientIP = getClientIP(req)
    const userAgent = req.get("User-Agent")

    // Check if IP is blocked
    const isBlocked = await pool.query("SELECT is_ip_blocked($1) as blocked", [clientIP])
    if (isBlocked.rows[0].blocked) {
      await auditLogger.logSecurityEvent("blocked_ip_attempt", null, clientIP, userAgent)
      return res.status(429).json({ error: "IP address is temporarily blocked" })
    }

    // Check if user already exists
    const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email])
    if (existingUser.rows.length > 0) {
      await auditLogger.logAuthAttempt(null, email, false, clientIP, userAgent, "user_already_exists")
      return res.status(400).json({ error: "User already exists" })
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.isValid) {
      await auditLogger.logAuthAttempt(null, email, false, clientIP, userAgent, "weak_password")
      return res.status(400).json({
        error: "Password does not meet security requirements",
        requirements: passwordValidation.requirements,
      })
    }

    // Hash password with higher salt rounds for better security
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Create user
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name",
      [email, passwordHash, firstName, lastName],
    )

    const user = result.rows[0]

    // Create default security settings
    await pool.query("INSERT INTO user_security_settings (user_id) VALUES ($1)", [user.id])

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" })

    await auditLogger.logAuthAttempt(user.id, email, true, clientIP, userAgent, "registration_success")

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// User Login
app.post("/api/auth/login", createAuthLimiter(), loginValidation, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body
    const clientIP = getClientIP(req)
    const userAgent = req.get("User-Agent")

    // Check if IP is blocked
    const isBlocked = await pool.query("SELECT is_ip_blocked($1) as blocked", [clientIP])
    if (isBlocked.rows[0].blocked) {
      await auditLogger.logSecurityEvent("blocked_ip_attempt", null, clientIP, userAgent)
      return res.status(429).json({ error: "IP address is temporarily blocked" })
    }

    // Find user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email])
    if (result.rows.length === 0) {
      await auditLogger.logAuthAttempt(null, email, false, clientIP, userAgent, "user_not_found")
      await recordFailedAttempt(clientIP, email)
      return res.status(401).json({ error: "Invalid credentials" })
    }

    const user = result.rows[0]

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    if (!isValidPassword) {
      await auditLogger.logAuthAttempt(user.id, email, false, clientIP, userAgent, "invalid_password")
      await recordFailedAttempt(clientIP, email)
      return res.status(401).json({ error: "Invalid credentials" })
    }

    // Clear failed attempts on successful login
    await pool.query("DELETE FROM failed_attempts WHERE ip_address = $1 OR email = $2", [clientIP, email])

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "24h" })

    await auditLogger.logAuthAttempt(user.id, email, true, clientIP, userAgent, "login_success")

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ error: "Internal server error" })
  }
})

// Helper function to record failed attempts
async function recordFailedAttempt(ipAddress, email) {
  try {
    const existing = await pool.query("SELECT * FROM failed_attempts WHERE ip_address = $1", [ipAddress])

    if (existing.rows.length > 0) {
      const attemptCount = existing.rows[0].attempt_count + 1
      let blockedUntil = null

      // Block IP after 5 failed attempts for 1 hour
      if (attemptCount >= 5) {
        blockedUntil = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      }

      await pool.query(
        "UPDATE failed_attempts SET attempt_count = $1, last_attempt = NOW(), blocked_until = $2 WHERE ip_address = $3",
        [attemptCount, blockedUntil, ipAddress],
      )
    } else {
      await pool.query("INSERT INTO failed_attempts (ip_address, email, attempt_count) VALUES ($1, $2, 1)", [
        ipAddress,
        email,
      ])
    }
  } catch (error) {
    console.error("Failed to record failed attempt:", error)
  }
}

// Generate Connection Code
app.post("/api/connection/generate", authenticateToken, createConnectionLimiter(), async (req, res) => {
  try {
    const userId = req.user.id
    const clientIP = getClientIP(req)
    const code = generateSecureConnectionCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

    // Invalidate any existing codes for this user
    await pool.query("UPDATE connection_codes SET is_used = true WHERE user_id = $1 AND is_used = false", [userId])

    await pool.query("INSERT INTO connection_codes (code, user_id, expires_at) VALUES ($1, $2, $3)", [
      code,
      userId,
      expiresAt,
    ])

    await auditLogger.logSecurityEvent("connection_code_generated", userId, clientIP, req.get("User-Agent"), { code })

    res.json({
      code,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("Code generation error:", error)
    res.status(500).json({ error: "Failed to generate connection code" })
  }
})

// Validate Connection Code
app.post(
  "/api/connection/validate",
  authenticateToken,
  createConnectionLimiter(),
  connectionCodeValidation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { code } = req.body
      const guestUserId = req.user.id
      const clientIP = getClientIP(req)
      const userAgent = req.get("User-Agent")

      const result = await pool.query(
        `SELECT cc.*, u.email, u.first_name, u.last_name 
       FROM connection_codes cc 
       JOIN users u ON cc.user_id = u.id 
       WHERE cc.code = $1 AND cc.expires_at > NOW() AND cc.is_used = false`,
        [code],
      )

      if (result.rows.length === 0) {
        await auditLogger.logConnectionAttempt(null, guestUserId, clientIP, userAgent, false, "invalid_code")
        return res.status(404).json({ error: "Invalid or expired connection code" })
      }

      const connectionData = result.rows[0]

      // Prevent self-connection
      if (connectionData.user_id === guestUserId) {
        await auditLogger.logConnectionAttempt(null, guestUserId, clientIP, userAgent, false, "self_connection_attempt")
        return res.status(400).json({ error: "Cannot connect to your own computer" })
      }

      // Mark code as used
      await pool.query("UPDATE connection_codes SET is_used = true WHERE code = $1", [code])

      // Create session
      const sessionResult = await pool.query(
        "INSERT INTO sessions (connection_code, host_user_id, guest_user_id, status) VALUES ($1, $2, $3, $4) RETURNING id",
        [code, connectionData.user_id, guestUserId, "pending"],
      )

      const sessionId = sessionResult.rows[0].id

      await auditLogger.logConnectionAttempt(sessionId, guestUserId, clientIP, userAgent, true, "code_validated")

      res.json({
        sessionId,
        hostUser: {
          id: connectionData.user_id,
          email: connectionData.email,
          firstName: connectionData.first_name,
          lastName: connectionData.last_name,
        },
      })
    } catch (error) {
      console.error("Code validation error:", error)
      res.status(500).json({ error: "Failed to validate connection code" })
    }
  },
)

// Get User Sessions
app.get("/api/sessions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id

    const result = await pool.query(
      `
      SELECT s.*, 
             hu.email as host_email, hu.first_name as host_first_name, hu.last_name as host_last_name,
             gu.email as guest_email, gu.first_name as guest_first_name, gu.last_name as guest_last_name
      FROM sessions s
      LEFT JOIN users hu ON s.host_user_id = hu.id
      LEFT JOIN users gu ON s.guest_user_id = gu.id
      WHERE s.host_user_id = $1 OR s.guest_user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 50
    `,
      [userId],
    )

    const sessions = result.rows.map((session) => ({
      id: session.id,
      connectionCode: session.connection_code,
      status: session.status,
      createdAt: session.created_at,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      durationSeconds: session.duration_seconds,
      hostUser: {
        id: session.host_user_id,
        email: session.host_email,
        firstName: session.host_first_name,
        lastName: session.host_last_name,
      },
      guestUser: session.guest_user_id
        ? {
            id: session.guest_user_id,
            email: session.guest_email,
            firstName: session.guest_first_name,
            lastName: session.guest_last_name,
          }
        : null,
      isHost: session.host_user_id === userId,
    }))

    res.json({ sessions })
  } catch (error) {
    console.error("Sessions fetch error:", error)
    res.status(500).json({ error: "Failed to fetch sessions" })
  }
})

// Socket.IO WebRTC Signaling
io.use(authenticateSocket)

// Store active connections
const activeConnections = new Map()
const activeSessions = new Map()

io.on("connection", (socket) => {
  console.log(`User ${socket.user.email} connected with socket ${socket.id}`)

  activeConnections.set(socket.user.id, {
    socketId: socket.id,
    user: socket.user,
  })

  // Join room for connection requests
  socket.join(`user_${socket.user.id}`)

  // Handle connection request from guest
  socket.on("request_connection", async (data) => {
    try {
      const { sessionId } = data

      // Get session details
      const sessionResult = await pool.query(
        "SELECT * FROM sessions WHERE id = $1 AND guest_user_id = $2 AND status = $3",
        [sessionId, socket.user.id, "pending"],
      )

      if (sessionResult.rows.length === 0) {
        socket.emit("connection_error", { error: "Invalid session" })
        return
      }

      const session = sessionResult.rows[0]
      const hostConnection = activeConnections.get(session.host_user_id)

      if (!hostConnection) {
        socket.emit("connection_error", { error: "Host is not online" })
        return
      }

      // Notify host about connection request
      io.to(hostConnection.socketId).emit("connection_request", {
        sessionId: session.id,
        guestUser: {
          id: socket.user.id,
          email: socket.user.email,
        },
      })

      // Log the event
      await pool.query("INSERT INTO session_logs (session_id, event_type, user_id, metadata) VALUES ($1, $2, $3, $4)", [
        sessionId,
        "connection_requested",
        socket.user.id,
        JSON.stringify({ socketId: socket.id }),
      ])
    } catch (error) {
      console.error("Connection request error:", error)
      socket.emit("connection_error", { error: "Failed to process connection request" })
    }
  })

  // Handle connection acceptance from host
  socket.on("accept_connection", async (data) => {
    try {
      const { sessionId } = data

      // Verify host owns this session
      const sessionResult = await pool.query("SELECT * FROM sessions WHERE id = $1 AND host_user_id = $2", [
        sessionId,
        socket.user.id,
      ])

      if (sessionResult.rows.length === 0) {
        socket.emit("connection_error", { error: "Unauthorized" })
        return
      }

      const session = sessionResult.rows[0]
      const guestConnection = activeConnections.get(session.guest_user_id)

      if (!guestConnection) {
        socket.emit("connection_error", { error: "Guest is no longer online" })
        return
      }

      // Update session status
      await pool.query("UPDATE sessions SET status = $1, started_at = NOW() WHERE id = $2", ["active", sessionId])

      // Create WebRTC room
      const roomId = `session_${sessionId}`
      socket.join(roomId)
      io.sockets.sockets.get(guestConnection.socketId)?.join(roomId)

      // Store active session
      activeSessions.set(sessionId, {
        hostSocketId: socket.id,
        guestSocketId: guestConnection.socketId,
        roomId,
      })

      // Notify both parties
      io.to(roomId).emit("connection_accepted", { sessionId, roomId })

      // Log the event
      await pool.query("INSERT INTO session_logs (session_id, event_type, user_id, metadata) VALUES ($1, $2, $3, $4)", [
        sessionId,
        "connection_accepted",
        socket.user.id,
        JSON.stringify({ roomId }),
      ])
    } catch (error) {
      console.error("Connection acceptance error:", error)
      socket.emit("connection_error", { error: "Failed to accept connection" })
    }
  })

  // Handle connection rejection from host
  socket.on("reject_connection", async (data) => {
    try {
      const { sessionId } = data

      // Update session status
      await pool.query("UPDATE sessions SET status = $1, ended_at = NOW() WHERE id = $2", ["rejected", sessionId])

      const sessionResult = await pool.query("SELECT guest_user_id FROM sessions WHERE id = $1", [sessionId])
      if (sessionResult.rows.length > 0) {
        const guestConnection = activeConnections.get(sessionResult.rows[0].guest_user_id)
        if (guestConnection) {
          io.to(guestConnection.socketId).emit("connection_rejected", { sessionId })
        }
      }

      // Log the event
      await pool.query("INSERT INTO session_logs (session_id, event_type, user_id, metadata) VALUES ($1, $2, $3, $4)", [
        sessionId,
        "connection_rejected",
        socket.user.id,
        JSON.stringify({}),
      ])
    } catch (error) {
      console.error("Connection rejection error:", error)
    }
  })

  // WebRTC Signaling Events
  socket.on("webrtc_offer", (data) => {
    const { sessionId, offer } = data
    const session = activeSessions.get(sessionId)

    if (session) {
      const targetSocketId = socket.id === session.hostSocketId ? session.guestSocketId : session.hostSocketId
      io.to(targetSocketId).emit("webrtc_offer", { offer, from: socket.user.id })
    }
  })

  socket.on("webrtc_answer", (data) => {
    const { sessionId, answer } = data
    const session = activeSessions.get(sessionId)

    if (session) {
      const targetSocketId = socket.id === session.hostSocketId ? session.guestSocketId : session.hostSocketId
      io.to(targetSocketId).emit("webrtc_answer", { answer, from: socket.user.id })
    }
  })

  socket.on("webrtc_ice_candidate", (data) => {
    const { sessionId, candidate } = data
    const session = activeSessions.get(sessionId)

    if (session) {
      const targetSocketId = socket.id === session.hostSocketId ? session.guestSocketId : session.hostSocketId
      io.to(targetSocketId).emit("webrtc_ice_candidate", { candidate, from: socket.user.id })
    }
  })

  // Handle remote control events
  socket.on("remote_mouse_move", (data) => {
    const { sessionId, x, y } = data
    const session = activeSessions.get(sessionId)

    if (session && socket.id === session.guestSocketId) {
      io.to(session.hostSocketId).emit("remote_mouse_move", { x, y })
    }
  })

  socket.on("remote_mouse_click", (data) => {
    const { sessionId, button, x, y } = data
    const session = activeSessions.get(sessionId)

    if (session && socket.id === session.guestSocketId) {
      io.to(session.hostSocketId).emit("remote_mouse_click", { button, x, y })
    }
  })

  socket.on("remote_key_press", (data) => {
    const { sessionId, key, modifiers } = data
    const session = activeSessions.get(sessionId)

    if (session && socket.id === session.guestSocketId) {
      io.to(session.hostSocketId).emit("remote_key_press", { key, modifiers })
    }
  })

  // Handle disconnection
  socket.on("disconnect", async () => {
    console.log(`User ${socket.user.email} disconnected`)

    // Remove from active connections
    activeConnections.delete(socket.user.id)

    // End any active sessions
    for (const [sessionId, session] of activeSessions.entries()) {
      if (session.hostSocketId === socket.id || session.guestSocketId === socket.id) {
        // Update session in database
        const startTime = await pool.query("SELECT started_at FROM sessions WHERE id = $1", [sessionId])
        if (startTime.rows.length > 0 && startTime.rows[0].started_at) {
          const duration = Math.floor((Date.now() - new Date(startTime.rows[0].started_at).getTime()) / 1000)
          await pool.query("UPDATE sessions SET status = $1, ended_at = NOW(), duration_seconds = $2 WHERE id = $3", [
            "ended",
            duration,
            sessionId,
          ])
        }

        // Notify other party
        const otherSocketId = session.hostSocketId === socket.id ? session.guestSocketId : session.hostSocketId
        io.to(otherSocketId).emit("session_ended", { sessionId })

        // Remove from active sessions
        activeSessions.delete(sessionId)

        // Log the event
        await pool.query(
          "INSERT INTO session_logs (session_id, event_type, user_id, metadata) VALUES ($1, $2, $3, $4)",
          [sessionId, "disconnected", socket.user.id, JSON.stringify({ reason: "socket_disconnect" })],
        )
      }
    }
  })
})

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully")
  server.close(() => {
    pool.end()
    process.exit(0)
  })
})
