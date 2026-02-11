import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { makeApiProblem } from "../model/errors.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";
import { toolsErrorMapper } from "../utils/errorMappers.js";
import { ToolService } from "../services/toolService.js";

const toolRouter = (
  ctx: ZodiosContext,
  toolService: ToolService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolRouter = ctx.router(m2mGatewayApiV3.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  toolRouter.post("/tools/validateM2MTokenGeneration", async (req, res) => {
    const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

    try {
      const result = await toolService.validateM2MTokenGeneration(
        req.body.client_id,
        req.body.client_assertion,
        req.body.client_assertion_type,
        req.body.grant_type,
        req.body.dpop_proof,
        ctx
      );

      return res
        .status(200)
        .send(m2mGatewayApiV3.M2MTokenValidationResult.parse(result));
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        toolsErrorMapper,
        ctx,
        "Error validating M2M token generation request"
      );
      return res.status(errorRes.status).send(errorRes);
    }
  });

  return toolRouter;
};

export default toolRouter;
