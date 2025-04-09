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
import { catalogServiceBuilder } from "../services/catalogService.js";

const catalogRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const catalogRouter = ctx.router(m2mGatewayApi.catalogApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const catalogService = catalogServiceBuilder(clients);
  void catalogService;

  catalogRouter
    .get("/eservices", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
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
      const ctx = fromAppContext(req.ctx);
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
      const ctx = fromAppContext(req.ctx);
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
        const ctx = fromAppContext(req.ctx);
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

  return catalogRouter;
};

export default catalogRouter;
