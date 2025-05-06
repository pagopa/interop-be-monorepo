import {
  EServiceTemplate,
  RiskAnalysis,
  generateId,
  EServiceTemplateVersion,
} from "pagopa-interop-models";
import { riskAnalysisFormToRiskAnalysisFormToValidate } from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  eServiceModeToApiEServiceMode,
  eserviceTemplateToApiEServiceTemplate,
  technologyToApiTechnology,
} from "../src/model/domain/apiConverter.js";

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): eserviceTemplateApi.EServiceRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
});

export const eserviceTemplateToApiEServiceTemplateSeed = (
  eserviceTemplate: EServiceTemplate
): eserviceTemplateApi.EServiceTemplateSeed => {
  const apiEserviceTemplate =
    eserviceTemplateToApiEServiceTemplate(eserviceTemplate);

  return {
    ...apiEserviceTemplate,
    version: apiEserviceTemplate.versions[0],
  };
};

export const eserviceTemplateToApiUpdateEServiceTemplateSeed = (
  eserviceTemplate: EServiceTemplate
): eserviceTemplateApi.UpdateEServiceTemplateSeed => ({
  name: eserviceTemplate.name,
  intendedTarget: eserviceTemplate.intendedTarget,
  description: eserviceTemplate.description,
  technology: technologyToApiTechnology(eserviceTemplate.technology),
  mode: eServiceModeToApiEServiceMode(eserviceTemplate.mode),
  isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
});

export const buildUpdateVersionSeed = (
  version: EServiceTemplateVersion
): eserviceTemplateApi.UpdateEServiceTemplateVersionSeed => ({
  voucherLifespan: version.voucherLifespan,
  dailyCallsPerConsumer: version.dailyCallsPerConsumer,
  dailyCallsTotal: version.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: version.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
});

export const buildInterfaceSeed =
  (): eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed => ({
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
  (): eserviceTemplateApi.CreateEServiceTemplateVersionDocumentSeed => ({
    contentType: "json",
    prettyName: "prettyName",
    serverUrls: ["pagopa.it"],
    documentId: generateId(),
    kind: "DOCUMENT",
    filePath: "filePath",
    fileName: "fileName",
    checksum: "checksum",
  });
