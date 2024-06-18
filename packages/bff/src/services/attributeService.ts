import crypto from "crypto-js";
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
      requestHeaders: Headers
    ): Promise<ApiAttribute> {
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
      requestHeaders: Headers
    ): Promise<ApiAttribute> {
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
      requestHeaders: Headers
    ): Promise<ApiAttribute> {
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
      requestHeaders: Headers
    ): Promise<ProcessApiAttribute> {
      return attributeClient.getAttributeById({
        params: { attributeId },
        headers: { ...requestHeaders },
      });
    },

    async getAttributeByOriginAndCode(
      origin: string,
      code: string,
      requestHeaders: Headers
    ): Promise<ProcessApiAttribute> {
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
      name,
      origin,
    }: {
      offset: number;
      limit: number;
      kinds: ProcessApiAttributeKind[];
      requestHeaders: Headers;
      name?: string;
      origin?: string;
    }): Promise<ProcessApiAttributes> {
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
