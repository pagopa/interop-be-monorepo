import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { usePageFocus } from "../../hooks/usePageFocus";
import { useDashboardContext } from "../../providers/DashboardProvider";
import { ErrorAlert } from "../common/ErrorAlert";
import { PageLoading } from "../common/PageLoading";
import { AppHeader } from "./AppHeader";
import { AppNavigation } from "./AppNavigation";
import { AppShell } from "./AppShell";
import { RuntimeToolbar } from "./RuntimeToolbar";

export function DashboardLayout() {
  const dashboard = useDashboardContext();
  const { pathname } = useLocation();
  const contentRef = usePageFocus(pathname);
  return (
    <AppShell
      header={<AppHeader />}
      navigation={<AppNavigation />}
      contentRef={contentRef}
    >
      <RuntimeToolbar />
      {dashboard.connectionError && (
        <ErrorAlert
          title="Cannot reach the dashboard API"
          message={dashboard.connectionError}
        />
      )}
      {dashboard.actionError &&
        ["/presets", "/infrastructure", "/logs"].includes(pathname) && (
          <ErrorAlert
            message={dashboard.actionError}
            onDismiss={dashboard.dismissError}
          />
        )}
      {dashboard.status || pathname === "/logs" ? (
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      ) : (
        !dashboard.connectionError && <PageLoading />
      )}
    </AppShell>
  );
}
