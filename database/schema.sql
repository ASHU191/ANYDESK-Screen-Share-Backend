-- Remote Desktop Application Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    connection_code VARCHAR(10) UNIQUE NOT NULL,
    host_user_id INTEGER REFERENCES users(id),
    guest_user_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, ended, rejected
    host_peer_id VARCHAR(255),
    guest_peer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds INTEGER,
    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'ended', 'rejected'))
);

-- Session logs for audit trail
CREATE TABLE session_logs (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    event_type VARCHAR(50) NOT NULL, -- connection_requested, connection_accepted, connection_rejected, screen_shared, control_granted, disconnected
    user_id INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connection codes (temporary, auto-expire)
CREATE TABLE connection_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_sessions_connection_code ON sessions(connection_code);
CREATE INDEX idx_sessions_host_user ON sessions(host_user_id);
CREATE INDEX idx_sessions_guest_user ON sessions(guest_user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_session_logs_session_id ON session_logs(session_id);
CREATE INDEX idx_session_logs_timestamp ON session_logs(timestamp);
CREATE INDEX idx_connection_codes_code ON connection_codes(code);
CREATE INDEX idx_connection_codes_expires_at ON connection_codes(expires_at);

-- Auto-cleanup expired connection codes (PostgreSQL function)
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void AS $$
BEGIN
    DELETE FROM connection_codes WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every 5 minutes (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-codes', '*/5 * * * *', 'SELECT cleanup_expired_codes();');
