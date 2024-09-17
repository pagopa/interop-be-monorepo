import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";

const toolsRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolsRouter = ctx.router(bffApi.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  toolsRouter.post("/tools/validateTokenGeneration", async (_req, res) =>
    res.status(501).send()
  );

  return toolsRouter;
};

export default toolsRouter;
