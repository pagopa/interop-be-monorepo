import { TenantId, SelfcareId, unsafeBrandId } from "pagopa-interop-models";
import { eq } from "drizzle-orm";
import {
  DrizzleReturnType,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
}: {
  readModelDB: DrizzleReturnType;
}) {
  return {
    getTenantIdBySelfcareId: async (
      selfcareId: SelfcareId
    ): Promise<TenantId | undefined> => {
      const [tenant] = await readModelDB
        .select({ id: tenantInReadmodelTenant.id })
        .from(tenantInReadmodelTenant)
        .where(eq(tenantInReadmodelTenant.selfcareId, selfcareId));

      return tenant ? unsafeBrandId<TenantId>(tenant.id) : undefined;
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
