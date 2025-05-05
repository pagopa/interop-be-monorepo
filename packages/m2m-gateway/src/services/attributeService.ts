import { WithLogger } from "pagopa-interop-commons";
import { m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { toM2MGatewayApiCertifiedAttribute } from "../api/attributeApiConverter.js";

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeServiceBuilder(clients: PagoPAInteropBeClients) {
  return {
    async getCertifiedAttribute(
      attributeId: string,
      { headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.CertifiedAttribute> {
      const response = await clients.attributeProcessClient.getAttributeById({
        params: {
          attributeId,
        },
        headers,
      });

      return toM2MGatewayApiCertifiedAttribute(response.data);
    },
  };
}
