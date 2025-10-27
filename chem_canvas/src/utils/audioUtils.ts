export interface AudioRecorder {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  isRecording: () => boolean;
  cleanup: () => void;
}

export interface AudioPlayer {
  play: (audioBlob: Blob) => Promise<void>;
  stop: () => void;
  isPlaying: () => boolean;
  setVolume: (volume: number) => void;
}

class AudioRecorderImpl implements AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioStream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private isRecordingState = false;

  async startRecording(): Promise<void> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100, // Higher sample rate for better quality
          channelCount: 1, // Mono channel
        },
      });

      // Get available MIME types and use the best one for Gemini Live
      const mimeTypes = [
        'audio/wav',
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ];
      
      let selectedMimeType = 'audio/wav';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      this.mediaRecorder = new MediaRecorder(this.audioStream, {
        mimeType: selectedMimeType,
        audioBitsPerSecond: 128000, // Higher bitrate for better quality
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250); // Collect data every 250ms for better quality
      this.isRecordingState = true;
      
      console.log(`Recording started with MIME type: ${selectedMimeType}`);
    } catch (error) {
      console.error('Error starting audio recording:', error);
      throw new Error('Failed to start audio recording. Please check microphone permissions.');
    }
  }

  async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecordingState) {
        reject(new Error('No active recording to stop'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm;codecs=opus' });
        this.isRecordingState = false;
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  isRecording(): boolean {
    return this.isRecordingState;
  }

  cleanup(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder.stop();
      this.mediaRecorder = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }

    this.recordedChunks = [];
    this.isRecordingState = false;
  }
}

class AudioPlayerImpl implements AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private isPlayingState = false;

  async play(audioBlob: Blob): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.audioElement) {
        this.stop();
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      this.audioElement = new Audio(audioUrl);
      
      // Set volume to a reasonable level
      this.audioElement.volume = 0.8;

      this.audioElement.onended = () => {
        console.log('Audio playback ended');
        this.isPlayingState = false;
        URL.revokeObjectURL(audioUrl);
        resolve();
      };

      this.audioElement.onerror = (error) => {
        console.error('Audio playback error:', error);
        this.isPlayingState = false;
        URL.revokeObjectURL(audioUrl);
        reject(new Error('Failed to play audio'));
      };

      this.audioElement.oncanplaythrough = () => {
        console.log('Audio ready to play, starting playback...');
        this.audioElement?.play().catch(error => {
          console.error('Failed to start audio playback:', error);
          this.isPlayingState = false;
          URL.revokeObjectURL(audioUrl);
          reject(error);
        });
        this.isPlayingState = true;
      };

      this.audioElement.onloadstart = () => {
        console.log('Starting to load audio...');
      };

      this.audioElement.load();
    });
  }

  stop(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.isPlayingState = false;
    }
  }

  isPlaying(): boolean {
    return this.isPlayingState;
  }

  setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
    }
  }
}

// Utility functions for audio format conversion
export function convertWebmToWav(webmBlob: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const wavBlob = createWavBlob(arrayBuffer);
        resolve(wavBlob);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read audio file'));
    reader.readAsArrayBuffer(webmBlob);
  });
}

function createWavBlob(audioData: ArrayBuffer): Blob {
  const buffer = new ArrayBuffer(44 + audioData.byteLength);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + audioData.byteLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, audioData.byteLength, true);

  // Copy audio data
  const uint8Array = new Uint8Array(buffer);
  const audioArray = new Uint8Array(audioData);
  uint8Array.set(audioArray, 44);

  return new Blob([buffer], { type: 'audio/wav' });
}

// Export instances
export const audioRecorder = new AudioRecorderImpl();
export const audioPlayer = new AudioPlayerImpl();

// Permission utilities
export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error('Microphone permission denied:', error);
    return false;
  }
}

export function checkAudioSupport(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return false;
  }

  const mediaDevices = navigator.mediaDevices;
  const hasGetUserMedia = typeof mediaDevices?.getUserMedia === 'function';
  const hasMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
  const hasAudio = typeof (window as any).Audio === 'function';

  return Boolean(hasGetUserMedia && hasMediaRecorder && hasAudio);
}

// Audio validation utilities
export async function validateAudioContent(audioBlob: Blob): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Check if blob is empty or too small
    if (audioBlob.size < 1000) { // Less than 1KB
      return { isValid: false, reason: 'Audio too short or empty' };
    }

    // Check duration (should be at least 0.5 seconds and max 30 seconds)
    const duration = await getAudioDuration(audioBlob);
    if (duration < 0.5) {
      return { isValid: false, reason: 'Audio too short (less than 0.5 seconds)' };
    }
    if (duration > 30) {
      return { isValid: false, reason: 'Audio too long (more than 30 seconds)' };
    }

    // Check audio levels to detect if it's just silence/noise
    const hasAudioContent = await detectAudioContent(audioBlob);
    if (!hasAudioContent) {
      return { isValid: false, reason: 'No detectable speech content (likely silence or noise)' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating audio:', error);
    return { isValid: false, reason: 'Failed to validate audio' };
  }
}

async function getAudioDuration(audioBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(audioBlob);
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio metadata'));
    };
    
    audio.src = url;
  });
}

async function detectAudioContent(audioBlob: Blob): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const fileReader = new FileReader();
    
    fileReader.onload = async () => {
      try {
        const arrayBuffer = fileReader.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Analyze audio data to detect speech patterns
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        
        // Calculate RMS (Root Mean Square) to detect audio level
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        
        // Check for dynamic range (difference between quiet and loud parts)
        let min = 1, max = -1;
        for (let i = 0; i < channelData.length; i++) {
          min = Math.min(min, channelData[i]);
          max = Math.max(max, channelData[i]);
        }
        const dynamicRange = max - min;
        
        // Speech typically has RMS > 0.005 and dynamic range > 0.05 (more lenient)
        const hasContent = rms > 0.005 && dynamicRange > 0.05;
        
        console.log(`Audio analysis - RMS: ${rms.toFixed(4)}, Dynamic Range: ${dynamicRange.toFixed(4)}, Has Content: ${hasContent}`);
        
        resolve(hasContent);
      } catch (error) {
        console.error('Error analyzing audio:', error);
        resolve(false); // Assume no content if analysis fails
      }
    };
    
    fileReader.onerror = () => reject(new Error('Failed to read audio file'));
    fileReader.readAsArrayBuffer(audioBlob);
  });
}
