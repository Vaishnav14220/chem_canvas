import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Phone, 
  PhoneOff, 
  Loader2,
  AlertCircle,
  CheckCircle,
  MessageCircle,
  Headphones
} from 'lucide-react';
import { geminiLiveService, LiveChatMessage, LiveChatCallbacks } from '../services/geminiLiveService';
import { 
  audioRecorder, 
  audioPlayer, 
  requestMicrophonePermission, 
  checkAudioSupport,
  convertWebmToWav,
  validateAudioContent,
  detectAudioContent
} from '../utils/audioUtils';

interface LiveChatProps {
  onClose?: () => void;
  className?: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export default function LiveChat({ onClose, className = '' }: LiveChatProps) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [audioSupport, setAudioSupport] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check audio support and permissions
    const checkSupport = async () => {
      const support = checkAudioSupport();
      setAudioSupport(support);
      
      if (support) {
        const permission = await requestMicrophonePermission();
        setPermissionGranted(permission);
      }
    };
    
    checkSupport();
    
    return () => {
      // Cleanup on unmount
      if (isRecording) {
        audioRecorder.stopRecording();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      audioPlayer.stop();
      geminiLiveService.disconnect();
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Add detailed debugging information
      console.log('🔍 Starting Live Chat connection process...');
      const extendedWindow = window as typeof window & { webkitRTCPeerConnection?: RTCPeerConnection };

      console.log('📋 Browser info:', {
        userAgent: navigator.userAgent,
        mediaDevices: !!navigator.mediaDevices,
        mediaRecorder: !!window.MediaRecorder,
        webRTC: !!(extendedWindow.RTCPeerConnection || extendedWindow.webkitRTCPeerConnection)
      });
      
      const callbacks: LiveChatCallbacks = {
        onMessage: (message: LiveChatMessage) => {
          console.log('📨 Received message:', message);
          setMessages(prev => [...prev, message]);
        },
        onAudioReceived: async (audioBlob: Blob) => {
          try {
            console.log('🔊 Playing AI audio response:', audioBlob.size, 'bytes');
            setIsAISpeaking(true);
            await audioPlayer.play(audioBlob);
            console.log('✅ AI audio response played successfully');
          } catch (error) {
            console.error('❌ Failed to play audio:', error);
            setError('Failed to play AI voice response');
          } finally {
            setIsAISpeaking(false);
          }
        },
        onError: (error: Error) => {
          console.error('❌ LiveChat error:', error);
          setError(error.message);
          setConnectionStatus('error');
        },
        onStatusChange: (status: ConnectionStatus) => {
          console.log('🔄 Connection status changed:', status);
          setConnectionStatus(status);
        },
      };

      console.log('🚀 Attempting to connect to Live Chat...');
      await geminiLiveService.connect(callbacks);
      console.log('✅ Live Chat connected successfully!');
    } catch (error) {
      console.error('❌ Failed to connect:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to live chat';
      console.error('🔍 Full error details:', {
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      setError(errorMessage);
      setConnectionStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    geminiLiveService.disconnect();
    setMessages([]);
    setError(null);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || connectionStatus !== 'connected') return;

    try {
      await geminiLiveService.sendMessage(inputMessage);
      setInputMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
    }
  };

  const handleStartRecording = async () => {
    if (!permissionGranted) {
      setError('Microphone permission required');
      return;
    }

    try {
      await audioRecorder.startRecording();
      setIsRecording(true);
      setRecordingDuration(0);
      setError(null); // Clear any previous errors
      
      // Start recording duration timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 0.1;
          // Auto-stop recording if it exceeds 25 seconds (to leave buffer for 30s limit)
          if (newDuration >= 25) {
            handleStopRecording();
            return prev;
          }
          return newDuration;
        });
      }, 100);
      
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      // Stop the recording timer
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      const audioBlob = await audioRecorder.stopRecording();
      setIsRecording(false);
      
      console.log(`Recording stopped. Duration: ${recordingDuration.toFixed(1)}s, Size: ${audioBlob.size} bytes`);
      
      if (connectionStatus === 'connected') {
        // Validate audio content before sending
        console.log('🎵 Validating audio blob:', {
          size: audioBlob.size,
          type: audioBlob.type,
          trackedDuration: recordingDuration
        });
        
        const validation = await validateAudioContent(audioBlob);
        
        console.log('🎵 Audio validation result:', validation);
        
        // Additional check: if validation fails due to duration but tracked duration is reasonable, allow it
        if (!validation.isValid && validation.reason?.includes('too long') && recordingDuration <= 25) {
          console.log('🎵 Overriding duration validation - tracked duration is reasonable');
          // Check if audio has content despite duration issue
          const hasContent = await detectAudioContent(audioBlob);
          if (hasContent) {
            console.log('🎵 Audio has content, proceeding despite duration warning');
          } else {
            setError(`Recording issue: ${validation.reason}. Please try speaking more clearly and closer to the microphone, or use text messages instead.`);
            return;
          }
        } else if (!validation.isValid) {
          console.log('Audio validation failed:', validation.reason);
          setError(`Recording issue: ${validation.reason}. Please try speaking more clearly and closer to the microphone, or use text messages instead.`);
          return;
        }
        
        console.log('Audio validation passed, sending audio...');
        
        // Convert to WAV format for better compatibility
        const wavBlob = await convertWebmToWav(audioBlob);
        await geminiLiveService.sendAudio(wavBlob);
        
        // Clear any previous errors on successful send
        setError(null);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to stop recording');
      setIsRecording(false);
    }
  };

