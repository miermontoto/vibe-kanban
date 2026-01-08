import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

export interface TriStateOption<T> {
  value: T;
  label: string;
  description?: string;
  badge?: ReactNode;
}

interface TriStateToggleProps<T> {
  label: string;
  helper?: string;
  value: T;
  onChange: (value: T) => void;
  options: TriStateOption<T>[];
  className?: string;
}

export function TriStateToggle<T extends string | boolean | null>({
  label,
  helper,
  value,
  onChange,
  options,
  className,
}: TriStateToggleProps<T>) {
  // convertir el valor actual a string para el RadioGroup
  const stringValue = value === null ? 'null' : String(value);

  const handleValueChange = (newValue: string) => {
    // encontrar la opción correspondiente y usar su valor original
    const option = options.find((opt) => {
      const optValue = opt.value === null ? 'null' : String(opt.value);
      return optValue === newValue;
    });
    if (option) {
      onChange(option.value);
    }
  };

  return (
    <div className={cn('space-y-3', className)}>
      <Label className="text-base font-medium">{label}</Label>
      <RadioGroup value={stringValue} onValueChange={handleValueChange}>
        <div className="grid gap-3">
          {options.map((option, index) => {
            const optionStringValue =
              option.value === null ? 'null' : String(option.value);
            const isSelected = stringValue === optionStringValue;

            return (
              <div
                key={optionStringValue}
                className={cn(
                  'relative flex items-start space-x-3 rounded-lg border-2 p-4 transition-all cursor-pointer hover:bg-accent/50',
                  isSelected
                    ? 'border-primary bg-accent'
                    : 'border-border bg-card',
                  // primer opción (generalmente "use global") con estilo especial
                  index === 0 && 'border-dashed'
                )}
                onClick={() => handleValueChange(optionStringValue)}
              >
                <RadioGroupItem
                  value={optionStringValue}
                  id={`option-${optionStringValue}`}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={`option-${optionStringValue}`}
                    className="cursor-pointer font-normal flex items-center gap-2"
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
        <p className="text-sm text-muted-foreground leading-relaxed">
          {helper}
        </p>
      )}
    </div>
  );
}
