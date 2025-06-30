import { tenantApi } from "pagopa-interop-api-clients";
import {
  Agreement,
  CertifiedTenantAttribute,
  TenantId,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  generateId,
  tenantAttributeType,
  EServiceId,
  DescriptorId,
  agreementState,
  tenantKind,
} from "pagopa-interop-models";

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

export const getMockVerifiedTenantAttribute = (): VerifiedTenantAttribute => ({
  id: generateId(),
  type: tenantAttributeType.VERIFIED,
  assignmentTimestamp: new Date(),
  verifiedBy: [],
  revokedBy: [],
});

export const getMockCertifiedTenantAttribute =
  (): CertifiedTenantAttribute => ({
    assignmentTimestamp: currentDate,
    id: generateId(),
    type: tenantAttributeType.CERTIFIED,
    revocationTimestamp: undefined,
  });

export const getMockAgreement = ({
  eserviceId,
  descriptorId,
  producerId,
  consumerId,
}: {
  eserviceId: EServiceId;
  descriptorId: DescriptorId;
  producerId: TenantId;
  consumerId: TenantId;
}): Agreement => ({
  id: generateId(),
  createdAt: new Date(),
  eserviceId,
  descriptorId,
  producerId,
  consumerId,
  state: agreementState.active,
  verifiedAttributes: [],
  certifiedAttributes: [],
  declaredAttributes: [],
  consumerDocuments: [],
  stamps: {
    submission: undefined,
    activation: undefined,
    rejection: undefined,
    suspensionByProducer: undefined,
    suspensionByConsumer: undefined,
    upgrade: undefined,
    archiving: undefined,
  },
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
    onboardedAt: new Date().toISOString(),
  });
