import { Activity } from "lucide-react";

import { Badge } from "../ui/badge";

export function AppHeader() {
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
      </div>
    </header>
  );
}
