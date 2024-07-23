import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "../providers/clientProvider.js";
import { BffAppContext } from "./context.js";

export async function getBulkAttributes(
  ids: string[],
  attributeProcess: PagoPAInteropBeClients["attributeProcessClient"],
  { headers }: WithLogger<BffAppContext>
): Promise<attributeRegistryApi.Attribute[]> {
  async function getAttributesFrom(
    offset: number
  ): Promise<attributeRegistryApi.Attribute[]> {
    const response = await attributeProcess.getBulkedAttributes(ids, {
      queries: { offset, limit: 50 },
      headers,
    });
    return response.results;
  }

  async function aggregate(
    start: number,
    attributes: attributeRegistryApi.Attribute[]
  ): Promise<attributeRegistryApi.Attribute[]> {
    const attrs = await getAttributesFrom(start);
    if (attrs.length < 50) {
      return attributes.concat(attrs);
    } else {
      return aggregate(start + 50, attributes.concat(attrs));
    }
  }

  return aggregate(0, []);
}
