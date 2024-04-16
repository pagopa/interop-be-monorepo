import { Tenant } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantQueryBuilder(readModelService: ReadModelService) {
  return {
    getTenantById: async (
      id: string,
      logger: Logger
    ): Promise<Tenant | undefined> =>
      await readModelService.getTenantById(id, logger),
  };
}

export type TenantQuery = ReturnType<typeof tenantQueryBuilder>;
