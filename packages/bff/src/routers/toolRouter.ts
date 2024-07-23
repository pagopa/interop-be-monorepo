import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { bffApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";

const toolRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolRouter = ctx.router(bffApi.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  toolRouter.post("/tools/validateTokenGeneration", async (_req, res) =>
    res.status(501).send()
  );

  return toolRouter;
};

export default toolRouter;
