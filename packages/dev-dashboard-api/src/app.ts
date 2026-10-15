import express from "express";

import type { FrontendService } from "./services/frontendService.js";
import type { IdentityService } from "./services/identityService.js";
import type { Supervisor } from "./services/supervisorService.js";

import {
  DASHBOARD_API_BASE_PATH,
  DASHBOARD_UI_BASE_PATH,
} from "./config/constants.js";
import dashboardRouter from "./routers/DashboardRouter.js";
import {
  dashboardErrorMiddleware,
  dashboardMutationMiddleware,
} from "./utilities/middleware.js";

export const createApp = (
  supervisor: Supervisor,
  identities: IdentityService,
  uiRoot?: string,
  frontend?: FrontendService
): express.Express => {
  const app = express();

  app.disable("x-powered-by");
  app.use(dashboardMutationMiddleware);
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.use(
    DASHBOARD_API_BASE_PATH,
    dashboardRouter(supervisor, identities, frontend)
  );

  if (uiRoot) {
    app.use(DASHBOARD_UI_BASE_PATH, express.static(uiRoot));
    app.use(express.static(uiRoot));
  }

  app.use(dashboardErrorMiddleware);

  return app;
};
