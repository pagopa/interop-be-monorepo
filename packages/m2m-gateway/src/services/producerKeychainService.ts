import { ProducerKeychainId, unsafeBrandId } from "pagopa-interop-models";
import { WithLogger } from "pagopa-interop-commons";
import { authorizationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  toGetProducerKeychainsApiQueryParams,
  toM2MGatewayApiProducerKeychain,
} from "../api/producerKeychainApiConverter.js";

export type ProducerKeychainService = ReturnType<
  typeof producerKeychainServiceBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function producerKeychainServiceBuilder(
  clients: PagoPAInteropBeClients
) {
  const retrieveProducerKeychainById = (
    keychainId: ProducerKeychainId,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.ProducerKeychain>> =>
    clients.authorizationClient.producerKeychain.getProducerKeychain({
      params: { producerKeychainId: unsafeBrandId(keychainId) },
      headers,
    });

  return {
    async getProducerKeychain(
      keychainId: ProducerKeychainId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerKeychain> {
      logger.info(`Retrieving producer keychain with id ${keychainId}`);

      const keychain = await retrieveProducerKeychainById(keychainId, headers);

      return toM2MGatewayApiProducerKeychain(keychain.data);
    },
    async getProducerKeychains(
      params: m2mGatewayApi.GetProducerKeychainsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.ProducerKeychains> {
      const { limit, offset, name, producerId } = params;
      logger.info(
        `Retrieving producer keychains with name ${name}, producerId ${producerId}, offset ${offset}, limit ${limit}`
      );

      const {
        data: { results, totalCount },
      } =
        await clients.authorizationClient.producerKeychain.getProducerKeychains(
          {
            queries: toGetProducerKeychainsApiQueryParams(params),
            headers,
          }
        );

      return {
        results: results.map(toM2MGatewayApiProducerKeychain),
        pagination: {
          limit,
          offset,
          totalCount,
        },
      };
    },
  };
}
