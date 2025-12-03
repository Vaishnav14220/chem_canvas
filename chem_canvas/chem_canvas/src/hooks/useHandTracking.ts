/**
 * useHandTracking Hook
 * React hook for integrating hand tracking service
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import handTrackingService, {
  HandTrackingState,
  HandPosition,
} from '../services/handTrackingService';

interface UseHandTrackingOptions {
  containerRef?: React.RefObject<HTMLElement>;
  onPinch?: (position: HandPosition) => void;
  onScroll?: (direction: 'up' | 'down') => void;
  autoStart?: boolean;
  scrollSensitivity?: number;
}

interface UseHandTrackingReturn {
  isInitialized: boolean;
  isTracking: boolean;
  handPosition: HandPosition | null;
  error: string | null;
  videoElement: HTMLVideoElement | null;
  startTracking: () => Promise<boolean>;
  stopTracking: () => void;
  toggleTracking: () => Promise<boolean>;
}

export function useHandTracking(
  options: UseHandTrackingOptions = {}
): UseHandTrackingReturn {
  const {
    containerRef,
    onPinch,
    onScroll,
    autoStart = false,
    scrollSensitivity = 100,
  } = options;

  const [state, setState] = useState<HandTrackingState>({
    isInitialized: false,
    isTracking: false,
    handPosition: null,
    error: null,
    videoElement: null,
  });

  const lastPinchRef = useRef(false);
  const lastYRef = useRef<number | null>(null);
  const scrollThrottleRef = useRef(false);

  // Subscribe to service updates
  useEffect(() => {
    const unsubscribe = handTrackingService.subscribe((newState) => {
      setState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle container resize
  useEffect(() => {
    if (!containerRef?.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        handTrackingService.updateContainerSize(rect.width, rect.height);
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [containerRef]);

  // Handle pinch detection
  useEffect(() => {
    if (!state.handPosition) {
      lastPinchRef.current = false;
      return;
    }

    const { isPinching } = state.handPosition;

    // Detect pinch start (rising edge)
    if (isPinching && !lastPinchRef.current) {
      onPinch?.(state.handPosition);
      handTrackingService.simulateClick();
    }

    lastPinchRef.current = isPinching;
  }, [state.handPosition, onPinch]);

  // Handle scroll gesture
  useEffect(() => {
    if (!state.handPosition || scrollThrottleRef.current || !onScroll) {
      return;
    }

    const { y } = state.handPosition;

    if (lastYRef.current !== null) {
      const deltaY = y - lastYRef.current;

      // Detect significant vertical movement
      if (Math.abs(deltaY) > 0.02) {
        scrollThrottleRef.current = true;

        const direction = deltaY > 0 ? 'down' : 'up';
        onScroll(direction);
        handTrackingService.simulateScroll(deltaY * scrollSensitivity * 10);

        // Throttle scroll events
        setTimeout(() => {
          scrollThrottleRef.current = false;
        }, 150);
      }
    }

    lastYRef.current = y;
  }, [state.handPosition, onScroll, scrollSensitivity]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !state.isTracking) {
      handTrackingService.startTracking();
    }

    return () => {
      // Don't stop on unmount if other components might use it
    };
  }, [autoStart, state.isTracking]);

  const startTracking = useCallback(async () => {
    const containerWidth = containerRef?.current?.clientWidth || window.innerWidth;
    const containerHeight = containerRef?.current?.clientHeight || window.innerHeight;
    return await handTrackingService.startTracking(containerWidth, containerHeight);
  }, [containerRef]);

  const stopTracking = useCallback(() => {
    handTrackingService.stopTracking();
  }, []);

  const toggleTracking = useCallback(async () => {
    if (state.isTracking) {
      stopTracking();
      return false;
    } else {
      return await startTracking();
    }
  }, [state.isTracking, startTracking, stopTracking]);

  return {
    isInitialized: state.isInitialized,
    isTracking: state.isTracking,
    handPosition: state.handPosition,
    error: state.error,
    videoElement: state.videoElement,
    startTracking,
    stopTracking,
    toggleTracking,
  };
}

export default useHandTracking;
