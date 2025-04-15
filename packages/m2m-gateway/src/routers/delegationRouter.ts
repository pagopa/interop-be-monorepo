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
import { delegationServiceBuilder } from "../services/delegationService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const delegationRouter = (
  ctx: ZodiosContext,
  clients: PagoPAInteropBeClients
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(m2mGatewayApi.delegationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationService = delegationServiceBuilder(clients);

  delegationRouter
    .get("/consumerDelegations", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving consumer delegations"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumerDelegations", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        const createdDelegation =
          await delegationService.createConsumerDelegation(req.body, ctx);

        return res
          .status(200)
          .send(m2mGatewayApi.ConsumerDelegation.parse(createdDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error creating consumer delegation"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumerDelegations/:delegationId/accept", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error accepting consumer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumerDelegations/:delegationId/reject", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);
      try {
        return res.status(501).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting consumer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return delegationRouter;
};

export default delegationRouter;
