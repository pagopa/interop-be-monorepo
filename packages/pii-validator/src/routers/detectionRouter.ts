import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { piiValidatorApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";

import { DetectionResponse } from "../model/contracts.js";
import {
  detectionFailed,
  isDetectionError,
  makeApiProblem,
} from "../model/errors.js";
import {
  DetectionService,
  detectionService as defaultDetectionService,
} from "../services/detectionService.js";
import { detectionErrorMapper } from "../utilities/errorMappers.js";

const detectionRouter = (
  ctx: ZodiosContext,
  detectionService: DetectionService = defaultDetectionService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const router = ctx.router(piiValidatorApi.detectionApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  router.post("/detect", async (req, res) => {
    const appContext = fromAppContext(req.ctx);

    try {
      const response = await detectionService.detect(req.body);
      return res
        .type("application/json")
        .status(200)
        .send(DetectionResponse.parse(response));
    } catch (error) {
      const safeError = isDetectionError(error) ? error : detectionFailed();
      const problem = makeApiProblem(
        safeError,
        detectionErrorMapper,
        appContext
      );
      return res.status(problem.status).send(problem);
    }
  });

  return router;
};

export default detectionRouter;
