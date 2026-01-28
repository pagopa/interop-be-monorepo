import {
  bffApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { genericError } from "pagopa-interop-models";
import { getRulesetExpiration } from "pagopa-interop-commons";
import { catalogEServiceTemplatePublishedVersionNotFound } from "../model/errors.js";
import {
  toBffCatalogApiEserviceRiskAnalysis,
  toBffCatalogCreator,
} from "./catalogApiConverter.js";
import { toBffCompactOrganization } from "./agreementApiConverter.js";

function toBffCompactEServiceTemplateVersion(
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
  const draftVersion = eserviceTemplate.versions.find(
    (v) =>
      v.state === eserviceTemplateApi.EServiceTemplateVersionState.Values.DRAFT
  );

  return {
    id: eserviceTemplate.id,
    name: eserviceTemplate.name,
    intendedTarget: eserviceTemplate.intendedTarget,
    description: eserviceTemplate.description,
    technology: eserviceTemplate.technology,
    creator: toBffCompactOrganization(creator),
    mode: eserviceTemplate.mode,
    riskAnalysis: eserviceTemplate.riskAnalysis.map(
      toBffEServiceTemplateApiEServiceTemplateRiskAnalysis
    ),
    versions: eserviceTemplate.versions.map(
      toBffCompactEServiceTemplateVersion
    ),
    isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
    draftVersion: draftVersion
      ? toBffCompactEServiceTemplateVersion(draftVersion)
      : undefined,
    personalData: eserviceTemplate.personalData,
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
    description: eserviceTemplate.intendedTarget,
    creator: toBffCatalogCreator(creator),
    publishedVersion: toBffCompactEServiceTemplateVersion(publishedVersion),
  };
}

export function toBffProducerEServiceTemplate(
  eserviceTemplate: eserviceTemplateApi.EServiceTemplate,
  entityIdsWithUnreadNotifications: string[]
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
    activeVersion: activeVersion
      ? toBffCompactEServiceTemplateVersion(activeVersion)
      : undefined,
    draftVersion: draftVersion
      ? toBffCompactEServiceTemplateVersion(draftVersion)
      : undefined,
    hasUnreadNotifications: entityIdsWithUnreadNotifications?.includes(
      eserviceTemplate.id
    ),
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

export function toCatalogCreateEServiceTemplateSeed(
  eServiceTemplateSeed: bffApi.EServiceTemplateSeed
): eserviceTemplateApi.EServiceTemplateSeed {
  return {
    ...eServiceTemplateSeed,
    version: {
      voucherLifespan: 60,
    },
  };
}

function toBffEServiceTemplateApiEServiceTemplateRiskAnalysis(
  riskAnalysis: eserviceTemplateApi.EServiceTemplateRiskAnalysis
): bffApi.EServiceTemplateRiskAnalysis {
  const tenantKind = riskAnalysis.tenantKind;
  const rulesetExpiration = getRulesetExpiration(
    tenantKind,
    riskAnalysis.riskAnalysisForm.version
  );
  return {
    ...toBffCatalogApiEserviceRiskAnalysis(
      riskAnalysis,
      rulesetExpiration?.toJSON()
    ),
    tenantKind,
  };
}
