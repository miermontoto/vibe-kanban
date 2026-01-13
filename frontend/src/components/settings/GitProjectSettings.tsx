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
            <CardTitle className="text-xl">
              {t('settings.projects.git.title')}
            </CardTitle>
            <CardDescription className="mt-1">
              {t('settings.projects.git.description')}
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
              {t('settings.projects.git.sections.commits')}
            </h3>
          </div>

          <TriStateToggle
            label={t('settings.projects.git.autoCommit.label')}
            helper={t('settings.projects.git.autoCommit.helper')}
            value={gitAutoCommitEnabled}
            onChange={(value) => onChange({ git_auto_commit_enabled: value })}
            options={[
              {
                value: null,
                label: t('settings.projects.git.autoCommit.useGlobal'),
                description: t(
                  'settings.projects.git.autoCommit.useGlobalDescription'
                ),
              },
              {
                value: true,
                label: t('settings.projects.git.autoCommit.enabled'),
                description: t(
                  'settings.projects.git.autoCommit.enabledDescription'
                ),
              },
              {
                value: false,
                label: t('settings.projects.git.autoCommit.disabled'),
                description: t(
                  'settings.projects.git.autoCommit.disabledDescription'
                ),
              },
            ]}
          />

          <TriStateToggle
            label={t('settings.projects.git.commitTitleMode.label')}
            helper={t('settings.projects.git.commitTitleMode.helper')}
            value={gitCommitTitleMode}
            onChange={(value) => onChange({ git_commit_title_mode: value })}
            options={[
              {
                value: null,
                label: t('settings.projects.git.commitTitleMode.useGlobal'),
                description: t(
                  'settings.projects.git.commitTitleMode.useGlobalDescription'
                ),
              },
              {
                value: 'AgentSummary',
                label: t('settings.projects.git.commitTitleMode.agentSummary'),
                description: t(
                  'settings.projects.git.commitTitleMode.agentSummaryDescription'
                ),
              },
              {
                value: 'AiGenerated',
                label: t('settings.projects.git.commitTitleMode.aiGenerated'),
                description: t(
                  'settings.projects.git.commitTitleMode.aiGeneratedDescription'
                ),
                badge: (
                  <Badge variant="outline" className="text-xs">
                    {t('settings.general.git.commitTitleMode.notImplemented')}
                  </Badge>
                ),
              },
              {
                value: 'Manual',
                label: t('settings.projects.git.commitTitleMode.manual'),
                description: t(
                  'settings.projects.git.commitTitleMode.manualDescription'
                ),
              },
            ]}
          />
        </div>

        {/* Pull Requests Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <GitPullRequest className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t('settings.projects.git.sections.pullRequests')}
            </h3>
          </div>

          <TriStateToggle
            label={t('settings.projects.autoPr.label')}
            helper={t('settings.projects.autoPr.helper')}
            value={autoPrOnReviewEnabled}
            onChange={(value) => onChange({ auto_pr_on_review_enabled: value })}
            options={[
              {
                value: null,
                label: t('settings.projects.autoPr.useGlobal'),
                description: t('settings.projects.autoPr.useGlobalDescription'),
              },
              {
                value: true,
                label: t('settings.projects.autoPr.enabled'),
                description: t('settings.projects.autoPr.enabledDescription'),
              },
              {
                value: false,
                label: t('settings.projects.autoPr.disabled'),
                description: t('settings.projects.autoPr.disabledDescription'),
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
                description: t(
                  'settings.projects.autoPrDraft.useGlobalDescription'
                ),
              },
              {
                value: true,
                label: t('settings.projects.autoPrDraft.enabled'),
                description: t(
                  'settings.projects.autoPrDraft.enabledDescription'
                ),
              },
              {
                value: false,
                label: t('settings.projects.autoPrDraft.disabled'),
                description: t(
                  'settings.projects.autoPrDraft.disabledDescription'
                ),
              },
            ]}
          />
        </div>

        {/* Task Behavior Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              {t('settings.projects.git.sections.taskBehavior')}
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
                label: t('settings.projects.tasks.redirectToAttempt.useGlobal'),
                description: t(
                  'settings.projects.tasks.redirectToAttempt.useGlobalDescription'
                ),
              },
              {
                value: true,
                label: t('settings.projects.tasks.redirectToAttempt.enabled'),
                description: t(
                  'settings.projects.tasks.redirectToAttempt.enabledDescription'
                ),
              },
              {
                value: false,
                label: t('settings.projects.tasks.redirectToAttempt.disabled'),
                description: t(
                  'settings.projects.tasks.redirectToAttempt.disabledDescription'
                ),
              },
            ]}
          />
        </div>
      </CardContent>
    </Card>
  );
}
