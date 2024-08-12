import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { getAllFromPaginated } from "pagopa-interop-commons";
import { AttributeProcessClient } from "../clients/clientsProvider.js";
import { ApiGatewayAppContext } from "../utilities/context.js";

// TODO align other getAll functions to this one
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
