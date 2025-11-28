import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', color = 'text-indigo-600' }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    return (
        <Loader2 className={`${sizeClasses[size]} ${color} animate-spin`} />
    );
};
