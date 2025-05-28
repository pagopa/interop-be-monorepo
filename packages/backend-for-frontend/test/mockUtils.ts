import { bffApi, eserviceTemplateApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  EServiceId,
  EServiceTemplateId,
  EServiceTemplateVersionId,
  PurposeId,
  PurposeVersionId,
  TenantId,
  generateId,
} from "pagopa-interop-models";
import { RateLimiterStatus } from "pagopa-interop-commons";
import { EServiceRiskAnalysis } from "../../api-clients/dist/bffApi.js";

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

// Problema: questo tipo non è esportato
export const getMockGetSessionTokenReturnType = ():
  | {
    limitReached: true;
    sessionToken: undefined;
    rateLimitedTenantId: TenantId;
    rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
  }
  | {
    limitReached: false;
    sessionToken: bffApi.SessionToken;
    rateLimiterStatus: Omit<RateLimiterStatus, "limitReached">;
  } => ({
    limitReached: false,
    sessionToken: generateMock(bffApi.SessionToken),
    rateLimiterStatus: {
      maxRequests: 10,
      rateInterval: 10,
      remainingRequests: 10,
    },
  });

export const getMockIdentityToken = (): bffApi.IdentityToken => ({
  identity_token: generateMock(z.string()),
});

export const getMockGoogleSAMLPayload = (): bffApi.GoogleSAMLPayload => ({
  SAMLResponse: generateMock(z.string()),
  RelayState: generateMock(z.string().nullish()),
});

export const getMockDelegationSeed = (): bffApi.DelegationSeed => ({
  eserviceId: generateId<EServiceId>(),
  delegateId: generateId<TenantId>(),
});

export const getMockBffApiCreatedResource = (
  id = generateId()
): bffApi.CreatedResource => ({
  id,
});

export const getMockRejectDelegationPayload =
  (): bffApi.RejectDelegationPayload => ({
    rejectionReason: "reason",
  });

export const getMockDelegationTenant = (): bffApi.DelegationTenant => ({
  id: generateId<TenantId>(),
  name: generateMock(z.string()),
});

export const getMockCompactEService = (): bffApi.CompactEService => ({
  id: generateId<EServiceId>(),
  name: generateMock(z.string()),
  producer: generateMock(bffApi.CompactOrganization),
});

export const getMockEServiceTemplateSeed = (): bffApi.EServiceTemplateSeed => ({
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

export const getMockEServiceTemplateApiEServiceTemplate =
  (): eserviceTemplateApi.EServiceTemplate => ({
    id: generateId<EServiceTemplateId>(),
    creatorId: generateId(),
    name: generateMock(z.string()),
    intendedTarget: generateMock(z.string()),
    description: generateMock(z.string()),
    technology: generateMock(eserviceTemplateApi.EServiceTechnology),
    versions: generateMock(
      z.array(eserviceTemplateApi.EServiceTemplateVersion)
    ),
    riskAnalysis: generateMock(
      z.array(eserviceTemplateApi.EServiceRiskAnalysis)
    ),
    mode: generateMock(eserviceTemplateApi.EServiceMode),
    isSignalHubEnabled: generateMock(z.boolean().optional()),
  });

export const getMockBffApiEServiceTemplateDetails =
  (): bffApi.EServiceTemplateDetails => ({
    id: generateId<EServiceTemplateId>(),
    creator: generateMock(bffApi.CompactOrganization),
    name: generateMock(z.string()),
    intendedTarget: generateMock(z.string()),
    description: generateMock(z.string()),
    technology: generateMock(bffApi.EServiceTechnology),
    versions: generateMock(z.array(bffApi.CompactEServiceTemplateVersion)),
    riskAnalysis: generateMock(z.array(EServiceRiskAnalysis)),
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
    id: generateId<EServiceTemplateVersionId>(),
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
  });

export const getMockBffApiCatalogEServiceTemplate =
  (): bffApi.CatalogEServiceTemplate => ({
    id: generateId<EServiceTemplateId>(),
    name: generateMock(z.string()),
    description: generateMock(z.string()),
    creator: generateMock(bffApi.CompactOrganization),
    publishedVersion: generateMock(bffApi.CompactEServiceTemplateVersion),
  });

export const getMockBffApiProducerEServiceTemplate =
  (): bffApi.ProducerEServiceTemplate => ({
    id: generateId<EServiceTemplateId>(),
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

export const getMockBffApiEServiceRiskAnalysisSeed =
  (): bffApi.EServiceRiskAnalysisSeed => ({
    name: generateMock(z.string()),
    riskAnalysisForm: generateMock(bffApi.RiskAnalysisFormSeed),
  });

export const getMockBffApiDescriptorAttributesSeed =
  (): bffApi.DescriptorAttributesSeed => ({
    certified: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
    declared: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
    verified: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
  });

export const getMockBffApiCompactOrganization =
  (): bffApi.CompactOrganization => ({
    id: generateId<TenantId>(),
    name: generateMock(z.string()),
    kind: generateMock(bffApi.TenantKind.optional()),
    contactMail: generateMock(bffApi.Mail.optional()),
  });

export const getMockBffApiUpdateEServiceTemplateVersionDocumentSeed =
  (): bffApi.UpdateEServiceTemplateVersionDocumentSeed => ({
    prettyName: generateMock(z.string().min(5).max(60)),
  });
