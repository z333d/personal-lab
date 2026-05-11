import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/cn';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <label className={cn('relative inline-flex items-center justify-center cursor-pointer', className)}>
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            onCheckedChange?.(e.target.checked);
            onChange?.(e);
          }}
          className="peer sr-only"
          {...props}
        />
        <span
          className={cn(
            'h-5 w-5 rounded border border-border-strong bg-surface flex items-center justify-center transition-colors',
            'peer-checked:bg-accent peer-checked:border-accent',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/30 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface'
          )}
        >
          {checked && <Check className="h-3.5 w-3.5 text-primary-on" strokeWidth={3} />}
        </span>
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
