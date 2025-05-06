import { eserviceTemplateApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export const toM2MEServiceTemplate = (
  template: eserviceTemplateApi.EServiceTemplate
): m2mGatewayApi.EServiceTemplate => ({
  id: template.id,
  creatorId: template.creatorId,
  description: template.description,
  intendedTarget: template.intendedTarget,
  mode: template.mode,
  name: template.name,
  technology: template.technology,
  versions: template.versions,
  isSignalHubEnabled: template.isSignalHubEnabled,
});
