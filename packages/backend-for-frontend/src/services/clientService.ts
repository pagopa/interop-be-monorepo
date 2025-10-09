/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { CorrelationId } from "pagopa-interop-models";
import {
  AuthorizationProcessClient,
  PagoPAInteropBeClients,
  SelfcareV2UserClient,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toAuthorizationKeySeed,
  toBffApiCompactClient,
} from "../api/authorizationApiConverter.js";
import { getSelfcareCompactUserById } from "./selfcareService.js";
import { assertClientVisibilityIsFull } from "./validators.js";

export function clientServiceBuilder(apiClients: PagoPAInteropBeClients) {
  const {
    authorizationClient,
    selfcareV2UserClient,
    inAppNotificationManagerClient,
  } = apiClients;

  return {
    async getClients(
      {
        limit,
        offset,
        userIds,
        kind,
        name,
      }: {
        offset: number;
        limit: number;
        userIds: string[];
        name?: string;
        kind?: bffApi.ClientKind;
      },
      { logger, headers, correlationId, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactClients> {
      logger.info(`Retrieving clients`);

      const clients = await authorizationClient.client.getClientsWithKeys({
        queries: {
          offset,
          limit,
          userIds,
          consumerId: authData.organizationId,
          name,
          kind,
          purposeId: undefined,
        },
        headers,
      });

      const notifications =
        await inAppNotificationManagerClient.filterUnreadNotifications({
          queries: {
            entityIds: clients.results.map((c) => c.client.id),
          },
          headers,
        });

      return {
        results: await Promise.all(
          clients.results.map((client) =>
            toBffApiCompactClient(
              selfcareV2UserClient,
              client,
              authData.selfcareId,
              correlationId,
              notifications.includes(client.client.id)
            )
          )
        ),
        pagination: {
          limit,
          offset,
          totalCount: clients.totalCount,
        },
      };
    },

    async getClientById(
      clientId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Client> {
      ctx.logger.info(`Retrieve client ${clientId}`);

      const client = await authorizationClient.client.getClient({
        params: { clientId },
        headers: ctx.headers,
      });
      return enhanceClient(apiClients, client, ctx);
    },

    async deleteClient(
      clientId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting client ${clientId}`);

      return authorizationClient.client.deleteClient(undefined, {
        params: { clientId },
        headers,
      });
    },

    async removeClientPurpose(
      clientId: string,
      purposeId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Removing purpose ${purposeId} from client ${clientId}`);

      await authorizationClient.client.removeClientPurpose(undefined, {
        params: { clientId, purposeId },
        headers,
      });
    },

    async deleteClientKeyById(
      clientId: string,
      keyId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting key ${keyId} from client ${clientId}`);

      return authorizationClient.client.deleteClientKeyById(undefined, {
        params: { clientId, keyId },
        headers,
      });
    },

    async removeUser(
      clientId: string,
      userId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Removing user ${userId} from client ${clientId}`);

      return authorizationClient.client.removeUser(undefined, {
        params: { clientId, userId },
        headers,
      });
    },

    async addUsersToClient(
      userIds: string[],
      clientId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Add users ${userIds.join(",")} to client ${clientId}`);

      await authorizationClient.client.addUsers(
        { userIds },
        {
          params: { clientId },
          headers,
        }
      );
    },

    async setAdminToClient(
      adminId: string,
      clientId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Client> {
      ctx.logger.info(`Add admin ${adminId} to client ${clientId}`);

      const client = await authorizationClient.client.setAdminToClient(
        { adminId },
        {
          params: { clientId },
          headers: ctx.headers,
        }
      );

      return enhanceClient(apiClients, client, ctx);
    },

    async createKey(
      clientId: string,
      keySeed: bffApi.KeySeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Create keys for client ${clientId}`);

      await authorizationClient.client.createKey(
        toAuthorizationKeySeed(keySeed),
        {
          params: { clientId },
          headers,
        }
      );
    },

    async getClientKeys(
      {
        clientId,
        userIds,
        limit,
        offset,
      }: {
        clientId: string;
        userIds: string[];
        limit: number;
        offset: number;
      },
      { logger, headers, authData, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKeys> {
      logger.info(`Retrieve keys of client ${clientId}`);

      const [{ keys, totalCount }, client] = await Promise.all([
        authorizationClient.client.getClientKeys({
          params: { clientId },
          queries: { userIds, limit, offset },
          headers,
        }),
        authorizationClient.client.getClient({
          params: { clientId },
          headers,
        }),
      ]);
      assertClientVisibilityIsFull(client);

      const decoratedKeys = await Promise.all(
        keys.map((k) =>
          decorateKey(
            selfcareV2UserClient,
            k,
            authData.selfcareId,
            client.users,
            correlationId
          )
        )
      );

      return {
        pagination: {
          offset,
          limit,
          totalCount,
        },
        keys: decoratedKeys,
      };
    },

    async addClientPurpose(
      clientId: string,
      purpose: bffApi.PurposeAdditionDetailsSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Adding purpose ${purpose.purposeId} to client ${clientId}`);

      await authorizationClient.client.addClientPurpose(purpose, {
        params: { clientId },
        headers,
      });
    },

    async getClientUsers(
      clientId: string,
      selfcareId: string,
      { logger, headers, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactUsers> {
      logger.info(`Retrieving users for client ${clientId}`);

      const clientUsers = await authorizationClient.client.getClientUsers({
        params: { clientId },
        headers,
      });

      return await Promise.all(
        clientUsers.map(async (id) =>
          getSelfcareCompactUserById(
            selfcareV2UserClient,
            id,
            selfcareId,
            correlationId
          )
        )
      );
    },

    async getClientKeyById(
      clientId: string,
      keyId: string,
      selfcareId: string,
      { logger, headers, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const [key, client] = await Promise.all([
        authorizationClient.client.getClientKeyById({
          params: { clientId, keyId },
          headers,
        }),
        authorizationClient.client.getClient({
          params: { clientId },
          headers,
        }),
      ]);
      assertClientVisibilityIsFull(client);

      return decorateKey(
        selfcareV2UserClient,
        key,
        selfcareId,
        client.users,
        correlationId
      );
    },

    async getEncodedClientKeyById(
      clientId: string,
      keyId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EncodedClientKey> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const key = await authorizationClient.client.getClientKeyById({
        params: { clientId, keyId },
        headers,
      });
      return { key: key.encodedPem };
    },

    async createConsumerClient(
      seed: authorizationApi.ClientSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Creating consumer client with name ${seed.name}`);

      const { id } = await authorizationClient.client.createConsumerClient(
        seed,
        {
          headers,
        }
      );

      return { id };
    },

    async createApiClient(
      seed: authorizationApi.ClientSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Creating api client with name ${seed.name}`);

      const { id } = await authorizationClient.client.createApiClient(seed, {
        headers,
      });

      return { id };
    },

    async removeClientAdmin(
      clientId: string,
      adminId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Removing client admin ${adminId} from client ${clientId}`);

      return authorizationClient.client.removeClientAdmin(undefined, {
        params: { clientId, adminId },
        headers,
      });
    },
  };
}

