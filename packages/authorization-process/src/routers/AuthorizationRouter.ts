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
import {
  authorizationApi,
  selfcareV2InstitutionClientBuilder,
} from "pagopa-interop-api-clients";
import { config } from "../config/config.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import { authorizationServiceBuilder } from "../services/authorizationService.js";
import {
  apiClientKindToClientKind,
  clientToApiClient,
  clientToApiClientWithKeys,
  keyToApiKey,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  addUserErrorMapper,
  deleteClientErrorMapper,
  getClientsErrorMapper,
  createApiClientErrorMapper,
  createConsumerClientErrorMapper,
  deleteClientKeyByIdErrorMapper,
  getClientErrorMapper,
  getClientKeyErrorMapper,
  getClientKeysErrorMapper,
  getClientUsersErrorMapper,
  removeClientPurposeErrorMapper,
  removeUserErrorMapper,
  createKeysErrorMapper,
  getClientKeyWithClientErrorMapper,
  getClientsWithKeysErrorMapper,
  addClientPurposeErrorMapper,
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
  readModelService,
  selfcareV2InstitutionClientBuilder(config)
);

const authorizationRouter = (
  ctx: ZodiosContext
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const { ADMIN_ROLE, SECURITY_ROLE, M2M_ROLE, SUPPORT_ROLE } = userRoles;

  const authorizationClientRouter = ctx.router(authorizationApi.clientApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  authorizationClientRouter
    .post(
      "/clientsConsumer",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } =
            await authorizationService.createConsumerClient({
              clientSeed: req.body,
              organizationId: ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(clientToApiClient(client, { showUsers }))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createConsumerClientErrorMapper,
            ctx.logger
          );
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
            await authorizationService.createApiClient({
              clientSeed: req.body,
              organizationId: ctx.authData.organizationId,
              correlationId: req.ctx.correlationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(clientToApiClient(client, { showUsers }))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createApiClientErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clientsWithKeys",
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

          const parsedUserIds = (
            req.ctx.authData.userRoles.includes(userRoles.SECURITY_ROLE)
              ? [req.ctx.authData.userId]
              : userIds
          ).map(unsafeBrandId<UserId>);

          const clients = await authorizationService.getClients({
            filters: {
              name,
              userIds: parsedUserIds,
              consumerId: unsafeBrandId(consumerId),
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind: kind && apiClientKindToClientKind(kind),
            },
            authData: req.ctx.authData,
            offset,
            limit,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json({
              results: clients.results.map((client) =>
                clientToApiClientWithKeys(client, {
                  showUsers: ctx.authData.organizationId === client.consumerId,
                })
              ),
              totalCount: clients.totalCount,
            })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientsWithKeysErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
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
          const clients = await authorizationService.getClients({
            filters: {
              name,
              userIds: userIds?.map(unsafeBrandId<UserId>),
              consumerId: unsafeBrandId(consumerId),
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind: kind && apiClientKindToClientKind(kind),
            },
            authData: req.ctx.authData,
            offset,
            limit,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json({
              results: clients.results.map((client) =>
                clientToApiClient(client, {
                  showUsers: ctx.authData.organizationId === client.consumerId,
                })
              ),
              totalCount: clients.totalCount,
            })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientsErrorMapper,
            ctx.logger
          );
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
            await authorizationService.getClientById({
              clientId: unsafeBrandId(req.params.clientId),
              organizationId: ctx.authData.organizationId,
              logger: ctx.logger,
            });
          return res
            .status(200)
            .json(clientToApiClient(client, { showUsers }))
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
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { users } = await authorizationService.getClientUsers({
            clientId: unsafeBrandId(req.params.clientId),
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });
          return res.status(200).json(users).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientUsersErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeUser({
            clientId: unsafeBrandId(req.params.clientId),
            userIdToRemove: unsafeBrandId(req.params.userId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeUserErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/clients/:clientId/users/:userId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client, showUsers } = await authorizationService.addUser(
            {
              clientId: unsafeBrandId(req.params.clientId),
              userId: unsafeBrandId(req.params.userId),
              authData: req.ctx.authData,
            },
            req.ctx.correlationId,
            ctx.logger
          );
          return res
            .status(200)
            .json(clientToApiClient(client, { showUsers }))
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addUserErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/clients/:clientId/keys",
      authorizationMiddleware([ADMIN_ROLE, SECURITY_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const { client } = await authorizationService.createKeys({
            clientId: unsafeBrandId(req.params.clientId),
            authData: req.ctx.authData,
            keysSeeds: req.body,
            correlationId: req.ctx.correlationId,
            logger: ctx.logger,
          });
          return res
            .status(200)
            .json({ keys: client.keys.map((key) => keyToApiKey(key)) })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            createKeysErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clients/:clientId/keys",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const keys = await authorizationService.getClientKeys({
            clientId: unsafeBrandId(req.params.clientId),
            userIds: req.query.userIds.map(unsafeBrandId<UserId>),
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });

          return res
            .status(200)
            .json({ keys: keys.map((key) => keyToApiKey(key)) })
            .end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientKeysErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .get(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([
        ADMIN_ROLE,
        SECURITY_ROLE,
        M2M_ROLE,
        SUPPORT_ROLE,
      ]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          const key = await authorizationService.getClientKeyById({
            clientId: unsafeBrandId(req.params.clientId),
            kid: req.params.keyId,
            organizationId: ctx.authData.organizationId,
            logger: ctx.logger,
          });

          return res.status(200).json(keyToApiKey(key)).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getClientKeyErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/clients/:clientId/keys/:keyId",
      authorizationMiddleware([ADMIN_ROLE, SECURITY_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.deleteClientKeyById({
            clientId: unsafeBrandId(req.params.clientId),
            keyIdToRemove: unsafeBrandId(req.params.keyId),
            authData: ctx.authData,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteClientKeyByIdErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .post(
      "/clients/:clientId/purposes",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.addClientPurpose({
            clientId: unsafeBrandId(req.params.clientId),
            seed: req.body,
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addClientPurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/clients/:clientId/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removeClientPurpose({
            clientId: unsafeBrandId(req.params.clientId),
            purposeIdToRemove: unsafeBrandId(req.params.purposeId),
            organizationId: ctx.authData.organizationId,
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeClientPurposeErrorMapper,
            ctx.logger
          );
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    )
    .delete(
      "/clients/purposes/:purposeId",
      authorizationMiddleware([ADMIN_ROLE]),
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);
        try {
          await authorizationService.removePurposeFromClients({
            purposeIdToRemove: unsafeBrandId(req.params.purposeId),
            correlationId: ctx.correlationId,
            logger: ctx.logger,
          });
          return res.status(204).end();
        } catch (error) {
          const errorRes = makeApiProblem(error, () => 500, ctx.logger);
          return res.status(errorRes.status).json(errorRes).end();
        }
      }
    );

  const authorizationUserRouter = ctx.router(authorizationApi.userApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  authorizationUserRouter.get(
    "/clients/:clientId/users/:userId/keys",
    authorizationMiddleware([ADMIN_ROLE]),
    async (_req, res) => res.status(501).send()
  );

  const tokenGenerationRouter = ctx.router(
    authorizationApi.tokenGenerationApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  tokenGenerationRouter.get(
    "/clients/:clientId/keys/:keyId/bundle",
    authorizationMiddleware([
      ADMIN_ROLE,
      SECURITY_ROLE,
      M2M_ROLE,
      SUPPORT_ROLE,
    ]),
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        const { key: jwkKey, client } =
          await authorizationService.getKeyWithClientByKeyId({
            clientId: unsafeBrandId(req.params.clientId),
            kid: req.params.keyId,
            logger: ctx.logger,
          });
        return res
          .status(200)
          .json({
            key: jwkKey,
            client,
          })
          .end();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getClientKeyWithClientErrorMapper,
          ctx.logger
        );
        return res.status(errorRes.status).json(errorRes).end();
      }
    }
  );
  return [
    authorizationClientRouter,
    authorizationUserRouter,
    tokenGenerationRouter,
  ];
};
export default authorizationRouter;
