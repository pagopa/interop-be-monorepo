import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { emptyErrorMapper } from "../utilities/errorMappers.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";

const authorizationRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(m2mGatewayApi.authorizationApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const authorizationService = authorizationServiceBuilder(clients);
  void authorizationService;

  authorizationRouter.post("/clients/:clientId/purposes", async (req, res) => {
    const ctx = fromAppContext(req.ctx);
    try {
      return res.status(501).send();
    } catch (error) {
      const errorRes = makeApiProblem(
        error,
        emptyErrorMapper,
        ctx,
        `Error adding purpose to client with id ${req.params.clientId}`
      );
      return res.status(errorRes.status).send();
    }
  });

  return authorizationRouter;
};

export default authorizationRouter;
