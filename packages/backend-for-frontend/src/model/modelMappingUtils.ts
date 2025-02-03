import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { getLatestTenantMailOfKind } from "pagopa-interop-commons";
import {
  fromApiTenantMail,
  toBffTenantMail,
} from "../api/tenantApiConverter.js";
import { catalogApiDescriptorState } from "./types.js";

/*
  This file contains commons utility functions
  used to pick or transform data from model to another.
*/

const activeDescriptorStatesFilter: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.PUBLISHED,
  catalogApiDescriptorState.SUSPENDED,
  catalogApiDescriptorState.DEPRECATED,
];

const invalidDescriptorState: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.DRAFT,
  catalogApiDescriptorState.WAITING_FOR_APPROVAL,
];

export function getLatestActiveDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter((d) => activeDescriptorStatesFilter.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
}

export function getValidDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor[] {
  return eservice.descriptors.filter(
    (d) => !invalidDescriptorState.includes(d.state)
  );
}

export function getLatestTenantContactEmail(
  tenant: tenantApi.Tenant
): bffApi.Mail | undefined {
  const mail = getLatestTenantMailOfKind(
    tenant.mails.map(fromApiTenantMail),
    tenantApi.MailKind.Values.CONTACT_EMAIL
  );

  return mail ? toBffTenantMail(mail) : undefined;
}
