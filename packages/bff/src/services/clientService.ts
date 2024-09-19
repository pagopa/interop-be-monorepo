/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import {
  authorizationApi,
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import {
  AuthorizationProcessClient,
  PagoPAInteropBeClients,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toAuthorizationKeySeed } from "../api/authorizationApiConverter.js";
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
    ): Promise<authorizationApi.ClientsWithKeys> {
      logger.info(`Retrieving clients`);

      return authorizationClient.client.getClientsWithKeys({
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

    async addUserToClient(
      userId: string,
      clientId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Add user ${userId} to client ${clientId}`);

      const { id } = await authorizationClient.client.addUser(undefined, {
        params: { clientId, userId },
        headers,
      });

      return { id };
    },

    async createKeys(
      clientId: string,
      keySeed: bffApi.KeysSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Create keys for client ${clientId}`);

      const body: authorizationApi.KeysSeed = keySeed.map((seed) =>
        toAuthorizationKeySeed(seed)
      );

      await authorizationClient.client.createKeys(body, {
        params: { clientId },
        headers,
      });
    },

    async getClientKeys(
      clientId: string,
      userIds: string[],
      { logger, headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey[]> {
      logger.info(`Retrieve keys of client ${clientId}`);

      const { keys } = await authorizationClient.client.getClientKeys({
        params: { clientId },
        queries: { userIds },
        headers,
      });

      return Promise.all(
        keys.map((k) =>
          decorateKey(
            selfcareUsersClient,
            k,
            authData.selfcareId,
            headers["X-Correlation-Id"]
          )
        )
      );
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
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactUser[]> {
      logger.info(`Retrieving users for client ${clientId}`);

      const clientUsers = await authorizationClient.client.getClientUsers({
        params: { clientId },
        headers,
      });

      const users = clientUsers.map(async (id) =>
        toBffApiCompactUser(
          await getSelfcareUserById(
            selfcareUsersClient,
            id,
            selfcareId,
            headers["X-Correlation-Id"]
          ),
          id
        )
      );
      return Promise.all(users);
    },

    async getClientKeyById(
      clientId: string,
      keyId: string,
      selfcareId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const key = await authorizationClient.client.getClientKeyById({
        params: { clientId, keyId },
        headers,
      });
      return decorateKey(
        selfcareUsersClient,
        key,
        selfcareId,
        headers["X-Correlation-Id"]
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

      return authorizationClient.client.createConsumerClient(seed, {
        headers,
      });
    },

    async createApiClient(
      seed: authorizationApi.ClientSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Creating api client with name ${seed.name}`);

      return authorizationClient.client.createApiClient(seed, {
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
  const consumer = await apiClients.tenantProcessClient.tenant.getTenant({
    params: { id: client.consumerId },
    headers: ctx.headers,
  });

  const purposes = await Promise.all(
    client.purposes.map((p) => enhancePurpose(apiClients, p, ctx))
  );

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
  correlationId: string
): Promise<selfcareV2ClientApi.UserResponse> {
  try {
    return selfcareClient.getUserInfoUsingGET({
      params: { id: userId },
      queries: { institutionId: selfcareId },
      headers: {
        "X-Correlation-Id": correlationId,
      },
    });
  } catch (error) {
    return {};
  }
}

export async function decorateKey(
  selfcareClient: SelfcareV2UsersClient,
  key: authorizationApi.Key,
  selfcareId: string,
  correlationId: string
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
    isOrphan: user.id === undefined,
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
