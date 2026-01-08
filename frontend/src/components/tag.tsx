import { X } from 'lucide-react';
import { TaskLabel } from '../../../shared/types';

interface TagProps {
  label: TaskLabel;
  onRemove?: () => void;
  size?: 'sm' | 'md';
}

export function Tag({ label, onRemove, size = 'md' }: TagProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${label.color}20`,
        color: label.color,
        border: `1px solid ${label.color}40`,
      }}
    >
      <span>{label.name}</span>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-70 transition-opacity"
          aria-label={`Remove ${label.name} label`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

interface TagListProps {
  labels: TaskLabel[];
  onRemove?: (labelId: string) => void;
  size?: 'sm' | 'md';
}

export function TagList({ labels, onRemove, size = 'md' }: TagListProps) {
  if (labels.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <Tag
          key={label.id}
          label={label}
          onRemove={onRemove ? () => onRemove(label.id) : undefined}
          size={size}
        />
      ))}
    </div>
  );
}
