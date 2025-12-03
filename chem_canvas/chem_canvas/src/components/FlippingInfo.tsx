import React, { useState, useEffect } from 'react';
import { User, Clock, Timer } from 'lucide-react';

interface FlippingInfoProps {
  userName: string;
}

const FlippingInfo: React.FC<FlippingInfoProps> = ({ userName }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeSpent, setTimeSpent] = useState(0);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Track time spent on platform
  useEffect(() => {
    const startTime = Date.now();
    const sessionKey = 'studium_session_start';

    // Get or set session start time
    const storedStartTime = localStorage.getItem(sessionKey);
    const sessionStart = storedStartTime ? parseInt(storedStartTime) : startTime;

    if (!storedStartTime) {
      localStorage.setItem(sessionKey, sessionStart.toString());
    }

    // Update time spent every second
    const timeTracker = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - sessionStart) / 1000); // seconds
      setTimeSpent(elapsed);
    }, 1000);

    return () => clearInterval(timeTracker);
  }, []);

  // Flip animation every 15 seconds
  useEffect(() => {
    const flipTimer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % 3);
    }, 15000);

    return () => clearInterval(flipTimer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatTimeSpent = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const cards = [
    {
      icon: <User className="h-5 w-5" />,
      content: userName || 'User',
      label: 'Welcome'
    },
    {
      icon: <Clock className="h-5 w-5" />,
      content: formatTime(currentTime),
      label: 'Current Time'
    },
    {
      icon: <Timer className="h-5 w-5" />,
      content: formatTimeSpent(timeSpent),
      label: 'Time Spent'
    }
  ];

  const currentCard = cards[currentIndex];

  return (
    <div className="relative h-12 w-56 overflow-hidden rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 backdrop-blur-sm">
      <div className="flex h-full w-full items-center justify-center px-4">
        <div className="flex items-center space-x-3 transition-all duration-500 ease-in-out">
          <div className="flex-shrink-0">
            {currentCard.icon}
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-medium">
              {currentCard.label}
            </span>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {currentCard.content}
            </span>
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-in-out"
          style={{
            width: `${((currentIndex + 1) / 3) * 100}%`
          }}
        />
      </div>
    </div>
  );
};

export default FlippingInfo;