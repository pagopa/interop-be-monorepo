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
import {
  toGetCertifiedAttributesApiQueryParams,
  toGetDeclaredAttributesApiQueryParams,
  toGetVerifiedAttributesApiQueryParams,
  toM2MGatewayApiCertifiedAttribute,
  toM2MGatewayApiDeclaredAttribute,
  toM2MGatewayApiVerifiedAttribute,
} from "../api/attributeApiConverter.js";

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
    async getDeclaredAttribute(
      attributeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.DeclaredAttribute> {
      logger.info(`Retrieving declared attribute with id ${attributeId}`);

      const response = await clients.attributeProcessClient.getAttributeById({
        params: {
          attributeId,
        },
        headers,
      });

      return toM2MGatewayApiDeclaredAttribute({
        attribute: response.data,
        logger,
        mapThrownErrorsToNotFound: true,
      });
    },
    async getVerifiedAttribute(
      attributeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.VerifiedAttribute> {
      logger.info(`Retrieving verified attribute with id ${attributeId}`);

      const response = await clients.attributeProcessClient.getAttributeById({
        params: {
          attributeId,
        },
        headers,
      });

      return toM2MGatewayApiVerifiedAttribute({
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
    async createVerifiedAttribute(
      seed: m2mGatewayApi.VerifiedAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.VerifiedAttribute> {
      logger.info(`Creating verified attribute with name ${seed.name}`);

      const response =
        await clients.attributeProcessClient.createVerifiedAttribute(seed, {
          headers,
        });

      const polledResource = await pollAttribute(response, headers);

      return toM2MGatewayApiVerifiedAttribute({
        attribute: polledResource.data,
        logger,
      });
    },
    async getCertifiedAttributes(
      { limit, offset }: m2mGatewayApi.GetCertifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.CertifiedAttributes> {
      logger.info(
        `Retrieving certified attributes with limit ${limit} and offset ${offset}`
      );

      const response = await clients.attributeProcessClient.getAttributes({
        queries: toGetCertifiedAttributesApiQueryParams({ limit, offset }),
        headers,
      });

      return {
        results: response.data.results.map((attribute) =>
          toM2MGatewayApiCertifiedAttribute({ attribute, logger })
        ),
        pagination: {
          limit,
          offset,
          totalCount: response.data.totalCount,
        },
      };
    },
    async getDeclaredAttributes(
      { limit, offset }: m2mGatewayApi.GetDeclaredAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.DeclaredAttributes> {
      logger.info(
        `Retrieving declared attributes with limit ${limit} and offset ${offset}`
      );
      const response = await clients.attributeProcessClient.getAttributes({
        queries: toGetDeclaredAttributesApiQueryParams({ limit, offset }),
        headers,
      });
      return {
        results: response.data.results.map((attribute) =>
          toM2MGatewayApiDeclaredAttribute({ attribute, logger })
        ),
        pagination: {
          limit,
          offset,
          totalCount: response.data.totalCount,
        },
      };
    },
    async getVerifiedAttributes(
      { limit, offset }: m2mGatewayApi.GetVerifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.VerifiedAttributes> {
      logger.info(
        `Retrieving verified attributes with limit ${limit} and offset ${offset}`
      );

      const response = await clients.attributeProcessClient.getAttributes({
        queries: toGetVerifiedAttributesApiQueryParams({ limit, offset }),
        headers,
      });

      return {
        results: response.data.results.map((attribute) =>
          toM2MGatewayApiVerifiedAttribute({ attribute, logger })
        ),
        pagination: {
          limit,
          offset,
          totalCount: response.data.totalCount,
        },
      };
    },
    async createDeclaredAttribute(
      seed: m2mGatewayApi.DeclaredAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApi.DeclaredAttribute> {
      logger.info(`Creating declared attribute with name ${seed.name}`);

      const response =
        await clients.attributeProcessClient.createDeclaredAttribute(seed, {
          headers,
        });

      const polledResource = await pollAttribute(response, headers);

      return toM2MGatewayApiDeclaredAttribute({
        attribute: polledResource.data,
        logger,
      });
    },
  };
}