  const handlePlayAudio = async (audioBlob: Blob) => {
    try {
      setIsPlaying(true);
      setIsAISpeaking(true);
      console.log('Manually playing audio:', audioBlob.size, 'bytes');
      await audioPlayer.play(audioBlob);
      console.log('Manual audio playback completed');
    } catch (error) {
      console.error('Failed to play audio:', error);
      setError(error instanceof Error ? error.message : 'Failed to play audio');
    } finally {
      setIsPlaying(false);
      setIsAISpeaking(false);
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-green-400';
      case 'connecting': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <CheckCircle size={16} className="text-green-400" />;
      case 'connecting': return <Loader2 size={16} className="text-yellow-400 animate-spin" />;
      case 'error': return <AlertCircle size={16} className="text-red-400" />;
      default: return <Phone size={16} className="text-gray-400" />;
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-gray-800 rounded-2xl shadow-2xl flex flex-col h-full border border-gray-700 ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-800 text-white px-6 py-4 rounded-t-2xl shadow-lg border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600/20 p-2 rounded-lg">
              <Headphones size={22} className="text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-white">Live Chat</h2>
              <p className="text-xs text-purple-300">Powered by Gemini Live API</p>
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <span className={`text-xs font-medium ${getStatusColor()}`}>
                  {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {connectionStatus === 'disconnected' && (
              <button
                onClick={handleConnect}
                disabled={isLoading || !audioSupport}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
                Connect
              </button>
            )}
            
            {connectionStatus === 'connected' && (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <PhoneOff size={16} />
                Disconnect
              </button>
            )}
            
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Audio Support Status */}
        {!audioSupport && (
          <div className="mt-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-red-300">
              <AlertCircle size={16} />
              <span className="text-sm">Audio not supported in this browser</span>
            </div>
          </div>
        )}

        {audioSupport && !permissionGranted && (
          <div className="mt-3 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-300">
              <AlertCircle size={16} />
              <span className="text-sm">Microphone permission required for voice chat</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
          <div className="flex items-center gap-2 text-red-300">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 bg-gray-900">
        {messages.length === 0 ? (
          <div className="text-center mt-12 animate-fade-in">
            <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg border border-purple-600/30">
              <MessageCircle size={40} className="text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Live Chat Ready!</h3>
            <p className="text-gray-400 mb-1">Connect to start a conversation</p>
            <p className="text-sm text-gray-500">💬 Text messages available • 🎤 Voice features available</p>
            {connectionStatus === 'connected' && (
              <div className="mt-4 p-3 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                <p className="text-sm text-blue-300">
                  ✨ Connected! You can now send text messages and try voice features.
                </p>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
              <div className={`max-w-[80%] rounded-2xl p-4 shadow-md ${
                message.type === 'user' 
                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-sm' 
                  : 'bg-gray-800 border border-gray-700 rounded-tl-sm'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {message.type === 'user' ? (
                    <span className="text-xs font-semibold opacity-90">You</span>
                  ) : (
                    <>
                      <div className="bg-gradient-to-br from-purple-600/20 to-indigo-600/20 p-1 rounded-lg">
                        <Headphones size={12} className="text-purple-400" />
                      </div>
                      <span className="text-xs font-semibold text-gray-300">AI Assistant</span>
                    </>
                  )}
                  <span className="text-xs opacity-70">{formatTime(message.timestamp)}</span>
                </div>
                
                {message.isAudio && message.audioBlob ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handlePlayAudio(message.audioBlob!)}
                      disabled={isPlaying || isAISpeaking}
                      className="p-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <span className="text-sm text-gray-300">🎤 Audio response</span>
                    {isAISpeaking && (
                      <span className="text-xs text-blue-400 animate-pulse">Playing...</span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm">{message.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/80 backdrop-blur-sm rounded-b-2xl">
        {connectionStatus === 'connected' && (
          <div className="flex gap-3 mb-3">
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              disabled={!permissionGranted}
              className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 font-medium ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                  : 'bg-gray-700 hover:bg-gray-600 text-white disabled:bg-gray-800 disabled:cursor-not-allowed'
              }`}
            >
              {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              {isRecording ? `Recording... ${recordingDuration.toFixed(1)}s${recordingDuration >= 20 ? ' (will auto-stop soon)' : ''}` : 'Voice Message'}
            </button>
            
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-red-300">Speak clearly into your microphone</span>
              </div>
            )}
            
            {isAISpeaking && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border border-blue-700/50 rounded-lg">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-blue-300">AI is speaking...</span>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="💬 Type a message..."
            disabled={connectionStatus !== 'connected'}
            className="flex-1 px-4 py-3 border-2 border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-gray-700 text-white placeholder-gray-400 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || connectionStatus !== 'connected'}
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
