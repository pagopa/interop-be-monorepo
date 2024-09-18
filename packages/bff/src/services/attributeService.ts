/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { attributeRegistryApi, bffApi } from "pagopa-interop-api-clients";
import {
  AttributeProcessClient,
  PagoPAInteropBeClients,
} from "../clients/clientsProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toApiAttributeProcessSeed } from "../api/attributeApiConverter.js";

export async function getAllBulkAttributes(
  attributeProcessClient: AttributeProcessClient,
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
        toApiAttributeProcessSeed(seed),
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

      return attributeClient.createVerifiedAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async createDeclaredAttribute(
      seed: bffApi.AttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.Attribute> {
      logger.info(`Creating declared attribute with name ${seed.name}`);

      return attributeClient.createDeclaredAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async getAttributeById(
      attributeId: string,
      { logger, headers }: WithLogger<BffAppContext>
    ): Promise<attributeRegistryApi.Attribute> {
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
    ): Promise<attributeRegistryApi.Attribute> {
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
    ): Promise<attributeRegistryApi.Attributes> {
      logger.info("Retrieving attributes");
      return attributeClient.getAttributes({
        queries: { offset, limit, kinds, name, origin },
        headers,
      });
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;

export async function getBulkAttributes(
  ids: string[],
  attributeProcess: PagoPAInteropBeClients["attributeProcessClient"],
  { headers }: WithLogger<BffAppContext>
): Promise<attributeRegistryApi.Attribute[]> {
  return getAllFromPaginated((offset, limit) =>
    attributeProcess.getBulkedAttributes(ids, {
      queries: { offset, limit },
      headers,
    })
  );
}
