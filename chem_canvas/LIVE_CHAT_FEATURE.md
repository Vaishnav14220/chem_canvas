# Live Chat Feature - Gemini Live API Integration

## Overview
The Live Chat feature provides real-time voice and text communication with Google's Gemini AI using the Gemini Live API. This feature enables natural conversation flow with audio streaming capabilities.

## ✅ Features

### 🎤 Voice Recording & Playback
- Real-time audio recording with noise suppression
- Audio playback for AI responses
- WebM to WAV conversion for better compatibility
- Microphone permission handling

### 💬 Text & Audio Messages
- Send text messages
- Send voice messages by recording audio
- Receive both text and audio responses from AI
- Message history with timestamps

### 🔄 Real-time Streaming
- Live connection to Gemini Live API
- Streaming audio responses
- Connection status indicators
- Error handling and automatic fallback to text mode

### 🔙 Fallback Mode
- Automatic fallback to text-only chat if Live API unavailable
- Seamless experience with text messages using standard Gemini API
- User is clearly informed about the mode

## Technical Implementation

### Core Components

1. **GeminiLiveService** (`src/services/geminiLiveService.ts`)
   - Manages connection to Gemini Live API
   - Handles message streaming and audio processing
   - Provides callbacks for UI updates
   - Automatic fallback to text-only mode

2. **AudioUtils** (`src/utils/audioUtils.ts`)
   - Audio recording and playback functionality
   - WebM to WAV conversion
   - Microphone permission handling
   - Audio format utilities

3. **LiveChat Component** (`src/components/LiveChat.tsx`)
   - React component for the chat interface
   - Real-time message display
   - Audio controls and visual feedback
   - Connection management UI

### API Configuration
- **Primary Model**: `models/gemini-2.5-flash-native-audio-preview-09-2025` (Live API)
- **Fallback Model**: `gemini-2.5-flash` (Text-only)
- **Voice**: Zephyr
- **Media Resolution**: Medium
- **Response Modalities**: Audio + Text

## 🚀 Usage

### Starting Live Chat
1. Click the "Live Chat" button in the header navigation
2. Grant microphone permissions when prompted
3. Click "Connect" to establish connection
4. The system will either connect to Live API or use text-only mode

### Voice Messages (if Live API available)
1. Click and hold the "Voice Message" button
2. Speak your message
3. Release the button to send
4. AI will respond with both text and audio

### Text Messages
1. Type your message in the input field
2. Press Enter or click Send
3. Receive AI response in real-time
4. Works in both Live API and fallback modes

## 🔧 Troubleshooting

### Connection Issues
If Live Chat shows "Disconnected" and won't connect:

1. **Check Browser Console** (F12 → Console tab)
   - Look for error messages
   - Share detailed error info

2. **Network Requirements**
   - Ensure stable internet connection
   - Check firewall/VPN isn't blocking WebSocket connections
   - WebSocket requires specific ports (443 for wss://)

3. **Browser Compatibility**
   - Use modern browser: Chrome, Firefox, Safari, or Edge
   - Ensure browser has WebRTC support
   - Try different browser if issue persists

4. **API Key Issues**
   - Verify Gemini API keys are correctly configured in Firebase
   - Check API keys haven't reached quota limits
   - Ensure keys have Live API enabled

### Fallback Mode (Text-Only)
- If Live API fails, the app automatically falls back to text-only chat
- You'll see a message: "🎤 Live voice connection failed... Falling back to text-only mode"
- Text messages will still work perfectly
- This is expected behavior if Live API is not available in your region

## 🌐 Browser Requirements
- Modern browser with WebRTC support
- WebSocket support for real-time communication
- Microphone access (for voice features)
- Audio playback capabilities

## 📦 Dependencies
- `@google/genai` (^1.25.0): Google's Gemini Live API client
- `mime` (^4.1.0): MIME type detection
- Built-in browser APIs for audio recording/playback

## 🔐 Environment Setup

### Required Environment Variables
```
GEMINI_API_KEY=your_api_key_here
```

### Firebase Configuration
API keys should be stored in Firebase Firestore under `apiKeys` collection with the following structure:
```json
{
  "key": "AIzaSy...",
  "index": 1,
  "isActive": true,
  "usageCount": 0,
  "lastUsed": null,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

## 📊 Known Limitations
- Live API availability depends on region and API quota
- Voice quality depends on microphone and connection quality
- Audio messages limited to 30 seconds max
- Silence or very short recordings (<0.5s) are rejected

## 🔄 Auto-Fallback Strategy

The Live Chat feature implements an intelligent fallback system:

1. **Connection Phase**
   - Attempts Live API connection for 15 seconds
   - If successful → Full voice + text mode
   - If timeout/error → Automatic fallback to text mode

2. **Message Sending**
   - Live API session available → Send via WebSocket
   - Live API unavailable → Send via REST API (text-only)

3. **User Experience**
   - Clear status indicators (Connecting → Connected/Error)
   - Informative messages about current mode
   - Seamless transition between modes

## 🚀 Future Enhancements
- Multiple voice options
- Audio quality settings
- Conversation export
- Custom wake words
- Multi-language support
- Connection retry mechanism with exponential backoff