export type ClientService = ReturnType<typeof clientServiceBuilder>;

async function enhanceClient(
  apiClients: PagoPAInteropBeClients,
  client: authorizationApi.Client,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Client> {
  assertClientVisibilityIsFull(client);
  const [consumer, admin, ...purposes] = await Promise.all([
    apiClients.tenantProcessClient.tenant.getTenant({
      params: { id: client.consumerId },
      headers: ctx.headers,
    }),
    client.adminId
      ? getSelfcareCompactUserById(
          apiClients.selfcareV2UserClient,
          client.adminId,
          ctx.authData.selfcareId,
          ctx.correlationId
        )
      : Promise.resolve(undefined),
    ...client.purposes.map((p) => enhancePurpose(apiClients, p, ctx)),
  ]);

  return {
    id: client.id,
    name: client.name,
    description: client.description,
    kind: client.kind,
    createdAt: client.createdAt,
    consumer: {
      id: consumer.id,
      name: consumer.name,
    },
    purposes,
    admin,
  };
}

async function enhancePurpose(
  {
    catalogProcessClient,
    tenantProcessClient,
    purposeProcessClient,
  }: PagoPAInteropBeClients,
  clientPurposeId: string,
  { headers }: WithLogger<BffAppContext>
): Promise<bffApi.ClientPurpose> {
  const purpose = await purposeProcessClient.getPurpose({
    params: { id: clientPurposeId },
    headers,
  });

  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: purpose.eserviceId },
    headers,
  });

  const producer = await tenantProcessClient.tenant.getTenant({
    params: { id: eservice.producerId },
    headers,
  });

  return {
    purposeId: purpose.id,
    title: purpose.title,
    eservice: {
      id: eservice.id,
      name: eservice.name,
      producer: {
        id: producer.id,
        name: producer.name,
        kind: producer.kind,
      },
    },
  };
}

export async function decorateKey(
  selfcareClient: SelfcareV2UserClient,
  key: authorizationApi.Key,
  selfcareId: string,
  members: string[],
  correlationId: CorrelationId
): Promise<bffApi.PublicKey> {
  const user = await getSelfcareCompactUserById(
    selfcareClient,
    key.userId,
    selfcareId,
    correlationId
  );

  return {
    user,
    name: key.name,
    keyId: key.kid,
    createdAt: key.createdAt,
    isOrphan: !members.includes(key.userId) || user.userId === undefined,
  };
}

export const getAllClients = async (
  authorizationClient: AuthorizationProcessClient,
  consumerId: string,
  purposeId: string,
  headers: BffAppContext["headers"]
): Promise<authorizationApi.ClientWithKeys[]> =>
  await getAllFromPaginated(
    async (offset, limit) =>
      await authorizationClient.client.getClientsWithKeys({
        headers,
        queries: {
          userIds: [],
          consumerId,
          purposeId,
          limit,
          offset,
        },
      })
  );
