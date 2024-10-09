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
  createProducerDelegationErrorMapper,
  getDelegationByIdErrorMapper,
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
    .get("/producer/delegations/:delegationId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { delegationId } = req.params;

      try {
        const delegation = await delegationProducerService.getDelegationById(
          unsafeBrandId(delegationId)
        );

        return res
          .status(200)
          .send(
            delegationApi.Delegation.parse(
              delegationToApiDelegation(delegation)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getDelegationByIdErrorMapper,
          ctx.logger
        );

        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producer/delegations", async (_req, res) => res.status(501).send())
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
    .post("/producer/delegations/:delegationId/approve", async (_req, res) =>
      res.status(501).send()
    )
    .post("/producer/delegations/:delegationId/reject", async (_req, res) =>
      res.status(501).send()
    )
    .delete("/producer/delegations/:delegationId", async (_req, res) =>
      res.status(501).send()
    );

  return delegationRouter;
};

export default delegationProducerRouter;
