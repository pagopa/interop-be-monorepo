import { WithLogger } from "pagopa-interop-commons";
import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";

import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { toM2MGatewayApiCertifiedAttribute } from "../api/attributeApiConverter.js";

export type AttributeService = ReturnType<typeof attributeServiceBuilder>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeServiceBuilder(clients: PagoPAInteropBeClients) {
  const pollAttribute = (
    response: WithMaybeMetadata<attributeRegistryApi.Attribute>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<attributeRegistryApi.Attribute>> =>
    pollResourceWithMetadata(() =>
      clients.attributeProcessClient.getAttributeById({
        params: { attributeId: response.data.id },
        headers,
      })
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getCertifiedAttribute(
      attributeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.CertifiedAttribute> {
      logger.info(`Retrieving certified attribute with id ${attributeId}`);

      const response = await clients.attributeProcessClient.getAttributeById({
        params: {
          attributeId,
        },
        headers,
      });

      return toM2MGatewayApiCertifiedAttribute({
        attribute: response.data,
        logger,
        mapThrownErrorsToNotFound: true,
      });
    },
    async createCertifiedAttribute(
      seed: m2mGatewayApi.CertifiedAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.CertifiedAttribute> {
      logger.info(
        `Creating certified attribute with code ${seed.code} and name ${seed.name}`
      );

      const response =
        await clients.attributeProcessClient.createCertifiedAttribute(seed, {
          headers,
        });

      const polledResource = await pollAttribute(response, headers);

      return toM2MGatewayApiCertifiedAttribute({
        attribute: polledResource.data,
        logger,
      });
    },
  };
}
