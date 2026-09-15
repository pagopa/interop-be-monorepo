import { tenantApi } from "pagopa-interop-api-clients";
import {
  TenantRevoker,
  TenantVerifier,
  generateId,
  tenantKind,
} from "pagopa-interop-models";

export {
  getMockAgreement,
  getMockVerifiedTenantAttribute,
  getMockCertifiedTenantAttribute,
} from "pagopa-interop-commons-test";

export const currentDate = new Date();

export const getMockVerifiedBy = (): TenantVerifier => ({
  id: generateId(),
  verificationDate: currentDate,
});

export const getMockRevokedBy = (): TenantRevoker => ({
  id: generateId(),
  verificationDate: currentDate,
  revocationDate: currentDate,
});

export const getMockMaintenanceTenantUpdate =
  (): tenantApi.MaintenanceTenantUpdate => ({
    selfcareId: generateId(),
    externalId: {
      value: generateId(),
      origin: "IPA",
    },
    mails: [],
    name: "A tenant",
    kind: tenantKind.PA,
    selfcareInstitutionType: "SCP",
    onboardedAt: new Date().toISOString(),
  });
