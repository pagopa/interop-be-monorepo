import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";

import { makeApiProblem } from "../model/errors.js";
import { ProducerDashboardService } from "../services/producerDashboardService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { getProducerDashboardSaturationErrorMapper } from "../utilities/errorMappers.js";

const producerDashboardRouter = (
  ctx: ZodiosContext,
  producerDashboardService: ProducerDashboardService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const producerDashboardRouter = ctx.router(bffApi.producersDashboardApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  producerDashboardRouter.get(
    "/producers/dashboard/saturation",
    async (req, res) => {
      const ctx = fromBffAppContext(req.ctx, req.headers);

      try {
        const result =
          await producerDashboardService.getProducerDashboardSaturation(
            req.query,
            ctx
          );

        return res
          .status(200)
          .send(bffApi.ProducerDashboardSaturation.parse(result));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerDashboardSaturationErrorMapper,
          ctx,
          `Error retrieving producer dashboard saturation for q ${req.query.q}, sortBy ${req.query.sortBy}, offset ${req.query.offset}, limit ${req.query.limit}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  return producerDashboardRouter;
};

export default producerDashboardRouter;
