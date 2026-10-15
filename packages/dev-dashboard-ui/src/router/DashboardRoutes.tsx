import { lazy } from "react";
import { createHashRouter, Navigate } from "react-router-dom";

import { DashboardLayout } from "../components/layout/DashboardLayout";
import { paths } from "./paths";

const PackagesPage = lazy(() =>
  import("../pages/PackagesPage").then(({ PackagesPage }) => ({
    default: PackagesPage,
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

export function createDashboardRouter() {
  return createHashRouter([
    {
      element: <DashboardLayout />,
      children: [
        { path: paths.packages, element: <PackagesPage /> },
        { path: paths.presets, element: <PresetsPage /> },
        { path: paths.infrastructure, element: <InfrastructurePage /> },
        { path: paths.accessToken, element: <AccessTokenPage /> },
        { path: paths.logs, element: <LogsPage /> },
        { path: "*", element: <Navigate to={paths.packages} replace /> },
      ],
    },
  ]);
}
