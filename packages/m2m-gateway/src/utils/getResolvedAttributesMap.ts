import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { PagoPAInteropBeClients } from "../clients/clientsProvider.js";
import { M2MGatewayAppContext } from "./context.js";

export async function getResolvedAttributesMap(
  attributeIds: string[],
  headers: M2MGatewayAppContext["headers"],
  clients: PagoPAInteropBeClients,
  offset: number,
  limit: number
): Promise<Map<string, attributeRegistryApi.Attribute>> {
  if (attributeIds.length === 0) {
    return new Map();
  }

  const bulkResult = await clients.attributeProcessClient.getBulkedAttributes(
    attributeIds,
    {
      headers,
      queries: {
        offset,
        limit,
      },
    }
  );
  return new Map(bulkResult.data.results.map((attr) => [attr.id, attr]));
}
