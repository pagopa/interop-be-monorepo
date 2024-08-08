/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { WithLogger } from "pagopa-interop-commons";
import { authorizationApi, bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";

export function producerKeychainServiceBuilder(
  apiClients: PagoPAInteropBeClients
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
