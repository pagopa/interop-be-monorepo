import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { getAllFromPaginated, WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";

export async function getBulkAttributes(
  ids: string[],
  attributeProcess: PagoPAInteropBeClients["attributeProcessClient"],
  { headers }: WithLogger<BffAppContext>
): Promise<attributeRegistryApi.Attribute[]> {
  return getAllFromPaginated((offset, limit) =>
    attributeProcess.getBulkedAttributes(ids, {
      queries: { offset, limit },
      headers,
    })
  );
}
