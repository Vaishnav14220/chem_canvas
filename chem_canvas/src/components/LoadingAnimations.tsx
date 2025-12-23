import React from 'react';

// Diamond Grid Loading Animation
export const DiamondGridLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 1000 1000" 
        width="200" 
        height="200"
        className="animate-pulse"
      >
        <g>
          {/* Animated diamond grid pattern */}
          <g transform="translate(500, 500)" className="animate-spin-slow">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="1" 
              strokeWidth="3"
              d="M0,-172.698 L-320,0 L0,172.698 L320,0 Z"
              className="animate-pulse"
            />
          </g>
          <g transform="translate(500, 500)" className="animate-spin-reverse">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.8" 
              strokeWidth="3"
              d="M0,-157.19 L-291.752,0 L0,157.19 L291.752,0 Z"
            />
          </g>
          <g transform="translate(500, 500)" className="animate-spin-slow">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.6" 
              strokeWidth="3"
              d="M0,-141.387 L-262.969,0 L0,141.387 L262.969,0 Z"
            />
          </g>
          <g transform="translate(500, 500)" className="animate-spin-reverse">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.5" 
              strokeWidth="3"
              d="M0,-125.585 L-234.186,0 L0,125.585 L234.186,0 Z"
            />
          </g>
          <g transform="translate(500, 500)">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.4" 
              strokeWidth="3"
              d="M0,-109.783 L-205.403,0 L0,109.783 L205.403,0 Z"
              className="animate-pulse"
            />
          </g>
          <g transform="translate(500, 500)" className="animate-spin-slow">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.3" 
              strokeWidth="3"
              d="M0,-93.98 L-176.62,0 L0,93.98 L176.62,0 Z"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

// Concentric Rings Loading Animation
export const ConcentricRingsLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 650 650" 
        width="180" 
        height="180"
      >
        <g>
          {/* Outer rings */}
          <g transform="translate(325, 472.302)" className="animate-pulse">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="1" 
              strokeWidth="3"
              d="M0,-172.698 L-320,0 L0,172.698 L320,0 Z"
            />
          </g>
          <g transform="translate(325, 424.667)" className="animate-pulse delay-100">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.9" 
              strokeWidth="3"
              d="M0,-157.19 L-291.752,0 L0,157.19 L291.752,0 Z"
            />
          </g>
          <g transform="translate(325, 376.131)" className="animate-pulse delay-200">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.8" 
              strokeWidth="3"
              d="M0,-141.387 L-262.969,0 L0,141.387 L262.969,0 Z"
            />
          </g>
          <g transform="translate(325, 327.595)" className="animate-pulse delay-300">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.7" 
              strokeWidth="3"
              d="M0,-125.585 L-234.186,0 L0,125.585 L234.186,0 Z"
            />
          </g>
          <g transform="translate(325, 279.059)" className="animate-pulse delay-400">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.6" 
              strokeWidth="3"
              d="M0,-109.783 L-205.403,0 L0,109.783 L205.403,0 Z"
            />
          </g>
          <g transform="translate(325, 230.523)" className="animate-pulse delay-500">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.5" 
              strokeWidth="3"
              d="M0,-93.98 L-176.62,0 L0,93.98 L176.62,0 Z"
            />
          </g>
          <g transform="translate(325, 181.987)" className="animate-pulse delay-600">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.4" 
              strokeWidth="3"
              d="M0,-78.178 L-147.837,0 L0,78.178 L147.837,0 Z"
            />
          </g>
          <g transform="translate(325, 133.451)" className="animate-pulse delay-700">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.3" 
              strokeWidth="3"
              d="M0,-62.375 L-119.054,0 L0,62.375 L119.054,0 Z"
            />
          </g>
          <g transform="translate(325, 84.914)" className="animate-pulse delay-800">
            <path 
              fill="none" 
              stroke="rgb(117,251,244)" 
              strokeOpacity="0.2" 
              strokeWidth="3"
              d="M0,-46.573 L-90.27,0 L0,46.573 L90.27,0 Z"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

// Random loader selector - alternates between the two
export const RandomDocumentLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [loaderType] = React.useState(() => Math.random() > 0.5 ? 'diamond' : 'rings');
  
  return loaderType === 'diamond' ? (
    <DiamondGridLoader className={className} />
  ) : (
    <ConcentricRingsLoader className={className} />
  );
};
