import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { piiValidatorApi } from "pagopa-interop-api-clients";
import {
  AppContext,
  ExpressContext,
  ZodiosContext,
  fromAppContext,
} from "pagopa-interop-commons";
import { badRequestError } from "pagopa-interop-models";

import {
  DetectionRequest,
  parseDetectionResponse,
} from "../model/contracts.js";
import { detectionFailed, makeApiProblem } from "../model/errors.js";
import {
  DetectionService,
  detectionService as defaultDetectionService,
} from "../services/detectionService.js";
import { detectionErrorMapper } from "../utilities/errorMappers.js";

function invalidRequestProblem(
  context: AppContext
): ReturnType<typeof makeApiProblem> {
  return makeApiProblem(
    badRequestError("Invalid detection request"),
    () => 400,
    fromAppContext(context)
  );
}

const detectionRouter = (
  ctx: ZodiosContext,
  detectionService: DetectionService = defaultDetectionService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const router = ctx.router(piiValidatorApi.detectionApi.api, {
    validationErrorHandler: (_error, req, res, _next) =>
      res.status(400).send(invalidRequestProblem(req.ctx)),
  });

  router.post("/detect", async (req, res) => {
    const appContext = fromAppContext(req.ctx);

    const parsedRequest = DetectionRequest.safeParse(req.body);
    if (!parsedRequest.success) {
      return res.status(400).send(invalidRequestProblem(req.ctx));
    }
    try {
      const response = parseDetectionResponse(
        parsedRequest.data,
        await detectionService.detect(parsedRequest.data)
      );
      return res.type("application/json").status(200).send(response);
    } catch {
      const problem = makeApiProblem(
        detectionFailed(),
        detectionErrorMapper,
        appContext
      );
      return res.status(problem.status).send(problem);
    }
  });

  return router;
};

export default detectionRouter;
