import { TenantItemsSchema } from "pagopa-interop-kpi-models";
import { Tenant } from "pagopa-interop-models";
import { splitTenantIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";

/**
 * Splits a tenant into the rows upserted by the V2 and V3 tenant handlers.
 */
export function toTenantItems(
  tenant: Tenant,
  metadataVersion: number
): TenantItemsSchema {
  const splitResult = splitTenantIntoObjectsSQL(tenant, metadataVersion);

  return TenantItemsSchema.parse({
    tenantSQL: splitResult.tenantSQL,
    mailsSQL: splitResult.mailsSQL,
    certifiedAttributesSQL: splitResult.certifiedAttributesSQL,
    declaredAttributesSQL: splitResult.declaredAttributesSQL,
    verifiedAttributesSQL: splitResult.verifiedAttributesSQL,
    verifiedAttributeVerifiersSQL: splitResult.verifiedAttributeVerifiersSQL,
    verifiedAttributeRevokersSQL: splitResult.verifiedAttributeRevokersSQL,
    featuresSQL: splitResult.featuresSQL,
    remoteIdsSQL: splitResult.remoteIdsSQL,
    certifiedDiscreteAttributesSQL: splitResult.certifiedDiscreteAttributesSQL,
  } satisfies z.input<typeof TenantItemsSchema>);
}
