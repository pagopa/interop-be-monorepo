import { WithLogger } from "pagopa-interop-commons";
import {
  attributeRegistryApi,
  m2mGatewayApiV3,
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
  toGetCertifiedDiscreteAttributesApiQueryParams,
  toGetDeclaredAttributesApiQueryParams,
  toGetVerifiedAttributesApiQueryParams,
  toM2MGatewayApiCertifiedAttribute,
  toM2MGatewayApiCertifiedDiscreteAttribute,
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
    ): Promise<m2mGatewayApiV3.CertifiedAttribute> {
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
    async getCertifiedDiscreteAttribute(
      attributeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.CertifiedDiscreteAttribute> {
      logger.info(
        `Retrieving certified discrete attribute with id ${attributeId}`
      );

      const response = await clients.attributeProcessClient.getAttributeById({
        params: {
          attributeId,
        },
        headers,
      });

      return toM2MGatewayApiCertifiedDiscreteAttribute({
        attribute: response.data,
        logger,
        mapThrownErrorsToNotFound: true,
      });
    },
    async getDeclaredAttribute(
      attributeId: string,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.DeclaredAttribute> {
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
    ): Promise<m2mGatewayApiV3.VerifiedAttribute> {
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
      seed: m2mGatewayApiV3.CertifiedAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.CertifiedAttribute> {
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
    async createCertifiedDiscreteAttribute(
      seed: m2mGatewayApiV3.CertifiedDiscreteAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.CertifiedDiscreteAttribute> {
      logger.info(
        `Creating certified discrete attribute with code ${seed.code} and name ${seed.name}`
      );

      const response =
        await clients.attributeProcessClient.createCertifiedDiscreteAttribute(
          seed,
          {
            headers,
          }
        );

      const polledResource = await pollAttribute(response, headers);

      return toM2MGatewayApiCertifiedDiscreteAttribute({
        attribute: polledResource.data,
        logger,
      });
    },
    async createVerifiedAttribute(
      seed: m2mGatewayApiV3.VerifiedAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.VerifiedAttribute> {
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
      { limit, offset }: m2mGatewayApiV3.GetCertifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.CertifiedAttributes> {
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
    async getCertifiedDiscreteAttributes(
      {
        limit,
        offset,
      }: m2mGatewayApiV3.GetCertifiedDiscreteAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.CertifiedDiscreteAttributes> {
      logger.info(
        `Retrieving certified discrete attributes with limit ${limit} and offset ${offset}`
      );

      const response = await clients.attributeProcessClient.getAttributes({
        queries: toGetCertifiedDiscreteAttributesApiQueryParams({
          limit,
          offset,
        }),
        headers,
      });

      return {
        results: response.data.results.map((attribute) =>
          toM2MGatewayApiCertifiedDiscreteAttribute({ attribute, logger })
        ),
        pagination: {
          limit,
          offset,
          totalCount: response.data.totalCount,
        },
      };
    },
    async getDeclaredAttributes(
      { limit, offset }: m2mGatewayApiV3.GetDeclaredAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.DeclaredAttributes> {
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
      { limit, offset }: m2mGatewayApiV3.GetVerifiedAttributesQueryParams,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.VerifiedAttributes> {
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
      seed: m2mGatewayApiV3.DeclaredAttributeSeed,
      { headers, logger }: WithLogger<M2MGatewayAppContext>
    ): Promise<m2mGatewayApiV3.DeclaredAttribute> {
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
