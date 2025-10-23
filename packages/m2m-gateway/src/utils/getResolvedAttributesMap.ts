import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { getAllFromPaginated } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "./context.js";

export async function getResolvedAttributesMap(
  attributeIds: string[],
  headers: M2MGatewayAppContext["headers"],
  clients: PagoPAInteropBeClients
): Promise<Map<string, attributeRegistryApi.Attribute>> {
  if (attributeIds.length === 0) {
    return new Map();
  }

  const bulkResult: attributeRegistryApi.Attribute[] =
    await getAllFromPaginated<attributeRegistryApi.Attribute>(
      async (offset, limit) =>
        (
          await clients.attributeProcessClient.getBulkedAttributes(
            attributeIds,
            {
              headers,
              queries: {
                offset,
                limit,
              },
            }
          )
        ).data
    );

  return new Map(bulkResult.map((attr) => [attr.id, attr]));
}
