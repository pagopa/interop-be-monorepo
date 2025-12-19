import {
  bffApi,
  catalogApi,
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

export function toCompactPurposeTemplateEService(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.CompactPurposeTemplateEService {
  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: toBffCompactOrganization(producer),
  };
}

export function toBffEServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor(
  eserviceDescriptorPurposeTemplate: purposeTemplateApi.EServiceDescriptorPurposeTemplate,
  eservice: bffApi.CompactPurposeTemplateEService,
  descriptor: bffApi.CompactDescriptor
): bffApi.EServiceDescriptorPurposeTemplateWithCompactEServiceAndDescriptor {
  return {
    purposeTemplateId: eserviceDescriptorPurposeTemplate.purposeTemplateId,
    eservice,
    descriptor,
    createdAt: eserviceDescriptorPurposeTemplate.createdAt,
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

export function toBffPurposeTemplateWithCompactCreator(
  purposeTemplate: purposeTemplateApi.PurposeTemplate,
  creator: tenantApi.Tenant,
  annotationDocuments: purposeTemplateApi.RiskAnalysisTemplateAnswerAnnotationDocument[]
): bffApi.PurposeTemplateWithCompactCreator {
  return {
    id: purposeTemplate.id,
    targetDescription: purposeTemplate.targetDescription,
    targetTenantKind: purposeTemplate.targetTenantKind,
    state: purposeTemplate.state,
    createdAt: purposeTemplate.createdAt,
    updatedAt: purposeTemplate.updatedAt,
    purposeTitle: purposeTemplate.purposeTitle,
    purposeDescription: purposeTemplate.purposeDescription,
    purposeRiskAnalysisForm: purposeTemplate.purposeRiskAnalysisForm,
    purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
    purposeFreeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason,
    purposeDailyCalls: purposeTemplate.purposeDailyCalls,
    creator: toBffCompactOrganization(creator),
    handlesPersonalData: purposeTemplate.handlesPersonalData,
    annotationDocuments,
  };
}

export function toBffPurposeTemplate(
  purposeTemplate: purposeTemplateApi.PurposeTemplate
): bffApi.PurposeTemplate {
  return {
    id: purposeTemplate.id,
    targetDescription: purposeTemplate.targetDescription,
    targetTenantKind: purposeTemplate.targetTenantKind,
    state: purposeTemplate.state,
    createdAt: purposeTemplate.createdAt,
    updatedAt: purposeTemplate.updatedAt,
    purposeTitle: purposeTemplate.purposeTitle,
    purposeDescription: purposeTemplate.purposeDescription,
    purposeRiskAnalysisForm: purposeTemplate.purposeRiskAnalysisForm,
    purposeIsFreeOfCharge: purposeTemplate.purposeIsFreeOfCharge,
    purposeFreeOfChargeReason: purposeTemplate.purposeFreeOfChargeReason,
    purposeDailyCalls: purposeTemplate.purposeDailyCalls,
    creatorId: purposeTemplate.creatorId,
    handlesPersonalData: purposeTemplate.handlesPersonalData,
  };
}
