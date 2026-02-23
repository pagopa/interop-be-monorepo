import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import {
  ZodiosContext,
  ExpressContext,
  zodiosValidationErrorToApiProblem,
  validateAuthorization,
  authRole,
} from "pagopa-interop-commons";
import { emptyErrorMapper } from "pagopa-interop-models";
import { makeApiProblem } from "../model/errors.js";
import { DelegationService } from "../services/delegationService.js";
import { fromM2MGatewayAppContext } from "../utils/context.js";

const { M2M_ADMIN_ROLE, M2M_ROLE } = authRole;

const delegationRouter = (
  ctx: ZodiosContext,
  delegationService: DelegationService
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(m2mGatewayApi.delegationsApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  delegationRouter
    .get("/consumerDelegations", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const consumerDelegations =
          await delegationService.getConsumerDelegations(req.query, ctx);

        return res
          .status(200)
          .send(m2mGatewayApi.ConsumerDelegations.parse(consumerDelegations));
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
    .get("/consumerDelegations/:delegationId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const consumerDelegation =
          await delegationService.getConsumerDelegation(
            req.params.delegationId,
            ctx
          );
        return res
          .status(200)
          .send(m2mGatewayApi.ConsumerDelegation.parse(consumerDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving consumer delegation"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumerDelegations", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const createdDelegation =
          await delegationService.createConsumerDelegation(req.body, ctx);

        return res
          .status(201)
          .send(m2mGatewayApi.ConsumerDelegation.parse(createdDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating consumer delegation for eservice ${req.body.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/consumerDelegations/:delegationId/accept", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const acceptedDelegation =
          await delegationService.acceptConsumerDelegation(
            req.params.delegationId,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.ConsumerDelegation.parse(acceptedDelegation));
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
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const rejectedDelegation =
          await delegationService.rejectConsumerDelegation(
            req.params.delegationId,
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.ConsumerDelegation.parse(rejectedDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting consumer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerDelegations", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const producerDelegations =
          await delegationService.getProducerDelegations(req.query, ctx);

        return res
          .status(200)
          .send(m2mGatewayApi.ProducerDelegations.parse(producerDelegations));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving producer delegations"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerDelegations/:delegationId", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const producerDelegation =
          await delegationService.getProducerDelegation(
            req.params.delegationId,
            ctx
          );
        return res
          .status(200)
          .send(m2mGatewayApi.ProducerDelegation.parse(producerDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          "Error retrieving producer delegation"
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerDelegations/:delegationId/accept", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const acceptedDelegation =
          await delegationService.acceptProducerDelegation(
            req.params.delegationId,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.ProducerDelegation.parse(acceptedDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error accepting producer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerDelegations/:delegationId/reject", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const rejectedDelegation =
          await delegationService.rejectProducerDelegation(
            req.params.delegationId,
            req.body,
            ctx
          );

        return res
          .status(200)
          .send(m2mGatewayApi.ProducerDelegation.parse(rejectedDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error rejecting producer delegation with id ${req.params.delegationId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerDelegations", async (req, res) => {
      const ctx = fromM2MGatewayAppContext(req.ctx, req.headers);

      try {
        validateAuthorization(ctx, [M2M_ADMIN_ROLE]);

        const createdDelegation =
          await delegationService.createProducerDelegation(req.body, ctx);

        return res
          .status(201)
          .send(m2mGatewayApi.ProducerDelegation.parse(createdDelegation));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          emptyErrorMapper,
          ctx,
          `Error creating producer delegation for eservice ${req.body.eserviceId}`
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return delegationRouter;
};

export default delegationRouter;
