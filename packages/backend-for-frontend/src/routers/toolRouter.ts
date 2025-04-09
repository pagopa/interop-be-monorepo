import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { toolsServiceBuilder } from "../services/toolService.js";
import { fromBffAppContext } from "../utilities/context.js";
import { toolsErrorMapper } from "../utilities/errorMappers.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { makeApiProblem } from "../model/errors.js";

const toolRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolRouter = ctx.router(bffApi.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const toolsService = toolsServiceBuilder(clients);

  toolRouter.post("/tools/validateTokenGeneration", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);

    try {
      const result = await toolsService.validateTokenGeneration(
        req.body.client_id,
        req.body.client_assertion,
        req.body.client_assertion_type,
        req.body.grant_type,
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
