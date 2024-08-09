import { catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { catalogApiDescriptorState } from "./api/apiTypes.js";

/* 
  This file contains commons utility functions 
  used to pick or transform data from model to another.
*/

const activeDescriptorStatesFilter: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.PUBLISHED,
  catalogApiDescriptorState.SUSPENDED,
  catalogApiDescriptorState.DEPRECATED,
];

export function getLatestActiveDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter((d) => activeDescriptorStatesFilter.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
}

export function getNotDraftDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor[] {
  return eservice.descriptors.filter(
    (d) => d.state !== catalogApiDescriptorState.DRAFT
  );
}

export function getTenantEmail(
  tenant: tenantApi.Tenant
): tenantApi.Mail | undefined {
  return tenant.mails.find(
    (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
  );
}
