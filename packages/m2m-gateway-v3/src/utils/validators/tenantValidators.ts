import { tenantApi } from "pagopa-interop-api-clients";

import { missingSelfcareId } from "../../model/errors.js";

export function assertTenantHasSelfcareId(
  tenant: tenantApi.Tenant
): asserts tenant is tenantApi.Tenant & { selfcareId: string } {
  if (!tenant.selfcareId) {
    throw missingSelfcareId(tenant.id);
  }
}
