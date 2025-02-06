import {
  bffApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { catalogEServiceTemplatePublishedVersionNotFound } from "../model/errors.js";
import { toBffCatalogApiEserviceRiskAnalysis } from "./catalogApiConverter.js";
import { toBffCompactOrganization } from "./agreementApiConverter.js";

export function toBffCompactEServiceTemplateVersion(
  eserviceTemplateVersion: eserviceTemplateApi.EServiceTemplateVersion
): bffApi.CompactEServiceTemplateVersion {
  return {
    id: eserviceTemplateVersion.id,
    version: eserviceTemplateVersion.version,
    state: eserviceTemplateVersion.state,
  };
}

export function toBffEServiceTemplateApiEServiceTemplateDetails(
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  creator: tenantApi.Tenant
): bffApi.EServiceTemplateDetails {
  return {
    id: eserviceTemplate.id,
    name: eserviceTemplate.name,
    audienceDescription: eserviceTemplate.audienceDescription,
    eserviceDescription: eserviceTemplate.eserviceDescription,
    technology: eserviceTemplate.technology,
    creator: toBffCompactOrganization(creator),
    mode: eserviceTemplate.mode,
    riskAnalysis: eserviceTemplate.riskAnalysis.map(
      toBffCatalogApiEserviceRiskAnalysis
    ),
    versions: eserviceTemplate.versions.map(
      toBffCompactEServiceTemplateVersion
    ),
    isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
  };
}

export function toBffCatalogEServiceTemplate(
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  creator: tenantApi.Tenant
): bffApi.CatalogEServiceTemplate {
  const publishedVersion = eserviceTemplate.versions.find(
    (v) =>
      v.state ===
      eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED
  );

  if (!publishedVersion) {
    throw catalogEServiceTemplatePublishedVersionNotFound(eserviceTemplate.id);
  }

  return {
    id: eserviceTemplate.id,
    name: eserviceTemplate.name,
    description: eserviceTemplate.audienceDescription,
    creator: toBffCompactOrganization(creator),
    publishedVersion: toBffCompactEServiceTemplateVersion(publishedVersion),
  };
}

export function toBffProducerEServiceTemplate(
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate
): bffApi.ProducerEServiceTemplate {
  const activeVersion = eserviceTemplate.versions.find(
    (v) =>
      v.state ===
        eserviceTemplateApi.EServiceTemplateVersionState.Values.PUBLISHED ||
      v.state ===
        eserviceTemplateApi.EServiceTemplateVersionState.Values.SUSPENDED
  );

  const draftVersion = eserviceTemplate.versions.find(
    (v) =>
      v.state === eserviceTemplateApi.EServiceTemplateVersionState.Values.DRAFT
  );

  return {
    id: eserviceTemplate.id,
    name: eserviceTemplate.name,
    activeVersion,
    draftVersion,
  };
}
