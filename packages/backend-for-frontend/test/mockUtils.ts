import {
  attributeRegistryApi,
  authorizationApi,
  bffApi,
  delegationApi,
  eserviceTemplateApi,
  agreementApi,
  catalogApi,
  inAppNotificationApi,
} from "pagopa-interop-api-clients";
import {
  AgreementId,
  DescriptorId,
  EServiceId,
  EServiceTemplateId,
  AttributeId,
  ClientId,
  DelegationId,
  TenantId,
  generateId,
  PurposeId,
  PurposeVersionId,
  PurposeTemplateId,
} from "pagopa-interop-models";
import { generateMock } from "@anatine/zod-mock";
import { z } from "zod";
import { GetSessionTokenReturnType } from "../src/services/authorizationService.js";

export const getMockBffApiDelegation = (): bffApi.Delegation & {
  id: DelegationId;
} => ({
  id: generateId(),
  eservice: generateMock(bffApi.DelegationEService.optional()),
  delegate: generateMock(bffApi.DelegationTenant),
  delegator: generateMock(bffApi.DelegationTenant),
  activationContract: generateMock(bffApi.Document.optional()),
  revocationContract: generateMock(bffApi.Document.optional()),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  updatedAt: generateMock(z.string().datetime({ offset: true }).optional()),
  state: generateMock(bffApi.DelegationState),
  kind: generateMock(bffApi.DelegationKind),
  rejectionReason: generateMock(z.string().optional()),
});

export const getMockBffApiAttributeSeed = (): bffApi.AttributeSeed => ({
  description: generateMock(z.string()),
  name: generateMock(z.string()),
});

export const getMockBffApiAttribute = (
  kind: bffApi.AttributeKind = generateMock(bffApi.AttributeKind)
): bffApi.Attribute =>
  bffApi.Attribute.parse(getMockAttributeRegistryApiAttribute(kind));

export const getMockAttributeRegistryApiAttribute = (
  kind: attributeRegistryApi.AttributeKind = generateMock(
    attributeRegistryApi.AttributeKind
  )
): attributeRegistryApi.Attribute & { id: AttributeId } => ({
  id: generateId(),
  code: generateMock(z.string().optional()),
  kind,
  description: generateMock(z.string()),
  name: generateMock(z.string()),
  creationTime: new Date().toISOString(),
  origin: generateMock(z.string().optional()),
});

export const getMockBffApiCompactClient = (): bffApi.CompactClient => ({
  id: generateId(),
  name: generateMock(z.string()),
  hasKeys: generateMock(z.boolean()),
  admin: generateMock(bffApi.CompactUser.optional()),
});

export const getMockBffApiClient = (): bffApi.Client & { id: ClientId } => ({
  id: generateId(),
  createdAt: new Date().toISOString(),
  consumer: generateMock(bffApi.CompactOrganization),
  admin: generateMock(bffApi.CompactUser.optional()),
  name: generateMock(z.string()),
  purposes: generateMock(z.array(bffApi.ClientPurpose)),
  description: generateMock(z.string()),
  kind: generateMock(bffApi.ClientKind),
});

export const getMockBffApiEncodedClientKey = (
  key: string = generateMock(z.string())
): bffApi.EncodedClientKey => ({
  key,
});

export const getMockBffApiPurposeAdditionDetailsSeed =
  (): bffApi.PurposeAdditionDetailsSeed => ({
    purposeId: generateId(),
  });

export const getMockBffApiClientSeed = (): bffApi.ClientSeed => ({
  name: generateMock(z.string()),
  members: generateMock(z.array(z.string().uuid())),
  description: generateMock(z.string().optional()),
});

export const getMockBffApiKeySeed = (): bffApi.KeySeed => ({
  key: generateMock(z.string()),
  use: generateMock(bffApi.KeyUse),
  alg: generateMock(z.string()),
  name: generateMock(z.string().min(5).max(60)),
});

export const getMockAuthorizationApiKey = (): authorizationApi.Key => ({
  userId: generateId(),
  kid: generateMock(z.string()),
  name: generateMock(z.string()),
  encodedPem: generateMock(z.string()),
  algorithm: generateMock(z.string()),
  use: generateMock(bffApi.KeyUse),
  createdAt: generateMock(z.string().datetime({ offset: true })),
});

