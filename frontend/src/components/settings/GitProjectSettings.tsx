import { useTranslation } from 'react-i18next';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TriStateToggle } from '@/components/settings/TriStateToggle';
import { GitBranch, GitPullRequest, CheckCircle2 } from 'lucide-react';

interface GitProjectSettingsProps {
  gitAutoCommitEnabled: boolean | null;
  gitCommitTitleMode: string | null;
  autoPrOnReviewEnabled: boolean | null;
  autoPrDraft: boolean | null;
  redirectToAttemptOnCreate: boolean | null;
  onChange: (updates: {
    git_auto_commit_enabled?: boolean | null;
    git_commit_title_mode?: string | null;
    auto_pr_on_review_enabled?: boolean | null;
    auto_pr_draft?: boolean | null;
    redirect_to_attempt_on_create?: boolean | null;
  }) => void;
}

export function GitProjectSettings({
  gitAutoCommitEnabled,
  gitCommitTitleMode,
  autoPrOnReviewEnabled,
  autoPrDraft,
  redirectToAttemptOnCreate,
  onChange,
}: GitProjectSettingsProps) {
  const { t } = useTranslation('settings');

  return (
    <Card className="border-2">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Git Configuration</CardTitle>
            <CardDescription className="mt-1">
              Override global git settings for this project
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Commits Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Commits
            </h3>
          </div>

          <TriStateToggle
            label={t('settings.projects.git.autoCommit.label')}
            helper={t('settings.projects.git.autoCommit.helper')}
            value={gitAutoCommitEnabled}
            onChange={(value) =>
              onChange({ git_auto_commit_enabled: value })
            }
            options={[
              {
                value: null,
                label: t('settings.projects.git.autoCommit.useGlobal'),
                description: 'Use the global setting from General Settings',
              },
              {
                value: true,
                label: t('settings.projects.git.autoCommit.enabled'),
                description: 'Automatically commit changes for this project',
              },
              {
                value: false,
                label: t('settings.projects.git.autoCommit.disabled'),
                description: 'Disable auto-commit for this project',
              },
            ]}
          />

          <TriStateToggle
            label={t('settings.projects.git.commitTitleMode.label')}
            helper={t('settings.projects.git.commitTitleMode.helper')}
            value={gitCommitTitleMode}
            onChange={(value) =>
              onChange({ git_commit_title_mode: value })
            }
            options={[
              {
                value: null,
                label: t('settings.projects.git.commitTitleMode.useGlobal'),
                description: 'Use the global commit title mode',
              },
              {
                value: 'AgentSummary',
                label: t(
                  'settings.projects.git.commitTitleMode.agentSummary'
                ),
                description: 'Use agent-generated task summary as commit title',
              },
              {
                value: 'AiGenerated',
                label: t(
                  'settings.projects.git.commitTitleMode.aiGenerated'
                ),
                description: 'Generate commit titles using AI',
                badge: (
                  <Badge variant="outline" className="text-xs">
                    {t(
                      'settings.general.git.commitTitleMode.notImplemented'
                    )}
                  </Badge>
                ),
              },
              {
                value: 'Manual',
                label: t('settings.projects.git.commitTitleMode.manual'),
                description: 'Manually enter commit titles',
              },
            ]}
          />
        </div>

        {/* Pull Requests Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Pull Requests
            </h3>
          </div>

          <TriStateToggle
            label={t('settings.projects.autoPr.label')}
            helper={t('settings.projects.autoPr.helper')}
            value={autoPrOnReviewEnabled}
            onChange={(value) =>
              onChange({ auto_pr_on_review_enabled: value })
            }
            options={[
              {
                value: null,
                label: t('settings.projects.autoPr.useGlobal'),
                description: 'Use the global auto-PR setting',
              },
              {
                value: true,
                label: t('settings.projects.autoPr.enabled'),
                description: 'Automatically create PR when review is requested',
              },
              {
                value: false,
                label: t('settings.projects.autoPr.disabled'),
                description: 'Do not auto-create PRs for this project',
              },
            ]}
          />

          <TriStateToggle
            label={t('settings.projects.autoPrDraft.label')}
            helper={t('settings.projects.autoPrDraft.helper')}
            value={autoPrDraft}
            onChange={(value) => onChange({ auto_pr_draft: value })}
            options={[
              {
                value: null,
                label: t('settings.projects.autoPrDraft.useGlobal'),
                description: 'Use the global draft PR setting',
              },
              {
                value: true,
                label: t('settings.projects.autoPrDraft.enabled'),
                description: 'Create PRs as drafts by default',
              },
              {
                value: false,
                label: t('settings.projects.autoPrDraft.disabled'),
                description: 'Create PRs as ready for review',
              },
            ]}
          />
        </div>

        {/* Task Behavior Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Task Behavior
            </h3>
          </div>

          <TriStateToggle
            label={t('settings.projects.tasks.redirectToAttempt.label')}
            helper={t('settings.projects.tasks.redirectToAttempt.helper')}
            value={redirectToAttemptOnCreate}
            onChange={(value) =>
              onChange({ redirect_to_attempt_on_create: value })
            }
            options={[
              {
                value: null,
                label: t(
                  'settings.projects.tasks.redirectToAttempt.useGlobal'
                ),
                description: 'Use the global redirect behavior',
              },
              {
                value: true,
                label: t(
                  'settings.projects.tasks.redirectToAttempt.enabled'
                ),
                description: 'Automatically redirect to attempt page after task creation',
              },
              {
                value: false,
                label: t(
                  'settings.projects.tasks.redirectToAttempt.disabled'
                ),
                description: 'Stay on current page after creating task',
              },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
