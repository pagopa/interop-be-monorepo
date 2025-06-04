import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import { generateId } from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";

export const getMockBffApiAgreementListEntry =
  (): bffApi.AgreementListEntry => ({
    id: generateId(),
    consumer: generateMock(bffApi.CompactOrganization),
    eservice: generateMock(bffApi.CompactEService),
    state: generateMock(bffApi.AgreementState),
    canBeUpgraded: generateMock(z.boolean()),
    suspendedByConsumer: generateMock(z.boolean().optional()),
    suspendedByProducer: generateMock(z.boolean().optional()),
    suspendedByPlatform: generateMock(z.boolean().optional()),
    descriptor: generateMock(bffApi.CompactDescriptor),
    delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
  });

export const getMockBffApiAgreement = (): bffApi.Agreement => ({
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
  isContractPresent: generateMock(z.boolean()),
  consumerNotes: generateMock(z.string().optional()),
  rejectionReason: generateMock(z.string().optional()),
  consumerDocuments: generateMock(z.array(bffApi.Document)),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  updatedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  suspendedAt: generateMock(z.string().datetime({ offset: true }).optional()),
});

export const getMockBffApiAddAgreementConsumerDocument_Body =
  (): bffApi.addAgreementConsumerDocument_Body => ({
    name: generateMock(z.string()),
    prettyName: generateMock(z.string()),
    doc: new File(["content"], "doc.txt"),
  });

export const getMockBffApiAgreementPayload = (): bffApi.AgreementPayload => ({
  descriptorId: generateId(),
  eserviceId: generateId(),
  delegationId: generateId(),
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

export const getMockBffApiCatalogEService = (): bffApi.CatalogEService => ({
  id: generateId(),
  name: generateMock(z.string()),
  description: generateMock(z.string()),
  producer: generateMock(bffApi.CompactOrganization),
  agreement: generateMock(bffApi.CompactAgreement.optional()),
  isMine: generateMock(z.boolean()),
  activeDescriptor: generateMock(bffApi.CompactDescriptor.optional()),
});

export const getMockBffApiCompactEServiceLight = (
  id: string = generateId()
): bffApi.CompactEServiceLight => ({
  id,
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

export const getMockBffApiProducerEServiceDescriptor =
  (): bffApi.ProducerEServiceDescriptor => ({
    id: generateId(),
    version: generateMock(z.string()),
    description: generateMock(z.string().optional()),
    interface: generateMock(bffApi.EServiceDoc.optional()),
    docs: generateMock(z.array(bffApi.EServiceDoc)),
    state: generateMock(bffApi.EServiceDescriptorState),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int()),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(0)),
    dailyCallsTotal: generateMock(z.number().int().gte(0)),
    agreementApprovalPolicy: generateMock(bffApi.AgreementApprovalPolicy),
    eservice: generateMock(bffApi.ProducerDescriptorEService),
    attributes: generateMock(bffApi.DescriptorAttributes),
    publishedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    deprecatedAt: generateMock(
      z.string().datetime({ offset: true }).optional()
    ),
    archivedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    suspendedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    rejectionReasons: generateMock(
      z.array(bffApi.DescriptorRejectionReason).optional()
    ),
    serverUrls: generateMock(z.array(z.string().url()).optional()),
    templateRef: generateMock(bffApi.EServiceTemplateRef.optional()),
    delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
  });

export const getMockBffApiProducerEService = (): bffApi.ProducerEService => ({
  id: generateId(),
  name: generateMock(z.string()),
  mode: generateMock(bffApi.EServiceMode),
  activeDescriptor: generateMock(bffApi.CompactProducerDescriptor.optional()),
  draftDescriptor: generateMock(bffApi.CompactProducerDescriptor.optional()),
  delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
  isTemplateInstance: generateMock(z.boolean()),
  isNewTemplateVersionAvailable: generateMock(z.boolean().optional()),
});

export const getMockBffApiProducerEServiceDetails =
  (): bffApi.ProducerEServiceDetails => ({
    id: generateId(),
    name: generateMock(z.string()),
    description: generateMock(z.string()),
    technology: generateMock(bffApi.EServiceTechnology),
    mode: generateMock(bffApi.EServiceMode),
    riskAnalysis: generateMock(z.array(bffApi.EServiceRiskAnalysis)),
    isSignalHubEnabled: generateMock(z.boolean().optional()),
    isConsumerDelegable: generateMock(z.boolean().optional()),
    isClientAccessDelegable: generateMock(z.boolean().optional()),
  });

export const getMockBffApiCatalogEServiceDescriptor =
  (): bffApi.CatalogEServiceDescriptor => ({
    id: generateId(),
    version: generateMock(z.string()),
    description: generateMock(z.string().optional()),
    interface: generateMock(bffApi.EServiceDoc.optional()),
    docs: generateMock(z.array(bffApi.EServiceDoc)),
    attributes: generateMock(bffApi.DescriptorAttributes),
    state: generateMock(bffApi.EServiceDescriptorState),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int()),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(0)),
    dailyCallsTotal: generateMock(z.number().int().gte(0)),
    agreementApprovalPolicy: generateMock(bffApi.AgreementApprovalPolicy),
    eservice: generateMock(bffApi.CatalogDescriptorEService),
    publishedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    suspendedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    deprecatedAt: generateMock(
      z.string().datetime({ offset: true }).optional()
    ),
    archivedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  });

