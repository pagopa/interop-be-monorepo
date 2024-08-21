/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { WithLogger } from "pagopa-interop-commons";
import {
  authorizationApi,
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toAuthorizationKeySeed } from "../model/domain/apiConverter.js";
import { userNotFound } from "../model/domain/errors.js";
import { toBffApiCompactUser } from "../model/api/apiConverter.js";

export function producerKeychainServiceBuilder(
  apiClients: PagoPAInteropBeClients,
  selfcareUsersClient: SelfcareV2UsersClient
) {
  const { authorizationProcessClient } = apiClients;

  return {
    async getProducerKeychains(
      {
        limit,
        offset,
        requesterId,
        userIds,
        name,
      }: {
        requesterId: string;
        offset: number;
        limit: number;
        userIds: string[];
        name?: string;
      },
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<authorizationApi.ProducerKeychains> {
      logger.info(`Retrieving producer keychains`);

      return authorizationProcessClient.producerKeychain.getProducerKeychains({
        queries: {
          offset,
          limit,
          userIds,
          producerId: requesterId,
          name,
          eserviceId: undefined,
        },
        headers,
      });
    },
    async createProducerKeychain(
      seed: authorizationApi.ProducerKeychainSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Creating producer keychain with name ${seed.name}`);

      return authorizationProcessClient.producerKeychain.createProducerKeychain(
        seed,
        {
          headers,
        }
      );
    },
    async getProducerKeychainById(
      producerKeychainId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerKeychain> {
      ctx.logger.info(`Retrieve producer keychain ${producerKeychainId}`);

      const producerKeychain =
        await authorizationProcessClient.producerKeychain.getProducerKeychain({
          params: { producerKeychainId },
          headers: ctx.headers,
        });
      return enhanceProducerKeychain(apiClients, producerKeychain, ctx);
    },
    async deleteProducerKeychain(
      producerKeychainId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Deleting producer keychain ${producerKeychainId}`);

      return authorizationProcessClient.producerKeychain.deleteProducerKeychain(
        undefined,
        {
          params: { producerKeychainId },
          headers,
        }
      );
    },
    async addProducerKeychainEService(
      producerKeychainId: string,
      eservice: bffApi.EServiceAdditionDetailsSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Adding e-service ${eservice.eserviceId} to producer keychain ${producerKeychainId}`
      );

      await authorizationProcessClient.producerKeychain.addProducerKeychainEService(
        eservice,
        {
          params: { producerKeychainId },
          headers,
        }
      );
    },
    async removeProducerKeychainEService(
      producerKeychainId: string,
      eserviceId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Removing e-service ${eserviceId} from producer keychain ${producerKeychainId}`
      );

      return authorizationProcessClient.producerKeychain.removeProducerKeychainEService(
        undefined,
        {
          params: { producerKeychainId, eserviceId },
          headers,
        }
      );
    },
    async createProducerKeys(
      userId: string,
      producerKeychainId: string,
      keySeed: bffApi.KeysSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Create keys for producer keychain ${producerKeychainId}`);

      const body: authorizationApi.KeysSeed = keySeed.map((seed) =>
        toAuthorizationKeySeed(seed, userId)
      );

      await authorizationProcessClient.producerKeychain.createProducerKeys(
        body,
        {
          params: { producerKeychainId },
          headers,
        }
      );
    },
    async getProducerKeys(
      producerKeychainId: string,
      userIds: string[],
      { logger, headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey[]> {
      logger.info(`Retrieve keys of producer keychain ${producerKeychainId}`);

      const selfcareId = authData.selfcareId;

      const { keys } =
        await authorizationProcessClient.producerKeychain.getProducerKeys({
          params: { producerKeychainId },
          queries: { userIds },
          headers,
        });

      return Promise.all(
        // TODO: selfcareId?
        keys.map((k) => decorateKey(selfcareUsersClient, k, selfcareId))
      );
    },
    async getProducerKeyById(
      producerKeychainId: string,
      keyId: string,
      { logger, headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey> {
      logger.info(
        `Retrieve key ${keyId} for producer keychain ${producerKeychainId}`
      );

      const selfcareId = authData.selfcareId;

      const key =
        await authorizationProcessClient.producerKeychain.getProducerKeyById({
          params: { producerKeychainId, keyId },
          headers,
        });
      return decorateKey(selfcareUsersClient, key, selfcareId);
    },
    async deleteProducerKeyById(
      producerKeychainId: string,
      keyId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting key ${keyId} from producer keychain ${producerKeychainId}`
      );

      return authorizationProcessClient.producerKeychain.deleteProducerKeyById(
        undefined,
        {
          params: { producerKeychainId, keyId },
          headers,
        }
      );
    },
    async getProducerKeychainUsers(
      producerKeychainId: string,
      { logger, headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactUser[]> {
      logger.info(
        `Retrieving users for producer keychain ${producerKeychainId}`
      );

      const selfcareId = authData.selfcareId;

      const producerKeychainUsers =
        await authorizationProcessClient.producerKeychain.getProducerKeychainUsers(
          {
            params: { producerKeychainId },
            headers,
          }
        );

      const users = producerKeychainUsers.map(async (id) =>
        toBffApiCompactUser(
          await getSelfcareUserById(selfcareUsersClient, id, selfcareId)
        )
      );
      return Promise.all(users);
    },
    async addProducerKeychainUser(
      userId: string,
      producerKeychainId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(
        `Add user ${userId} to producer keychain ${producerKeychainId}`
      );

      const { id } =
        await authorizationProcessClient.producerKeychain.addProducerKeychainUser(
          undefined,
          {
            params: { producerKeychainId, userId },
            headers,
          }
        );

      return { id };
    },
    async removeProducerKeychainUser(
      producerKeychainId: string,
      userId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Removing user ${userId} from producer keychain ${producerKeychainId}`
      );

      return authorizationProcessClient.producerKeychain.removeProducerKeychainUser(
        undefined,
        {
          params: { producerKeychainId, userId },
          headers,
        }
      );
    },
  };
}

export type ProducerKeychainService = ReturnType<
  typeof producerKeychainServiceBuilder
>;

async function enhanceProducerKeychain(
  apiClients: PagoPAInteropBeClients,
  producerKeychain: authorizationApi.ProducerKeychain,
  ctx: WithLogger<BffAppContext>
): Promise<bffApi.ProducerKeychain> {
  const producer = await apiClients.tenantProcessClient.tenant.getTenant({
    params: { id: producerKeychain.producerId },
    headers: ctx.headers,
  });

  const eservices = await Promise.all(
    producerKeychain.eservices.map((p) => enhanceEService(apiClients, p, ctx))
  );

  return {
    id: producerKeychain.id,
    name: producerKeychain.name,
    description: producerKeychain.description,
    createdAt: producerKeychain.createdAt,
    producer: {
      id: producer.id,
      name: producer.name,
    },
    eservices,
  };
}

async function enhanceEService(
  { catalogProcessClient, tenantProcessClient }: PagoPAInteropBeClients,
  eserviceId: string,
  { headers }: WithLogger<BffAppContext>
): Promise<bffApi.ProducerKeychainEService> {
  const eservice = await catalogProcessClient.getEServiceById({
    params: { eServiceId: eserviceId },
    headers,
  });

  const producer = await tenantProcessClient.tenant.getTenant({
    params: { id: eservice.producerId },
    headers,
  });

  return {
    id: eservice.id,
    name: eservice.name,
    // TODO: check if this is needed
    producer: {
      id: producer.id,
      name: producer.name,
      kind: producer.kind,
    },
  };
}

// TODO: move to separate file
async function getSelfcareUserById(
  selfcareClient: SelfcareV2UsersClient,
  userId: string,
  selfcareId: string
): Promise<selfcareV2ClientApi.UserResponse> {
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
  selfcareClient: SelfcareV2UsersClient,
  key: authorizationApi.Key,
  selfcareId: string
): Promise<bffApi.PublicKey> {
  const user = await getSelfcareUserById(
    selfcareClient,
    key.userId,
    selfcareId
  );

  return {
    user: toBffApiCompactUser(user),
    name: key.name,
    keyId: key.kid,
    createdAt: key.createdAt,
    isOrphan: user.id === undefined,
  };
}
