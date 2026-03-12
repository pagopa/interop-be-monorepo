import { delegationApi } from "pagopa-interop-api-clients";
import { EService, Tenant } from "pagopa-interop-models";

export const tenantToApiCompactTenant = (
  tenant: Tenant
): delegationApi.CompactTenant => ({
  id: tenant.id,
  name: tenant.name,
});

export const eserviceToApiCompactEservice = (
  eservice: EService
): delegationApi.CompactEService => ({
  id: eservice.id,
  name: eservice.name,
  producerId: eservice.producerId,
});
