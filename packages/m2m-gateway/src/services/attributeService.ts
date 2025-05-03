import { WithLogger } from "pagopa-interop-commons";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { toM2MGatewayApiCertifiedAttribute } from "../api/attributeApiConverter.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResource,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { M2MGatewayAppContext } from "../utils/context.js";

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeServiceBuilder(clients: PagoPAInteropBeClients) {
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const pollAttribute = (
    response: WithMaybeMetadata<attributeRegistryApi.Attribute>,
    headers: M2MGatewayAppContext["headers"]
  ) =>
    pollResource(() =>
      clients.attributeProcessClient.getAttributeById({
        params: { attributeId: response.data.id },
        headers,
      })
    )({
      checkFn: isPolledVersionAtLeastResponseVersion(response),
    });

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

      return toM2MGatewayApiCertifiedAttribute(
        response.data,
        "attributeNotFound"
      );
    },
    async createCertifiedAttribute(
      seed: m2mGatewayApi.CertifiedAttributeSeed,
      { headers }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.CertifiedAttribute> {
      const response =
        await clients.attributeProcessClient.createCertifiedAttribute(seed, {
          headers,
        });

      const polledResource = await pollAttribute(response, headers);

      return toM2MGatewayApiCertifiedAttribute(polledResource.data);
    },
  };
}
