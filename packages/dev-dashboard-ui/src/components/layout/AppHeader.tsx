import { Activity, ExternalLink } from "lucide-react";

import { useDashboardContext } from "../../providers/DashboardProvider";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export function AppHeader() {
  const { status } = useDashboardContext();
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b bg-card px-4 sm:px-6 lg:px-8">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
        <div className="flex items-center gap-3">
          <Badge aria-hidden="true" className="size-8 justify-center p-0">
            <Activity />
          </Badge>
          <strong>PDND Interop</strong>
          <Badge variant="outline">local</Badge>
        </div>
        {status?.frontendAvailable && (
          <Button asChild size="sm" variant="ghost">
            <a
              href="http://localhost:3000/ui/it/"
              target="_blank"
              rel="noreferrer"
            >
              Open frontend
              <ExternalLink data-icon="inline-end" />
            </a>
          </Button>
        )}
      </div>
    </header>
  );
}
