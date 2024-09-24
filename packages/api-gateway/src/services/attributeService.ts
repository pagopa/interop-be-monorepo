import {
  apiGatewayApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { AttributeProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";
import { toApiGatewayAttribute } from "../api/attributeApiConverter.js";

export async function getAllBulkAttributes(
  attributeProcessClient: AttributeProcessClient,
  headers: ApiGatewayAppContext["headers"],
  attributeIds: Array<attributeRegistryApi.Attribute["id"]>
): Promise<attributeRegistryApi.Attribute[]> {
  return await getAllFromPaginated<attributeRegistryApi.Attribute>(
    async (offset, limit) =>
      await attributeProcessClient.getBulkedAttributes(attributeIds, {
        headers,
        queries: {
          offset,
          limit,
        },
      })
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeServiceBuilder(
  attributeProcessClient: AttributeProcessClient
) {
  return {
    getAttribute: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      attributeId: attributeRegistryApi.Attribute["id"]
    ): Promise<apiGatewayApi.Attribute> => {
      logger.info(`Retrieving attribute ${attributeId}`);

      const attribute = await attributeProcessClient.getAttributeById({
        headers,
        params: {
          attributeId,
        },
      });

      return toApiGatewayAttribute(attribute);
    },
    createCertifiedAttribute: async (
      { logger, headers }: WithLogger<ApiGatewayAppContext>,
      attributeSeed: apiGatewayApi.AttributeSeed
    ): Promise<apiGatewayApi.Attribute> => {
      logger.info(
        `Creating certified attribute with code ${attributeSeed.code}`
      );

      const attribute = await attributeProcessClient.createCertifiedAttribute(
        {
          code: attributeSeed.code,
          name: attributeSeed.name,
          description: attributeSeed.description,
        },
        {
          headers,
        }
      );

      return toApiGatewayAttribute(attribute);
    },
  };
}
