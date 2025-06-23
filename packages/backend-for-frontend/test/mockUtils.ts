import {
  bffApi,
  delegationApi,
  eserviceTemplateApi,
} from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  DelegationId,
  EServiceTemplateId,
  PurposeId,
  PurposeVersionId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { GetSessionTokenReturnType } from "../src/services/authorizationService.js";

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

export const getMockGetSessionTokenReturnType =
  (): GetSessionTokenReturnType => ({
    limitReached: false,
    sessionToken: generateMock(bffApi.SessionToken),
    rateLimiterStatus: {
      maxRequests: 10,
      rateInterval: 10,
      remainingRequests: 10,
    },
  });

export const getMockBffApiIdentityToken = (): bffApi.IdentityToken => ({
  identity_token: generateMock(z.string()),
});

export const getMockBffApiGoogleSAMLPayload = (): bffApi.GoogleSAMLPayload => ({
  SAMLResponse: generateMock(z.string()),
  RelayState: generateMock(z.string().nullish()),
});

export const getMockBffApiDelegationSeed = (): bffApi.DelegationSeed => ({
  eserviceId: generateId(),
  delegateId: generateId(),
});

export const getMockBffApiCreatedResource = (
  id = generateId()
): bffApi.CreatedResource => ({
  id,
});

export const getMockBffApiRejectDelegationPayload =
  (): bffApi.RejectDelegationPayload => ({
    rejectionReason: "reason",
  });

export const getMockBffApiDelegationTenant = (): bffApi.DelegationTenant => ({
  id: generateId(),
  name: generateMock(z.string()),
});

export const getMockBffApiCompactEService = (): bffApi.CompactEService => ({
  id: generateId(),
  name: generateMock(z.string()),
  producer: generateMock(bffApi.CompactOrganization),
});

export const getMockBffApiEServiceTemplateSeed =
  (): bffApi.EServiceTemplateSeed => ({
    name: generateMock(z.string().min(5).max(60)),
    intendedTarget: generateMock(z.string().min(10).max(250)),
    description: generateMock(z.string().min(10).max(250)),
    technology: generateMock(bffApi.EServiceTechnology),
    mode: generateMock(bffApi.EServiceMode),
    version: generateMock(
      bffApi.VersionSeedForEServiceTemplateCreation.optional()
    ),
    isSignalHubEnabled: generateMock(z.boolean().optional()),
  });

export const getMockBffApiEServiceTemplateApiEServiceTemplate =
  (): eserviceTemplateApi.EServiceTemplate => ({
    id: generateId(),
    creatorId: generateId(),
    name: generateMock(z.string()),
    intendedTarget: generateMock(z.string()),
    description: generateMock(z.string()),
    technology: generateMock(eserviceTemplateApi.EServiceTechnology),
    versions: generateMock(
      z.array(eserviceTemplateApi.EServiceTemplateVersion)
    ),
    riskAnalysis: generateMock(
      z.array(eserviceTemplateApi.EServiceTemplateRiskAnalysis)
    ),
    mode: generateMock(eserviceTemplateApi.EServiceMode),
    isSignalHubEnabled: generateMock(z.boolean().optional()),
  });

export const getMockBffApiEServiceTemplateDetails =
  (): bffApi.EServiceTemplateDetails & { id: EServiceTemplateId } => ({
    id: generateId(),
    creator: generateMock(bffApi.CompactOrganization),
    name: generateMock(z.string()),
    intendedTarget: generateMock(z.string()),
    description: generateMock(z.string()),
    technology: generateMock(bffApi.EServiceTechnology),
    versions: generateMock(z.array(bffApi.CompactEServiceTemplateVersion)),
    riskAnalysis: generateMock(z.array(bffApi.EServiceTemplateRiskAnalysis)),
    mode: generateMock(bffApi.EServiceMode),
    isSignalHubEnabled: generateMock(z.boolean()),
    draftVersion: generateMock(
      bffApi.CompactEServiceTemplateVersion.optional()
    ),
  });

export const getMockBffApiEServiceTemplateUpdateSeed =
  (): bffApi.UpdateEServiceTemplateSeed => ({
    name: generateMock(z.string().min(5).max(60)),
    intendedTarget: generateMock(z.string().min(10).max(250)),
    description: generateMock(z.string().min(10).max(250)),
    technology: generateMock(bffApi.EServiceTechnology),
    mode: generateMock(bffApi.EServiceMode),
    isSignalHubEnabled: generateMock(z.boolean()),
  });

export const getMockBffApiUpdateEServiceTemplateVersionSeed =
  (): bffApi.UpdateEServiceTemplateVersionSeed => ({
    description: generateMock(z.string().min(10).max(250).optional()),
    voucherLifespan: generateMock(z.number().int().gte(60).lte(86400)),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(1).optional()),
    dailyCallsTotal: generateMock(z.number().int().gte(1).optional()),
    agreementApprovalPolicy: generateMock(
      bffApi.AgreementApprovalPolicy.optional()
    ),
    attributes: generateMock(bffApi.EServiceTemplateAttributesSeed),
  });

