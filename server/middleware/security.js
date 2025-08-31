const rateLimit = require("express-rate-limit")
const { body, validationResult } = require("express-validator")
const crypto = require("crypto")

// Rate limiting configurations
const createAuthLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      error: "Too many authentication attempts, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  })

const createConnectionLimiter = () =>
  rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 connection attempts per window
    message: {
      error: "Too many connection attempts, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  })

const createGeneralLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: {
      error: "Too many requests, please try again later",
    },
    standardHeaders: true,
    legacyHeaders: false,
  })

// Input validation rules
const registerValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    ),
  body("firstName").trim().isLength({ min: 1, max: 50 }).withMessage("First name must be between 1 and 50 characters"),
  body("lastName").trim().isLength({ min: 1, max: 50 }).withMessage("Last name must be between 1 and 50 characters"),
]

const loginValidation = [
  body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address"),
  body("password").notEmpty().withMessage("Password is required"),
]

const connectionCodeValidation = [
  body("code")
    .isLength({ min: 6, max: 6 })
    .isAlphanumeric()
    .toUpperCase()
    .withMessage("Connection code must be exactly 6 alphanumeric characters"),
]

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation failed",
      details: errors.array(),
    })
  }
  next()
}

// Secure connection code generation
const generateSecureConnectionCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let result = ""
  const randomBytes = crypto.randomBytes(6)

  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length]
  }

  return result
}

// Password strength validation
const validatePasswordStrength = (password) => {
  const minLength = 8
  const hasUpperCase = /[A-Z]/.test(password)
  const hasLowerCase = /[a-z]/.test(password)
  const hasNumbers = /\d/.test(password)
  const hasSpecialChar = /[@$!%*?&]/.test(password)

  return {
    isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
    requirements: {
      minLength: password.length >= minLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChar,
    },
  }
}

// IP address extraction for logging
const getClientIP = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null)
  )
}

// Security headers middleware
const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  next()
}

module.exports = {
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
}
