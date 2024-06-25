/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { userNotFound } from "../model/domain/errors.js";
import { toBffApiCompactUser } from "../model/domain/apiConverter.js";
import { BffAppContext } from "../utilities/context.js";
import {
  BffApiClientKind,
  BffApiClient,
  BffApiKeysSeed,
  BffApiPurposeAdditionDetailsSeed,
  BffApiCompactUser,
  BffApiPublicKey,
  BffApiClientPurpose,
} from "../model/api/bffTypes.js";
import {
  AuthProcessApiClientsWithKeys,
  AuthProcessApiKeySeed,
  AuthProcessApiClientSeed,
  AuthUpdaterApiClient,
  AuthUpdaterApiPurpose,
} from "../model/api/clientTypes.js";

export function clientServiceBuilder(
  apiClients: PagoPAInteropBeClients,
  selfcareV2Client: SelfcareV2Client
) {
  const { authorizationProcessClient, authorizationUpdaterClient } = apiClients;

  return {
    async getClients({
      ctx,
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
      ctx: WithLogger<BffAppContext>;
      name?: string;
      kind?: BffApiClientKind;
    }): Promise<AuthProcessApiClientsWithKeys> {
      ctx.logger.info(`Retrieving clients`);

      return authorizationProcessClient.getClientsWithKeys({
        queries: {
          offset,
          limit,
          userIds,
          consumerId: requesterId,
          name,
          kind,
        },
        headers: ctx.headers,
      });
    },

    async getClientById(
      clientId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<BffApiClient> {
      ctx.logger.info(`Retrieve client ${clientId}`);

      const client = await authorizationUpdaterClient.getClient({
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

      return authorizationProcessClient.deleteClient(undefined, {
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

      return authorizationProcessClient.removeClientPurpose(undefined, {
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

      return authorizationProcessClient.deleteClientKeyById(undefined, {
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

      return authorizationProcessClient.removeUser(undefined, {
        params: { clientId, userId },
        headers,
      });
    },

    async addUserToClient(
      userId: string,
      clientId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Add user ${userId} to client ${clientId}`);

      await authorizationProcessClient.addUser(undefined, {
        params: { clientId, userId },
        headers,
      });
    },

    async createKeys(
      userId: string,
      clientId: string,
      keySeed: BffApiKeysSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Create keys for client ${clientId}`);

      const body: AuthProcessApiKeySeed = keySeed.map((seed) => ({
        userId,
        key: seed.key,
        use: seed.use,
        alg: seed.alg,
        name: seed.name,
        createdAt: new Date().toISOString(),
      }));

      await authorizationProcessClient.createKeys(body, {
        params: { clientId },
        headers,
      });
    },

    async addClientPurpose(
      clientId: string,
      purpose: BffApiPurposeAdditionDetailsSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Adding purpose ${purpose.purposeId} to client ${clientId}`);

      await authorizationProcessClient.addClientPurpose(purpose, {
        params: { clientId },
        headers,
      });
    },

    async getClientUsers(
      clientId: string,
      selfcareId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<BffApiCompactUser[]> {
      logger.info(`Retrieving users for client ${clientId}`);

      const clientUsers = await authorizationProcessClient.getClientUsers({
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
        user: toBffApiCompactUser(user, key.userId),
        name: key.name,
        keyId: key.kid,
        createdAt: key.createdAt,
        isOrphan: user.id === undefined,
      };
    },

    async getEncodedClientKeyById(
      clientId: string,
      keyId: string,
      { logger, headers }: WithLogger<BffAppContext>
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
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<{ id: string }> {
      logger.info(`Creating consumer client with name ${seed.name}`);

      return authorizationProcessClient.createConsumerClient(seed, {
        headers,
      });
    },

    async createApiClient(
      seed: AuthProcessApiClientSeed,
      { logger, headers }: WithLogger<BffAppContext>
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
  ctx: WithLogger<BffAppContext>
): Promise<BffApiClient> {
  const consumer = await apiClients.tenantProcessClient.getTenant({
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
  clientPurpose: AuthUpdaterApiPurpose,
  { headers }: WithLogger<BffAppContext>
): Promise<BffApiClientPurpose> {
  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: clientPurpose.states.eservice.eserviceId },
    headers,
  });

  const producerRes = tenantProcessClient.getTenant({
    params: { id: eservice.producerId },
    headers,
  });

  const purposeRes = purposeProcessClient.getPurpose({
    params: { id: clientPurpose.states.purpose.purposeId },
    headers,
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
