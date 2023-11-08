import { Tenant, WithMetadata } from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantQueryBuilder(readModelService: ReadModelService) {
  return {
    getTenantById: async (
      id: string
    ): Promise<WithMetadata<Tenant> | undefined> =>
      await readModelService.getTenantById(id),
  };
}

export type TenantQuery = ReturnType<typeof tenantQueryBuilder>;
