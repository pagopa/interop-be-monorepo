import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { agreementApi, bffApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  PurposeId,
  PurposeVersionId,
  generateId,
  TenantId,
} from "pagopa-interop-models";

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

export const getMockApiAddAgreementConsumerDocument_Body =
  (): bffApi.addAgreementConsumerDocument_Body => ({
    name: "name",
    prettyName: "pretty name",
    doc: new File([], "file name"),
  });

export const getMockBffApiAgreementListEntry =
  (): bffApi.AgreementListEntry => ({
    id: generateId(),
    consumer: generateMock(bffApi.CompactOrganization),
    eservice: generateMock(bffApi.CompactEService),
    state: generateMock(bffApi.AgreementState),
    canBeUpgraded: generateMock(z.boolean()),
    suspendedByConsumer: generateMock(z.boolean().optional()),
    suspendedByPlatform: generateMock(z.boolean().optional()),
    suspendedByProducer: generateMock(z.boolean().optional()),
    descriptor: generateMock(bffApi.CompactDescriptor),
    delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
  });

export const getMockBffApiAgreement = (): bffApi.Agreement & {
  id: AgreementId;
} => ({
  id: generateId(),
  descriptorId: generateId(),
  delegation: {
    id: generateId(),
    delegate: generateMock(bffApi.CompactOrganization),
  },
  producer: generateMock(bffApi.CompactOrganization),
  consumer: generateMock(bffApi.Tenant),
  eservice: generateMock(bffApi.AgreementsEService),
  state: generateMock(bffApi.AgreementState),
  verifiedAttributes: generateMock(z.array(bffApi.VerifiedAttribute)),
  certifiedAttributes: generateMock(z.array(bffApi.CertifiedAttribute)),
  declaredAttributes: generateMock(z.array(bffApi.DeclaredAttribute)),
  suspendedByConsumer: generateMock(z.boolean().optional()),
  suspendedByPlatform: generateMock(z.boolean().optional()),
  suspendedByProducer: generateMock(z.boolean().optional()),
  isContractPresent: generateMock(z.boolean()),
  consumerNotes: generateMock(z.string().optional()),
  rejectionReason: generateMock(z.string().optional()),
  consumerDocuments: generateMock(z.array(bffApi.Document)),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  updatedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  suspendedAt: generateMock(z.string().datetime({ offset: true }).optional()),
});

export const getMockBffApiAddAgreementConsumerDocumentBody =
  (): bffApi.addAgreementConsumerDocument_Body => ({
    name: generateMock(z.string()),
    prettyName: generateMock(z.string()),
    doc: new File(["content"], "doc.txt"),
  });

export const getMockBffApiAgreementPayload = (): bffApi.AgreementPayload => ({
  eserviceId: generateId(),
  descriptorId: generateId(),
  delegationId: generateMock(z.string().uuid().optional()),
});

export const getMockBffApiCreatedResource = (
  id: string = generateId()
): bffApi.CreatedResource => ({
  id,
});

export const getMockAgreementApiCompactEService =
  (): agreementApi.CompactEService => ({
    id: generateId(),
    name: generateMock(z.string()),
  });

export const getMockBffApiAgreementSubmissionPayload =
  (): bffApi.AgreementSubmissionPayload => ({
    consumerNotes: generateMock(z.string().optional()),
  });

export const getMockBffApiAgreementRejectionPayload =
  (): bffApi.AgreementRejectionPayload => ({
    reason: generateMock(z.string()),
  });

export const getMockBffApiAgreementUpdatePayload =
  (): bffApi.AgreementUpdatePayload => ({
    consumerNotes: generateMock(z.string()),
  });

export const getMockBffApiHasCertifiedAttributes =
  (): bffApi.HasCertifiedAttributes => ({
    hasCertifiedAttributes: generateMock(z.boolean()),
  });

export const getMockAgreementApiCompactOrganization =
  (): agreementApi.CompactOrganization => ({
    id: generateId(),
    name: generateMock(z.string()),
  });

export const toBffCompactEServiceLight = (
  compactEService: agreementApi.CompactEService
): bffApi.CompactEServiceLight => ({
  id: compactEService.id,
  name: compactEService.name,
});
