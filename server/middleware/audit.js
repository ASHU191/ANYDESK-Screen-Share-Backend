const { Pool } = require("pg")

class AuditLogger {
  constructor(pool) {
    this.pool = pool
  }

  async logAuthAttempt(userId, email, success, ipAddress, userAgent, reason = null) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (event_type, user_id, email, success, ip_address, user_agent, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        ["auth_attempt", userId, email, success, ipAddress, userAgent, JSON.stringify({ reason })],
      )
    } catch (error) {
      console.error("Failed to log auth attempt:", error)
    }
  }

  async logConnectionAttempt(sessionId, userId, ipAddress, userAgent, success, reason = null) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (event_type, session_id, user_id, success, ip_address, user_agent, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        ["connection_attempt", sessionId, userId, success, ipAddress, userAgent, JSON.stringify({ reason })],
      )
    } catch (error) {
      console.error("Failed to log connection attempt:", error)
    }
  }

  async logSessionEvent(sessionId, userId, eventType, ipAddress, metadata = {}) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (event_type, session_id, user_id, ip_address, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [eventType, sessionId, userId, ipAddress, JSON.stringify(metadata)],
      )
    } catch (error) {
      console.error("Failed to log session event:", error)
    }
  }

  async logSecurityEvent(eventType, userId, ipAddress, userAgent, metadata = {}) {
    try {
      await this.pool.query(
        `INSERT INTO audit_logs (event_type, user_id, ip_address, user_agent, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [eventType, userId, ipAddress, userAgent, JSON.stringify(metadata)],
      )
    } catch (error) {
      console.error("Failed to log security event:", error)
    }
  }

  async getRecentFailedAttempts(ipAddress, windowMinutes = 15) {
    try {
      const result = await this.pool.query(
        `SELECT COUNT(*) as count FROM audit_logs 
         WHERE ip_address = $1 
         AND success = false 
         AND timestamp > NOW() - INTERVAL '${windowMinutes} minutes'`,
        [ipAddress],
      )
      return Number.parseInt(result.rows[0].count)
    } catch (error) {
      console.error("Failed to get failed attempts:", error)
      return 0
    }
  }

  async getUserSessions(userId, limit = 50) {
    try {
      const result = await this.pool.query(
        `SELECT * FROM audit_logs 
         WHERE user_id = $1 
         AND event_type IN ('auth_attempt', 'connection_attempt', 'session_started', 'session_ended')
         ORDER BY timestamp DESC 
         LIMIT $2`,
        [userId, limit],
      )
      return result.rows
    } catch (error) {
      console.error("Failed to get user sessions:", error)
      return []
    }
  }
}

module.exports = AuditLogger
