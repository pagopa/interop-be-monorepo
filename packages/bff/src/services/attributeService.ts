import crypto from "crypto-js";
import { Logger } from "pagopa-interop-commons";
import {
  ApiAttribute,
  ApiAttributeSeed,
  ProcessApiAttribute,
  ProcessApiAttributeKind,
  ProcessApiAttributes,
} from "../model/types.js";
import { PagoPaClients, Headers } from "../providers/clientProvider.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeServiceBuilder(
  attributeClient: PagoPaClients["attributeProcessClient"]
) {
  return {
    async createCertifiedAttribute(
      seed: ApiAttributeSeed,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ApiAttribute> {
      logger.info(`Creating certified attribute with name ${seed.name}`);

      return attributeClient.createCertifiedAttribute(
        {
          ...seed,
          code: generateSeedCode(seed.name),
        },
        {
          headers: { ...requestHeaders },
          withCredentials: true,
        }
      );
    },

    async createVerifiedAttribute(
      seed: ApiAttributeSeed,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ApiAttribute> {
      logger.info(`Creating verified attribute with name ${seed.name}`);

      return attributeClient.createVerifiedAttribute(
        {
          ...seed,
          code: generateSeedCode(seed.name),
        },
        {
          headers: { ...requestHeaders },
        }
      );
    },

    async createDeclaredAttribute(
      seed: ApiAttributeSeed,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ApiAttribute> {
      logger.info(`Creating declared attribute with name ${seed.name}`);

      return attributeClient.createDeclaredAttribute(
        {
          ...seed,
          code: generateSeedCode(seed.name),
        },
        {
          headers: { ...requestHeaders },
          withCredentials: true,
        }
      );
    },

    async getAttributeById(
      attributeId: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ProcessApiAttribute> {
      logger.info(`Retrieving attribute with id ${attributeId}`);
      return attributeClient.getAttributeById({
        params: { attributeId },
        headers: { ...requestHeaders },
      });
    },

    async getAttributeByOriginAndCode(
      origin: string,
      code: string,
      requestHeaders: Headers,
      logger: Logger
    ): Promise<ProcessApiAttribute> {
      logger.info(
        `Retrieving attribute with origin ${origin} and code ${code}`
      );
      return attributeClient.getAttributeByOriginAndCode({
        params: { origin, code },
        headers: { ...requestHeaders },
        withCredentials: true,
      });
    },

    async getAttributes({
      offset,
      limit,
      kinds,
      requestHeaders,
      logger,
      name,
      origin,
    }: {
      offset: number;
      limit: number;
      kinds: ProcessApiAttributeKind[];
      requestHeaders: Headers;
      logger: Logger;
      name?: string;
      origin?: string;
    }): Promise<ProcessApiAttributes> {
      logger.info("Retrieving attributes");
      return attributeClient.getAttributes({
        queries: { offset, limit, kinds, name, origin },
        headers: { ...requestHeaders },
        withCredentials: true,
      });
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;

function generateSeedCode(name: string): string {
  return crypto.SHA256(name).toString();
}
