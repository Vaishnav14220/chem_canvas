import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
} from '@google/genai';
import { assignRandomApiKey } from '../firebase/apiKeys';

export interface LiveChatMessage {
  id: string;
  type: 'user' | 'ai' | 'system';
  content: string;
  timestamp: Date;
  audioBlob?: Blob;
  isAudio?: boolean;
}

export interface LiveChatCallbacks {
  onMessage?: (message: LiveChatMessage) => void;
  onAudioReceived?: (audioBlob: Blob) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

interface LiveModelStrategy {
  model: string;
  description: string;
  type: 'native' | 'half';
  config: Record<string, unknown>;
}

class GeminiLiveService {
  private ai: GoogleGenAI | null = null;
  private session: Session | null = null;
  private responseQueue: LiveServerMessage[] = [];
  private audioParts: string[] = [];
  private callbacks: LiveChatCallbacks = {};
  private isConnected = false;
  private currentApiKey: string | null = null;
  private activeModel: string | null = null;
  private remainingStrategies: LiveModelStrategy[] = [];
  private readonly systemInstruction = "You are ChemAssist, a helpful chemistry assistant. You can help with chemical concepts, equations, molecular structures, laboratory techniques, and answer questions about chemistry. Be friendly, accurate, and provide clear explanations.";

  constructor() {
    this.handleModelTurn = this.handleModelTurn.bind(this);
  }

  async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Gemini Live service...');
      const apiKey = await assignRandomApiKey();
      const sanitizedKey = apiKey?.trim();
      console.log('🔑 API Key obtained:', sanitizedKey ? `${sanitizedKey.substring(0, 10)}...` : 'No');
      
      if (!sanitizedKey) {
        throw new Error('No API key available');
      }
      
      console.log('🏗️ Creating GoogleGenAI instance...');
      this.ai = new GoogleGenAI({
        apiKey: sanitizedKey,
      });

      this.currentApiKey = sanitizedKey;
      
      console.log('🔍 Checking available AI methods:', Object.keys(this.ai));
      console.log('🔍 Live API available:', !!this.ai.live);
      
      if (this.ai.live) {
        console.log('🔍 Live API methods:', Object.keys(this.ai.live));
      }
      
