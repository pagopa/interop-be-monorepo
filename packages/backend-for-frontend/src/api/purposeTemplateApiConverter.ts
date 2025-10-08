import {
  bffApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { toBffCompactOrganization } from "./agreementApiConverter.js";

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

export function toBffCatalogPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate,
  creator: tenantApi.Tenant
): bffApi.CatalogPurposeTemplate {
  return {
    id: purposeTemplate.id,
    targetTenantKind: purposeTemplate.targetTenantKind,
    purposeTitle: purposeTemplate.purposeTitle,
    purposeDescription: purposeTemplate.purposeDescription,
    creator: toBffCompactOrganization(creator),
  };
}

export function toCompactPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate
): bffApi.CompactPurposeTemplate {
  return {
    id: purposeTemplate.id,
    purposeTitle: purposeTemplate.purposeTitle,
  };
}
