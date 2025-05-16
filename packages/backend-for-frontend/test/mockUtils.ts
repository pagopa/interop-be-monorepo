import { agreementApi, bffApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  DelegationId,
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { CompactDescriptor } from "../../api-clients/dist/bffApi.js";

export const getMockApiAgreementListEntry = (): bffApi.AgreementListEntry => ({
  id: generateId(),
  consumer: getMockApiCompactOrganization(),
  eservice: getMockBffApiCompactEService(),
  canBeUpgraded: false,
  descriptor: getApiMockCompactDescriptor(),
  state: "DRAFT",
});

export const getMockApiAgreement = (): bffApi.Agreement => ({
  id: generateId<AgreementId>(),
  descriptorId: generateId<DescriptorId>(),
  delegation: {
    id: generateId<DelegationId>(),
    delegate: getMockApiCompactOrganization(),
  },
  producer: getMockApiCompactOrganization(),
  consumer: getMockApiTenant(),
  eservice: getMockApiAgreementsEService(),
  state: "ACTIVE",
  verifiedAttributes: [],
  certifiedAttributes: [],
  declaredAttributes: [],
  isContractPresent: true,
  consumerDocuments: [],
  createdAt: new Date().toISOString(),
});

export const getMockApiAddAgreementConsumerDocument_Body =
  (): bffApi.addAgreementConsumerDocument_Body => ({
    name: "name",
    prettyName: "pretty name",
    doc: new File([], "file name"),
  });

export const getMockApiAgreementPayload = (): bffApi.AgreementPayload => ({
  descriptorId: generateId<DescriptorId>(),
  eserviceId: generateId<EServiceId>(),
});

export const getMockApiCreatedResource = (
  id: string = generateId()
): bffApi.CreatedResource => ({
  id,
});

export const getMockAgreementApiCompactEService =
  (): agreementApi.CompactEService => ({
    id: generateId<EServiceId>(),
    name: "name",
  });

export const getMockApiCompactEServiceLight = (
  id: string = generateId<EServiceId>()
): bffApi.CompactEServiceLight => ({
  id,
  name: "name",
});

export const getMockApiAgreementSubmissionPayload =
  (): bffApi.AgreementSubmissionPayload => ({});

export const getMockApiAgreementRejectionPayload =
  (): bffApi.AgreementRejectionPayload => ({ reason: "reason" });

export const getMockApiAgreementUpdatePayload =
  (): bffApi.AgreementUpdatePayload => ({ consumerNotes: "notes" });

export const getMockApiHasCertifiedAttributes =
  (): bffApi.HasCertifiedAttributes => ({
    hasCertifiedAttributes: true,
  });

export const getMockAgreementApiCompactOrganization =
  (): agreementApi.CompactOrganization => ({
    id: generateId<TenantId>(),
    name: "name",
  });

const getMockApiAgreementsEService = (): bffApi.AgreementsEService => ({
  id: generateId<EServiceId>(),
  name: "name",
  version: "1.0",
});

const getMockApiTenant = (): bffApi.Tenant => ({
  id: generateId<TenantId>(),
  externalId: {
    origin: "origin",
    value: "value",
  },
  features: [],
  createdAt: new Date().toISOString(),
  name: "name",
  attributes: {
    declared: [],
    certified: [],
    verified: [],
  },
});

const getApiMockCompactDescriptor = (): CompactDescriptor => ({
  id: generateId<DescriptorId>(),
  audience: ["audience"],
  state: "DRAFT",
  version: "1.0",
});

const getMockApiCompactOrganization = (): bffApi.CompactOrganization => ({
  id: generateId<TenantId>(),
  name: "name",
});

const getMockBffApiCompactEService = (): bffApi.CompactEService => ({
  id: generateId<EServiceId>(),
  name: "name",
  producer: getMockApiCompactOrganization(),
});