export const getMockAuthorizationApiClient = (): authorizationApi.Client & {
  id: ClientId;
} => ({
  id: generateId(),
  name: generateMock(z.string()),
  consumerId: generateId(),
  adminId: generateId(),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  purposes: generateMock(z.array(z.string().uuid())),
  description: generateMock(z.string().optional()),
  users: generateMock(z.array(z.string().uuid())),
  kind: generateMock(authorizationApi.ClientKind),
  visibility: generateMock(z.union([z.literal("FULL"), z.literal("PARTIAL")])),
});

export const getMockBffApiCompactDelegation = (): bffApi.CompactDelegation => ({
  id: generateId(),
  eservice: generateMock(bffApi.CompactEServiceLight.optional()),
  delegate: generateMock(bffApi.DelegationTenant),
  delegator: generateMock(bffApi.DelegationTenant),
  state: generateMock(bffApi.DelegationState),
  kind: generateMock(bffApi.DelegationKind),
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
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().gte(1).lte(1000000000)),
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
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().gte(1).lte(1000000000)),
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
  uploadDate: new Date().toISOString(),
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

export const getMockCatalogApiEService = (): catalogApi.EService & {
  id: EServiceId;
} => ({
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
  personalData: generateMock(z.boolean().optional()),
});

export const getMockBffApiFileResource = (): bffApi.FileResource => ({
  url: generateMock(z.string().url()),
  filename: generateMock(z.string()),
});

export const getMockBffApiPresignedUrl = (): bffApi.PresignedUrl => ({
  url: generateMock(z.string().url()),
});

export const getMockCatalogApiEServiceDescriptor =
  (): catalogApi.EServiceDescriptor & { id: DescriptorId } => ({
    id: generateId(),
    version: generateMock(z.string()),
    description: generateMock(z.string().optional()),
    audience: generateMock(z.array(z.string())),
    voucherLifespan: generateMock(z.number().int()),
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().gte(1).lte(1000000000)),
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
    riskAnalysisForm: generateMock(bffApi.RiskAnalysisFormSeed),
  });

export const getMockBffApiInstanceEServiceSeed =
  (): bffApi.InstanceEServiceSeed => ({
    isSignalHubEnabled: generateMock(z.boolean().optional()),
    isClientAccessDelegable: generateMock(z.boolean().optional()),
    isConsumerDelegable: generateMock(z.boolean().optional()),
  });

export const getMockBffApiEServicePersonalDataFlagUpdateSeed =
  (): bffApi.EServicePersonalDataFlagUpdateSeed => ({
    personalData: generateMock(z.boolean()),
  });

export const getMockBffApiEServiceSeed = (): bffApi.EServiceSeed => ({
  name: generateMock(z.string()),
  description: generateMock(z.string()),
  technology: generateMock(bffApi.EServiceTechnology),
  mode: generateMock(bffApi.EServiceMode),
  isSignalHubEnabled: generateMock(z.boolean().optional()),
  isClientAccessDelegable: generateMock(z.boolean().optional()),
  isConsumerDelegable: generateMock(z.boolean().optional()),
  personalData: generateMock(z.boolean().optional()),
});

export const getMockBffApiRejectDelegatedEServiceDescriptorSeed =
  (): bffApi.RejectDelegatedEServiceDescriptorSeed => ({
    rejectionReason: generateMock(z.string()),
  });

export const getMockCatalogApiUpdateEServiceDescriptorQuotasSeed =
  (): catalogApi.UpdateEServiceDescriptorQuotasSeed => ({
    voucherLifespan: generateMock(z.number().int().gte(60).lte(86400)),
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().gte(1).lte(1000000000)),
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
    dailyCallsPerConsumer: generateMock(
      z.number().int().min(1).max(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().min(1).max(1000000000)),
    agreementApprovalPolicy: generateMock(bffApi.AgreementApprovalPolicy),
    attributes: generateMock(bffApi.DescriptorAttributesSeed),
  });

