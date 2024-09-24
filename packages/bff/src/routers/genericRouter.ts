import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { bffApi } from "pagopa-interop-api-clients";
import { toolsServiceBuilder } from "../services/toolsService.js";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { fromBffAppContext } from "../utilities/context.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { makeApiProblem } from "../model/domain/errors.js";

const toolsRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const toolsRouter = ctx.router(bffApi.toolsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const toolsService = toolsServiceBuilder(clients);

  toolsRouter.post("/tools/validateTokenGeneration", async (req, res) => {
    const ctx = fromBffAppContext(req.ctx, req.headers);

    try {
      const result = await toolsService.validateTokenGeneration(
        req.body.client_id,
        req.body.client_assertion,
        req.body.client_assertion_type,
        req.body.grant_type,
        ctx
      );
      return res.status(200).json(result).end();
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx.logger,
        "Error validating token generation request"
      );
      return res.status(errorRes.status).json(errorRes).end();
    }
  });

  return toolsRouter;
};

const supportRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const supportRouter = ctx.router(bffApi.supportApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  supportRouter.post("/session/saml2/tokens", async (_req, res) =>
    res.status(501).send()
  );

  return supportRouter;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default function genericRouter(
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
) {
  return [toolsRouter(ctx, clients), supportRouter(ctx)];
}
