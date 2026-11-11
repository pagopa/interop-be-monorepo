import { LoaderCircle, type LucideIcon } from "lucide-react";
import { useRef, useState, type ReactElement } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";

type Props = {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  confirmIcon?: LucideIcon;
  onConfirm: () => Promise<unknown>;
  busy: boolean;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  confirmIcon: ConfirmIcon,
  onConfirm,
  busy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const confirmationRequest = useRef(false);
  const pending = busy || confirming;
  async function confirm() {
    if (confirmationRequest.current || pending) return;
    confirmationRequest.current = true;
    setConfirming(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      confirmationRequest.current = false;
      setConfirming(false);
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            aria-label={confirmLabel}
            aria-busy={pending}
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {pending ? (
              <LoaderCircle
                data-icon="inline-start"
                aria-hidden="true"
                className="animate-spin"
              />
            ) : ConfirmIcon ? (
              <ConfirmIcon data-icon="inline-start" aria-hidden="true" />
            ) : null}
            {pending && (
              <span className="sr-only" role="status">
                Confirming action
              </span>
            )}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
