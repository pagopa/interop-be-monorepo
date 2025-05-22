import { catalogApi } from "pagopa-interop-api-clients";
import { riskAnalysisFormToRiskAnalysisFormToValidate } from "pagopa-interop-commons";
import { getMockEServiceAttribute } from "pagopa-interop-commons-test";
import {
  Descriptor,
  EserviceAttributes,
  generateId,
  RiskAnalysis,
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
