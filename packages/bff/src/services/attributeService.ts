import { ProcessApiAttribute } from "../model/types.js";
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
  };
}

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;
