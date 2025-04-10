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
import { attributeServiceBuilder } from "../services/attributeService.js";

const attributeRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const attributeRouter = ctx.router(m2mGatewayApi.attributesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const attributeService = attributeServiceBuilder(clients);
  void attributeService;

  attributeRouter
    .get("/certifiedAttributes/:attributeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving certified attribute with id ${req.params.attributeId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/certifiedAttributes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating certified attribute"
        );
        return res.status(errorRes.status).send();
      }
    });

  return attributeRouter;
};

export default attributeRouter;
