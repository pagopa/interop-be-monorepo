import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { piiValidatorApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  fromAppContext,
} from "pagopa-interop-commons";
import { badRequestError } from "pagopa-interop-models";

import { DetectionRequest, DetectionResponse } from "../model/contracts.js";
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
    validationErrorHandler: (_error, req, res, _next) =>
      res
        .status(400)
        .send(
          makeApiProblem(
            badRequestError("Invalid detection request"),
            () => 400,
            fromAppContext(req.ctx)
          )
        ),
  });

  router.post("/detect", async (req, res) => {
    const appContext = fromAppContext(req.ctx);

    const parsedRequest = DetectionRequest.safeParse(req.body);
    if (!parsedRequest.success) {
      const problem = makeApiProblem(
        badRequestError("Invalid detection request"),
        () => 400,
        appContext
      );
      return res.status(400).send(problem);
    }
    try {
      const response = DetectionResponse.parse(
        await detectionService.detect(parsedRequest.data)
      );
      if (
        response.results.length !== parsedRequest.data.fields.length ||
        response.results.some(
          (result, index) =>
            result.fieldId !== parsedRequest.data.fields[index].fieldId ||
            (parsedRequest.data.fields[index].text === "" &&
              result.detectedCategories.length > 0)
        )
      ) {
        throw detectionFailed();
      }
      return res.type("application/json").status(200).send(response);
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
