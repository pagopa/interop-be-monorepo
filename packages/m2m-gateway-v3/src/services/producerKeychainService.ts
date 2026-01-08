import {
  EServiceId,
  ProducerKeychainId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { WithLogger } from "pagopa-interop-commons";
import { authorizationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "../utils/context.js";
import { WithMaybeMetadata } from "../clients/zodiosWithMetadataPatch.js";
import {
  toGetProducerKeychainsApiQueryParams,
  toM2MGatewayApiProducerKeychain,
} from "../api/producerKeychainApiConverter.js";
import { assertProducerKeychainVisibilityIsFull } from "../utils/validators/keychainValidators.js";
import { toM2MGatewayApiEService } from "../api/eserviceApiConverter.js";
import { toM2MJWK } from "../api/keysApiConverter.js";
import {
  isPolledVersionAtLeastResponseVersion,
  pollResourceWithMetadata,
} from "../utils/polling.js";

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

  const pollProducerKeychain = (
    response: WithMaybeMetadata<authorizationApi.ProducerKeychain>,
    headers: M2MGatewayAppContext["headers"]
  ): Promise<WithMaybeMetadata<authorizationApi.ProducerKeychain>> =>
    pollResourceWithMetadata(() =>
      retrieveProducerKeychainById(unsafeBrandId(response.data.id), headers)
    )({
      condition: isPolledVersionAtLeastResponseVersion(response),
    });

  return {
    async getProducerKeychain(
      keychainId: ProducerKeychainId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ProducerKeychain> {
      logger.info(`Retrieving producer keychain with id ${keychainId}`);

      const keychain = await retrieveProducerKeychainById(keychainId, headers);

      return toM2MGatewayApiProducerKeychain(keychain.data);
    },
    async getProducerKeychains(
      params: m2mGatewayApiV3.GetProducerKeychainsQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.ProducerKeychains> {
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
    async getProducerKeychainEServices(
      keychainId: ProducerKeychainId,
      {
        limit,
        offset,
      }: m2mGatewayApiV3.GetProducerKeychainEServicesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.EServices> {
      logger.info(
        `Retrieving e-services for producer keychain with id ${keychainId}`
      );

      const { data: keychain } = await retrieveProducerKeychainById(
        keychainId,
        headers
      );

      assertProducerKeychainVisibilityIsFull(keychain);

      const paginatedEServiceIds = keychain.eservices.slice(
        offset,
        offset + limit
      );

      const paginatedEServices = await clients.catalogProcessClient
        .getEServices({
          queries: { eservicesIds: paginatedEServiceIds, offset: 0, limit },
          headers,
        })
        .then(({ data: eService }) => eService.results);

      return {
        pagination: {
          limit,
          offset,
          totalCount: keychain.eservices.length,
        },
        results: paginatedEServices.map(toM2MGatewayApiEService),
      };
    },
    async getProducerKeychainKeys(
      keychainId: ProducerKeychainId,
      { limit, offset }: m2mGatewayApiV3.GetProducerKeychainKeysQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.JWKs> {
      logger.info(
        `Retrieving keys for producer keychain with id ${keychainId}`
      );

      const {
        data: { keys, totalCount },
      } = await clients.authorizationClient.producerKeychain.getProducerKeys({
        params: { producerKeychainId: keychainId },
        queries: { limit, offset },
        headers,
      });

      const jwks = await Promise.all(
        keys.map((key) =>
          clients.authorizationClient.key
            .getProducerJWKByKid({
              params: { kid: key.kid },
              headers,
            })
            .then(({ data: jwk }) => jwk.jwk)
        )
      );

      return {
        pagination: {
          limit,
          offset,
          totalCount,
        },
        results: jwks.map(toM2MJWK),
      };
    },
    async createProducerKeychainKey(
      keychainId: ProducerKeychainId,
      seed: m2mGatewayApiV3.KeySeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.JWK> {
      logger.info(
        `Create a new key for producer keychain with id ${keychainId}`
      );

      const { data: key } =
        await clients.authorizationClient.producerKeychain.createProducerKey(
          seed,
          {
            params: { producerKeychainId: keychainId },
            headers,
          }
        );

      const { data: jwkData } =
        await clients.authorizationClient.key.getJWKByKid({
          params: { kid: key.kid },
          headers,
        });

      return toM2MJWK(jwkData.jwk);
    },
    async addProducerKeychainEService(
      producerKeychainId: ProducerKeychainId,
      seed: m2mGatewayApiV3.ProducerKeychainAddEService,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Adding e-service ${seed.eserviceId} to producer keychain with id ${producerKeychainId}`
      );

      const response =
        await clients.authorizationClient.producerKeychain.addProducerKeychainEService(
          seed,
          {
            params: {
              producerKeychainId,
            },
            headers,
          }
        );

      await pollProducerKeychain(response, headers);
    },
    async removeProducerKeychainEService(
      producerKeychainId: ProducerKeychainId,
      eserviceId: EServiceId,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<void> {
      logger.info(
        `Removing e-service ${eserviceId} from producer keychain with id ${producerKeychainId}`
      );

      const response =
        await clients.authorizationClient.producerKeychain.removeProducerKeychainEService(
          undefined,
          {
            params: { producerKeychainId, eserviceId },
            headers,
          }
        );

      await pollProducerKeychain(response, headers);
    },
  };
}
