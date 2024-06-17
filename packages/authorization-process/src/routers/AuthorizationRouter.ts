import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  userRoles,
  ZodiosContext,
  authorizationMiddleware,
  zodiosValidationErrorToApiProblem,
  ReadModelRepository,
  initDB,
  fromAppContext,
} from "pagopa-interop-commons";
import { PurposeId, UserId, unsafeBrandId } from "pagopa-interop-models";
import { api } from "../model/generated/api.js";
import { config } from "../utilities/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import { clientToApiClient } from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  createClientErrorMapper,
  deleteClientErrorMapper,
  getClientErrorMapper,
} from "../utilities/errorMappers.js";

const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const authorizationService = authorizationServiceBuilder(
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

const authorizationRouter = (
  ctx: ZodiosContext
): ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext> => {
  const authorizationRouter = ctx.router(api.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  const { ADMIN_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE } = userRoles;
  authorizationRouter
    .post(
      "/clientsConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.createConsumerClient(
              req.body,
              ctx.authData.organizationId,
              req.ctx.correlationId,
              ctx.logger
            );
          return res
            .status(200)
            .json(clientToApiClient(client, { includeKeys: false, showUsers }))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, () => 500, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/clientsApi",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.createApiClient(
              req.body,
              ctx.authData.organizationId,
              req.ctx.correlationId,
              ctx.logger
            );
          return res
            .status(200)
            .json(clientToApiClient(client, { includeKeys: false, showUsers }))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, () => 500, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clientsWithKeys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { name, userIds, consumerId, purposeId, kind, offset, limit } =
            req.query;
          const clients = await authorizationService.getClients(
            {
              name,
              userIds: userIds?.map(unsafeBrandId<UserId>),
              consumerId: unsafeBrandId(consumerId),
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind,
            },
            { offset, limit },
            req.ctx.authData,
            ctx.logger
          );
          return res
            .status(200)
            .json({
              results: clients.results.map((client) =>
                clientToApiClient(client, {
                  includeKeys: false,
                  showUsers: ctx.authData.organizationId === client.consumerId,
                })
              ),
              totalCount: clients.totalCount,
            })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(error, () => 500, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clients/:clientId",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.getClientById(
              unsafeBrandId(req.params.clientId),
              ctx.authData.organizationId,
              ctx.logger
            );
          return res
            .status(200)
            .json(clientToApiClient(client, { includeKeys: false, showUsers }))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/clients/:clientId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.deleteClient({
            clientId: unsafeBrandId(req.params.clientId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteClientErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clients/:clientId/users",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .get(
      "/clients/:clientId/users/:userId/keys",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .post(
      "/clients/:clientId/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/:clientId/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    )
    .delete(
      "/clients/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (_req, res) => res.status(501).send()
    );

  return authorizationRouter;
};
export default authorizationRouter;
