import type { ReactNode } from "react";

import { DashboardProvider } from "./DashboardProvider";
import { NotificationProvider } from "./NotificationProvider";
import { QueryProvider } from "./QueryProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <NotificationProvider>
        <DashboardProvider>{children}</DashboardProvider>
      </NotificationProvider>
    </QueryProvider>
  );
}
