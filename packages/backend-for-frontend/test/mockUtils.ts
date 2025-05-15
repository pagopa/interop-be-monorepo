import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import {
  AgreementId,
  DelegationId,
  DescriptorId,
  EServiceDocumentId,
  EServiceId,
  EServiceTemplateId,
  generateId,
  RiskAnalysisFormId,
  RiskAnalysisId,
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

export const getMockApiCatalogEService = (): bffApi.CatalogEService => ({
  id: generateId<EServiceId>(),
  name: "name",
  description: "description",
  producer: getMockApiCompactOrganization(),
  isMine: true,
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

export const getMockApiProducerEServiceDescriptor =
  (): bffApi.ProducerEServiceDescriptor => ({
    id: generateId<DescriptorId>(),
    version: "1.0",
    docs: [],
    state: "WAITING_FOR_APPROVAL",
    audience: [],
    voucherLifespan: 0,
    dailyCallsPerConsumer: 0,
    dailyCallsTotal: 0,
    agreementApprovalPolicy: "AUTOMATIC",
    eservice: getMockApiProducerDescriptorEService(),
    attributes: getMockApiDescriptorAttributes(),
  });

export const getMockApiProducerEService = (): bffApi.ProducerEService => ({
  id: generateId<EServiceId>(),
  name: "name",
  mode: "DELIVER",
  isTemplateInstance: true,
});

export const getMockApiProducerEServiceDetails =
  (): bffApi.ProducerEServiceDetails => ({
    id: generateId<EServiceId>(),
    name: "name",
    description: "description",
    technology: "REST",
    mode: "DELIVER",
    riskAnalysis: [],
  });

export const getMockApiCatalogEServiceDescriptor =
  (): bffApi.CatalogEServiceDescriptor => ({
    id: generateId<DescriptorId>(),
    version: "1.0",
    docs: [],
    attributes: getMockApiDescriptorAttributes(),
    state: "WAITING_FOR_APPROVAL",
    audience: [],
    voucherLifespan: 0,
    dailyCallsPerConsumer: 0,
    dailyCallsTotal: 0,
    agreementApprovalPolicy: "AUTOMATIC",
    eservice: getMockApiCatalogDescriptorEservice(),
  });

export const getMockApiCreatedEServiceDescriptor = (
  eServiceId: string = generateId<EServiceId>(),
  descriptorId: string = generateId<DescriptorId>()
): bffApi.CreatedEServiceDescriptor => ({
  id: eServiceId,
  descriptorId,
});

export const getMockCatalogApiEServiceDoc = (): catalogApi.EServiceDoc => ({
  id: generateId<EServiceDocumentId>(),
  name: "name",
  contentType: "type",
  prettyName: "pretty name",
  path: "path/to/doc",
  checksum: "checksum",
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
  id: generateId<EServiceId>(),
  producerId: generateId<TenantId>(),
  name: "name",
  description: "description",
  technology: "REST",
  descriptors: [getMockCatalogApiEServiceDescriptor()],
  riskAnalysis: [getMockCatalogApiEserviceRiskAnalysis()],
  mode: "DELIVER",
});

export const getMockApiFileResource = (): bffApi.FileResource => ({
  url: "http://valid.url.com",
  filename: "filename",
});

export const getMockApiPresignedUrl = (): bffApi.PresignedUrl => ({
  url: "http://valid.url.com",
});

export const getMockCatalogApiEServiceDescriptor =
  (): catalogApi.EServiceDescriptor => ({
    id: generateId<DescriptorId>(),
    version: "1.0",
    audience: [],
    voucherLifespan: 0,
    dailyCallsPerConsumer: 1,
    dailyCallsTotal: 1,
    docs: [],
    state: "WAITING_FOR_APPROVAL",
    agreementApprovalPolicy: "AUTOMATIC",
    serverUrls: [],
    attributes: {
      certified: [],
      declared: [],
      verified: [],
    },
  });

export const getApiMockEServiceTemplateInstance =
  (): bffApi.EServiceTemplateInstance => ({
    id: generateId<EServiceTemplateId>(),
    descriptors: [],
    name: "name",
    producerId: generateId<TenantId>(),
    producerName: "name",
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

const getMockApiProducerDescriptorEService =
  (): bffApi.ProducerDescriptorEService => ({
    id: generateId<EServiceId>(),
    name: "name",
    description: "description",
    producer: getMockApiProducerDescriptorEServiceProducer(),
    technology: "REST",
    mode: "DELIVER",
    riskAnalysis: [],
    descriptors: [],
  });

const getMockApiProducerDescriptorEServiceProducer =
  (): bffApi.ProducerDescriptorEServiceProducer => ({
    id: generateId<TenantId>(),
  });

const getMockApiDescriptorAttributes = (): bffApi.DescriptorAttributes => ({
  certified: [],
  declared: [],
  verified: [],
});

const getMockApiCatalogDescriptorEservice =
  (): bffApi.CatalogDescriptorEService => ({
    id: generateId<EServiceId>(),
    name: "name",
    producer: getMockApiCompactOrganization(),
    description: "description",
    technology: "REST",
    mode: "DELIVER",
    riskAnalysis: [],
    descriptors: [],
    isMine: true,
    hasCertifiedAttributes: true,
    isSubscribed: true,
  });

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
