import { bffApi, purposeTemplateApi } from "pagopa-interop-api-clients";

export function toBffCreatorPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate
): bffApi.CreatorPurposeTemplate {
  return {
    id: purposeTemplate.id,
    targetTenantKind: purposeTemplate.targetTenantKind,
    purposeTitle: purposeTemplate.purposeTitle,
    state: purposeTemplate.state,
  };
}
