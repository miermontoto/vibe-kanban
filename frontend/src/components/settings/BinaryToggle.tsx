import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

export interface BinaryOption {
  value: boolean;
  label: string;
  description?: string;
  badge?: ReactNode;
  disabled?: boolean;
}

interface BinaryToggleProps {
  label: string;
  helper?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  options: [BinaryOption, BinaryOption]; // exactly two options: [enabled, disabled]
  className?: string;
  disabled?: boolean;
}

export function BinaryToggle({
  label,
  helper,
  value,
  onChange,
  options,
  className,
  disabled = false,
}: BinaryToggleProps) {
  const stringValue = String(value);

  const handleValueChange = (newValue: string) => {
    if (disabled) return;
    onChange(newValue === 'true');
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label className={cn('text-base font-medium', disabled && 'opacity-50')}>
        {label}
      </Label>
      <RadioGroup
        value={stringValue}
        onValueChange={handleValueChange}
        disabled={disabled}
      >
        <div className="grid gap-3">
          {options.map((option) => {
            const optionStringValue = String(option.value);
            const isSelected = stringValue === optionStringValue;
            const isDisabled = disabled || option.disabled;

            return (
              <div
                key={optionStringValue}
                className={cn(
                  'relative flex items-start space-x-3 rounded-lg border-2 p-4 transition-all',
                  isDisabled
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:bg-accent/50',
                  isSelected
                    ? 'border-primary bg-accent'
                    : 'border-border bg-card'
                )}
                onClick={() => !isDisabled && handleValueChange(optionStringValue)}
              >
                <RadioGroupItem
                  value={optionStringValue}
                  id={`binary-option-${optionStringValue}`}
                  className="mt-0.5"
                  disabled={isDisabled}
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`binary-option-${optionStringValue}`}
                    className={cn(
                      'font-normal flex items-center gap-2',
                      isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                    )}
                  >
                    <span>{option.label}</span>
                    {option.badge}
                  </Label>
                  {option.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </RadioGroup>
      {helper && (
        <p
          className={cn(
            'text-sm text-muted-foreground leading-relaxed',
            disabled && 'opacity-50'
          )}
        >
          {helper}
        </p>
      )}
    </div>
  );
}
