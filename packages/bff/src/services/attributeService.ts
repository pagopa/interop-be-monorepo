/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import {
  BffApiAttributeSeed,
  BffApiAttribute,
  AttributeProcessApiAttribute,
  AttributeProcessApiAttributeKind,
  AttributeProcessApiAttributes,
} from "../model/api/attributeTypes.js";
import { toApiAttributeProcessSeed } from "../model/domain/apiConverter.js";
import { BffAppContext } from "../utilities/context.js";

export function attributeServiceBuilder(
  attributeClient: PagoPAInteropBeClients["attributeProcessClient"]
) {
  return {
    async createCertifiedAttribute(
      seed: BffApiAttributeSeed,
      { logger, headers }: WithLogger<BffAppContext>
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
      { logger, headers }: WithLogger<BffAppContext>
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
      { logger, headers }: WithLogger<BffAppContext>
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
      { logger, headers }: WithLogger<BffAppContext>
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
      { logger, headers }: WithLogger<BffAppContext>
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
      ctx,
      name,
      origin,
    }: {
      offset: number;
      limit: number;
      kinds: AttributeProcessApiAttributeKind[];
      ctx: WithLogger<BffAppContext>;
      name?: string;
      origin?: string;
    }): Promise<AttributeProcessApiAttributes> {
      ctx.logger.info("Retrieving attributes");
      return attributeClient.getAttributes({
        queries: { offset, limit, kinds: kinds.join(","), name, origin },
        headers: ctx.headers,
        withCredentials: true,
      });
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
