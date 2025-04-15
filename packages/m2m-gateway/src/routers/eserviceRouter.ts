import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { eserviceServiceBuilder } from "../services/eserviceService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const eserviceRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const eserviceRouter = ctx.router(m2mGatewayApi.eservicesApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const eserviceService = eserviceServiceBuilder(clients);
  void eserviceService;

  eserviceRouter
    .get("/eservices", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservices`
        );
        return res.status(errorRes.status).send();
      }
    })
    .get("/eservices/:eserviceId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice with id ${req.params.eserviceId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .get("/eservices/:eserviceId/descriptors", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error retrieving eservice ${req.params.eserviceId} descriptors`
        );
        return res.status(errorRes.status).send();
      }
    })
    .get(
      "/eservices/:eserviceId/descriptors/:descriptorId",
      async (req, res) => {
        const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
        try {
          return res.status(501).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            emptyErrorMapper,
            ctx,
            `Error retrieving eservice ${req.params.eserviceId} descriptor with id ${req.params.descriptorId}`
          );
          return res.status(errorRes.status).send();
        }
      }
    );

  return eserviceRouter;
};

export default eserviceRouter;
