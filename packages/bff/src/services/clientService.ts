/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger } from "pagopa-interop-commons";
import {
  Headers,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import {
  BffApiClient,
  BffApiClientPurpose,
  BffApiKeysSeed,
  ApiPurposeAdditionDetailsSeed,
  AuthUpdaterApiClient,
  AuthUpdaterApiPurpose,
  AuthProcessApiKeySeed,
} from "../model/api/clientTypes.js";

export function clientServiceBuilder(apiClients: PagoPAInteropBeClients) {
  const { authorizationProcessClient, authorizationUpdaterClient } = apiClients;

  return {
    async getClientById(
      clientId: string,
      headers: Headers,
      logger: Logger
    ): Promise<BffApiClient> {
      logger.info(`Retrieve client ${clientId}`);

      const client = await authorizationUpdaterClient.getClient({
        params: { clientId },
        headers,
      });
      return enhanceClient(apiClients, client, headers);
    },

    async deleteClient(
      clientId: string,
      headers: Headers,
      logger: Logger
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
      headers: Headers,
      logger: Logger
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
      headers: Headers,
      logger: Logger
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
      headers: Headers,
      logger: Logger
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
      headers: Headers,
      logger: Logger
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
      headers: Headers,
      logger: Logger
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
      purpose: ApiPurposeAdditionDetailsSeed,
      headers: Headers,
      logger: Logger
    ): Promise<void> {
      logger.info(`Adding purpose ${purpose.purposeId} to client ${clientId}`);

      await authorizationProcessClient.addClientPurpose(purpose, {
        params: { clientId },
        headers,
      });
    },
  };
}

export type ClientService = ReturnType<typeof clientServiceBuilder>;

async function enhanceClient(
  apiClients: PagoPAInteropBeClients,
  client: AuthUpdaterApiClient,
  headers: Headers
): Promise<BffApiClient> {
  const consumer = await apiClients.tenantProcessClient.getTenant({
    params: { id: client.consumerId },
    headers,
  });

  const purposes = await Promise.all(
    client.purposes.map((p) => enhancePurpose(apiClients, p, headers))
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
  headers: Headers
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
