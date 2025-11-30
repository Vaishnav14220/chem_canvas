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
  private recordingMimeType = 'audio/webm;codecs=opus';

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
      
      let selectedMimeType = 'audio/webm;codecs=opus';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      this.recordingMimeType = selectedMimeType;

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
        const audioBlob = new Blob(this.recordedChunks, { type: this.recordingMimeType });
        this.isRecordingState = false;
        console.log(`🎵 Recording stopped. MIME type: ${this.recordingMimeType}, Size: ${audioBlob.size} bytes`);
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
    // If it's already WAV, return as-is
    if (webmBlob.type.includes('wav')) {
      console.log('🎵 Audio is already WAV format, skipping conversion');
      resolve(webmBlob);
      return;
    }

    (async () => {
      try {
        // Decode the WebM/Opus audio to raw PCM data
        const arrayBuffer = await webmBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

        // Decode the compressed audio
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Convert to WAV format
        const wavBlob = audioBufferToWav(audioBuffer);
        console.log(`🎵 Converted ${webmBlob.type} to WAV. Original size: ${webmBlob.size}, WAV size: ${wavBlob.size}`);
        resolve(wavBlob);
      } catch (error) {
        console.error('Error converting audio:', error);
        reject(error);
      }
    })();
  });
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  
  // Create WAV file buffer
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * numChannels * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM format
  view.setUint16(20, 1, true); // PCM format code
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // bytes per second
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, length * numChannels * 2, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
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
export async function validateAudioContent(audioBlob: Blob, trackedDuration?: number): Promise<{ isValid: boolean; reason?: string }> {
  try {
    // Check if blob is empty or too small
    if (audioBlob.size < 1000) { // Less than 1KB
      return { isValid: false, reason: 'Audio too short or empty' };
    }

    // Check duration (should be at least 0.5 seconds and max 30 seconds)
    const duration = await getAudioDuration(audioBlob);
    console.log('🎵 Audio duration check:', { 
      duration, 
      blobSize: audioBlob.size, 
      blobType: audioBlob.type,
      trackedDuration 
    });
    
    if (duration < 0.5) {
      return { isValid: false, reason: 'Audio too short (less than 0.5 seconds)' };
    }
    
    // If we have tracked duration and it's reasonable, use that instead
    const effectiveDuration = (trackedDuration && trackedDuration > 0 && trackedDuration <= 30) ? trackedDuration : duration;
    
    // For very short recordings (under 10 seconds), skip duration validation if tracked duration is available
    if (trackedDuration && trackedDuration > 0 && trackedDuration < 10) {
      console.log('🎵 Short recording detected, using tracked duration');
      // Skip duration check for short recordings
    } else if (effectiveDuration > 30) {
      return { isValid: false, reason: 'Audio too long (more than 30 seconds)' };
    }

    // Additional check: if duration is suspiciously long compared to blob size, it might be corrupted
    const estimatedDuration = audioBlob.size / (44100 * 2); // Rough estimate for 44.1kHz 16-bit audio
    if (duration > estimatedDuration * 2) {
      console.warn('🎵 Audio duration seems inconsistent with blob size, using tracked duration if available');
      if (trackedDuration && trackedDuration <= 30) {
        console.log('🎵 Using tracked duration instead of blob duration');
      }
    }

    // Check audio levels to detect if it's just silence/noise
    const hasAudioContent = await detectAudioContent(audioBlob);
    
    // For short recordings with tracked duration, be more lenient
    if (!hasAudioContent && trackedDuration && trackedDuration > 0 && trackedDuration <= 10) {
      console.log('🎵 Short recording detected, being more lenient with content detection');
      // For short recordings, if there's any signal at all, accept it
      try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Add timeout to prevent hanging during decode
        const decodePromise = audioContext.decodeAudioData(arrayBuffer);
        const timeoutPromise = new Promise<AudioBuffer>((_, reject) =>
          setTimeout(() => reject(new Error('Audio decode timeout')), 5000)
        );
        
        const audioBuffer = await Promise.race([decodePromise, timeoutPromise]);
        const channelData = audioBuffer.getChannelData(0);
        
        // Check if there's any non-zero audio data
        let hasAnySignal = false;
        for (let i = 0; i < Math.min(channelData.length, 10000); i++) { // Check first 10000 samples
          if (Math.abs(channelData[i]) > 0.00001) { // Very small threshold
            hasAnySignal = true;
            break;
          }
        }
        
        if (hasAnySignal) {
          console.log('🎵 Found minimal audio signal in short recording, accepting');
          return { isValid: true };
        }
      } catch (error) {
        console.warn('Error in lenient content check:', error);
      }
    }
    
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
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(url);
      console.warn('🎵 Audio duration detection timed out, returning 0');
      resolve(0);
    }, 2000); // 2 second timeout
    
    audio.onloadedmetadata = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    
    audio.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load audio metadata'));
    };
    
    audio.src = url;
  });
}

export async function detectAudioContent(audioBlob: Blob): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const fileReader = new FileReader();
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.warn('🎵 Audio content detection timed out, assuming has content');
      resolve(true); // Assume has content if analysis hangs
    }, 3000); // 3 second timeout
    
    fileReader.onload = async () => {
      try {
        const arrayBuffer = fileReader.result as ArrayBuffer;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Analyze audio data to detect speech patterns
        const channelData = audioBuffer.getChannelData(0);
        // sampleRate is unused in original code, commented out to fix lint error
        // const sampleRate = audioBuffer.sampleRate;
        
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
        // Made more lenient for various microphone conditions
        const hasContent = rms > 0.001 && dynamicRange > 0.01;
        
        console.log(`🎵 Audio analysis - RMS: ${rms.toFixed(4)}, Dynamic Range: ${dynamicRange.toFixed(4)}, Has Content: ${hasContent}`);
        
        // Additional check: if RMS is very low but dynamic range exists, it might still be speech
        if (!hasContent && rms > 0.0005 && dynamicRange > 0.005) {
          console.log('🎵 Low volume speech detected, accepting as valid');
          clearTimeout(timeout);
          resolve(true);
          return;
        }
        
        // Final fallback: if there's any detectable signal at all, accept it for short recordings
        if (!hasContent && (rms > 0.0001 || dynamicRange > 0.001)) {
          console.log('🎵 Minimal audio signal detected, accepting for short recordings');
          clearTimeout(timeout);
          resolve(true);
          return;
        }
        
        clearTimeout(timeout);
        resolve(hasContent);
      } catch (error) {
        console.error('Error analyzing audio:', error);
        clearTimeout(timeout);
        resolve(false); // Assume no content if analysis fails
      }
    };
    
    fileReader.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to read audio file'));
    };
    fileReader.readAsArrayBuffer(audioBlob);
  });
}
