import * as React from 'react';
import { GripVertical } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '../../lib/utils';

type PanelGroupProps = React.ComponentPropsWithoutRef<typeof ResizablePrimitive.PanelGroup>;
type PanelGroupRef = React.ElementRef<typeof ResizablePrimitive.PanelGroup>;

export const ResizablePanelGroup = React.forwardRef<PanelGroupRef, PanelGroupProps>(
  ({ className, ...props }, ref) => (
    <ResizablePrimitive.PanelGroup
      ref={ref}
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  )
);
ResizablePanelGroup.displayName = 'ResizablePanelGroup';

type PanelProps = React.ComponentPropsWithoutRef<typeof ResizablePrimitive.Panel>;
type PanelRef = React.ElementRef<typeof ResizablePrimitive.Panel>;

export const ResizablePanel = React.forwardRef<PanelRef, PanelProps>((props, ref) => {
  return <ResizablePrimitive.Panel ref={ref} {...props} />;
});
ResizablePanel.displayName = 'ResizablePanel';

type ResizeHandleProps = React.ComponentPropsWithoutRef<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
};
type ResizeHandleRef = React.ElementRef<typeof ResizablePrimitive.PanelResizeHandle>;

export const ResizableHandle = React.forwardRef<ResizeHandleRef, ResizeHandleProps>(
  ({ withHandle, className, ...props }, ref) => (
    <ResizablePrimitive.PanelResizeHandle
      ref={ref}
      className={cn(
        'bg-border focus-visible:ring-ring relative flex w-px items-center justify-center after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      {withHandle ? (
        <div className="bg-border z-10 flex h-4 w-3 items-center justify-center rounded-sm border">
          <GripVertical className="size-2.5" />
        </div>
      ) : null}
    </ResizablePrimitive.PanelResizeHandle>
  )
);
ResizableHandle.displayName = 'ResizableHandle';
