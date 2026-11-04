import type { ReactNode } from "react";

import { AlertCircle, Terminal, X } from "lucide-react";
import { Link } from "react-router-dom";

import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

export function ErrorAlert({
  title,
  message,
  onDismiss,
  logsHref,
}: {
  title?: string;
  message: ReactNode;
  onDismiss?: () => void;
  logsHref?: string;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        <span>{message}</span>
        {(logsHref || onDismiss) && (
          <div className="flex shrink-0 items-center gap-2">
            {logsHref && (
              <Button asChild variant="ghost" size="sm">
                <Link to={logsHref}>
                  <Terminal data-icon="inline-start" aria-hidden="true" />
                  Logs
                </Link>
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dismiss error"
                onClick={onDismiss}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
