import * as React from 'react';
import { ArrowDown } from 'lucide-react';
import { StickToBottom, type StickToBottomProps, useStickToBottomContext } from 'use-stick-to-bottom';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const conversationVariants = cva(
  'relative flex flex-col rounded-2xl border border-border bg-card/80 text-card-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
  {
    variants: {
      tone: {
        default: 'backdrop-blur supports-[backdrop-filter]:bg-card/70',
        muted: 'bg-muted/70 text-muted-foreground',
        glass: 'bg-background/30 backdrop-blur-xl supports-[backdrop-filter]:bg-background/20 border-white/10'
      },
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6'
      }
    },
    defaultVariants: {
      tone: 'default',
      padding: 'md'
    }
  }
);

const conversationContentVariants = cva('flex flex-col gap-4 p-4', {
  variants: {
    inset: {
      true: 'px-3 pb-5 pt-4 sm:px-4',
      false: ''
    }
  },
  defaultVariants: {
    inset: true
  }
});

const scrollButtonVariants = cva(
  'group inline-flex items-center gap-1 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-lg transition duration-200 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
  {
    variants: {
      floating: {
        true: 'absolute bottom-4 right-4 sm:right-5'
      }
    },
    defaultVariants: {
      floating: true
    }
  }
);

export interface ConversationProps
  extends Omit<StickToBottomProps, 'children'>,
    VariantProps<typeof conversationVariants> {
  children: React.ReactNode;
  className?: string;
}

export const Conversation = React.forwardRef<HTMLDivElement, ConversationProps>(
  (
    {
      className,
      children,
      tone,
      padding,
      initial = 'smooth',
      resize = 'smooth',
      role = 'feed',
      ...props
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn(conversationVariants({ tone, padding }), className)} role={role}>
        <StickToBottom initial={initial} resize={resize} {...props}>
          {children}
        </StickToBottom>
      </div>
    );
  }
);
Conversation.displayName = 'Conversation';

export interface ConversationContentProps
  extends React.ComponentPropsWithoutRef<typeof StickToBottom.Content>,
    VariantProps<typeof conversationContentVariants> {
  className?: string;
}

export const ConversationContent: React.FC<ConversationContentProps> = ({ className, inset, children, ...props }) => (
  <StickToBottom.Content
    className={cn('relative flex-1 overflow-y-auto', conversationContentVariants({ inset }), className)}
    {...props}
  >
    {children}
  </StickToBottom.Content>
);
ConversationContent.displayName = 'ConversationContent';

export interface ConversationScrollButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof scrollButtonVariants> {}

export const ConversationScrollButton = React.forwardRef<HTMLButtonElement, ConversationScrollButtonProps>(
  ({ className, children, floating, ...props }, ref) => {
    const { isAtBottom, scrollToBottom } = useStickToBottomContext();

    if (isAtBottom) {
      return null;
    }

    return (
      <button
        type="button"
        ref={ref}
        onClick={() => scrollToBottom()}
        className={cn(scrollButtonVariants({ floating }), 'focus-visible:ring-offset-background', className)}
        {...props}
      >
        <ArrowDown className="h-4 w-4 text-primary transition-transform group-hover:translate-y-0.5" aria-hidden />
        <span>{children ?? 'Scroll to latest'}</span>
        <span className="sr-only">Scroll to most recent message</span>
      </button>
    );
  }
);
ConversationScrollButton.displayName = 'ConversationScrollButton';

export type { StickToBottomContext } from 'use-stick-to-bottom';
