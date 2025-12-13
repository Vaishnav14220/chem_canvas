import * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 border border-transparent hover:border-primary/20',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm hover:shadow-md transition-all duration-200',
  outline: 'border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent transition-all duration-200 shadow-sm hover:shadow-md',
  ghost: 'hover:bg-accent hover:text-accent-foreground transition-all duration-200',
  soft: 'bg-primary/10 text-primary hover:bg-primary/15 border-2 border-primary/20 hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md'
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10'
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98]',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
