import { and, eq } from "drizzle-orm";
import {
  Attribute,
  attributeKind,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
} from "pagopa-interop-models";
import {
  AttributeReadModelService,
  TenantReadModelService,
} from "pagopa-interop-readmodel";
import {
  attributeInReadmodelAttribute,
  DrizzleReturnType,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  readModelDB: DrizzleReturnType;
  attributeReadModelServiceSQL: AttributeReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {
    getIPATenants: async (): Promise<Tenant[]> =>
      await readModelDB.transaction(async (tx) => {
        const queryRes = await tx
          .select({ id: tenantInReadmodelTenant.id })
          .from(tenantInReadmodelTenant)
          .where(
            eq(
              tenantInReadmodelTenant.externalIdOrigin,
              PUBLIC_ADMINISTRATIONS_IDENTIFIER
            )
          );

        const tenantIds = queryRes.map((entry) => entry.id);

        const tenantsWithMetadata =
          await tenantReadModelServiceSQL.getTenantsByIds(tenantIds, tx);
        return tenantsWithMetadata.map((tenant) => tenant.data);
      }),
    getAttributes: async (): Promise<Attribute[]> =>
      (
        await attributeReadModelServiceSQL.getAttributesByFilter(
          and(
            eq(attributeInReadmodelAttribute.kind, attributeKind.certified),
            eq(
              attributeInReadmodelAttribute.origin,
              PUBLIC_ADMINISTRATIONS_IDENTIFIER
            )
          )
        )
      ).map((a) => a.data),
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
