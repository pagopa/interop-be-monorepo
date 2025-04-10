import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { clientServiceBuilder } from "../services/clientService.js";

const clientRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const clientRouter = ctx.router(m2mGatewayApi.clientsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const clientService = clientServiceBuilder(clients);
  void clientService;

  clientRouter.post("/clients/:clientId/purposes", async (req, res) => {
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

  return clientRouter;
};

export default clientRouter;
