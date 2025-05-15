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
  });
