const { Pool } = require("pg")
require("dotenv").config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
})

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect()
    console.log("Database connected successfully")
    client.release()
  } catch (error) {
    console.error("Database connection error:", error)
    process.exit(1)
  }
}

// Initialize database tables
const initializeDatabase = async () => {
  try {
    const client = await pool.connect()

    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        connection_code VARCHAR(10) UNIQUE NOT NULL,
        host_user_id INTEGER REFERENCES users(id),
        guest_user_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        host_peer_id VARCHAR(255),
        guest_peer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        duration_seconds INTEGER,
        CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'ended', 'rejected'))
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id),
        event_type VARCHAR(50) NOT NULL,
        user_id INTEGER REFERENCES users(id),
        ip_address INET,
        user_agent TEXT,
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS connection_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        expires_at TIMESTAMP NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `)

    // Create indexes
    await client.query("CREATE INDEX IF NOT EXISTS idx_sessions_connection_code ON sessions(connection_code);")
    await client.query("CREATE INDEX IF NOT EXISTS idx_sessions_host_user ON sessions(host_user_id);")
    await client.query("CREATE INDEX IF NOT EXISTS idx_sessions_guest_user ON sessions(guest_user_id);")
    await client.query("CREATE INDEX IF NOT EXISTS idx_connection_codes_code ON connection_codes(code);")
    await client.query("CREATE INDEX IF NOT EXISTS idx_connection_codes_expires_at ON connection_codes(expires_at);")

    console.log("Database tables initialized successfully")
    client.release()
  } catch (error) {
    console.error("Database initialization error:", error)
    process.exit(1)
  }
}

module.exports = {
  pool,
  testConnection,
  initializeDatabase,
}
