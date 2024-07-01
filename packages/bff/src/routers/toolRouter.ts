import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { toolsApi } from "../model/generated/api.js";

const toolRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolRouter = ctx.router(toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  toolRouter.post("/tools/validateTokenGeneration", async (_req, res) =>
    res.status(501).send()
  );

  return toolRouter;
};

export default toolRouter;
