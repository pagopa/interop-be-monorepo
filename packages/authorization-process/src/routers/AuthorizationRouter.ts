import { ZodiosEndpointDefinitions } from "@zodios/core";
import { ZodiosRouter } from "@zodios/express";
import {
  ExpressContext,
  authRole,
  ZodiosContext,
  zodiosValidationErrorToApiProblem,
  fromAppContext,
  validateAuthorization,
  setMetadataVersionHeader,
} from "pagopa-interop-commons";
import {
  EServiceId,
  PurposeId,
  TenantId,
  UserId,
  emptyErrorMapper,
  unsafeBrandId,
} from "pagopa-interop-models";
import { authorizationApi } from "pagopa-interop-api-clients";
import { AuthorizationService } from "../services/authorizationService.js";
import {
  apiClientKindToClientKind,
  clientToApiClient,
  clientToApiClientWithKeys,
  clientToApiFullVisibilityClient,
  jwkAndClientToApiKeyWithClient,
  keyToApiKey,
  producerKeychainToApiFullVisibilityProducerKeychain,
  producerKeychainToApiProducerKeychain,
} from "../model/domain/apiConverter.js";
import { makeApiProblem } from "../model/domain/errors.js";
import {
  addClientUserErrorMapper,
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
  removeClientUserErrorMapper,
  createKeyErrorMapper,
  getClientKeyWithClientErrorMapper,
  getClientsWithKeysErrorMapper,
  addClientPurposeErrorMapper,
  createProducerKeychainErrorMapper,
  getProducerKeychainsErrorMapper,
  deleteProducerKeychainErrorMapper,
  createProducerKeychainKeyErrorMapper,
  deleteProducerKeychainKeyByIdErrorMapper,
  getProducerKeychainKeysErrorMapper,
  getProducerKeychainKeyErrorMapper,
  getProducerKeychainUsersErrorMapper,
  addProducerKeychainUserErrorMapper,
  removeProducerKeychainUserErrorMapper,
  removeProducerKeychainEServiceErrorMapper,
  getProducerKeychainErrorMapper,
  addProducerKeychainEServiceErrorMapper,
  internalRemoveClientAdminErrorMapper,
  removeClientAdminErrorMapper,
  addClientAdminErrorMapper,
  getJWKByKidErrorMapper,
  getProducerJWKByKidErrorMapper,
} from "../utilities/errorMappers.js";

