import { lazy } from "react";
import { createHashRouter, Navigate } from "react-router-dom";

import { DashboardLayout } from "../components/layout/DashboardLayout";
import { useDashboardContext } from "../providers/DashboardProvider";
import { paths } from "./paths";

const PackagesPage = lazy(() =>
  import("../pages/PackagesPage").then(({ PackagesPage }) => ({
    default: PackagesPage,
  }))
);
const FullstackStatusPage = lazy(() =>
  import("../pages/FullstackStatusPage").then(({ FullstackStatusPage }) => ({
    default: FullstackStatusPage,
  }))
);
const PresetsPage = lazy(() =>
  import("../pages/PresetsPage").then(({ PresetsPage }) => ({
    default: PresetsPage,
  }))
);
const InfrastructurePage = lazy(() =>
  import("../pages/InfrastructurePage").then(({ InfrastructurePage }) => ({
    default: InfrastructurePage,
  }))
);
const AccessTokenPage = lazy(() =>
  import("../pages/AccessTokenPage").then(({ AccessTokenPage }) => ({
    default: AccessTokenPage,
  }))
);
const LogsPage = lazy(() =>
  import("../pages/LogsPage").then(({ LogsPage }) => ({
    default: LogsPage,
  }))
);

function DefaultPage() {
  const { status } = useDashboardContext();
  return (
    <Navigate to={status?.frontend ? paths.status : paths.packages} replace />
  );
}

export function createDashboardRouter() {
  return createHashRouter([
    {
      element: <DashboardLayout />,
      children: [
        { path: paths.status, element: <FullstackStatusPage /> },
        { path: paths.packages, element: <PackagesPage /> },
        { path: paths.presets, element: <PresetsPage /> },
        { path: paths.infrastructure, element: <InfrastructurePage /> },
        { path: paths.accessToken, element: <AccessTokenPage /> },
        { path: paths.logs, element: <LogsPage /> },
        { path: "*", element: <DefaultPage /> },
      ],
    },
  ]);
}
