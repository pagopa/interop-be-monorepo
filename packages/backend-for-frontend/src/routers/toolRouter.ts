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

import { makeApiProblem } from "../model/errors.js";
import { ToolsService } from "../services/toolService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { toolsErrorMapper } from "../utilities/errorMappers.js";

const toolRouter = (
  ctx: ZodiosContext,
  toolsService: ToolsService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolRouter = ctx.router(bffApi.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  toolRouter.post("/tools/validateTokenGeneration", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);

    try {
      validateAuthorization(ctx, [
        authRole.ADMIN_ROLE,
        authRole.SECURITY_ROLE,
        authRole.SUPPORT_ROLE,
      ]);

      const result = await toolsService.validateTokenGeneration(
        req.body.client_id,
        req.body.client_assertion,
        req.body.client_assertion_type,
        req.body.grant_type,
        req.body.is_async === "true",
        req.body.dpop_proof,
        ctx
      );
      return res
        .status(200)
        .send(bffApi.TokenGenerationValidationResult.parse(result));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        toolsErrorMapper,
        ctx,
        "Error validating token generation request"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return toolRouter;
};

export default toolRouter;
