# Remote Desktop Signaling Server

This is the WebRTC signaling server for the remote desktop application. It handles peer-to-peer connection setup, user authentication, and session management.

## Features

- User authentication with JWT
- Connection code generation and validation
- WebRTC signaling (offer/answer/ICE candidates)
- Real-time session management
- Session logging and audit trail
- Remote control event forwarding

## Setup

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Set up environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your database credentials and JWT secret
\`\`\`

3. Set up PostgreSQL database and run the schema:
\`\`\`bash
psql -d your_database -f ../database/schema.sql
\`\`\`

4. Start the server:
\`\`\`bash
npm run dev  # Development
npm start    # Production
\`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login

### Connection Management
- `POST /api/connection/generate` - Generate connection code (requires auth)
- `POST /api/connection/validate` - Validate connection code (requires auth)
- `GET /api/sessions` - Get user sessions (requires auth)

### Health Check
- `GET /health` - Server health status

## Socket.IO Events

### Connection Management
- `request_connection` - Guest requests connection to host
- `accept_connection` - Host accepts connection request
- `reject_connection` - Host rejects connection request

### WebRTC Signaling
- `webrtc_offer` - Send WebRTC offer
- `webrtc_answer` - Send WebRTC answer
- `webrtc_ice_candidate` - Exchange ICE candidates

### Remote Control
- `remote_mouse_move` - Mouse movement events
- `remote_mouse_click` - Mouse click events
- `remote_key_press` - Keyboard events

## Security

- JWT authentication for all API endpoints
- Socket.IO authentication middleware
- CORS protection
- Helmet security headers
- Session validation and logging