      console.log('✅ Gemini Live service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Live service:', error);
      console.error('🔍 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error
      });
      throw new Error(`Failed to initialize Gemini Live service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async connect(callbacks: LiveChatCallbacks): Promise<void> {
    if (!this.ai) {
      await this.initialize();
    }

    this.callbacks = callbacks;
    this.callbacks.onStatusChange?.('connecting');

    try {
      console.log('🚀 Attempting to connect to Gemini Live...');

      if (!this.ai!.live) {
        console.warn('⚠️ Gemini Live API is not available in this SDK version, enabling text fallback.');
        this.handleLiveFallback();
        return;
      }

      this.remainingStrategies = this.getModelStrategies();
      await this.tryNextStrategy();
    } catch (error) {
      this.handleConnectionFailure(error);
    }
  }

  private async tryNextStrategy(lastError?: Error | null): Promise<void> {
    const strategy = this.remainingStrategies.shift();

    if (!strategy) {
      this.handleLiveFallback(lastError);
      return;
    }

    try {
      await this.openSessionWithStrategy(strategy);
      this.activeModel = strategy.model;
      console.log(`✅ Connected to Gemini Live using ${strategy.model}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(`⚠️ Connection attempt with ${strategy.model} failed: ${err.message}`);
      await this.tryNextStrategy(err);
    }
  }

  private getModelStrategies(): LiveModelStrategy[] {
    return [
      {
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        description: 'Gemini 2.5 Flash Native Audio (preview)',
        type: 'native',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: this.systemInstruction,
        },
      },
      {
        model: 'gemini-live-2.5-flash-preview',
        description: 'Gemini Live 2.5 Flash (half-cascade preview)',
        type: 'half',
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
          systemInstruction: this.systemInstruction,
        },
      },
      {
        model: 'gemini-2.0-flash-live-001',
        description: 'Gemini 2.0 Flash Live (GA)',
        type: 'half',
        config: {
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck',
              },
            },
          },
          systemInstruction: this.systemInstruction,
        },
      },
    ];
  }

  private async openSessionWithStrategy(strategy: LiveModelStrategy): Promise<void> {
    console.log(`🎯 Trying live model ${strategy.model} (${strategy.description})`);

    // Reset session state before attempting a new connection
    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        console.warn('⚠️ Error closing previous session:', error);
      }
      this.session = null;
    }
    this.responseQueue = [];
    this.audioParts = [];
    this.isConnected = false;

    if (this.currentApiKey) {
      console.log(`🔐 Using API key ending with ${this.currentApiKey.slice(-4)} for live connection.`);
    }

    this.session = await this.ai!.live.connect({
      model: strategy.model,
      config: strategy.config,
      callbacks: this.buildCallbacks(strategy.model),
    });
  }

  private buildCallbacks(modelName: string) {
    return {
      onopen: () => {
        console.log(`✅ Live chat connection opened for model ${modelName}`);
        this.isConnected = true;
        this.activeModel = modelName;
        this.callbacks.onStatusChange?.('connected');
        void this.processMessages();
      },
      onmessage: (message: LiveServerMessage) => {
        console.log('📨 Received message:', message);
        this.responseQueue.push(message);
      },
      onerror: (e: ErrorEvent) => {
        console.error(`❌ Live chat streaming error (${modelName}):`, e);
        this.isConnected = false;
        const errorMessage = e.message || 'Unknown streaming error';

        if (errorMessage.includes('API key') && this.remainingStrategies.length > 0) {
          console.warn('🔁 Live streaming error indicates key issue for this model. Trying next available model.');
          void this.tryNextStrategy(new Error(errorMessage));
          return;
        }

        this.callbacks.onError?.(new Error(`Live session error (${modelName}): ${errorMessage}`));
        this.callbacks.onStatusChange?.('error');
      },
      onclose: (e: CloseEvent) => {
        console.log(`🔌 Live chat connection closed for ${modelName}:`, e.reason, 'Code:', e.code);
        this.isConnected = false;
        this.activeModel = null;

        if (e.code !== 1000) {
          const reason = e.reason || 'Unknown reason';

          if ((reason.includes('API key') || reason.includes('API_KEY')) && this.remainingStrategies.length > 0) {
            console.warn(`🔁 Model ${modelName} closed due to key issue. Trying next model...`);
            void this.tryNextStrategy(new Error(reason));
            return;
          }

          this.callbacks.onError?.(new Error(`Connection closed unexpectedly (${modelName}): ${reason}`));
          this.callbacks.onStatusChange?.('error');
        } else {
          this.callbacks.onStatusChange?.('disconnected');
        }
      },
    };
  }

  private handleLiveFallback(lastError?: Error | null): void {
    const reason = lastError?.message ?? 'Live API not available.';
    console.log('🔄 Falling back to text-only mode:', reason);

    const fallbackMsg: LiveChatMessage = {
      id: `fallback_${Date.now()}`,
      type: 'ai',
  content: `🎤 Live voice features are not available right now (${reason}). I\'m switching to text chat mode.`,
      timestamp: new Date(),
      isAudio: false,
    };

    if (this.activeModel) {
      console.log(`ℹ️ Previous live model ${this.activeModel} is not available, continuing in text mode.`);
    }
    this.session = null;
    this.activeModel = null;
    this.callbacks.onMessage?.(fallbackMsg);
    this.isConnected = true;
    this.callbacks.onStatusChange?.('connected');
  }

  private handleConnectionFailure(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Failed to connect to Gemini Live:', err);

    if (err.message.includes('API key') || err.message.includes('API_KEY') || err.message.includes('UNAUTHENTICATED')) {
      this.callbacks.onError?.(new Error(`Live API rejected the key: ${err.message}. Ensure your key is Live API enabled in Google AI Studio.`));
      this.callbacks.onStatusChange?.('error');
      return;
    }

    this.handleLiveFallback(err);
  }

  private async processMessages(): Promise<void> {
    while (this.isConnected) {
      if (this.responseQueue.length > 0) {
        const message = this.responseQueue.shift();
        if (message) {
          await this.handleModelTurn(message);
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  private async handleModelTurn(message: LiveServerMessage): Promise<void> {
    console.log('Processing message:', message);

    if (message.data) {
      // Handle audio data directly
      console.log('Received audio data:', message.data.length);

      this.audioParts.push(message.data);

      // Convert to WAV and create blob
      const buffer = this.convertToWav(this.audioParts, 'audio/pcm;rate=24000');
      const audioBlob = new Blob([buffer], { type: 'audio/wav' });

      const audioMessage: LiveChatMessage = {
        id: `audio_${Date.now()}_${Math.random()}`,
        type: 'ai',
        content: 'Audio response',
        timestamp: new Date(),
        audioBlob,
        isAudio: true,
      };

      this.callbacks.onMessage?.(audioMessage);
      this.callbacks.onAudioReceived?.(audioBlob);
      this.audioParts = []; // Clear after processing
    }

    if (message.text) {
      // Handle text responses
      const textMessage: LiveChatMessage = {
        id: `msg_${Date.now()}_${Math.random()}`,
        type: 'ai',
        content: message.text,
        timestamp: new Date(),
        isAudio: false,
      };
      this.callbacks.onMessage?.(textMessage);
    }

    // Handle server content for turn completion
    if (message.serverContent?.turnComplete) {
      console.log('Turn complete, clearing audio parts');
      this.audioParts = []; // Clear audio parts when turn is complete
    }
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Gemini Live');
    }

    try {
      // Add user message to callbacks first
      const userMessage: LiveChatMessage = {
        id: `user_${Date.now()}_${Math.random()}`,
        type: 'user',
        content: message,
        timestamp: new Date(),
        isAudio: false,
      };
      this.callbacks.onMessage?.(userMessage);

      // If we have a session, use live API
      if (this.session) {
        this.session.sendRealtimeInput({
          text: message,
        });
      } else {
        // Fallback to regular Gemini API
        console.log('Using fallback mode for message:', message);
        await this.sendFallbackMessage(message);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  private async sendFallbackMessage(message: string): Promise<void> {
    try {
      console.log('🔄 Using fallback message mode with text API...');

      // Try the new API structure with models.generateContent
      const result = await this.ai!.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ role: 'user', parts: [{ text: message }] }]
      });

      // Extract text from the response - handle different response structures
      let responseText = 'Sorry, I could not process your message.';

      if (result.candidates && result.candidates[0]) {
        const candidate = result.candidates[0];
        if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
          responseText = candidate.content.parts[0].text || responseText;
        }
      } else if (result.text) {
        responseText = result.text;
      }

      const aiMessage: LiveChatMessage = {
        id: `ai_${Date.now()}_${Math.random()}`,
        type: 'ai',
        content: responseText,
        timestamp: new Date(),
        isAudio: false,
      };
      this.callbacks.onMessage?.(aiMessage);
    } catch (error) {
      console.error('❌ Fallback message failed:', error);

      // Provide a simple fallback response if API call fails
      const aiMessage: LiveChatMessage = {
        id: `ai_${Date.now()}_${Math.random()}`,
        type: 'ai',
        content: 'I received your message, but I\'m having trouble processing it right now. Please try again or use the voice feature if available.',
        timestamp: new Date(),
        isAudio: false,
      };
      this.callbacks.onMessage?.(aiMessage);
    }
  }

  async sendAudio(audioBlob: Blob): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to Gemini Live');
    }

    try {
      console.log(`Sending audio: ${audioBlob.size} bytes, type: ${audioBlob.type}`);
      
      // Add user audio message to callbacks
      const userMessage: LiveChatMessage = {
        id: `user_audio_${Date.now()}_${Math.random()}`,
        type: 'user',
        content: 'Audio message',
        timestamp: new Date(),
        audioBlob,
        isAudio: true,
      };
      this.callbacks.onMessage?.(userMessage);

      // If we have a session, use live API
      if (this.session) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

        // Send with proper audio configuration
        this.session.sendRealtimeInput({
          audio: {
            data: base64Data,
            mimeType: "audio/pcm;rate=16000"
          }
        });

        console.log('Audio sent successfully to Gemini Live');
      } else {
        // Fallback mode - provide better feedback
        console.log('Audio fallback mode - Live API not available');
        const aiMessage: LiveChatMessage = {
          id: `ai_${Date.now()}_${Math.random()}`,
          type: 'ai',
          content: 'I received your audio message, but live voice processing is currently not available. Please use text messages for now, or try reconnecting to enable voice features.',
          timestamp: new Date(),
          isAudio: false,
        };
        this.callbacks.onMessage?.(aiMessage);
      }
    } catch (error) {
      console.error('Failed to send audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Provide user-friendly error message
      const errorMsg: LiveChatMessage = {
        id: `error_${Date.now()}_${Math.random()}`,
        type: 'ai',
        content: `Sorry, there was an issue processing your audio: ${errorMessage}. Please try recording again or use text messages.`,
        timestamp: new Date(),
        isAudio: false,
      };
      this.callbacks.onMessage?.(errorMsg);
      
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.isConnected = false;
    this.responseQueue = [];
    this.audioParts = [];
    this.activeModel = null;
    this.callbacks.onStatusChange?.('disconnected');
  }

  isConnectedToLive(): boolean {
    return this.isConnected;
  }

  private convertToWav(rawData: string[], mimeType: string): ArrayBuffer {
    const options = this.parseMimeType(mimeType);
    const dataLength = rawData.reduce((a, b) => a + b.length, 0);
    const wavHeader = this.createWavHeader(dataLength, options);
    
    // Convert base64 strings to Uint8Array
    const audioData = new Uint8Array(dataLength);
    let offset = 0;
    for (const data of rawData) {
      const decoded = this.base64ToUint8Array(data);
      audioData.set(decoded, offset);
      offset += decoded.length;
    }

    // Combine header and audio data
    const combined = new Uint8Array(wavHeader.length + audioData.length);
    combined.set(wavHeader, 0);
    combined.set(audioData, wavHeader.length);

    return combined.buffer;
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  private parseMimeType(mimeType: string): { numChannels: number; sampleRate: number; bitsPerSample: number } {
    const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
    const [_, format] = fileType.split('/');

    const options: Partial<{ numChannels: number; sampleRate: number; bitsPerSample: number }> = {
      numChannels: 1,
      bitsPerSample: 16,
    };

    if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
        options.bitsPerSample = bits;
      }
    }

    for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
        options.sampleRate = parseInt(value, 10);
      }
    }

    return {
      numChannels: options.numChannels || 1,
      sampleRate: options.sampleRate || 16000,
      bitsPerSample: options.bitsPerSample || 16,
    };
  }

  private createWavHeader(dataLength: number, options: { numChannels: number; sampleRate: number; bitsPerSample: number }): Uint8Array {
    const { numChannels, sampleRate, bitsPerSample } = options;

    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = new Uint8Array(44);

    // Helper function to write string to buffer
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        buffer[offset + i] = str.charCodeAt(i);
      }
    };

    // Helper function to write little-endian values
    const writeUInt32LE = (offset: number, value: number) => {
      buffer[offset] = value & 0xFF;
      buffer[offset + 1] = (value >> 8) & 0xFF;
      buffer[offset + 2] = (value >> 16) & 0xFF;
      buffer[offset + 3] = (value >> 24) & 0xFF;
    };

    const writeUInt16LE = (offset: number, value: number) => {
      buffer[offset] = value & 0xFF;
      buffer[offset + 1] = (value >> 8) & 0xFF;
    };

    writeString(0, 'RIFF');                      // ChunkID
    writeUInt32LE(4, 36 + dataLength);           // ChunkSize
    writeString(8, 'WAVE');                      // Format
    writeString(12, 'fmt ');                     // Subchunk1ID
    writeUInt32LE(16, 16);                       // Subchunk1Size (PCM)
    writeUInt16LE(20, 1);                        // AudioFormat (1 = PCM)
    writeUInt16LE(22, numChannels);              // NumChannels
    writeUInt32LE(24, sampleRate);               // SampleRate
    writeUInt32LE(28, byteRate);                 // ByteRate
    writeUInt16LE(32, blockAlign);               // BlockAlign
    writeUInt16LE(34, bitsPerSample);            // BitsPerSample
    writeString(36, 'data');                     // Subchunk2ID
    writeUInt32LE(40, dataLength);               // Subchunk2Size

    return buffer;
  }
}

// Export singleton instance
export const geminiLiveService = new GeminiLiveService();
