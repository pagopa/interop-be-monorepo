import { RouterProvider } from "react-router-dom";

import { AppProviders } from "./providers/AppProviders";
import { createDashboardRouter } from "./router/DashboardRoutes";

const defaultRouter = createDashboardRouter();

export function App({
  router = defaultRouter,
}: {
  router?: ReturnType<typeof createDashboardRouter>;
}) {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
