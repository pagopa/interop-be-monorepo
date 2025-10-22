import {
  EServiceTemplate,
  generateId,
  EServiceTemplateVersion,
  TenantId,
  EServiceTemplateRiskAnalysis,
} from "pagopa-interop-models";
import {
  riskAnalysisFormToRiskAnalysisFormToValidate,
  userRole,
} from "pagopa-interop-commons";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import {
  getMockContext,
  getMockAuthData,
  getMockContextM2M,
  getMockContextM2MAdmin,
} from "pagopa-interop-commons-test";
import {
  eServiceModeToApiEServiceMode,
  eserviceTemplateToApiEServiceTemplate,
  technologyToApiTechnology,
} from "../src/model/domain/apiConverter.js";

export const buildRiskAnalysisSeed = (
  riskAnalysis: EServiceTemplateRiskAnalysis
): eserviceTemplateApi.EServiceTemplateRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
  tenantKind: riskAnalysis.tenantKind,
});

export const eserviceTemplateToApiEServiceTemplateSeed = (
  eserviceTemplate: EServiceTemplate
): eserviceTemplateApi.EServiceTemplateSeed => {
  const apiEserviceTemplate =
    eserviceTemplateToApiEServiceTemplate(eserviceTemplate);

  return eserviceTemplateApi.EServiceTemplateSeed.strip().parse({
    ...apiEserviceTemplate,
    version:
      eserviceTemplateApi.VersionSeedForEServiceTemplateCreation.strip().parse(
        apiEserviceTemplate.versions[0]
      ),
  });
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
export const buildCreateVersionSeed = (
  version: EServiceTemplateVersion
): eserviceTemplateApi.EServiceTemplateVersionSeed => ({
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
  docs: version.docs.map((d) => ({
    ...d,
    kind: "DOCUMENT",
    serverUrls: [],
    documentId: d.id,
    filePath: d.path,
    fileName: d.name,
  })),
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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const getContextsAllowedToSeeDraftVersions = (creatorId: TenantId) => [
  getMockContext({
    authData: {
      ...getMockAuthData(creatorId),
      userRoles: [userRole.ADMIN_ROLE],
    },
  }),
  getMockContext({
    authData: {
      ...getMockAuthData(creatorId),
      userRoles: [userRole.API_ROLE],
    },
  }),
  getMockContext({
    authData: {
      ...getMockAuthData(creatorId),
      userRoles: [userRole.SUPPORT_ROLE],
    },
  }),
  getMockContextM2M({
    organizationId: creatorId,
  }),
  getMockContextM2MAdmin({
    organizationId: creatorId,
  }),
];
