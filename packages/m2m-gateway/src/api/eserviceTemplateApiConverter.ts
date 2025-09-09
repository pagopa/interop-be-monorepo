import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayEServiceTemplate(
  template: eserviceTemplateApi.EServiceTemplate
): m2mGatewayApi.EServiceTemplate {
  return {
    id: template.id,
    creatorId: template.creatorId,
    description: template.description,
    intendedTarget: template.intendedTarget,
    mode: template.mode,
    name: template.name,
    technology: template.technology,
    isSignalHubEnabled: template.isSignalHubEnabled,
  };
}

export function toM2MGatewayEServiceTemplateVersion(
  version: eserviceTemplateApi.EServiceTemplateVersion
): m2mGatewayApi.EServiceTemplateVersion {
  return {
    id: version.id,
    state: version.state,
    version: version.version,
    voucherLifespan: version.voucherLifespan,
    agreementApprovalPolicy: version.agreementApprovalPolicy,
    dailyCallsPerConsumer: version.dailyCallsPerConsumer,
    dailyCallsTotal: version.dailyCallsTotal,
    deprecatedAt: version.deprecatedAt,
    description: version.description,
    publishedAt: version.publishedAt,
    suspendedAt: version.suspendedAt,
  };
}

export function toM2MGatewayApiEServiceTemplateRiskAnalysis(
  riskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis
): m2mGatewayApi.EServiceTemplateRiskAnalysis {
  return {
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt,
    riskAnalysisForm: toM2MGatewayApiRiskAnalysisForm(
      riskAnalysis.riskAnalysisForm
    ),
    tenantKind: riskAnalysis.tenantKind,
  };
}

export function toM2MGatewayApiRiskAnalysisForm(
  riskAnalysisForm: eserviceTemplateApi.EServiceRiskAnalysisForm
): m2mGatewayApi.RiskAnalysisForm {
  return {
    id: riskAnalysisForm.id,
    version: riskAnalysisForm.version,
    answers: toM2MGatewayApiRiskAnalysisAnswers(
      riskAnalysisForm.singleAnswers,
      riskAnalysisForm.multiAnswers
    ),
  };
}

export function toM2MGatewayApiRiskAnalysisAnswers(
  singleAnswers: eserviceTemplateApi.EServiceRiskAnalysisSingleAnswer[],
  multiAnswers: eserviceTemplateApi.EServiceRiskAnalysisMultiAnswer[]
): Record<string, string[]> {
  const singleAnswersMap = singleAnswers.reduce<Record<string, string[]>>(
    (map, { key, value }) => {
      if (!value) {
        return map;
      }
      // eslint-disable-next-line functional/immutable-data
      map[key] = [value];
      return map;
    },
    {}
  );

  const multiAnswersMap = multiAnswers.reduce<Record<string, string[]>>(
    (map, { key, values }) => {
      if (values.length === 0) {
        return map;
      }
      // eslint-disable-next-line functional/immutable-data
      map[key] = values;
      return map;
    },
    {}
  );

  return {
    ...singleAnswersMap,
    ...multiAnswersMap,
  };
}
