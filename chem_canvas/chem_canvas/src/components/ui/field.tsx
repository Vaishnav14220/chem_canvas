import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'vertical' | 'horizontal' | 'responsive';
  'data-invalid'?: boolean;
}

const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  ({ className, orientation = 'vertical', 'data-invalid': dataInvalid, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-invalid={dataInvalid}
        className={cn(
          'space-y-2',
          orientation === 'horizontal' && 'flex items-center gap-4',
          orientation === 'responsive' && 'flex flex-col gap-4 sm:flex-row sm:items-center',
          dataInvalid && 'data-[invalid=true]:text-destructive',
          className
        )}
        {...props}
      />
    );
  }
);
Field.displayName = 'Field';

export interface FieldContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const FieldContent = React.forwardRef<HTMLDivElement, FieldContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col gap-1.5', className)}
        {...props}
      />
    );
  }
);
FieldContent.displayName = 'FieldContent';

export interface FieldLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const FieldLabel = React.forwardRef<HTMLLabelElement, FieldLabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
          className
        )}
        {...props}
      />
    );
  }
);
FieldLabel.displayName = 'FieldLabel';

export interface FieldDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

const FieldDescription = React.forwardRef<HTMLParagraphElement, FieldDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  }
);
FieldDescription.displayName = 'FieldDescription';

export interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  errors?: Array<{ message?: string } | undefined | null>;
}

const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ className, errors, ...props }, ref) => {
    if (!errors || errors.length === 0) return null;
    
    const errorMessage = errors.find((e) => e?.message)?.message;
    if (!errorMessage) return null;

    return (
      <p
        ref={ref}
        className={cn('text-sm font-medium text-destructive', className)}
        {...props}
      >
        {errorMessage}
      </p>
    );
  }
);
FieldError.displayName = 'FieldError';

export interface FieldGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  'data-slot'?: string;
}

const FieldGroup = React.forwardRef<HTMLDivElement, FieldGroupProps>(
  ({ className, 'data-slot': dataSlot, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot={dataSlot}
        className={cn('space-y-4', className)}
        {...props}
      />
    );
  }
);
FieldGroup.displayName = 'FieldGroup';

export { Field, FieldContent, FieldLabel, FieldDescription, FieldError, FieldGroup };




