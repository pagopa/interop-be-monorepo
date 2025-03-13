import { catalogApi } from "pagopa-interop-api-clients";
import {
  AuthData,
  riskAnalysisFormToRiskAnalysisFormToValidate,
} from "pagopa-interop-commons";
import {
  Agreement,
  agreementState,
  Descriptor,
  DescriptorId,
  descriptorState,
  DescriptorState,
  Document,
  EService,
  EServiceAttribute,
  EserviceAttributes,
  EServiceId,
  eserviceMode,
  generateId,
  RiskAnalysis,
  technology,
  TenantId,
} from "pagopa-interop-models";

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: generateId(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  selfcareId: generateId(),
});
export const buildDescriptorSeedForEserviceCreation = (
  descriptor: Descriptor
): catalogApi.DescriptorSeedForEServiceCreation => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
});
export const buildCreateDescriptorSeed = (
  descriptor: Descriptor
): catalogApi.EServiceDescriptorSeed => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
  docs: descriptor.docs.map((d) => ({
    ...d,
    kind: "DOCUMENT",
    serverUrls: [],
    documentId: d.id,
    filePath: d.path,
    fileName: d.name,
  })),
});
export const buildUpdateDescriptorSeed = (
  descriptor: Descriptor
): catalogApi.UpdateEServiceDescriptorSeed => ({
  audience: descriptor.audience,
  voucherLifespan: descriptor.voucherLifespan,
  dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
  dailyCallsTotal: descriptor.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: descriptor.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
});
export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): catalogApi.EServiceRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
});
export const getMockEService = (): EService => ({
  id: generateId(),
  name: "eservice name",
  description: "eservice description",
  createdAt: new Date(),
  producerId: generateId(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
  mode: eserviceMode.deliver,
  riskAnalysis: [],
});
export const getMockDescriptor = (state?: DescriptorState): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: state || descriptorState.draft,
  audience: ["pagopa.it"],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
  ...(state === descriptorState.archived ? { archivedAt: new Date() } : {}),
  ...(state === descriptorState.suspended ? { suspendedAt: new Date() } : {}),
  ...(state === descriptorState.deprecated ? { deprecatedAt: new Date() } : {}),
  ...(state === descriptorState.published ? { publishedAt: new Date() } : {}),
  rejectionReasons: [],
});
export const getMockEServiceAttribute = (): EServiceAttribute => ({
  id: generateId(),
  explicitAttributeVerification: false,
});
export const getMockEServiceAttributes = (): EserviceAttributes => ({
  certified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  declared: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
  verified: [[getMockEServiceAttribute(), getMockEServiceAttribute()]],
});
export const buildInterfaceSeed =
  (): catalogApi.CreateEServiceDescriptorDocumentSeed => ({
    contentType: "json",
    prettyName: "prettyName",
    serverUrls: ["pagopa.it"],
    documentId: generateId(),
    kind: "INTERFACE",
    filePath: "filePath",
    fileName: "fileName",
    checksum: "checksum",
  });
export const buildDocumentSeed =
  (): catalogApi.CreateEServiceDescriptorDocumentSeed => ({
    contentType: "json",
    prettyName: "prettyName",
    serverUrls: ["pagopa.it"],
    documentId: generateId(),
    kind: "DOCUMENT",
    filePath: "filePath",
    fileName: "fileName",
    checksum: "checksum",
  });
export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: generateId(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: "checksum",
  uploadDate: new Date(),
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
