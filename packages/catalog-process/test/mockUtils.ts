import { catalogApi } from "pagopa-interop-api-clients";
import {
  riskAnalysisFormToRiskAnalysisFormToValidate,
  userRole,
} from "pagopa-interop-commons";
import {
  getMockContext,
  getMockAuthData,
  getMockContextM2M,
  getMockContextM2MAdmin,
} from "pagopa-interop-commons-test/index.js";
import {
  Descriptor,
  generateId,
  RiskAnalysis,
  TenantId,
} from "pagopa-interop-models";

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getContextsAllowedToSeeInactiveDescriptors = (
  producerOrDelegateId: TenantId
) => [
  getMockContext({
    authData: {
      ...getMockAuthData(producerOrDelegateId),
      userRoles: [userRole.ADMIN_ROLE],
    },
  }),
  getMockContext({
    authData: {
      ...getMockAuthData(producerOrDelegateId),
      userRoles: [userRole.API_ROLE],
    },
  }),
  getMockContext({
    authData: {
      ...getMockAuthData(producerOrDelegateId),
      userRoles: [userRole.SUPPORT_ROLE],
    },
  }),
  getMockContextM2M({
    organizationId: producerOrDelegateId,
  }),
  getMockContextM2MAdmin({
    organizationId: producerOrDelegateId,
  }),
];