export const getMockBffApiCreatedEServiceDescriptor = (
  eServiceId: string = generateId(),
  descriptorId: string = generateId()
): bffApi.CreatedEServiceDescriptor => ({
  id: eServiceId,
  descriptorId,
});

export const getMockCatalogApiEServiceDoc = (): catalogApi.EServiceDoc => ({
  id: generateId(),
  name: generateMock(z.string()),
  contentType: generateMock(z.string()),
  prettyName: generateMock(z.string()),
  path: generateMock(z.string()),
  checksum: generateMock(z.string()),
  contacts: generateMock(catalogApi.DescriptorInterfaceContacts.optional()),
});

export const toApiEServiceDoc = (
  doc: catalogApi.EServiceDoc
): bffApi.EServiceDoc => ({
  id: doc.id,
  name: doc.name,
  contentType: doc.contentType,
  prettyName: doc.prettyName,
  checksum: doc.checksum,
});

export const getMockCatalogApiEService = (): catalogApi.EService => ({
  id: generateId(),
  producerId: generateId(),
  name: generateMock(z.string()),
  description: generateMock(z.string()),
  technology: generateMock(catalogApi.EServiceTechnology),
  descriptors: generateMock(z.array(catalogApi.EServiceDescriptor)),
  riskAnalysis: generateMock(z.array(catalogApi.EServiceRiskAnalysis)),
  mode: generateMock(catalogApi.EServiceMode),
  isSignalHubEnabled: generateMock(z.boolean().optional()),
  isConsumerDelegable: generateMock(z.boolean().optional()),
  isClientAccessDelegable: generateMock(z.boolean().optional()),
  templateId: generateMock(z.string().uuid().optional()),
});

export const getMockBffApiFileResource = (): bffApi.FileResource => ({
  url: generateMock(z.string().url()),
  filename: generateMock(z.string()),
});

export const getMockBffApiPresignedUrl = (): bffApi.PresignedUrl => ({
  url: generateMock(z.string().url()),
});

export const getMockCatalogApiEServiceDescriptor =
  (): catalogApi.EServiceDescriptor => ({
    id: generateId(),
    version: generateMock(z.string()),
    description: generateMock(z.string().optional()),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int()),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(1)),
    dailyCallsTotal: generateMock(z.number().int().gte(1)),
    interface: generateMock(catalogApi.EServiceDoc.optional()),
    docs: generateMock(z.array(catalogApi.EServiceDoc)),
    state: generateMock(catalogApi.EServiceDescriptorState),
    agreementApprovalPolicy: generateMock(catalogApi.AgreementApprovalPolicy),
    serverUrls: generateMock(z.array(z.string())),
    publishedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    suspendedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    deprecatedAt: generateMock(
      z.string().datetime({ offset: true }).optional()
    ),
    archivedAt: generateMock(z.string().datetime({ offset: true }).optional()),
    attributes: generateMock(catalogApi.Attributes),
    rejectionReasons: generateMock(
      z.array(catalogApi.RejectionReason).optional()
    ),
    templateVersionRef: generateMock(
      catalogApi.EServiceTemplateVersionRef.optional()
    ),
  });

export const getMockBffApiEServiceTemplateInstance =
  (): bffApi.EServiceTemplateInstance => ({
    id: generateId(),
    name: generateMock(z.string()),
    producerId: generateId(),
    producerName: generateMock(z.string()),
    latestDescriptor: generateMock(bffApi.CompactDescriptor.optional()),
    descriptors: generateMock(z.array(bffApi.CompactDescriptor)),
  });

export const getMockBffApiTemplateInstanceInterfaceRESTSeed =
  (): bffApi.TemplateInstanceInterfaceRESTSeed => ({
    contactName: generateMock(z.string()),
    contactEmail: generateMock(z.string().email()),
    contactUrl: generateMock(z.string().url().optional()),
    termsAndConditionsUrl: generateMock(z.string().url().optional()),
    serverUrls: generateMock(z.array(z.string().url())),
  });

export const getMockBffApiTemplateInstanceInterfaceSOAPSeed =
  (): bffApi.TemplateInstanceInterfaceSOAPSeed => ({
    serverUrls: generateMock(z.array(z.string().url())),
  });

export const getMockBffApiEServiceRiskAnalysisSeed =
  (): bffApi.EServiceRiskAnalysisSeed => ({
    name: generateMock(z.string()),
    riskAnalysisForm: generateMock(bffApi.RiskAnalysisForm),
  });

export const getMockBffApiInstanceEServiceSeed =
  (): bffApi.InstanceEServiceSeed => ({
    isSignalHubEnabled: generateMock(z.boolean().optional()),
    isClientAccessDelegable: generateMock(z.boolean().optional()),
    isConsumerDelegable: generateMock(z.boolean().optional()),
  });

