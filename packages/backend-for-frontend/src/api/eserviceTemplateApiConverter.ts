import {
  bffApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { genericError } from "pagopa-interop-models";
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

export function toBffEServiceTemplateDetails(
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  creator: tenantApi.Tenant
): bffApi.EServiceTemplateDetails {
  return {
    id: eserviceTemplate.id,
    name: eserviceTemplate.name,
    templateDescription: eserviceTemplate.templateDescription,
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
    description: eserviceTemplate.templateDescription,
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
    mode: eserviceTemplate.mode,
    activeVersion,
    draftVersion,
  };
}

export const toBffCreatedEServiceTemplateVersion = (
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate
): bffApi.CreatedEServiceTemplateVersion => {
  const version = eserviceTemplate.versions.at(0);
  if (version === undefined) {
    throw genericError("No version found for the created EServiceTemplate");
  }
  return {
    id: eserviceTemplate.id,
    versionId: version.id,
  };
};
