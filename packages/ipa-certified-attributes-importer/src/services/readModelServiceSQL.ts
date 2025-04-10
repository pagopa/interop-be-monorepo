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
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
}: {
  attributeReadModelServiceSQL: AttributeReadModelService;
  tenantReadModelServiceSQL: TenantReadModelService;
}) {
  return {
    getIPATenants: async (): Promise<Tenant[]> =>
      (
        await tenantReadModelServiceSQL.getTenantsByFilter(
          eq(
            tenantInReadmodelTenant.externalIdOrigin,
            PUBLIC_ADMINISTRATIONS_IDENTIFIER
          )
        )
      ).map((t) => t.data),
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
