import { bffApi } from "pagopa-interop-api-clients";
import { WithLogger } from "pagopa-interop-commons";
import { TenantProcessClient } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";
import { toBffApiCompactOrganization } from "../model/domain/apiConverter.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(tenantProcessClient: TenantProcessClient) {
  return {
    async getConsumers(
      name: string | undefined,
      offset: number,
      limit: number,
      { headers }: WithLogger<BffAppContext>
    ): Promise<bffApi.CompactOrganizations> {
      const { results, totalCount } =
        await tenantProcessClient.tenant.getConsumers({
          queries: {
            name,
            offset,
            limit,
          },
          headers,
        });

      return {
        results: results.map(toBffApiCompactOrganization),
        pagination: {
          offset,
          limit,
          totalCount,
        },
      };
    },
  };
}
