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

export function toBffEServiceDescriptorsPurposeTemplate(
  eserviceDescriptorPurposeTemplate: purposeTemplateApi.EServiceDescriptorPurposeTemplate,
  eservice: bffApi.CompactEService,
  descriptor: bffApi.CompactDescriptor
): bffApi.EServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor {
  return {
    purposeTemplateId: eserviceDescriptorPurposeTemplate.purposeTemplateId,
    eservice,
    descriptor,
    createdAt: eserviceDescriptorPurposeTemplate.createdAt,
  };
}
