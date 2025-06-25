import { delegationApi } from "pagopa-interop-api-clients";
import { EService, eserviceMode, Tenant } from "pagopa-interop-models";
import { match } from "ts-pattern";

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
  mode: match(eservice.mode)
    .with(eserviceMode.deliver, () => delegationApi.EServiceMode.Values.DELIVER)
    .with(eserviceMode.receive, () => delegationApi.EServiceMode.Values.RECEIVE)
    .exhaustive(),
});
