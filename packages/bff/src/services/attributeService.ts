import {
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
      });
    },
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
