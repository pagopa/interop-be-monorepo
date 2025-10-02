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
    personalData: template.personalData,
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
