import { ClientId, UserId, unsafeBrandId } from "pagopa-interop-models";
import { WithLogger } from "pagopa-interop-commons";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { clientAdminIdNotFound } from "../model/errors.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
  pollResourceUntilDeletion,
} from "../utils/polling.js";
import { assertClientVisibilityIsFull } from "../utils/validators/clientValidators.js";
import {
  toGetClientsApiQueryParams,
  toM2MGatewayApiConsumerClient,
} from "../api/clientApiConverter.js";
import {
  toGetPurposesApiQueryParamsForClient,
  toM2MGatewayApiPurpose,
} from "../api/purposeApiConverter.js";
import { toM2MJWK, toM2MKey } from "../api/keysApiConverter.js";
import { assertTenantHasSelfcareId } from "../utils/validators/tenantValidators.js";
import { getSelfcareUserById } from "./userService.js";

export type ClientService = ReturnType<typeof clientServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function clientServiceBuilder(clients: PagoPAInteropBeClients) {
  const retrieveClientById = (
    clientId: ClientId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Client>> =>
    clients.authorizationClient.client.getClient({
      params: { clientId },
      headers,
    });

  const retrieveClientKeyById = (
    clientId: ClientId,
    keyId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Key>> =>
    clients.authorizationClient.client.getClientKeyById({
      params: { clientId: unsafeBrandId(clientId), keyId },
      headers,
    });

  const pollClient = (
    response: WithMaybeMetadata<authorizationApi.Client>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Client>> =>
    pollResourceWithMetadata(() =>
      retrieveClientById(unsafeBrandId(response.data.id), headers)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  const pollClientKey = (
    clientId: ClientId,
    response: WithMaybeMetadata<authorizationApi.Key>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.Key>> =>
    pollResourceWithMetadata(() =>
      retrieveClientKeyById(unsafeBrandId(clientId), response.data.kid, headers)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  const pollClientKeyUntilDeletion = (
    clientId: ClientId,
    keyId: string,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<void> =>
    pollResourceUntilDeletion(() =>
      retrieveClientKeyById(clientId, keyId, headers)
    )({});

  return {
    async getClientAdminId(
      clientId: ClientId,
      {
        headers,
        logger,
      }: Pick<WithLogger<M2MGatewayAppContext>, "headers" | "logger">
    ): Promise<UserId> {
      logger.info(`Retrieving client with id ${clientId} to get its adminId`);

      const { data: client } = await retrieveClientById(clientId, headers);

      const adminId = match(client)
        .with(
          { visibility: authorizationApi.Visibility.Enum.FULL },
          (c) => c.adminId
        )
        .with(
          { visibility: authorizationApi.Visibility.Enum.PARTIAL },
          () => undefined
        )
        .exhaustive();

      if (adminId === undefined) {
        throw clientAdminIdNotFound(client);
      }

      return unsafeBrandId<UserId>(adminId);
    },
    async getClient(
      clientId: ClientId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.Client> {
      logger.info(`Retrieving client with id ${clientId}`);

      const client = await retrieveClientById(clientId, headers);

      return toM2MGatewayApiConsumerClient(client.data);
    },
    async getClients(
      params: m2mGatewayApiV3.GetClientsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.Clients> {
      const { limit, offset, name, consumerId } = params;
      logger.info(
        `Retrieving clients with name ${name}, consumerId ${consumerId}, offset ${offset}, limit ${limit}`
      );

      const {
        data: { results, totalCount },
      } = await clients.authorizationClient.client.getClients({
        queries: toGetClientsApiQueryParams(params),
        headers,
      });

      return {
        results: results.map(toM2MGatewayApiConsumerClient),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
    async addClientPurpose(
      clientId: ClientId,
      seed: m2mGatewayApiV3.ClientAddPurpose,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Adding purpose ${seed.purposeId} to client with id ${clientId}`
      );

      const response =
        await clients.authorizationClient.client.addClientPurpose(seed, {
          params: { clientId },
          headers,
        });

      await pollClient(response, headers);
    },
    async getClientPurposes(
      clientId: ClientId,
      {
        limit,
        offset,
        eserviceIds,
        states,
      }: m2mGatewayApiV3.GetClientPurposesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.Purposes> {
      logger.info(`Retrieving purposes for client with id ${clientId}`);

      const { data: client } = await retrieveClientById(clientId, headers);

      assertClientVisibilityIsFull(client);

      const clientPurposesIds = client.purposes;

      if (clientPurposesIds.length === 0) {
        return {
          results: [],
          pagination: {
            limit,
            offset,
            totalCount: 0,
          },
        };
      }

      const queries = toGetPurposesApiQueryParamsForClient({
        limit,
        offset,
        eserviceIds,
        states,
        clientId,
      });

      const { data } = await clients.purposeProcessClient.getPurposes({
        queries,
        headers,
      });

      const { results: paginatedPurposes, totalCount } = data;

      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        results: paginatedPurposes.map(toM2MGatewayApiPurpose),
      };
    },
    async removeClientPurpose(
      clientId: ClientId,
      purposeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Removing purpose ${purposeId} from client with id ${clientId}`
      );

      const response =
        await clients.authorizationClient.client.removeClientPurpose(
          undefined,
          {
            params: { clientId, purposeId },
            headers,
          }
        );

      await pollClient(response, headers);
    },
    async getClientKeys(
      clientId: ClientId,
      { limit, offset }: m2mGatewayApiV3.GetClientKeysQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.JWKs> {
      logger.info(`Retrieving keys for client with id ${clientId}`);

      const {
        data: { keys, totalCount },
      } = await clients.authorizationClient.client.getClientKeys({
        params: { clientId },
        queries: { limit, offset },
        headers,
      });

      const jwks = await Promise.all(
        keys.map((key) =>
          clients.authorizationClient.key
            .getJWKByKid({
              params: { kid: key.kid },
              headers,
            })
            .then(({ data: jwk }) => jwk.jwk)
        )
      );

      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        results: jwks.map(toM2MJWK),
      };
    },
    async createClientKey(
      clientId: ClientId,
      seed: m2mGatewayApiV3.KeySeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.Key> {
      logger.info(`Create a new key for client with id ${clientId}`);

      const response = await clients.authorizationClient.client.createKey(
        seed,
        {
          params: { clientId },
          headers,
        }
      );

      const { data: key } = await pollClientKey(clientId, response, headers);

      const { data: jwkData } =
        await clients.authorizationClient.key.getJWKByKid({
          params: { kid: key.kid },
          headers,
        });

      return toM2MKey({ jwk: jwkData.jwk, clientId });
    },
    async deleteClientKey(
      clientId: ClientId,
      keyId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting key for client with id ${clientId} and its keyId ${keyId}`
      );

      await clients.authorizationClient.client.deleteClientKeyById(undefined, {
        params: { clientId, keyId },
        headers,
      });

      await pollClientKeyUntilDeletion(clientId, keyId, headers);
    },
    async getClientUsers(
      clientId: string,
      ctx: WithLogger<M2MGatewayAppContext>,
      { limit, offset }: m2mGatewayApiV3.GetClientUsersQueryParams
    ): Promise<m2mGatewayApiV3.Users> {
      ctx.logger.info(`Retrieving users for client ${clientId}`);

      const { data: tenant } =
        await clients.tenantProcessClient.tenant.getTenant({
          params: { id: ctx.authData.organizationId },
          headers: ctx.headers,
        });

      assertTenantHasSelfcareId(tenant);

      const clientUsers =
        await clients.authorizationClient.client.getClientUsers({
          params: { clientId },
          headers: ctx.headers,
        });

      const users = await Promise.all(
        clientUsers.data.map(async (id) =>
          getSelfcareUserById(
            clients,
            id,
            tenant.selfcareId,
            ctx.headers["X-Correlation-Id"]
          )
        )
      );

      const results: m2mGatewayApiV3.User[] = users.slice(
        offset,
        offset + limit
      );

      return {
        results,
        pagination: {
          limit,
          offset,
          totalCount: users.length,
        },
      };
    },

    async addClientUsers(
      clientId: ClientId,
      userIds: string[],
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Adding users ${userIds.join(", ")} to client with id ${clientId}`
      );

      const response = await clients.authorizationClient.client.addUsers(
        { userIds },
        {
          params: { clientId },
          headers,
        }
      );

      await pollClient(response, headers);
    },
    async removeClientUser(
      clientId: ClientId,
      userId: string,
      { logger, headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(`Removing user ${userId} from client ${clientId}`);

      const response = await clients.authorizationClient.client.removeUser(
        undefined,
        {
          params: { clientId, userId },
          headers,
        }
      );

      await pollClient(response, headers);
    },
  };
}