const authorizationRouter = (
  ctx: ZodiosContext,
  authorizationService: AuthorizationService
): Array<ZodiosRouter<ZodiosEndpointDefinitions, ExpressContext>> => {
  const {
    ADMIN_ROLE,
    SECURITY_ROLE,
    M2M_ROLE,
    M2M_ADMIN_ROLE,
    SUPPORT_ROLE,
    API_ROLE,
    INTERNAL_ROLE,
  } = authRole;

  const authorizationClientRouter = ctx.router(authorizationApi.clientApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  authorizationClientRouter
    .post("/clientsConsumer", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const client = await authorizationService.createConsumerClient(
          {
            clientSeed: req.body,
          },
          ctx
        );
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createConsumerClientErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/clientsApi", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const client = await authorizationService.createApiClient(
          {
            clientSeed: req.body,
          },
          ctx
        );
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, createApiClientErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clientsWithKeys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          API_ROLE,
        ]);

        const { name, userIds, consumerId, purposeId, kind, offset, limit } =
          req.query;

        const clients = await authorizationService.getClients(
          {
            filters: {
              name,
              userIds: userIds?.map(unsafeBrandId<UserId>),
              consumerId: consumerId
                ? unsafeBrandId<TenantId>(consumerId)
                : undefined,
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind: kind && apiClientKindToClientKind(kind),
            },
            offset,
            limit,
          },
          ctx
        );
        return res.status(200).send(
          authorizationApi.ClientsWithKeys.parse({
            results: clients.results.map((client) =>
              clientToApiClientWithKeys(client, ctx.authData)
            ),
            totalCount: clients.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getClientsWithKeysErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

        const { name, userIds, consumerId, purposeId, kind, offset, limit } =
          req.query;
        const clients = await authorizationService.getClients(
          {
            filters: {
              name,
              userIds: userIds?.map(unsafeBrandId<UserId>),
              consumerId: consumerId
                ? unsafeBrandId<TenantId>(consumerId)
                : undefined,
              purposeId: purposeId
                ? unsafeBrandId<PurposeId>(purposeId)
                : undefined,
              kind: kind && apiClientKindToClientKind(kind),
            },
            offset,
            limit,
          },
          ctx
        );
        return res.status(200).send(
          authorizationApi.Clients.parse({
            results: clients.results.map((client) =>
              clientToApiClient(client, ctx.authData)
            ),
            totalCount: clients.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, getClientsErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

        const { data: client, metadata } =
          await authorizationService.getClientById(
            {
              clientId: unsafeBrandId(req.params.clientId),
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            authorizationApi.Client.parse(
              clientToApiClient(client, ctx.authData)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, getClientErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/:clientId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        await authorizationService.deleteClient(
          {
            clientId: unsafeBrandId(req.params.clientId),
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, deleteClientErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId/users", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const users = await authorizationService.getClientUsers(
          {
            clientId: unsafeBrandId(req.params.clientId),
          },
          ctx
        );

        return res.status(200).send(authorizationApi.Users.parse(users));
      } catch (error) {
        const errorRes = makeApiProblem(error, getClientUsersErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/:clientId/users/:userId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: client, metadata } =
          await authorizationService.removeClientUser(
            {
              clientId: unsafeBrandId(req.params.clientId),
              userIdToRemove: unsafeBrandId(req.params.userId),
            },
            ctx
          );
        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          removeClientUserErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/clients/:clientId/users", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: client, metadata } =
          await authorizationService.addClientUsers(
            {
              clientId: unsafeBrandId(req.params.clientId),
              userIds: req.body.userIds.map(unsafeBrandId<UserId>),
            },
            ctx
          );
        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, addClientUserErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/clients/:clientId/admin", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const client = await authorizationService.setAdminToClient(
          {
            clientId: unsafeBrandId(req.params.clientId),
            adminId: unsafeBrandId(req.body.adminId),
          },
          ctx
        );
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(error, addClientAdminErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, SECURITY_ROLE]);

        const key = await authorizationService.createKey(
          {
            clientId: unsafeBrandId(req.params.clientId),
            keySeed: req.body,
          },
          ctx
        );
        return res
          .status(200)
          .send(authorizationApi.Key.parse(keyToApiKey(key)));
      } catch (error) {
        const errorRes = makeApiProblem(error, createKeyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId/keys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { userIds, offset, limit } = req.query;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          M2M_ADMIN_ROLE,
          SUPPORT_ROLE,
        ]);

        const keys = await authorizationService.getClientKeys(
          {
            clientId: unsafeBrandId(req.params.clientId),
            userIds: userIds.map(unsafeBrandId<UserId>),
            offset,
            limit,
          },
          ctx
        );

        return res.status(200).send(
          authorizationApi.Keys.parse({
            keys: keys.results.map((key) => keyToApiKey(key)),
            totalCount: keys.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(error, getClientKeysErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/clients/:clientId/keys/:keyId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
        ]);

        const key = await authorizationService.getClientKeyById(
          {
            clientId: unsafeBrandId(req.params.clientId),
            kid: req.params.keyId,
          },
          ctx
        );

        return res
          .status(200)
          .send(authorizationApi.Key.parse(keyToApiKey(key)));
      } catch (error) {
        const errorRes = makeApiProblem(error, getClientKeyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/:clientId/keys/:keyId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, SECURITY_ROLE]);

        await authorizationService.deleteClientKeyById(
          {
            clientId: unsafeBrandId(req.params.clientId),
            keyIdToRemove: unsafeBrandId(req.params.keyId),
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deleteClientKeyByIdErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/clients/:clientId/purposes", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: client, metadata } =
          await authorizationService.addClientPurpose(
            {
              clientId: unsafeBrandId(req.params.clientId),
              seed: req.body,
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addClientPurposeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/:clientId/purposes/:purposeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: client, metadata } =
          await authorizationService.removeClientPurpose(
            {
              clientId: unsafeBrandId(req.params.clientId),
              purposeIdToRemove: unsafeBrandId(req.params.purposeId),
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            authorizationApi.FullClient.parse(
              clientToApiFullVisibilityClient(client)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          removeClientPurposeErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/clients/purposes/:purposeId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, INTERNAL_ROLE]);

        await authorizationService.removePurposeFromClients(
          {
            purposeIdToRemove: unsafeBrandId(req.params.purposeId),
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(error, emptyErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/internal/clients/:clientId/admin/:adminId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [INTERNAL_ROLE]);
        await authorizationService.internalRemoveClientAdmin(
          unsafeBrandId(req.params.clientId),
          unsafeBrandId(req.params.adminId),
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          internalRemoveClientAdminErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })

    .delete("/clients/:clientId/admin/:adminId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);
        await authorizationService.removeClientAdmin(
          {
            clientId: unsafeBrandId(req.params.clientId),
            adminId: unsafeBrandId(req.params.adminId),
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          removeClientAdminErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  const authorizationUserRouter = ctx.router(authorizationApi.userApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });
  authorizationUserRouter.get(
    "/clients/:clientId/users/:userId/keys",
    async (_req, res) => res.status(501).send()
  );

  const authorizationProducerKeychainRouter = ctx.router(
    authorizationApi.producerKeychainApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );
  authorizationProducerKeychainRouter
    .post("/producerKeychains", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        const producerKeychain =
          await authorizationService.createProducerKeychain(
            {
              producerKeychainSeed: req.body,
            },
            ctx
          );

        return res
          .status(200)
          .send(
            authorizationApi.FullProducerKeychain.parse(
              producerKeychainToApiFullVisibilityProducerKeychain(
                producerKeychain
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createProducerKeychainErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const { name, userIds, producerId, eserviceId, offset, limit } =
          req.query;
        const producerKeychains =
          await authorizationService.getProducerKeychains(
            {
              filters: {
                name,
                userIds: userIds?.map(unsafeBrandId<UserId>),
                producerId: producerId
                  ? unsafeBrandId<TenantId>(producerId)
                  : undefined,
                eserviceId: eserviceId
                  ? unsafeBrandId<EServiceId>(eserviceId)
                  : undefined,
              },
              offset,
              limit,
            },
            ctx
          );
        return res.status(200).send(
          authorizationApi.ProducerKeychains.parse({
            results: producerKeychains.results.map((producerKeychain) =>
              producerKeychainToApiProducerKeychain(
                producerKeychain,
                ctx.authData
              )
            ),
            totalCount: producerKeychains.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerKeychainsErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:producerKeychainId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const { data: producerKeychain, metadata } =
          await authorizationService.getProducerKeychainById(
            {
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            },
            ctx
          );

        setMetadataVersionHeader(res, metadata);

        return res
          .status(200)
          .send(
            authorizationApi.ProducerKeychain.parse(
              producerKeychainToApiProducerKeychain(
                producerKeychain,
                ctx.authData
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerKeychainErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete("/producerKeychains/:producerKeychainId", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE]);

        await authorizationService.deleteProducerKeychain(
          {
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
          },
          ctx
        );
        return res.status(204).send();
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          deleteProducerKeychainErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:producerKeychainId/users", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const users = await authorizationService.getProducerKeychainUsers(
          {
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
          },
          ctx
        );
        return res.status(200).send(authorizationApi.Users.parse(users));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerKeychainUsersErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .post("/producerKeychains/:producerKeychainId/users", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

        const { data: producerKeychain, metadata } =
          await authorizationService.addProducerKeychainUsers(
            {
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
              userIds: req.body.userIds.map(unsafeBrandId<UserId>),
            },
            ctx
          );
        setMetadataVersionHeader(res, metadata);
        return res
          .status(200)
          .send(
            authorizationApi.FullProducerKeychain.parse(
              producerKeychainToApiFullVisibilityProducerKeychain(
                producerKeychain
              )
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          addProducerKeychainUserErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .delete(
      "/producerKeychains/:producerKeychainId/users/:userId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);

          await authorizationService.removeProducerKeychainUser(
            {
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
              userIdToRemove: unsafeBrandId(req.params.userId),
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeProducerKeychainUserErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post("/producerKeychains/:producerKeychainId/keys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [ADMIN_ROLE, SECURITY_ROLE]);

        const key = await authorizationService.createProducerKeychainKey(
          {
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            keySeed: req.body,
          },
          ctx
        );
        return res
          .status(200)
          .send(authorizationApi.Key.parse(keyToApiKey(key)));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          createProducerKeychainKeyErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeychains/:producerKeychainId/keys", async (req, res) => {
      const ctx = fromAppContext(req.ctx);
      const { userIds, offset, limit } = req.query;

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
          M2M_ADMIN_ROLE,
        ]);

        const keys = await authorizationService.getProducerKeychainKeys(
          {
            producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
            userIds: userIds.map(unsafeBrandId<UserId>),
            offset,
            limit,
          },
          ctx
        );

        return res.status(200).send(
          authorizationApi.Keys.parse({
            keys: keys.results.map((key) => keyToApiKey(key)),
            totalCount: keys.totalCount,
          })
        );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerKeychainKeysErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [
            ADMIN_ROLE,
            SECURITY_ROLE,
            M2M_ROLE,
            SUPPORT_ROLE,
          ]);

          const key = await authorizationService.getProducerKeychainKeyById(
            {
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
              kid: req.params.keyId,
            },
            ctx
          );

          return res
            .status(200)
            .send(authorizationApi.Key.parse(keyToApiKey(key)));
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            getProducerKeychainKeyErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/keys/:keyId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE]);

          await authorizationService.removeProducerKeychainKeyById(
            {
              producerKeychainId: unsafeBrandId(req.params.producerKeychainId),
              keyIdToRemove: unsafeBrandId(req.params.keyId),
            },
            ctx
          );
          return res.status(204).send();
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            deleteProducerKeychainKeyByIdErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .post(
      "/producerKeychains/:producerKeychainId/eservices",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data: producerKeychain, metadata } =
            await authorizationService.addProducerKeychainEService(
              {
                producerKeychainId: unsafeBrandId(
                  req.params.producerKeychainId
                ),
                seed: req.body,
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(
              authorizationApi.FullProducerKeychain.parse(
                producerKeychainToApiFullVisibilityProducerKeychain(
                  producerKeychain
                )
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            addProducerKeychainEServiceErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    )
    .delete(
      "/producerKeychains/:producerKeychainId/eservices/:eserviceId",
      async (req, res) => {
        const ctx = fromAppContext(req.ctx);

        try {
          validateAuthorization(ctx, [ADMIN_ROLE, M2M_ADMIN_ROLE]);

          const { data: producerKeychain, metadata } =
            await authorizationService.removeProducerKeychainEService(
              {
                producerKeychainId: unsafeBrandId(
                  req.params.producerKeychainId
                ),
                eserviceIdToRemove: unsafeBrandId(req.params.eserviceId),
              },
              ctx
            );

          setMetadataVersionHeader(res, metadata);

          return res
            .status(200)
            .send(
              authorizationApi.FullProducerKeychain.parse(
                producerKeychainToApiFullVisibilityProducerKeychain(
                  producerKeychain
                )
              )
            );
        } catch (error) {
          const errorRes = makeApiProblem(
            error,
            removeProducerKeychainEServiceErrorMapper,
            ctx
          );
          return res.status(errorRes.status).send(errorRes);
        }
      }
    );

  const tokenGenerationRouter = ctx.router(
    authorizationApi.tokenGenerationApi.api,
    {
      validationErrorHandler: zodiosValidationErrorToApiProblem,
    }
  );

  tokenGenerationRouter.get(
    "/clients/:clientId/keys/:keyId/bundle",
    async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [
          ADMIN_ROLE,
          SECURITY_ROLE,
          M2M_ROLE,
          SUPPORT_ROLE,
        ]);

        const { jwk, kid, client } =
          await authorizationService.getKeyWithClientByKeyId(
            {
              clientId: unsafeBrandId(req.params.clientId),
              kid: req.params.keyId,
            },
            ctx
          );
        return res
          .status(200)
          .send(
            authorizationApi.KeyWithClient.parse(
              jwkAndClientToApiKeyWithClient(jwk, kid, client, ctx.authData)
            )
          );
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getClientKeyWithClientErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    }
  );

  const keyRouter = ctx.router(authorizationApi.keyApi.api, {
    validationErrorHandler: zodiosValidationErrorToApiProblem,
  });

  keyRouter
    .get("/keys/:kid", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const keyWithClientId = await authorizationService.getJWKByKid(
          unsafeBrandId(req.params.kid),
          ctx
        );
        return res
          .status(200)
          .send(authorizationApi.ClientJWK.parse(keyWithClientId));
      } catch (error) {
        const errorRes = makeApiProblem(error, getJWKByKidErrorMapper, ctx);
        return res.status(errorRes.status).send(errorRes);
      }
    })
    .get("/producerKeys/:kid", async (req, res) => {
      const ctx = fromAppContext(req.ctx);

      try {
        validateAuthorization(ctx, [M2M_ROLE, M2M_ADMIN_ROLE]);

        const keyWithProducerKeychainId =
          await authorizationService.getProducerJWKByKid(
            unsafeBrandId(req.params.kid),
            ctx
          );
        return res
          .status(200)
          .send(authorizationApi.ProducerJWK.parse(keyWithProducerKeychainId));
      } catch (error) {
        const errorRes = makeApiProblem(
          error,
          getProducerJWKByKidErrorMapper,
          ctx
        );
        return res.status(errorRes.status).send(errorRes);
      }
    });

  return [
    authorizationClientRouter,
    authorizationUserRouter,
    authorizationProducerKeychainRouter,
    tokenGenerationRouter,
    keyRouter,
  ];
};
export default authorizationRouter;
