import React from 'react';
import { cn } from '../lib/utils';

export type SegmentedOption = 'auto' | 'socratic' | 'feynman';

interface SegmentedControlProps {
  value: SegmentedOption;
  onChange: (value: SegmentedOption) => void;
  className?: string;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  className
}) => {
  const options: { value: SegmentedOption; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'socratic', label: 'Socratic' },
    { value: 'feynman', label: 'Feynman' }
  ];

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-gray-300/30 bg-white/5 backdrop-blur-sm p-1 shadow-lg',
        className
      )}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
      }}
    >
      {options.map((option, index) => (
        <React.Fragment key={option.value}>
          <button
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-all duration-200 rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-transparent',
              value === option.value
                ? 'text-white'
                : 'text-gray-400 hover:text-gray-300'
            )}
            style={{
              backgroundColor: value === option.value ? '#212121' : 'transparent',
              color: value === option.value ? '#ffffff' : '#9ca3af'
            }}
          >
            {option.label}
          </button>
          {index < options.length - 1 && (
            <div className="h-6 w-px bg-gray-300/30 mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default SegmentedControl;