export const getMockBffApiMockEServiceTemplateNameUpdateSeed =
  (): bffApi.EServiceTemplateNameUpdateSeed => ({
    name: generateMock(z.string()),
  });

export const getMockBffApiMockEServiceTemplateIntendedTargetUpdateSeed =
  (): bffApi.EServiceTemplateIntendedTargetUpdateSeed => ({
    intendedTarget: generateMock(z.string()),
  });

export const getMockBffApiMockEServiceTemplateDescriptionUpdateSeed =
  (): bffApi.EServiceTemplateDescriptionUpdateSeed => ({
    description: generateMock(z.string()),
  });

export const getMockBffApiEServiceTemplateVersionDetails =
  (): bffApi.EServiceTemplateVersionDetails => ({
    id: generateId(),
    version: generateMock(z.number().int()),
    description: generateMock(z.string().optional()),
    voucherLifespan: generateMock(z.number().int()),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(1).optional()),
    dailyCallsTotal: generateMock(z.number().int().gte(1).optional()),
    interface: generateMock(bffApi.EServiceDoc.optional()),
    docs: generateMock(z.array(bffApi.EServiceDoc)),
    state: generateMock(bffApi.EServiceTemplateVersionState),
    agreementApprovalPolicy: generateMock(
      bffApi.AgreementApprovalPolicy.optional()
    ),
    attributes: generateMock(bffApi.DescriptorAttributes),
    eserviceTemplate: generateMock(bffApi.EServiceTemplateDetails),
    isAlreadyInstantiated: generateMock(z.boolean()),
    hasRequesterRiskAnalysis: generateMock(z.boolean().optional()),
  });

export const getMockBffApiCatalogEServiceTemplate =
  (): bffApi.CatalogEServiceTemplate => ({
    id: generateId(),
    name: generateMock(z.string()),
    description: generateMock(z.string()),
    creator: generateMock(bffApi.CompactOrganization),
    publishedVersion: generateMock(bffApi.CompactEServiceTemplateVersion),
  });

export const getMockBffApiProducerEServiceTemplate =
  (): bffApi.ProducerEServiceTemplate => ({
    id: generateId(),
    name: generateMock(z.string()),
    mode: generateMock(bffApi.EServiceMode),
    activeVersion: generateMock(
      bffApi.CompactEServiceTemplateVersion.optional()
    ),
    draftVersion: generateMock(
      bffApi.CompactEServiceTemplateVersion.optional()
    ),
  });

export const getMockBffApiEServiceTemplateVersionQuotasUpdateSeed =
  (): bffApi.EServiceTemplateVersionQuotasUpdateSeed => ({
    voucherLifespan: generateMock(z.number().int().gte(60).lte(86400)),
    dailyCallsPerConsumer: generateMock(z.number().gte(1).optional()),
    dailyCallsTotal: generateMock(z.number().gte(1).optional()),
  });

export const getMockBffApiEServiceTemplateRiskAnalysisSeed =
  (): bffApi.EServiceTemplateRiskAnalysisSeed => ({
    name: generateMock(z.string()),
    riskAnalysisForm: generateMock(bffApi.RiskAnalysisFormSeed),
    tenantKind: generateMock(bffApi.TenantKind),
  });

export const getMockBffApiDescriptorAttributesSeed =
  (): bffApi.DescriptorAttributesSeed => ({
    certified: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
    declared: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
    verified: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
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

export const getMockBffApiUpdateEServiceTemplateVersionDocumentSeed =
  (): bffApi.UpdateEServiceTemplateVersionDocumentSeed => ({
    prettyName: generateMock(z.string().min(5).max(60)),
  });

export const getMockDelegationApiDelegation = (): delegationApi.Delegation & {
  id: DelegationId;
} => ({
  id: generateId(),
  delegatorId: generateId(),
  delegateId: generateId(),
  eserviceId: generateId(),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  updatedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  rejectionReason: generateMock(z.string().optional()),
  state: generateMock(delegationApi.DelegationState),
  kind: generateMock(delegationApi.DelegationKind),
  activationContract: generateMock(
    delegationApi.DelegationContractDocument.optional()
  ),
  revocationContract: generateMock(
    delegationApi.DelegationContractDocument.optional()
  ),
  stamps: generateMock(delegationApi.DelegationStamps),
});

export const getMockBffApiCreateEServiceDocumentBody =
  (): bffApi.createEServiceDocument_Body => ({
    kind: generateMock(z.enum(["INTERFACE", "DOCUMENT"])),
    prettyName: generateMock(z.string()),
    doc: new File(["content"], "doc.txt"),
  });