export const getMockBffApiUpdateEServiceDescriptorTemplateInstanceSeed =
  (): bffApi.UpdateEServiceDescriptorTemplateInstanceSeed => ({
    audience: generateMock(z.array(z.string())),
    dailyCallsPerConsumer: generateMock(
      z.number().int().min(1).max(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().min(1).max(1000000000)),
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

export const getMockBffApiEServiceTemplatePersonalDataFlagUpdateSeed =
  (): bffApi.EServiceTemplatePersonalDataFlagUpdateSeed => ({
    personalData: generateMock(z.boolean()),
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
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000)
    ),
    dailyCallsTotal: generateMock(z.number().int().gte(1).lte(1000000000)),
  });

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
  dailyCallsPerConsumer: generateMock(z.number().int().min(1).max(1000000000)),
  dailyCallsTotal: generateMock(z.number().int().min(1).max(1000000000)),
  delegation: generateMock(bffApi.DelegationWithCompactTenants.optional()),
  hasUnreadNotifications: generateMock(z.boolean()),
  purposeTemplate: generateMock(bffApi.CompactPurposeTemplate.optional()),
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
    dailyCalls: generateMock(z.number().int().min(1).max(1000000000)),
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
  dailyCalls: generateMock(z.number().int().min(1).max(1000000000)),
});

export const getMockPurposeTemplateSeed = (): bffApi.PurposeTemplateSeed => ({
  targetDescription:
    "This is a valid target description that meets the minimum length requirement",
  targetTenantKind: "PA" as bffApi.TenantKind,
  purposeTitle: "Valid Purpose Title",
  purposeDescription:
    "This is a valid purpose description that meets the minimum length requirement",
  purposeRiskAnalysisForm: generateMock(bffApi.RiskAnalysisFormTemplateSeed),
  purposeIsFreeOfCharge: false,
  purposeFreeOfChargeReason: undefined,
  purposeDailyCalls: 1000,
  handlesPersonalData: false,
});

export const getMockReversePurposeSeed = (): bffApi.PurposeEServiceSeed => ({
  eserviceId: generateId(),
  consumerId: generateId(),
  riskAnalysisId: generateId(),
  title: generateMock(z.string()),
  description: generateMock(z.string()),
  isFreeOfCharge: generateMock(z.boolean()),
  freeOfChargeReason: generateMock(z.string().optional()),
  dailyCalls: generateMock(z.number().int().min(1).max(1000000000)),
});

export const getMockBffApiPrivacyNotice = (): bffApi.PrivacyNotice => ({
  id: generateId(),
  userId: generateId(),
  consentType: generateMock(bffApi.ConsentType),
  firstAccept: generateMock(z.boolean()),
  isUpdated: generateMock(z.boolean()),
  latestVersionId: generateId(),
});

export const getMockBffApiCompactUser = (): bffApi.CompactUser => ({
  userId: generateId(),
  name: generateMock(z.string()),
  familyName: generateMock(z.string()),
});

export const getMockBffApiPublicKey = (): bffApi.PublicKey => ({
  keyId: generateMock(z.string()),
  name: generateMock(z.string()),
  user: getMockBffApiCompactUser(),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  isOrphan: generateMock(z.boolean()),
});

export const getMockBffApiProducerKeychain = (): bffApi.ProducerKeychain => ({
  id: generateId(),
  createdAt: generateMock(z.string().datetime({ offset: true })),
  producer: generateMock(bffApi.CompactOrganization),
  name: generateMock(z.string()),
  eservices: generateMock(z.array(bffApi.CompactEService)),
  description: generateMock(z.string()),
});

export const getMockBffApiCompactProducerKeychain =
  (): bffApi.CompactProducerKeychain => ({
    id: generateId(),
    name: generateMock(z.string()),
    hasKeys: generateMock(z.boolean()),
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

export const getMockBffApiEServiceTemplate =
  (): eserviceTemplateApi.EServiceTemplate & {
    id: EServiceTemplateId;
  } => ({
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
    personalData: generateMock(z.boolean().optional()),
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
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000).optional()
    ),
    dailyCallsTotal: generateMock(
      z.number().int().gte(1).lte(1000000000).optional()
    ),
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
    dailyCallsPerConsumer: generateMock(
      z.number().int().gte(1).lte(1000000000).optional()
    ),
    dailyCallsTotal: generateMock(
      z.number().int().gte(1).lte(1000000000).optional()
    ),
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
    hasUnreadNotifications: generateMock(z.boolean()),
  });

