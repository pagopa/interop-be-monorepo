import { Router } from "express";
import { constants } from "node:http2";
import {
  IdentityInput,
  FrontendLogSource,
} from "pagopa-interop-dev-dashboard-contracts";

import type { FrontendService } from "../services/frontendService.js";
import type { IdentityService } from "../services/identityService.js";
import type { Supervisor } from "../services/supervisorService.js";

import { PresetId } from "../model/domain/models.js";
import { parseLogQuery } from "../utilities/logQuery.js";
import { asyncHandler } from "../utilities/middleware.js";

const dashboardRouter = (
  supervisor: Supervisor,
  identities: IdentityService,
  frontend?: FrontendService
): Router => {
  const router = Router();

  router.get(
    "/status",
    asyncHandler(async (_request, response) => {
      const frontendStatus = frontend
        ? { frontend: await frontend.status() }
        : {};
      response.json({ ...supervisor.status(), ...frontendStatus });
    })
  );

  router.get(
    "/frontend/logs",
    asyncHandler(async (request, response) => {
      if (!frontend) {
        response
          .status(constants.HTTP_STATUS_NOT_FOUND)
          .json({ error: "Frontend integration is disabled" });
        return;
      }
      const source = FrontendLogSource.parse(request.query.source ?? "startup");
      response.json(await frontend.logs(source));
    })
  );

  router.get("/logs", (request, response, next) => {
    try {
      response.json(
        supervisor.logs.read(parseLogQuery(request.query, supervisor))
      );
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/identities",
    asyncHandler(async (_request, response) => {
      await supervisor.refreshSeed();
      response.json(await identities.identities());
    })
  );

  router.post(
    "/identity",
    asyncHandler(async (request, response) => {
      response.json(
        await identities.identity(IdentityInput.parse(request.body))
      );
    })
  );

  router.post("/actions", (request, response, next) => {
    try {
      response
        .status(constants.HTTP_STATUS_ACCEPTED)
        .json(supervisor.action(request.body));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/presets",
    asyncHandler(async (request, response) => {
      response.json(await supervisor.savePreset(request.body));
    })
  );

  router.delete(
    "/presets/:id",
    asyncHandler(async (request, response) => {
      await supervisor.deletePreset(PresetId.parse(request.params.id));
      response.sendStatus(constants.HTTP_STATUS_NO_CONTENT);
    })
  );

  router.use((_request, response) => {
    response
      .status(constants.HTTP_STATUS_NOT_FOUND)
      .json({ error: "Unknown dashboard endpoint" });
  });

  return router;
};

export default dashboardRouter;
