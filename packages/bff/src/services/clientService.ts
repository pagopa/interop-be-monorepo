/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger } from "pagopa-interop-commons";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import {
  Headers,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import {
  ApiClient,
  ApiClientPurpose,
  ApiKeysSeed,
  ApiPurposeAdditionDetailsSeed,
  AuthUpdaterApiClient,
  AuthUpdaterApiPurpose,
  ProcessApiKeySeed,
} from "../model/api/clientTypes.js";
import { userNotFound } from "../model/domain/errors.js";
import { toApiCompactUser } from "../model/domain/apiConverter.js";

export function clientServiceBuilder(
  apiClients: PagoPAInteropBeClients,
  selfcareV2Client: SelfcareV2Client
) {
  const { authorizationProcessClient, authorizationUpdaterClient } = apiClients;

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
      kind?: BffApiClientKind;
    }): Promise<AuthProcessApiClientsWithKeys> {
      return authorizationProcessClient.getClientsWithKeys({
        queries: {
          offset,
          limit,
          userIds,
          consumerId: requesterId,
          name,
          kind,
        },
        headers,
      });
    },

    async getClientById(
      clientId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ApiClient> {
      logger.info(`Retrieve client ${clientId}`);

      const client = await authorizationUpdaterClient.getClient({
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

      return authorizationProcessClient.deleteClient(undefined, {
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

      return authorizationProcessClient.removeClientPurpose(undefined, {
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

      return authorizationProcessClient.deleteClientKeyById(undefined, {
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

      return authorizationProcessClient.removeUser(undefined, {
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

      await authorizationProcessClient.addUser(undefined, {
        params: { clientId, userId },
        headers: { ...requestHeaders },
      });
    },

    async createKeys(
      userId: string,
      clientId: string,
      keySeed: ApiKeysSeed,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Create keys for client ${clientId}`);

      const body: ProcessApiKeySeed = keySeed.map((seed) => ({
        userId,
        key: seed.key,
        use: seed.use,
        alg: seed.alg,
        name: seed.name,
        createdAt: new Date().toISOString(),
      }));

      await authorizationProcessClient.createKeys(body, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },

    async addClientPurpose(
      clientId: string,
      purpose: BffApiPurposeAdditionDetailsSeed,
      headers: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Adding purpose ${purpose.purposeId} to client ${clientId}`);

      await authorizationProcessClient.addClientPurpose(purpose, {
        params: { clientId },
        headers: { ...requestHeaders },
      });
    },

    async getClientUsers(
      clientId: string,
      selfcareId: string,
      headers: Headers,
      logger: Logger
    ): Promise<BffApiCompactUser[]> {
      logger.info(`Retrieving users for client ${clientId}`);

      const clientUsers = await authorizationProcessClient.getClientUsers({
        params: { clientId },
        headers,
      });

      const users = clientUsers.map(async (id) =>
        toApiCompactUser(
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
      headers: Headers,
      logger: Logger
    ): Promise<BffApiPublicKey> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const key = await authorizationProcessClient.getClientKeyById({
        params: { clientId, keyId },
        headers,
      });
      const user = await getSelfcareUserById(
        selfcareV2Client,
        key.userId,
        selfcareId
      );

      return {
        user: toApiCompactUser(user, key.userId),
        name: key.name,
        keyId: key.kid,
        createdAt: key.createdAt,
        isOrphan: user.id === undefined,
      };
    },

    async getEncodedClientKeyById(
      clientId: string,
      keyId: string,
      headers: Headers,
      logger: Logger
    ): Promise<{ key: string }> {
      logger.info(`Retrieve key ${keyId} for client ${clientId}`);

      const key = await authorizationProcessClient.getClientKeyById({
        params: { clientId, keyId },
        headers,
      });
      return { key: key.encodedPem };
    },

    async createConsumerClient(
      seed: AuthProcessApiClientSeed,
      headers: Headers,
      logger: Logger
    ): Promise<{ id: string }> {
      logger.info(`Creating consumer client with name ${seed.name}`);

      return authorizationProcessClient.createConsumerClient(seed, {
        headers,
      });
    },

    async createApiClient(
      seed: AuthProcessApiClientSeed,
      headers: Headers,
      logger: Logger
    ): Promise<{ id: string }> {
      logger.info(`Creating api client with name ${seed.name}`);

      return authorizationProcessClient.createApiClient(seed, {
        headers,
      });
    },
  };
}

export type ClientService = ReturnType<typeof clientServiceBuilder>;

async function enhanceClient(
  apiClients: PagoPAInteropBeClients,
  client: AuthUpdaterApiClient,
  requestHeaders: Headers
): Promise<ApiClient> {
  const consumer = await apiClients.tenantProcessClient.getTenant({
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
  clientPurpose: AuthUpdaterApiPurpose,
  requestHeaders: Headers
): Promise<ApiClientPurpose> {
  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: clientPurpose.states.eservice.eserviceId },
    headers: { ...requestHeaders },
  });

  const producerRes = tenantProcessClient.getTenant({
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
