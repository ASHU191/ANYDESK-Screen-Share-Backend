# RemoteDesk Desktop Agent

The desktop agent is an Electron application that runs on the host computer to enable remote desktop access.

## Features

- Screen capture and sharing via WebRTC
- Remote mouse and keyboard control
- Secure connection management
- Real-time session monitoring
- Cross-platform support (Windows, macOS, Linux)

## Installation

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Development mode:
\`\`\`bash
npm run dev
\`\`\`

3. Build for production:
\`\`\`bash
npm run build
\`\`\`

## Usage

1. **Connect to Server**: Enter your server URL and authentication token
2. **Generate Connection Code**: Create a code for others to connect
3. **Select Screen**: Choose which screen or window to share
4. **Enable Remote Control**: Allow remote users to control your computer
5. **Accept Connections**: Approve incoming connection requests

## Security

- All connections require explicit user approval
- Remote control must be manually enabled
- WebRTC provides end-to-end encryption
- Session logging for audit purposes

## System Requirements

- **Windows**: Windows 10 or later
- **macOS**: macOS 10.14 or later  
- **Linux**: Ubuntu 18.04 or equivalent

## Building Executables

- Windows: \`npm run build-win\`
- macOS: \`npm run build-mac\`
- Linux: \`npm run build-linux\`

The built applications will be in the \`dist\` folder.
