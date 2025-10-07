import {
  bffApi,
  catalogApi,
  purposeTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { toBffCompactOrganization } from "./agreementApiConverter.js";
import { toCompactDescriptor } from "./catalogApiConverter.js";

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

export function toCompactPurposeTemplateEService(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor,
  producer: tenantApi.Tenant
): bffApi.CompactPurposeTemplateEService {
  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: toBffCompactOrganization(producer),
    descriptor: toCompactDescriptor(descriptor),
  };
}

export function toBffEServiceDescriptorsPurposeTemplate(
  eserviceDescriptorPurposeTemplate: purposeTemplateApi.EServiceDescriptorPurposeTemplate,
  compactPurposeTemplateEService: bffApi.CompactPurposeTemplateEService
): bffApi.EServiceDescriptorPurposeTemplateWithCompactPurposeTemplateEService {
  return {
    purposeTemplateId: eserviceDescriptorPurposeTemplate.purposeTemplateId,
    eservice: compactPurposeTemplateEService,
    createdAt: eserviceDescriptorPurposeTemplate.createdAt,
  };
}
