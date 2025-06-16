import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { agreementApi, bffApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  DelegationId,
  PurposeId,
  PurposeVersionId,
  DescriptorId,
  EServiceId,
  generateId,
  TenantId,
} from "pagopa-interop-models";
import { CompactDescriptor } from "../../api-clients/dist/bffApi.js";

export const getMockBffApiPurpose = (): bffApi.Purpose & { id: PurposeId } => ({
  id: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  consumer: generateMock(bffApi.CompactOrganization),
  riskAnalysisForm: generateMock(bffApi.RiskAnalysisForm.optional()),
  eservice: generateMock(bffApi.CompactPurposeEService),
  agreement: generateMock(bffApi.CompactAgreement),
  currentVersion: generateMock(bffApi.PurposeVersion.optional()),
  versions: generateMock(z.array(bffApi.PurposeVersion)),
  clients: generateMock(z.array(bffApi.CompactClient)),
  waitingForApprovalVersion: generateMock(bffApi.PurposeVersion.optional()),
  rejectedVersion: generateMock(bffApi.PurposeVersion.optional()),
  suspendedByConsumer: generateMock(z.boolean().optional()),
  suspendedByProducer: generateMock(z.boolean().optional()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCallsPerConsumer: generateMock(z.number().int()),
  dailyCallsTotal: generateMock(z.number().int()),
  delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
});

export const getMockBffApiRiskAnalysisFormConfig =
  (): bffApi.RiskAnalysisFormConfig => ({
    version: generateMock(z.string()),
    questions: generateMock(z.array(bffApi.FormConfigQuestion)),
  });

export const getMockBffApiPurposeUpdateContent =
  (): bffApi.PurposeUpdateContent => ({
    title: generateMock(z.string()),
    description: generateMock(z.string()),
    isFreeOfCharge: generateMock(z.boolean()),
    freeOfChargeReason: generateMock(z.string().optional()),
    dailyCalls: generateMock(z.number().int().min(0)),
  });

export const getMockBffApiPurposeVersionResource = (
  purposeId: PurposeId = generateId(),
  versionId: PurposeVersionId = generateId()
): bffApi.PurposeVersionResource & {
  purposeId: PurposeId;
  versionId: PurposeVersionId;
} => ({
  purposeId,
  versionId,
});

export const getMockPurposeSeed = (): bffApi.PurposeSeed => ({
  eserviceId: generateId(),
  consumerId: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCalls: generateMock(z.number().int().min(0)),
});

export const getMockReversePurposeSeed = (): bffApi.PurposeEServiceSeed => ({
  eserviceId: generateId(),
  consumerId: generateId(),
  riskAnalysisId: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCalls: generateMock(z.number().int().min(0)),
});

export const getMockBffApiMailSeed = (): bffApi.MailSeed => ({
  kind: generateMock(bffApi.MailKind),
  address: generateMock(z.string()),
  description: generateMock(z.string().optional()),
});

export const getMockBffApiTenantDelegatedFeaturesFlagsUpdateSeed =
  (): bffApi.TenantDelegatedFeaturesFlagsUpdateSeed => ({
    isDelegatedConsumerFeatureEnabled: generateMock(z.boolean()),
    isDelegatedProducerFeatureEnabled: generateMock(z.boolean()),
  });

export const getMockBffApiVerifiedTenantAttributeSeed =
  (): bffApi.VerifiedTenantAttributeSeed => ({
    id: generateId(),
    agreementId: generateId(),
    expirationDate: generateMock(
      z.string().datetime({ offset: true }).optional()
    ),
  });

export const getMockBffApiTenant = (): bffApi.Tenant & { id: TenantId } => ({
  id: generateId(),
  selfcareId: generateMock(z.string().uuid().optional()),
  kind: generateMock(bffApi.TenantKind.optional()),
  externalId: generateMock(bffApi.ExternalId),
  features: generateMock(z.array(bffApi.TenantFeature)),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  updatedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  name: generateMock(z.string()),
  attributes: generateMock(bffApi.TenantAttributes),
  contactMail: generateMock(bffApi.Mail.optional()),
  onboardedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  subUnitType: generateMock(bffApi.TenantUnitType.optional()),
});

export const getMockBffApiCompactTenant = (): bffApi.CompactTenant => ({
  id: generateId(),
  selfcareId: generateMock(z.string().optional()),
  name: generateMock(z.string()),
  logoUrl: generateMock(z.string().optional()),
});

export const getMockBffApiVerifiedAttributesResponse =
  (): bffApi.VerifiedAttributesResponse => ({
    attributes: generateMock(
      z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string(),
          assignmentTimestamp: z.string().datetime({ offset: true }),
          verifiedBy: z.array(bffApi.TenantVerifier),
          revokedBy: z.array(bffApi.TenantRevoker),
        })
      )
    ),
  });

export const getMockBffApiDeclaredAttributesResponse =
  (): bffApi.DeclaredAttributesResponse => ({
    attributes: generateMock(
      z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string(),
          assignmentTimestamp: z.string().datetime({ offset: true }),
          revocationTimestamp: z.string().datetime({ offset: true }).optional(),
          delegationId: z.string().uuid().optional(),
        })
      )
    ),
  });

export const getMockBffApiCertifiedAttributesResponse =
  (): bffApi.CertifiedAttributesResponse => ({
    attributes: generateMock(
      z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string(),
          assignmentTimestamp: z.string().datetime({ offset: true }),
          revocationTimestamp: z.string().datetime({ offset: true }).optional(),
        })
      )
    ),
  });

export const getMockBffApiRequesterCertifiedAttribute =
  (): bffApi.RequesterCertifiedAttribute => ({
    tenantId: generateId(),
    tenantName: generateMock(z.string()),
    attributeId: generateId(),
    attributeName: generateMock(z.string()),
  });

export const getMockBffApiCompactOrganization =
  (): bffApi.CompactOrganization => ({
    id: generateId(),
    name: generateMock(z.string()),
    kind: generateMock(bffApi.TenantKind.optional()),
    contactMail: generateMock(bffApi.Mail.optional()),
  });

// export const getMockApiAgreementListEntry = (): bffApi.AgreementListEntry => ({
//   id: generateId(),
//   consumer: getMockTenant(),
//   eservice: getMockEService(),
//   canBeUpgraded: false,
//   descriptor: getMockDescriptor(),
//   state: "DRAFT",
// });

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
