/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { WithLogger } from "pagopa-interop-commons";
import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toAuthorizationKeySeed,
  toBffApiCompactProducerKeychain,
} from "../api/authorizationApiConverter.js";
import { filterUnreadNotifications } from "../utilities/filterUnreadNotifications.js";
import { decorateKey } from "./clientService.js";
import { getSelfcareCompactUserById } from "./selfcareService.js";
import { assertProducerKeychainVisibilityIsFull } from "./validators.js";

export function producerKeychainServiceBuilder(
  apiClients: PagoPAInteropBeClients
) {
  const {
    authorizationClient,
    selfcareV2UserClient,
    inAppNotificationManagerClient,
  } = apiClients;

  return {
    async getProducerKeychains(
      {
        limit,
        offset,
        userIds,
        name,
        eserviceId,
      }: {
        offset: number;
        limit: number;
        userIds: string[];
        name?: string;
        eserviceId?: string;
      },
      ctx: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactProducerKeychains> {
      const { logger, headers, authData } = ctx;
      logger.info(`Retrieving producer keychains`);

      const producerKeychains =
        await authorizationClient.producerKeychain.getProducerKeychains({
          queries: {
            offset,
            limit,
            userIds,
            producerId: authData.organizationId,
            name,
            eserviceId,
          },
          headers,
        });

      const notifications = await filterUnreadNotifications(
        inAppNotificationManagerClient,
        producerKeychains.results.map((pk) => pk.id),
        ctx
      );

      const enrichedKeychains = producerKeychains.results.map((pk) => ({
        ...pk,
        hasUnreadNotifications: notifications.includes(pk.id),
      }));

      return {
        results: enrichedKeychains.map(toBffApiCompactProducerKeychain),
        pagination: {
          limit,
          offset,
          totalCount: producerKeychains.totalCount,
        },
      };
    },
    async createProducerKeychain(
      seed: authorizationApi.ProducerKeychainSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CreatedResource> {
      logger.info(`Creating producer keychain with name ${seed.name}`);

      const { id } =
        await authorizationClient.producerKeychain.createProducerKeychain(
          seed,
          {
            headers,
          }
        );

      return { id };
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

      await authorizationClient.producerKeychain.removeProducerKeychainEService(
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
      {
        producerKeychainId,
        userIds,
        limit,
        offset,
      }: {
        producerKeychainId: string;
        userIds: string[];
        limit: number;
        offset: number;
      },
      { logger, headers, authData, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKeys> {
      logger.info(`Retrieve keys of producer keychain ${producerKeychainId}`);

      const selfcareId = authData.selfcareId;

      const [{ keys, totalCount }, keychain] = await Promise.all([
        authorizationClient.producerKeychain.getProducerKeys({
          params: { producerKeychainId },
          queries: { userIds, limit, offset },
          headers,
        }),
        authorizationClient.producerKeychain.getProducerKeychain({
          params: { producerKeychainId },
          headers,
        }),
      ]);

      assertProducerKeychainVisibilityIsFull(keychain);

      const decoratedKeys = await Promise.all(
        keys.map((k) =>
          decorateKey(
            selfcareV2UserClient,
            k,
            selfcareId,
            keychain.users,
            correlationId
          )
        )
      );

      return {
        keys: decoratedKeys,
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
    async getProducerKeyById(
      producerKeychainId: string,
      keyId: string,
      { logger, headers, authData, correlationId }: WithLogger<BffAppContext>
    ): Promise<bffApi.PublicKey> {
      logger.info(
        `Retrieve key ${keyId} for producer keychain ${producerKeychainId}`
      );

      const selfcareId = authData.selfcareId;

      const [key, keychain] = await Promise.all([
        authorizationClient.producerKeychain.getProducerKeyById({
          params: { producerKeychainId, keyId },
          headers,
        }),
        authorizationClient.producerKeychain.getProducerKeychain({
          params: { producerKeychainId },
          headers,
        }),
      ]);

      assertProducerKeychainVisibilityIsFull(keychain);

      return decorateKey(
        selfcareV2UserClient,
        key,
        selfcareId,
        keychain.users,
        correlationId
      );
    },
    async deleteProducerKeyById(
      producerKeychainId: string,
      keyId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Deleting key ${keyId} from producer keychain ${producerKeychainId}`
      );

      await authorizationClient.producerKeychain.deleteProducerKeyById(
        undefined,
        {
          params: { producerKeychainId, keyId },
          headers,
        }
      );
    },
    async getProducerKeychainUsers(
      producerKeychainId: string,
      { logger, headers, authData, correlationId }: WithLogger<BffAppContext>
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

      return await Promise.all(
        producerKeychainUsers.map((id) =>
          getSelfcareCompactUserById(
            selfcareV2UserClient,
            id,
            selfcareId,
            correlationId
          )
        )
      );
    },
    async addProducerKeychainUsers(
      userIds: string[],
      producerKeychainId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Add user ${userIds.join(
          ","
        )} to producer keychain ${producerKeychainId}`
      );

      await authorizationClient.producerKeychain.addProducerKeychainUsers(
        { userIds },
        {
          params: { producerKeychainId },
          headers,
        }
      );
    },
    async removeProducerKeychainUser(
      producerKeychainId: string,
      userId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<void> {
      logger.info(
        `Removing user ${userId} from producer keychain ${producerKeychainId}`
      );

      await authorizationClient.producerKeychain.removeProducerKeychainUser(
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
  assertProducerKeychainVisibilityIsFull(producerKeychain);
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
): Promise<bffApi.CompactEService> {
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
