import { Router } from "express";
import { constants } from "node:http2";
import { IdentityInput } from "pagopa-interop-dev-dashboard-contracts";

import type { IdentityService } from "../services/identityService.js";
import type { Supervisor } from "../services/supervisorService.js";

import { PresetId } from "../model/domain/models.js";
import { parseLogQuery } from "../utilities/logQuery.js";
import { asyncHandler } from "../utilities/middleware.js";

const dashboardRouter = (
  supervisor: Supervisor,
  identities: IdentityService
): Router => {
  const router = Router();

  router.get("/status", (_request, response) => {
    response.json(supervisor.status());
  });

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
