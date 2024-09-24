/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { WithLogger } from "pagopa-interop-commons";
import {
  authorizationApi,
  bffApi,
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { SelfcareId } from "pagopa-interop-models";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toAuthorizationKeySeed } from "../api/authorizationApiConverter.js";
import { toBffApiCompactUser } from "../api/selfcareApiConverter.js";

export function producerKeychainServiceBuilder(
  apiClients: PagoPAInteropBeClients,
  selfcareUsersClient: SelfcareV2UsersClient
) {
  const { authorizationClient } = apiClients;

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

      return authorizationClient.producerKeychain.getProducerKeychains({
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

      return authorizationClient.producerKeychain.createProducerKeychain(seed, {
        headers,
      });
    },
    async getProducerKeychainById(
      producerKeychainId: string,
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerKeychain> {
      ctx.logger.info(`Retrieve producer keychain ${producerKeychainId}`);

      const producerKeychain =
        await authorizationClient.producerKeychain.getProducerKeychain({
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

      return authorizationClient.producerKeychain.deleteProducerKeychain(
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

      await authorizationClient.producerKeychain.addProducerKeychainEService(
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

      return authorizationClient.producerKeychain.removeProducerKeychainEService(
        undefined,
        {
          params: { producerKeychainId, eserviceId },
          headers,
        }
      );
    },
    async createProducerKey(
      producerKeychainId: string,
      keySeed: bffApi.KeySeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(`Create keys for producer keychain ${producerKeychainId}`);

      const body: authorizationApi.KeySeed = toAuthorizationKeySeed(keySeed);

      await authorizationClient.producerKeychain.createProducerKey(body, {
        params: { producerKeychainId },
        headers,
      });
    },
    async getProducerKeys(
      producerKeychainId: string,
      userIds: string[],
      { logger, headers, authData }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKeys> {
      logger.info(`Retrieve keys of producer keychain ${producerKeychainId}`);

      const selfcareId = authData.selfcareId;

      const { keys } =
        await authorizationClient.producerKeychain.getProducerKeys({
          params: { producerKeychainId },
          queries: { userIds },
          headers,
        });

      const decoratedKeys = await Promise.all(
        keys.map((k) => decorateKey(selfcareUsersClient, k, selfcareId))
      );

      return { keys: decoratedKeys };
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

      const key = await authorizationClient.producerKeychain.getProducerKeyById(
        {
          params: { producerKeychainId, keyId },
          headers,
        }
      );
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

      return authorizationClient.producerKeychain.deleteProducerKeyById(
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
    ): Promise<bffApi.CompactUsers> {
      logger.info(
        `Retrieving users for producer keychain ${producerKeychainId}`
      );

      const selfcareId = authData.selfcareId;

      const producerKeychainUsers =
        await authorizationClient.producerKeychain.getProducerKeychainUsers({
          params: { producerKeychainId },
          headers,
        });

      const users = producerKeychainUsers.map(async (id) =>
        toBffApiCompactUser(
          await getSelfcareUserById(selfcareUsersClient, id, selfcareId),
          id
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
        await authorizationClient.producerKeychain.addProducerKeychainUser(
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

      return authorizationClient.producerKeychain.removeProducerKeychainUser(
        undefined,
        {
          params: { producerKeychainId, userId },
          headers,
        }
      );
    },

    async getEncodedProducerKeychainKeyById(
      producerKeychainId: string,
      keyId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.EncodedClientKey> {
      logger.info(
        `Retrieve key ${keyId} for producer keychain ${producerKeychainId}`
      );

      const key = await authorizationClient.producerKeychain.getProducerKeyById(
        {
          params: { producerKeychainId, keyId },
          headers,
        }
      );
      return { key: key.encodedPem };
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
    producer: {
      id: producer.id,
      name: producer.name,
      kind: producer.kind,
    },
  };
}

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
    return {};
  }
}

async function decorateKey(
  selfcareClient: SelfcareV2UsersClient,
  key: authorizationApi.Key,
  selfcareId: SelfcareId
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
