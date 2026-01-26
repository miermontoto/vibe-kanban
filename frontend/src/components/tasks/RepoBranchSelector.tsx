import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import BranchSelector from './BranchSelector';
import { cn } from '@/lib/utils';
import type { RepoBranchConfig } from '@/hooks';

type ExtendedRepoBranchConfig = RepoBranchConfig & { selected?: boolean };

type Props = {
  configs: ExtendedRepoBranchConfig[];
  onBranchChange: (repoId: string, branch: string) => void;
  onRepoToggle?: (repoId: string, selected: boolean) => void;
  isLoading?: boolean;
  showLabel?: boolean;
  className?: string;
};

export function RepoBranchSelector({
  configs,
  onBranchChange,
  onRepoToggle,
  isLoading,
  showLabel = true,
  className,
}: Props) {
  const { t } = useTranslation('tasks');

  if (configs.length === 0) {
    return null;
  }

  // single repo: no checkbox needed
  if (configs.length === 1) {
    const config = configs[0];
    return (
      <div className={className}>
        {showLabel && (
          <Label className="text-sm font-medium">
            {t('repoBranchSelector.label')}{' '}
            <span className="text-destructive">*</span>
          </Label>
        )}
        <BranchSelector
          branches={config.branches}
          selectedBranch={config.targetBranch}
          onBranchSelect={(branch) => onBranchChange(config.repoId, branch)}
          placeholder={
            isLoading
              ? t('createAttemptDialog.loadingBranches')
              : t('createAttemptDialog.selectBranch')
          }
        />
      </div>
    );
  }

  // multiple repos: show checkboxes to select which repos to include
  return (
    <div className={className}>
      <div className="space-y-3">
        {configs.map((config) => {
          const isSelected = config.selected !== false;
          return (
            <div
              key={config.repoId}
              className={cn(
                'space-y-1 transition-opacity',
                !isSelected && 'opacity-50'
              )}
            >
              <div className="flex items-center gap-2">
                {onRepoToggle && (
                  <Checkbox
                    id={`repo-toggle-${config.repoId}`}
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                      onRepoToggle(config.repoId, checked === true)
                    }
                    aria-label={t('repoBranchSelector.toggleRepo', {
                      repo: config.repoDisplayName,
                    })}
                  />
                )}
                <Label
                  htmlFor={`repo-toggle-${config.repoId}`}
                  className={cn(
                    'text-sm font-medium',
                    onRepoToggle && 'cursor-pointer'
                  )}
                >
                  {config.repoDisplayName}
                  {isSelected && <span className="text-destructive"> *</span>}
                </Label>
              </div>
              <BranchSelector
                branches={config.branches}
                selectedBranch={config.targetBranch}
                onBranchSelect={(branch) =>
                  onBranchChange(config.repoId, branch)
                }
                placeholder={
                  isLoading
                    ? t('createAttemptDialog.loadingBranches')
                    : t('createAttemptDialog.selectBranch')
                }
                disabled={!isSelected}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RepoBranchSelector;
