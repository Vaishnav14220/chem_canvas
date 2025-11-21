import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning';

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-primary/15 text-primary border border-primary/20',
  secondary: 'bg-muted text-muted-foreground border border-border',
  outline: 'border border-border text-foreground',
  success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30',
  warning: 'bg-amber-500/15 text-amber-200 border border-amber-400/30'
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
          badgeStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = 'Badge';

export { Badge };
