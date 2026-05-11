import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
  {
    variants: {
      variant: {
        // Solid accent — for the primary CTA per view; use sparingly.
        accent: 'bg-accent text-primary-on hover:opacity-90 active:opacity-95',
        // Solid ink — secondary primary action when accent is reserved elsewhere.
        primary: 'bg-primary text-primary-on hover:opacity-90 active:opacity-95',
        // Outline — non-destructive secondary actions.
        outline: 'bg-transparent text-fg border border-border-strong hover:bg-surface-2',
        // Ghost — least visible, for inline / repeated actions.
        ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-surface-2',
        // Destructive — delete / remove.
        danger: 'bg-danger text-primary-on hover:opacity-90 active:opacity-95',
        // Link — text-only inline action.
        link: 'bg-transparent text-accent underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-body-sm rounded-md',
        md: 'h-10 px-4 text-body rounded-md',
        lg: 'h-11 px-5 text-body rounded-lg',
        icon: 'h-9 w-9 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  }
);
Button.displayName = 'Button';