export const getMockBffApiEServiceSeed = (): bffApi.EServiceSeed => ({
  name: generateMock(z.string()),
  description: generateMock(z.string()),
  technology: generateMock(bffApi.EServiceTechnology),
  mode: generateMock(bffApi.EServiceMode),
  isSignalHubEnabled: generateMock(z.boolean().optional()),
  isClientAccessDelegable: generateMock(z.boolean().optional()),
  isConsumerDelegable: generateMock(z.boolean().optional()),
});

export const getMockBffApiRejectDelegatedEServiceDescriptorSeed =
  (): bffApi.RejectDelegatedEServiceDescriptorSeed => ({
    rejectionReason: generateMock(z.string()),
  });

export const getMockCatalogApiUpdateEServiceDescriptorQuotasSeed =
  (): catalogApi.UpdateEServiceDescriptorQuotasSeed => ({
    voucherLifespan: generateMock(z.number().int().gte(60).lte(86400)),
    dailyCallsPerConsumer: generateMock(z.number().int().gte(1)),
    dailyCallsTotal: generateMock(z.number().int().gte(1)),
  });

export const getMockBffApiDescriptorAttributesSeed =
  (): bffApi.DescriptorAttributesSeed => ({
    certified: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
    declared: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
    verified: generateMock(z.array(z.array(bffApi.DescriptorAttributeSeed))),
  });

export const getMockBffApiUpdateEServiceDescriptorSeed =
  (): bffApi.UpdateEServiceDescriptorSeed => ({
    description: generateMock(z.string().optional()),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int()),
    dailyCallsPerConsumer: generateMock(z.number().int()),
    dailyCallsTotal: generateMock(z.number().int()),
    agreementApprovalPolicy: generateMock(bffApi.AgreementApprovalPolicy),
    attributes: generateMock(bffApi.DescriptorAttributesSeed),
  });

export const getMockBffApiUpdateEServiceDescriptorTemplateInstanceSeed =
  (): bffApi.UpdateEServiceDescriptorTemplateInstanceSeed => ({
    audience: generateMock(z.array(z.string())),
    dailyCallsPerConsumer: generateMock(z.number().int()),
    dailyCallsTotal: generateMock(z.number().int()),
    agreementApprovalPolicy: generateMock(bffApi.AgreementApprovalPolicy),
  });

export const getMockBffApiUpdateEServiceSeed =
  (): bffApi.UpdateEServiceSeed => ({
    name: generateMock(z.string()),
    description: generateMock(z.string()),
    technology: generateMock(bffApi.EServiceTechnology),
    mode: generateMock(bffApi.EServiceMode),
    isSignalHubEnabled: generateMock(z.boolean().optional()),
    isConsumerDelegable: generateMock(z.boolean().optional()),
    isClientAccessDelegable: generateMock(z.boolean().optional()),
  });

export const getMockBffApiEServiceDescriptionUpdateSeed =
  (): bffApi.EServiceDescriptionUpdateSeed => ({
    description: generateMock(z.string()),
  });

export const getMockBffApiUpdateEServiceDescriptorDocumentSeed =
  (): bffApi.UpdateEServiceDescriptorDocumentSeed => ({
    prettyName: generateMock(z.string()),
  });

export const getMockBffApiEServiceDelegationFlagsUpdateSeed =
  (): bffApi.EServiceDelegationFlagsUpdateSeed => ({
    isConsumerDelegable: generateMock(z.boolean()),
    isClientAccessDelegable: generateMock(z.boolean()),
  });

export const getMockBffApiEServiceNameUpdateSeed =
  (): bffApi.EServiceNameUpdateSeed => ({
    name: generateMock(z.string()),
  });

export const getMockBffApiUpdateEServiceTemplateInstanceSeed =
  // eslint-disable-next-line sonarjs/no-identical-functions
  (): bffApi.UpdateEServiceTemplateInstanceSeed => ({
    isSignalHubEnabled: generateMock(z.boolean().optional()),
    isClientAccessDelegable: generateMock(z.boolean().optional()),
    isConsumerDelegable: generateMock(z.boolean().optional()),
  });

export const getMockBffApiUpdateEServiceTemplateInstanceDescriptorQuotas =
  (): bffApi.UpdateEServiceTemplateInstanceDescriptorQuotas => ({
    dailyCallsPerConsumer: generateMock(z.number().int().gte(0)),
    dailyCallsTotal: generateMock(z.number().int().gte(0)),
const getMockCatalogApiEserviceRiskAnalysis =
  (): catalogApi.EServiceRiskAnalysis => ({
    id: generateId<RiskAnalysisId>(),
    name: "name",
    createdAt: new Date().toISOString(),
    riskAnalysisForm: {
      id: generateId<RiskAnalysisFormId>(),
      version: "1.0",
      singleAnswers: [],
      multiAnswers: [],
    },
import { bffApi } from "pagopa-interop-api-clients";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import {
  PurposeId,
  PurposeVersionId,
  TenantId,
  generateId,
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
