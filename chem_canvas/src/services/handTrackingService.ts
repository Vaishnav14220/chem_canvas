/**
 * Hand Tracking Service using MediaPipe Hand Landmarker
 * Provides gesture-based navigation using index finger tracking
 */

import {
  FilesetResolver,
  HandLandmarker,
  HandLandmarkerResult,
} from '@mediapipe/tasks-vision';

// Hand landmark indices
const INDEX_FINGER_TIP = 8;
const THUMB_TIP = 4;
const MIDDLE_FINGER_TIP = 12;

export interface HandPosition {
  x: number; // Normalized 0-1, mapped to screen
  y: number; // Normalized 0-1, mapped to screen
  screenX: number; // Actual screen coordinates
  screenY: number; // Actual screen coordinates
  confidence: number;
  isPinching: boolean; // Thumb and index finger close together (click gesture)
  isPointing: boolean; // Index finger extended, others curled
}

export interface HandTrackingState {
  isInitialized: boolean;
  isTracking: boolean;
  handPosition: HandPosition | null;
  error: string | null;
  videoElement: HTMLVideoElement | null;
}

type HandTrackingCallback = (state: HandTrackingState) => void;

class HandTrackingService {
  private handLandmarker: HandLandmarker | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private callbacks: Set<HandTrackingCallback> = new Set();
  private lastVideoTime: number = -1;
  
  private state: HandTrackingState = {
    isInitialized: false,
    isTracking: false,
    handPosition: null,
    error: null,
    videoElement: null,
  };

  private containerWidth: number = window.innerWidth;
  private containerHeight: number = window.innerHeight;

  /**
   * Initialize the MediaPipe Hand Landmarker
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing Hand Landmarker...');
      
      // Load vision tasks WASM files
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );

      // Create Hand Landmarker instance
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU', // Use GPU for better performance
        },
        runningMode: 'VIDEO',
        numHands: 1, // Track only one hand for navigation
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      this.state = { ...this.state, isInitialized: true, error: null };
      this.notifyCallbacks();
      console.log('Hand Landmarker initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Hand Landmarker:', error);
      this.state = {
        ...this.state,
        isInitialized: false,
        error: error instanceof Error ? error.message : 'Failed to initialize',
      };
      this.notifyCallbacks();
      return false;
    }
  }

  /**
   * Start webcam and begin hand tracking
   */
  async startTracking(containerWidth?: number, containerHeight?: number): Promise<boolean> {
    if (!this.state.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) return false;
    }

    if (containerWidth) this.containerWidth = containerWidth;
    if (containerHeight) this.containerHeight = containerHeight;

    try {
      // Request webcam access
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user', // Front camera
          frameRate: { ideal: 30 },
        },
      });

      // Create hidden video element
      this.videoElement = document.createElement('video');
      this.videoElement.srcObject = this.stream;
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      this.videoElement.style.display = 'none';
      document.body.appendChild(this.videoElement);

      await this.videoElement.play();

      this.state = { ...this.state, isTracking: true, error: null, videoElement: this.videoElement };
      this.notifyCallbacks();

      // Start detection loop
      this.detectLoop();
      console.log('Hand tracking started');
      return true;
    } catch (error) {
      console.error('Failed to start hand tracking:', error);
      this.state = {
        ...this.state,
        isTracking: false,
        error: error instanceof Error ? error.message : 'Failed to access camera',
      };
      this.notifyCallbacks();
      return false;
    }
  }

  /**
   * Stop hand tracking and release resources
   */
  stopTracking(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.remove();
      this.videoElement = null;
    }

    this.lastVideoTime = -1;
    this.state = { ...this.state, isTracking: false, handPosition: null, videoElement: null };
    this.notifyCallbacks();
    console.log('Hand tracking stopped');
  }

  /**
   * Main detection loop
   */
  private detectLoop = (): void => {
    if (!this.videoElement || !this.handLandmarker || !this.state.isTracking) {
      return;
    }

    const currentTime = this.videoElement.currentTime;

    // Only process new frames
    if (currentTime !== this.lastVideoTime && this.videoElement.readyState >= 2) {
      this.lastVideoTime = currentTime;

      const result = this.handLandmarker.detectForVideo(
        this.videoElement,
        performance.now()
      );

      this.processResult(result);
    }

    this.animationFrameId = requestAnimationFrame(this.detectLoop);
  };

  /**
   * Process hand detection results
   */
  private processResult(result: HandLandmarkerResult): void {
    if (result.landmarks && result.landmarks.length > 0) {
      const landmarks = result.landmarks[0];
      
      // Get index finger tip position
      const indexTip = landmarks[INDEX_FINGER_TIP];
      const thumbTip = landmarks[THUMB_TIP];
      const middleTip = landmarks[MIDDLE_FINGER_TIP];

      // Calculate screen position (mirror the x coordinate for natural movement)
      const normalizedX = 1 - indexTip.x; // Mirror horizontally
      const normalizedY = indexTip.y;
      
      // Map to screen coordinates
      const screenX = normalizedX * this.containerWidth;
      const screenY = normalizedY * this.containerHeight;

      // Calculate if pinching (thumb and index finger close)
      const pinchDistance = Math.sqrt(
        Math.pow(indexTip.x - thumbTip.x, 2) +
        Math.pow(indexTip.y - thumbTip.y, 2) +
        Math.pow(indexTip.z - thumbTip.z, 2)
      );
      const isPinching = pinchDistance < 0.05; // Threshold for pinch detection

      // Check if pointing gesture (index up, middle down)
      const indexMiddleDistance = Math.abs(indexTip.y - middleTip.y);
      const isPointing = indexMiddleDistance > 0.1 && indexTip.y < middleTip.y;

      // Get confidence from handedness if available
      const confidence = result.handedness?.[0]?.[0]?.score ?? 0.8;

      const handPosition: HandPosition = {
        x: normalizedX,
        y: normalizedY,
        screenX,
        screenY,
        confidence,
        isPinching,
        isPointing,
      };

      this.state = { ...this.state, handPosition };
    } else {
      // No hand detected
      this.state = { ...this.state, handPosition: null };
    }

    this.notifyCallbacks();
  }

  /**
   * Update container dimensions for coordinate mapping
   */
  updateContainerSize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
  }

  /**
   * Subscribe to hand tracking state updates
   */
  subscribe(callback: HandTrackingCallback): () => void {
    this.callbacks.add(callback);
    // Immediately call with current state
    callback(this.state);
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Get current state
   */
  getState(): HandTrackingState {
    return { ...this.state };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifyCallbacks(): void {
    this.callbacks.forEach((callback) => callback({ ...this.state }));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopTracking();
    this.handLandmarker?.close();
    this.handLandmarker = null;
    this.callbacks.clear();
    this.state = {
      isInitialized: false,
      isTracking: false,
      handPosition: null,
      error: null,
      videoElement: null,
    };
  }

  /**
   * Simulate click at current hand position
   */
  simulateClick(): void {
    if (this.state.handPosition) {
      const { screenX, screenY } = this.state.handPosition;
      
      // Find element at position
      const element = document.elementFromPoint(screenX, screenY);
      if (element) {
        // Create and dispatch click event
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: screenX,
          clientY: screenY,
        });
        element.dispatchEvent(clickEvent);
      }
    }
  }

  /**
   * Simulate scroll based on hand position
   */
  simulateScroll(deltaY: number): void {
    window.scrollBy({
      top: deltaY,
      behavior: 'smooth',
    });
  }
}

// Export singleton instance
export const handTrackingService = new HandTrackingService();
export default handTrackingService;
