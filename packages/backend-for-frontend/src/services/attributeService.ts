/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { attributeRegistryApi, bffApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import {
  toApiCertifiedAttributeProcessSeed,
  toCompactAttribute,
} from "../api/attributeApiConverter.js";

export async function getAllBulkAttributes(
  attributeProcessClient: attributeRegistryApi.AttributeProcessClient,
  headers: BffAppContext["headers"],
  attributeIds: Array<attributeRegistryApi.Attribute["id"]>
): Promise<attributeRegistryApi.Attribute[]> {
  return await getAllFromPaginated<attributeRegistryApi.Attribute>(
    async (offset, limit) =>
      await attributeProcessClient.getBulkedAttributes(attributeIds, {
        headers,
        queries: {
          offset,
          limit,
        },
      })
  );
}

export function attributeServiceBuilder(
  attributeClient: PagoPAInteropBeClients["attributeProcessClient"]
) {
  return {
    async createCertifiedAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating certified attribute with name ${seed.name}`);

      return attributeClient.createCertifiedAttribute(
        toApiCertifiedAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async createVerifiedAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating verified attribute with name ${seed.name}`);

      return attributeClient.createVerifiedAttribute(seed, {
        headers,
      });
    },

    async createDeclaredAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating declared attribute with name ${seed.name}`);

      return attributeClient.createDeclaredAttribute(seed, {
        headers,
      });
    },

    async getAttributeById(
      attributeId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Retrieving attribute with id ${attributeId}`);
      return attributeClient.getAttributeById({
        params: { attributeId },
        headers,
      });
    },

    async getAttributeByOriginAndCode(
      origin: string,
      code: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(
        `Retrieving attribute with origin ${origin} and code ${code}`
      );
      return attributeClient.getAttributeByOriginAndCode({
        params: { origin, code },
        headers,
      });
    },

    async getAttributes(
      {
        offset,
        limit,
        kinds,
        name,
        origin,
      }: {
        offset: number;
        limit: number;
        kinds: attributeRegistryApi.AttributeKind[];
        name?: string;
        origin?: string;
      },
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attributes> {
      logger.info("Retrieving attributes");

      const attributes = await attributeClient.getAttributes({
        queries: { offset, limit, kinds, name, origin },
        headers,
      });
      return {
        results: attributes.results.map(toCompactAttribute),
        pagination: { offset, limit, totalCount: attributes.totalCount },
      };
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
