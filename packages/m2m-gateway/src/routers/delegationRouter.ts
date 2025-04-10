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
import { delegationServiceBuilder } from "../services/delegationService.js";

const delegationRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(m2mGatewayApi.delegationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationService = delegationServiceBuilder(clients);
  void delegationService;

  delegationRouter
    .get("/consumerDelegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving consumer delegations"
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/consumerDelegations", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating consumer delegation"
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/consumerDelegations/:delegationId/accept", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error accepting consumer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send();
      }
    })
    .post("/consumerDelegations/:delegationId/reject", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting consumer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send();
      }
    });

  return delegationRouter;
};

export default delegationRouter;