export const getMockBffApiEServiceTemplateVersionQuotasUpdateSeed =
  (): bffApi.EServiceTemplateVersionQuotasUpdateSeed => ({
    voucherLifespan: generateMock(z.number().int().gte(60).lte(86400)),
    dailyCallsPerConsumer: generateMock(
      z.number().gte(1).lte(1000000000).optional()
    ),
    dailyCallsTotal: generateMock(z.number().gte(1).lte(1000000000).optional()),
  });

export const getMockBffApiEServiceTemplateRiskAnalysisSeed =
  (): bffApi.EServiceTemplateRiskAnalysisSeed => ({
    name: generateMock(z.string()),
    riskAnalysisForm: generateMock(bffApi.RiskAnalysisFormSeed),
    tenantKind: generateMock(bffApi.TenantKind),
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
    hasUnreadNotifications: generateMock(z.boolean()),
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

export const getMockInAppNotificationApiNotification =
  (): inAppNotificationApi.Notification => ({
    id: generateId(),
    userId: generateId(),
    tenantId: generateId(),
    body: generateMock(z.string()),
    notificationType: "agreementSuspendedUnsuspendedToProducer",
    entityId: generateId(),
    readAt: generateMock(z.string().datetime({ offset: true }).nullable()),
    createdAt: generateMock(z.string().datetime({ offset: true })),
  });

export const getMockInAppNotificationApiNotifications =
  (): inAppNotificationApi.Notifications => ({
    results: [
      getMockInAppNotificationApiNotification(),
      getMockInAppNotificationApiNotification(),
      getMockInAppNotificationApiNotification(),
    ],
    totalCount: 3,
  });

export const getMockBffApiNotification = (): bffApi.Notification => ({
  id: generateId(),
  userId: generateId(),
  tenantId: generateId(),
  body: generateMock(z.string()),
  category: generateMock(z.string()),
  deepLink: generateMock(z.string()),
  readAt: generateMock(z.string().datetime({ offset: true }).nullable()),
  createdAt: generateMock(z.string().datetime({ offset: true })),
});

export const getMockBffApiNotifications = (): bffApi.Notifications => ({
  results: [
    getMockBffApiNotification(),
    getMockBffApiNotification(),
    getMockBffApiNotification(),
  ],
  pagination: {
    offset: 0,
    limit: 50,
    totalCount: 3,
  },
});

export const getMockInAppNotificationApiNotificationsByType =
  (): inAppNotificationApi.NotificationsByType => ({
    results: {
      agreementSuspendedUnsuspendedToProducer: generateMock(z.number().int()),
      agreementManagementToProducer: generateMock(z.number().int()),
      clientAddedRemovedToProducer: generateMock(z.number().int()),
      purposeStatusChangedToProducer: generateMock(z.number().int()),
      templateStatusChangedToProducer: generateMock(z.number().int()),
      agreementSuspendedUnsuspendedToConsumer: generateMock(z.number().int()),
      eserviceStateChangedToConsumer: generateMock(z.number().int()),
      agreementActivatedRejectedToConsumer: generateMock(z.number().int()),
      purposeActivatedRejectedToConsumer: generateMock(z.number().int()),
      purposeSuspendedUnsuspendedToConsumer: generateMock(z.number().int()),
      newEserviceTemplateVersionToInstantiator: generateMock(z.number().int()),
      eserviceTemplateNameChangedToInstantiator: generateMock(z.number().int()),
      eserviceTemplateStatusChangedToInstantiator: generateMock(
        z.number().int()
      ),
      delegationApprovedRejectedToDelegator: generateMock(z.number().int()),
      eserviceNewVersionSubmittedToDelegator: generateMock(z.number().int()),
      eserviceNewVersionApprovedRejectedToDelegate: generateMock(
        z.number().int()
      ),
      delegationSubmittedRevokedToDelegate: generateMock(z.number().int()),
      certifiedVerifiedAttributeAssignedRevokedToAssignee: generateMock(
        z.number().int()
      ),
      clientKeyAddedDeletedToClientUsers: generateMock(z.number().int()),
    },
    totalCount: generateMock(z.number().int()),
  });

export const getMockBffApiNotificationsCountBySection =
  (): bffApi.NotificationsCountBySection => ({
    erogazione: {
      richieste: generateMock(z.number().int()),
      finalita: generateMock(z.number().int()),
      "template-eservice": generateMock(z.number().int()),
      "e-service": generateMock(z.number().int()),
      portachiavi: generateMock(z.number().int()),
      totalCount: generateMock(z.number().int()),
    },
    fruizione: {
      richieste: generateMock(z.number().int()),
      finalita: generateMock(z.number().int()),
      totalCount: generateMock(z.number().int()),
    },
    "catalogo-e-service": {
      totalCount: generateMock(z.number().int()),
    },
    aderente: {
      deleghe: generateMock(z.number().int()),
      anagrafica: generateMock(z.number().int()),
      totalCount: generateMock(z.number().int()),
    },
    "gestione-client": {
      "api-e-service": generateMock(z.number().int()),
      totalCount: generateMock(z.number().int()),
    },
    totalCount: generateMock(z.number().int()),
  });

export const getMockBffApiCreatorPurposeTemplate =
  (): bffApi.CreatorPurposeTemplate => ({
    id: generateId(),
    targetTenantKind: generateMock(bffApi.TenantKind),
    purposeTitle: generateMock(z.string()),
    state: generateMock(bffApi.PurposeTemplateState),
  });

export const getMockBffApiCatalogPurposeTemplate =
  (): bffApi.CatalogPurposeTemplate => ({
    id: generateId(),
    targetTenantKind: generateMock(bffApi.TenantKind),
    purposeTitle: generateMock(z.string()),
    purposeDescription: generateMock(z.string()),
    creator: generateMock(bffApi.CompactOrganization),
  });

export const getMockBffApiEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor =
  (
    purposeTemplateId: PurposeTemplateId = generateId()
  ): bffApi.EServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor => ({
    purposeTemplateId,
    createdAt: generateMock(z.string().datetime({ offset: true })),
    eservice: generateMock(bffApi.CompactPurposeTemplateEService),
    descriptor: generateMock(bffApi.CompactDescriptor),
  });

export const getMockBffApiPurposeTemplateWithCompactCreator =
  (): bffApi.PurposeTemplateWithCompactCreator & {
    id: PurposeTemplateId;
  } => ({
    id: generateId(),
    targetDescription:
      "This is a valid target description that meets the minimum length requirement",
    targetTenantKind: "PA" as bffApi.TenantKind,
    creator: generateMock(bffApi.CompactOrganization),
    state: generateMock(bffApi.PurposeTemplateState),
    createdAt: new Date().toISOString(),
    purposeTitle: "Valid Purpose Title",
    purposeDescription:
      "This is a valid purpose description that meets the minimum length requirement",
    purposeRiskAnalysisForm: generateMock(bffApi.RiskAnalysisFormTemplate),
    purposeIsFreeOfCharge: false,
    annotationDocuments: generateMock(
      z.array(bffApi.RiskAnalysisTemplateAnswerAnnotationDocument)
    ),
    handlesPersonalData: false,
  });

export const getMockBffApiPurposeTemplate = (
  state?: bffApi.PurposeTemplateState
): bffApi.PurposeTemplate & {
  id: PurposeTemplateId;
} => ({
  id: generateId(),
  targetDescription:
    "This is a valid target description that meets the minimum length requirement",
  targetTenantKind: "PA" as bffApi.TenantKind,
  creatorId: generateId(),
  state: state || generateMock(bffApi.PurposeTemplateState),
  createdAt: new Date().toISOString(),
  purposeTitle: "Valid Purpose Title",
  purposeDescription:
    "This is a valid purpose description that meets the minimum length requirement",
  purposeRiskAnalysisForm: generateMock(bffApi.RiskAnalysisFormTemplate),
  purposeIsFreeOfCharge: false,
  handlesPersonalData: false,
});
