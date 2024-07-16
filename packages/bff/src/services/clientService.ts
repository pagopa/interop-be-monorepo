/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger } from "pagopa-interop-commons";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { WithLogger } from "pagopa-interop-commons";
import {
  authorizationApi,
  authorizationManagementApi,
  bffApi,
} from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { userNotFound } from "../model/domain/errors.js";
import { toBffApiCompactUser } from "../model/domain/apiConverter.js";
import { BffAppContext } from "../utilities/context.js";

export function clientServiceBuilder(
  apiClients: PagoPAInteropBeClients,
  selfcareV2Client: SelfcareV2Client
) {
  const { authorizationProcessClient } = apiClients;

  return {
    async getClients({
      headers,
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
      headers: Headers;
      name?: string;
      kind?: bffApi.ClientKind;
    }): Promise<authorizationApi.Clients> {
      ctx.logger.info(`Retrieving clients`);

      return authorizationProcessClient.client.getClients({
        queries: {
          offset,
          limit,
          userIds: userIds.join(","),
          consumerId: requesterId,
          name,
          kind,
        },
        headers,
      });
    },

    async getClientById(
      clientId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.Client> {
      ctx.logger.info(`Retrieve client ${clientId}`);

      const client = await authorizationProcessClient.client.getClient({
        params: { clientId },
        headers: { ...requestHeaders },
      });
      return enhanceClient(apiClients, client, requestHeaders);
    },

    async deleteClient(
      clientId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Deleting client ${clientId}`);

      return authorizationProcessClient.client.deleteClient(undefined, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },

    async removeClientPurpose(
      clientId: string,
      purposeId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Removing purpose ${purposeId} from client ${clientId}`);

      return authorizationProcessClient.client.removeClientPurpose(undefined, {
        params: { clientId, purposeId },
        headers: { ...requestHeaders },
      });
    },

    async deleteClientKeyById(
      clientId: string,
      keyId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Deleting key ${keyId} from client ${clientId}`);

      return authorizationProcessClient.client.deleteClientKeyById(undefined, {
        params: { clientId, keyId },
        headers: { ...requestHeaders },
      });
    },

    async removeUser(
      clientId: string,
      userId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Removing user ${userId} from client ${clientId}`);

      return authorizationProcessClient.client.removeUser(undefined, {
        params: { clientId, userId },
        headers: { ...requestHeaders },
      });
    },

    async addUserToClient(
      userId: string,
      clientId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Add user ${userId} to client ${clientId}`);

      await authorizationProcessClient.client.addUser(undefined, {
        params: { clientId, userId },
        headers: { ...requestHeaders },
      });
    },

    async createKeys(
      userId: string,
      clientId: string,
      keySeed: bffApi.KeysSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Create keys for client ${clientId}`);

      const body: authorizationApi.KeysSeed = keySeed.map((seed) => ({
        userId,
        key: seed.key,
        use: seed.use,
        alg: seed.alg,
        name: seed.name,
        createdAt: new Date().toISOString(),
      }));

      await authorizationProcessClient.client.createKeys(body, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },

    async getClientKeys(
      clientId: string,
      userIds: string[],
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey[]> {
      logger.info(`Retrieve keys of client ${clientId}`);

      const { keys } = await authorizationProcessClient.client.getClientKeys({
        params: { clientId },
        queries: { userIds: userIds.join(",") },
        headers,
      });

      return Promise.all(
        keys.map((k) => decorateKey(selfcareV2Client, k, clientId))
      );
    },

    async addClientPurpose(
      clientId: string,
      purpose: bffApi.PurposeAdditionDetailsSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Adding purpose ${purpose.purposeId} to client ${clientId}`);

      await authorizationProcessClient.client.addClientPurpose(purpose, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },

    async getClientUsers(
      clientId: string,
      selfcareId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactUser[]> {
      logger.info(`Retrieving users for client ${clientId}`);

      const clientUsers =
        await authorizationProcessClient.client.getClientUsers({
          params: { clientId },
          headers,
        });

      const users = clientUsers.map(async (id) =>
        toBffApiCompactUser(
          await getSelfcareUserById(selfcareV2Client, id, selfcareId),
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

      const key = await authorizationProcessClient.client.getClientKeyById({
        params: { clientId, keyId },
        headers,
      });
      return decorateKey(selfcareV2Client, key, selfcareId);
    },

    async getEncodedClientKeyById(
      clientId: string,
      keyId: string,
      headers: Headers,
      logger: Logger
    ): Promise<{ key: string }> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const key = await authorizationProcessClient.client.getClientKeyById({
        params: { clientId, keyId },
        headers,
      });
      return { key: key.encodedPem };
    },

    async createConsumerClient(
      seed: authorizationApi.ClientSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ id: string }> {
      logger.info(`Creating consumer client with name ${seed.name}`);

      return authorizationProcessClient.client.createConsumerClient(seed, {
        headers,
      });
    },

    async createApiClient(
      seed: authorizationApi.ClientSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ id: string }> {
      logger.info(`Creating api client with name ${seed.name}`);

      return authorizationProcessClient.client.createApiClient(seed, {
        headers,
      });
    },
  };
}

export type ClientService = ReturnType<typeof clientServiceBuilder>;

async function enhanceClient(
  apiClients: PagoPAInteropBeClients,
  client: authorizationManagementApi.Client,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Client> {
  const consumer = await apiClients.tenantProcessClient.tenant.getTenant({
    params: { id: client.consumerId },
    headers: { ...requestHeaders },
  });

  const purposes = await Promise.all(
    client.purposes.map((p) => enhancePurpose(apiClients, p, requestHeaders))
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
  clientPurpose: authorizationManagementApi.Purpose,
  { headers }: WithLogger<BffAppContext>
): Promise<bffApi.ClientPurpose> {
  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: clientPurpose.states.eservice.eserviceId },
    headers: { ...requestHeaders },
  });

  const producerRes = tenantProcessClient.tenant.getTenant({
    params: { id: eservice.producerId },
    headers: { ...requestHeaders },
  });

  const purposeRes = purposeProcessClient.getPurpose({
    params: { id: clientPurpose.states.purpose.purposeId },
    headers: { ...requestHeaders },
  });
  const [producer, purpose] = await Promise.all([producerRes, purposeRes]);

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

async function getSelfcareUserById(
  selfcareClient: SelfcareV2Client,
  userId: string,
  selfcareId: string
) {
  try {
    return selfcareClient.getUserInfoUsingGET({
      params: { id: userId },
      queries: { institutionId: selfcareId },
    });
  } catch (error) {
    throw userNotFound(userId, selfcareId);
  }
}

async function decorateKey(
  selfcareClient: SelfcareV2Client,
  key: authorizationApi.Key,
  selfcareId: string
): Promise<bffApi.PublicKey> {
  const user = await getSelfcareUserById(
    selfcareClient,
    key.userId,
    selfcareId
  );

  return {
    user: toBffApiCompactUser(user, key.userId),
    name: key.name,
    keyId: key.kid,
    createdAt: key.createdAt,
    isOrphan: user.id === undefined,
  };
}
