# Remote Desktop Application Architecture

## System Overview

This is a complete open-source remote desktop application similar to AnyDesk/TeamViewer, built with modern web technologies and peer-to-peer connections.

## Architecture Components

### 1. Frontend (Next.js Web App)
- **Technology**: Next.js 15 + TypeScript + Tailwind CSS
- **Features**:
  - User authentication (login/register)
  - Generate & share connection codes
  - Join remote sessions by entering codes
  - Dashboard for active sessions
  - Real-time connection status

### 2. Backend (Signaling Server)
- **Technology**: Node.js + Express + Socket.IO
- **Responsibilities**:
  - WebRTC signaling (offer/answer exchange)
  - Peer connection coordination
  - Session management
  - User authentication (JWT)
  - Connection code generation/validation

### 3. Desktop Agent (Electron App)
- **Technology**: Electron + Node.js
- **Features**:
  - Screen capture using desktopCapturer
  - Audio capture (optional)
  - Remote input injection (mouse/keyboard)
  - WebRTC peer connection
  - Clipboard sharing
  - File transfer

### 4. Database Schema
- **Users**: id, email, password_hash, created_at
- **Sessions**: id, host_user_id, guest_user_id, connection_code, status, created_at, ended_at
- **Session_logs**: id, session_id, event_type, timestamp, metadata

## Data Flow

1. **Connection Initiation**:
   - Host opens desktop agent → generates connection code
   - Guest enters code in web app → requests connection
   - Signaling server validates code and initiates WebRTC handshake

2. **WebRTC P2P Connection**:
   - Signaling server exchanges ICE candidates, offers, and answers
   - Direct peer-to-peer connection established
   - Screen sharing and remote control begin

3. **Security**:
   - All WebRTC connections use DTLS-SRTP encryption
   - Connection codes are temporary (5-minute expiry)
   - User must explicitly allow remote control

## Technology Stack

### Frontend
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Socket.IO client
- WebRTC APIs

### Backend
- Node.js + Express
- Socket.IO for real-time communication
- JWT for authentication
- MongoDB/PostgreSQL for data persistence
- WebRTC signaling

### Desktop Agent
- Electron (cross-platform)
- desktopCapturer for screen capture
- robotjs for input injection
- Socket.IO client
- WebRTC peer connection

### Deployment
- Frontend: Vercel
- Backend: Railway/Render
- Database: MongoDB Atlas (free tier)
- Desktop Agent: Electron packaged executables

## Security Features

1. **End-to-End Encryption**: WebRTC DTLS-SRTP
2. **Temporary Codes**: 6-digit codes expire in 5 minutes
3. **User Consent**: Explicit permission required for remote access
4. **Session Logging**: All connections logged for audit
5. **JWT Authentication**: Secure user sessions

## Scalability Considerations

- WebRTC peer-to-peer reduces server bandwidth
- Signaling server only handles connection setup
- Horizontal scaling possible for signaling servers
- Database sharding for large user bases
