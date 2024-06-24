/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { Logger } from "pagopa-interop-commons";
import {
  Headers,
  PagoPAInteropBeClients,
} from "../providers/clientProvider.js";
import {
  BffApiAttributeSeed,
  BffApiAttribute,
  AttributeProcessApiAttribute,
  AttributeProcessApiAttributeKind,
  AttributeProcessApiAttributes,
} from "../model/api/attributeTypes.js";
import { toApiAttributeProcessSeed } from "../model/domain/apiConverter.js";

export function attributeServiceBuilder(
  attributeClient: PagoPAInteropBeClients["attributeProcessClient"]
) {
  return {
    async createCertifiedAttribute(
      seed: BffApiAttributeSeed,
      headers: Headers,
      logger: Logger
    ): Promise<BffApiAttribute> {
      logger.info(`Creating certified attribute with name ${seed.name}`);

      return attributeClient.createCertifiedAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
          withCredentials: true,
        }
      );
    },

    async createVerifiedAttribute(
      seed: BffApiAttributeSeed,
      headers: Headers,
      logger: Logger
    ): Promise<BffApiAttribute> {
      logger.info(`Creating verified attribute with name ${seed.name}`);

      return attributeClient.createVerifiedAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
        }
      );
    },

    async createDeclaredAttribute(
      seed: BffApiAttributeSeed,
      headers: Headers,
      logger: Logger
    ): Promise<BffApiAttribute> {
      logger.info(`Creating declared attribute with name ${seed.name}`);

      return attributeClient.createDeclaredAttribute(
        toApiAttributeProcessSeed(seed),
        {
          headers,
          withCredentials: true,
        }
      );
    },

    async getAttributeById(
      attributeId: string,
      headers: Headers,
      logger: Logger
    ): Promise<AttributeProcessApiAttribute> {
      logger.info(`Retrieving attribute with id ${attributeId}`);
      return attributeClient.getAttributeById({
        params: { attributeId },
        headers,
      });
    },

    async getAttributeByOriginAndCode(
      origin: string,
      code: string,
      headers: Headers,
      logger: Logger
    ): Promise<AttributeProcessApiAttribute> {
      logger.info(
        `Retrieving attribute with origin ${origin} and code ${code}`
      );
      return attributeClient.getAttributeByOriginAndCode({
        params: { origin, code },
        headers,
        withCredentials: true,
      });
    },

    async getAttributes({
      offset,
      limit,
      kinds,
      headers,
      logger,
      name,
      origin,
    }: {
      offset: number;
      limit: number;
      kinds: AttributeProcessApiAttributeKind[];
      headers: Headers;
      logger: Logger;
      name?: string;
      origin?: string;
    }): Promise<AttributeProcessApiAttributes> {
      logger.info("Retrieving attributes");
      return attributeClient.getAttributes({
        queries: { offset, limit, kinds: kinds.join(","), name, origin },
        headers,
        withCredentials: true,
      });
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
