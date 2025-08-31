-- Enhanced security tables for audit logging and session management

-- Audit logs table for comprehensive security logging
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- auth_attempt, connection_attempt, session_started, session_ended, security_violation
    session_id INTEGER REFERENCES sessions(id),
    user_id INTEGER REFERENCES users(id),
    email VARCHAR(255),
    success BOOLEAN DEFAULT NULL, -- NULL for non-success/failure events
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Failed login attempts tracking
CREATE TABLE IF NOT EXISTS failed_attempts (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    email VARCHAR(255),
    attempt_count INTEGER DEFAULT 1,
    last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    blocked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Active sessions tracking for security
CREATE TABLE IF NOT EXISTS active_sessions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    socket_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Security settings per user
CREATE TABLE IF NOT EXISTS user_security_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    allowed_ip_ranges JSONB, -- Array of allowed IP ranges
    session_timeout_minutes INTEGER DEFAULT 60,
    require_approval_for_connections BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

CREATE INDEX IF NOT EXISTS idx_failed_attempts_ip ON failed_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_email ON failed_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_attempts_blocked_until ON failed_attempts(blocked_until);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user_id ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_session_id ON active_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_is_active ON active_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_user_security_settings_user_id ON user_security_settings(user_id);

-- Function to clean up old audit logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days';
    DELETE FROM failed_attempts WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update last activity for active sessions
CREATE OR REPLACE FUNCTION update_session_activity(p_session_id INTEGER)
RETURNS void AS $$
BEGIN
    UPDATE active_sessions 
    SET last_activity = NOW() 
    WHERE session_id = p_session_id AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Function to check if IP is blocked
CREATE OR REPLACE FUNCTION is_ip_blocked(p_ip_address INET)
RETURNS BOOLEAN AS $$
DECLARE
    blocked_until TIMESTAMP;
BEGIN
    SELECT f.blocked_until INTO blocked_until
    FROM failed_attempts f
    WHERE f.ip_address = p_ip_address
    AND f.blocked_until > NOW()
    LIMIT 1;
    
    RETURN blocked_until IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
