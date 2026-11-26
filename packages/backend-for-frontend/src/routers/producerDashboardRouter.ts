import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  authRole,
  ExpressContext,
  validateAuthorization,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";

import { makeApiProblem } from "../model/errors.js";
import { CatalogService } from "../services/catalogService.js";
import { fromBffAppContext } from "../utilities/context.js";

const producerDashboardRouter = (
  ctx: ZodiosContext,
  catalogService: CatalogService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerDashboardRouter = ctx.router(bffApi.producersDashboardApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  producerDashboardRouter.get("/producers/dashboard", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);
    try {
      validateAuthorization(ctx, [
        authRole.ADMIN_ROLE,
        authRole.SUPPORT_ROLE,
        authRole.API_ROLE,
        authRole.SECURITY_ROLE,
        authRole.VIEWER_ROLE,
      ]);
      const response = await catalogService.getProducerDashboard(ctx);
      return res.status(200).send(bffApi.ProducerDashboard.parse(response));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        "Error retrieving producer dashboard"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return producerDashboardRouter;
};

export default producerDashboardRouter;
