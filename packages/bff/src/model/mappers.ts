import {
  agreementApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { descriptorApiState } from "./api/catalogTypes.js";
import { agreementApiState } from "./api/agreementTypes.js";

/* 
  This file contains commons utility functions 
  used to pick or transform data from model to another.
*/

const ACTIVE_DESCRIPTOR_STATES_FILTER = [
  descriptorApiState.PUBLISHED,
  descriptorApiState.SUSPENDED,
  descriptorApiState.DEPRECATED,
];

export function getLatestAcriveDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter((d) => ACTIVE_DESCRIPTOR_STATES_FILTER.includes(d.state))
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
}

export function getTenantEmail(
  tenant: tenantApi.Tenant
): tenantApi.Mail | undefined {
  return tenant.mails.find(
    (m) => m.kind === tenantApi.MailKind.Values.CONTACT_EMAIL
  );
}

export function isUpgradable(
  eservice: catalogApi.EService,
  agreement: agreementApi.Agreement
): boolean {
  const eserviceDescriptor = eservice.descriptors.find(
    (e) => e.id === agreement.descriptorId
  );

  return (
    eserviceDescriptor !== undefined &&
    eservice.descriptors
      .filter((d) => Number(d.version) > Number(eserviceDescriptor.version))
      .find(
        (d) =>
          (d.state === descriptorApiState.PUBLISHED ||
            d.state === descriptorApiState.SUSPENDED) &&
          (agreement.state === agreementApiState.ACTIVE ||
            agreement.state === agreementApiState.SUSPENDED)
      ) !== undefined
  );
}
