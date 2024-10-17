import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import { delegationApi } from "pagopa-interop-api-clients";
import {
  ExpressContext,
  ReadModelRepository,
  userRoles,
  ZodiosContext,
  fromAppContext,
  zodiosValidationErrorToApiProblem,
  authorizationMiddleware,
  initDB,
} from "pagopa-interop-commons";
import { unsafeBrandId } from "pagopa-interop-models";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { config } from "../config/config.js";
import { delegationProducerServiceBuilder } from "../services/delegationProducerService.js";
import { delegationToApiDelegation } from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  approveRejectDelegationErrorMapper,
  createProducerDelegationErrorMapper,
} from "../utilites/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const { ADMIN_ROLE } = userRoles;

const delegationProducerRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const delegationRouter = ctx.router(delegationApi.producerApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  const delegationProducerService = delegationProducerServiceBuilder(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    readModelService
  );

  delegationRouter
    .post(
      "/producer/delegations",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          const delegation =
            await delegationProducerService.createProducerDelegation(
              req.body,
              ctx
            );
          return res
            .status(200)
            .json(
              delegationApi.Delegation.parse(
                delegationToApiDelegation(delegation)
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createProducerDelegationErrorMapper,
            ctx.logger
          );

          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/producer/delegations/:delegationId/approve", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;

      try {
        await delegationProducerService.approveProducerDelegation(
          ctx.authData.organizationId,
          unsafeBrandId(delegationId),
          ctx.correlationId
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          approveRejectDelegationErrorMapper,
          ctx.logger
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producer/delegations/:delegationId/reject", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;
      const { rejectionReason } = req.body;

      try {
        await delegationProducerService.rejectProducerDelegation(
          ctx.authData.organizationId,
          unsafeBrandId(delegationId),
          ctx.correlationId,
          rejectionReason
        );

        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          approveRejectDelegationErrorMapper,
          ctx.logger
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/producer/delegations/:delegationId", async (_req, res) =>
      res.status(501).send()
    );

  return delegationRouter;
};

export default delegationProducerRouter;
