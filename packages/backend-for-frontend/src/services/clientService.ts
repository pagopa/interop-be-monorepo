/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  authorizationApi,
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { CorrelationId } from "pagopa-interop-models";
import {
  AuthorizationProcessClient,
  PagoPAInteropBeClients,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toAuthorizationKeySeed,
  toBffApiCompactClient,
} from "../api/authorizationApiConverter.js";
import { toBffApiCompactUser } from "../api/selfcareApiConverter.js";

export function clientServiceBuilder(
  apiClients: PagoPAInteropBeClients,
  selfcareUsersClient: SelfcareV2UsersClient
) {
  const { authorizationClient } = apiClients;

  return {
    async getClients(
      {
        limit,
        offset,
        requesterId,
        userIds,
        kind,
        name,
      }: {
        requesterId: string;
        offset: number;
        limit: number;
        userIds: string[];
        name?: string;
        kind?: bffApi.ClientKind;
      },
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactClients> {
      logger.info(`Retrieving clients`);

      const clients = await authorizationClient.client.getClientsWithKeys({
        queries: {
          offset,
          limit,
          userIds,
          consumerId: requesterId,
          name,
          kind,
          purposeId: undefined,
        },
        headers,
      });

      return {
        results: clients.results.map(toBffApiCompactClient),
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

      return authorizationClient.client.removeClientPurpose(undefined, {
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

      const [{ keys, totalCount }, { users }] = await Promise.all([
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

      const decoratedKeys = await Promise.all(
        keys.map((k) =>
          decorateKey(
            selfcareUsersClient,
            k,
            authData.selfcareId,
            users,
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
        clientUsers.map(async (id) => {
          const user = await getSelfcareUserById(
            selfcareUsersClient,
            id,
            selfcareId,
            correlationId
          );
          return toBffApiCompactUser(user, id);
        })
      );
    },

    async getClientKeyById(
      clientId: string,
      keyId: string,
      selfcareId: string,
      { logger, headers, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const [key, { users }] = await Promise.all([
        authorizationClient.client.getClientKeyById({
          params: { clientId, keyId },
          headers,
        }),
        authorizationClient.client.getClient({
          params: { clientId },
          headers,
        }),
      ]);

      return decorateKey(
        selfcareUsersClient,
        key,
        selfcareId,
        users,
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
  };
}

export type ClientService = ReturnType<typeof clientServiceBuilder>;

async function enhanceClient(
  apiClients: PagoPAInteropBeClients,
  client: authorizationApi.Client,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Client> {
  const [consumer, admin, purposes] = await Promise.all([
    await apiClients.tenantProcessClient.tenant.getTenant({
      params: { id: client.consumerId },
      headers: ctx.headers,
    }),
    client.adminId
      ? await apiClients.tenantProcessClient.tenant.getTenant({
          params: { id: client.adminId },
          headers: ctx.headers,
        })
      : undefined,
    Promise.all(client.purposes.map((p) => enhancePurpose(apiClients, p, ctx))),
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

export async function getSelfcareUserById(
  selfcareClient: SelfcareV2UsersClient,
  userId: string,
  selfcareId: string,
  correlationId: CorrelationId
): Promise<selfcareV2ClientApi.UserResponse> {
  return selfcareClient.getUserInfoUsingGET({
    params: { id: userId },
    queries: { institutionId: selfcareId },
    headers: {
      "X-Correlation-Id": correlationId,
    },
  });
}

export async function decorateKey(
  selfcareClient: SelfcareV2UsersClient,
  key: authorizationApi.Key,
  selfcareId: string,
  members: string[],
  correlationId: CorrelationId
): Promise<bffApi.PublicKey> {
  const user = await getSelfcareUserById(
    selfcareClient,
    key.userId,
    selfcareId,
    correlationId
  );

  return {
    user: toBffApiCompactUser(user, key.userId),
    name: key.name,
    keyId: key.kid,
    createdAt: key.createdAt,
    isOrphan: !members.includes(key.userId) || user.id === undefined,
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
