import {
  bffApi,
  eserviceTemplateApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { toBffCatalogApiEserviceRiskAnalysis } from "./catalogApiConverter.js";

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
    creator: {
      id: creator.id,
      name: creator.name,
    },
    mode: eserviceTemplate.mode,
    riskAnalysis: eserviceTemplate.riskAnalysis.map(
      toBffCatalogApiEserviceRiskAnalysis
    ),
    versions: eserviceTemplate.versions,
    isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
  };
}
