import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { attemptsApi } from '@/lib/api';
import type { Workspace } from 'shared/types';
import NiceModal, { useModal } from '@ebay/nice-modal-react';
import { defineModal } from '@/lib/modals';
import { taskAttemptKeys } from '@/hooks/useTaskAttempts';

export interface DeleteAttemptDialogProps {
  attempt: Workspace;
}

const DeleteAttemptDialogImpl = NiceModal.create<DeleteAttemptDialogProps>(
  ({ attempt }) => {
    const { t } = useTranslation('tasks');
    const modal = useModal();
    const queryClient = useQueryClient();
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConfirmDelete = async () => {
      setIsDeleting(true);
      setError(null);

      try {
        await attemptsApi.delete(attempt.id);
        // invalidar la cache de intentos para refrescar la lista
        queryClient.invalidateQueries({
          queryKey: taskAttemptKeys.byTask(attempt.task_id),
        });
        queryClient.invalidateQueries({
          queryKey: taskAttemptKeys.byTaskWithSessions(attempt.task_id),
        });
        modal.resolve();
        modal.hide();
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : t('deleteAttemptDialog.error');
        setError(errorMessage);
      } finally {
        setIsDeleting(false);
      }
    };

    const handleCancelDelete = () => {
      modal.reject();
      modal.hide();
    };

    // mostrar nombre o branch como identificador del intento
    const attemptIdentifier = attempt.name || attempt.branch || attempt.id;

    return (
      <Dialog
        open={modal.visible}
        onOpenChange={(open) => !open && handleCancelDelete()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteAttemptDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteAttemptDialog.description', {
                name: attemptIdentifier,
              })}
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive" className="mb-4">
            <strong>{t('deleteAttemptDialog.warningTitle')}</strong>{' '}
            {t('deleteAttemptDialog.warningBody')}
          </Alert>

          {error && (
            <Alert variant="destructive" className="mb-4">
              {error}
            </Alert>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={isDeleting}
              autoFocus
            >
              {t('deleteAttemptDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting
                ? t('deleteAttemptDialog.deleting')
                : t('deleteAttemptDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export const DeleteAttemptDialog = defineModal<DeleteAttemptDialogProps, void>(
  DeleteAttemptDialogImpl
);
