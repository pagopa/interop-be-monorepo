/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  authorizationApi,
  bffApi,
  SelfcareV2UsersClient,
  tenantApi,
} from "pagopa-interop-api-clients";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { CorrelationId } from "pagopa-interop-models";
import { match } from "ts-pattern";

import {
  toAuthorizationKeySeed,
  toBffApiCompactClient,
} from "../api/authorizationApiConverter.js";
import { AuthorizationProcessClient } from "../clients/clientsProvider.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import {
  clientNotFound,
  eServiceNotFound,
  purposeNotFound,
} from "../model/errors.js";
import { BffAppContext } from "../utilities/context.js";
import { filterUnreadNotifications } from "../utilities/filterUnreadNotifications.js";
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
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactClients> {
      const { logger, headers, correlationId, authData } = ctx;
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

      const notifications = await filterUnreadNotifications(
        inAppNotificationManagerClient,
        clients.results.map((c) => c.client.id),
        ctx
      );

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
      return match(client)
        .with(
          { visibility: authorizationApi.Visibility.Values.FULL },
          (fullClient) => enhanceClient(apiClients, fullClient, ctx)
        )
        .with(
          { visibility: authorizationApi.Visibility.Values.PARTIAL },
          () => {
            throw clientNotFound(clientId);
          }
        )
        .exhaustive();
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

      await authorizationClient.client.deleteClientKeyById(undefined, {
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

      await authorizationClient.client.removeUser(undefined, {
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
      assertClientVisibilityIsFull(client);

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
      { logger, headers, correlationId, authData }: WithLogger<BffAppContext>
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
            authData.selfcareId,
            correlationId
          )
        )
      );
    },

    async getClientKeyById(
      clientId: string,
      keyId: string,
      { logger, headers, correlationId, authData }: WithLogger<BffAppContext>
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
        authData.selfcareId,
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
  client: authorizationApi.FullClient,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.Client> {
  const tenantById = new Map<string, Promise<tenantApi.Tenant>>();
  const getTenant = (id: string): Promise<tenantApi.Tenant> => {
    const cachedTenant = tenantById.get(id);
    if (cachedTenant) {
      return cachedTenant;
    }

    const tenant = apiClients.tenantProcessClient.tenant.getTenant({
      params: { id },
      headers: ctx.headers,
    });
    tenantById.set(id, tenant);
    return tenant;
  };

  const [consumer, admin, purposes] = await Promise.all([
    getTenant(client.consumerId),
    client.adminId
      ? getSelfcareCompactUserById(
          apiClients.selfcareV2UserClient,
          client.adminId,
          ctx.authData.selfcareId,
          ctx.correlationId
        )
      : Promise.resolve(undefined),
    enhancePurposes(apiClients, client, getTenant, ctx),
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

async function enhancePurposes(
  { catalogProcessClient, purposeProcessClient }: PagoPAInteropBeClients,
  client: authorizationApi.FullClient,
  getTenant: (id: string) => Promise<tenantApi.Tenant>,
  { headers }: WithLogger<BffAppContext>
): Promise<bffApi.ClientPurpose[]> {
  if (client.purposes.length === 0) {
    return [];
  }

  const purposes = await getAllFromPaginated((offset, limit) =>
    purposeProcessClient.getPurposes({
      queries: { clientId: client.id, offset, limit },
      headers,
    })
  );
  const purposeById = new Map(purposes.map((purpose) => [purpose.id, purpose]));
  const orderedPurposes = client.purposes.map((purposeId) => {
    const purpose = purposeById.get(purposeId);
    if (!purpose) {
      throw purposeNotFound(purposeId);
    }
    return purpose;
  });

  const eserviceIds = Array.from(
    new Set(orderedPurposes.map((purpose) => purpose.eserviceId))
  );
  const eserviceBatches = Array.from(
    { length: Math.ceil(eserviceIds.length / 50) },
    (_, index) => eserviceIds.slice(index * 50, (index + 1) * 50)
  );
  const eservices = (
    await Promise.all(
      eserviceBatches.map((batch) =>
        catalogProcessClient.getEServices({
          queries: { eservicesIds: batch, offset: 0, limit: batch.length },
          headers,
        })
      )
    )
  ).flatMap(({ results }) => results);
  const eserviceById = new Map(
    eservices.map((eservice) => [eservice.id, eservice])
  );

  return await Promise.all(
    orderedPurposes.map(async (purpose) => {
      const eservice = eserviceById.get(purpose.eserviceId);
      if (!eservice) {
        throw eServiceNotFound(purpose.eserviceId);
      }

      const producer = await getTenant(eservice.producerId);

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
    })
  );
}

export async function decorateKey(
  selfcareClient: SelfcareV2UsersClient,
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
