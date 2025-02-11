import {
  ReadEvent,
  readLastEventByStreamId,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Attribute,
  EServiceTemplate,
  EServiceTemplateEvent,
  EServiceTemplateId,
  RiskAnalysis,
  Tenant,
  toEServiceTemplateV2,
  toReadModelAttribute,
  toReadModelTenant,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { riskAnalysisFormToRiskAnalysisFormToValidate } from "pagopa-interop-commons";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";
import {
  eServiceModeToApiEServiceMode,
  eserviceTemplateToApiEServiceTemplate,
  technologyToApiTechnology,
} from "../src/model/domain/apiConverter.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const eserviceTemplates = readModelRepository.eserviceTemplates;
export const attributes = readModelRepository.attributes;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const tenants = readModelRepository.tenants;

export const eserviceTemplateService = eserviceTemplateServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);

export const writeEServiceTemplateInEventstore = async (
  eserviceTemplate: EServiceTemplate
): Promise<void> => {
  const eserviceTemplateEvent: EServiceTemplateEvent = {
    type: "EServiceTemplateAdded",
    event_version: 2,
    data: { eserviceTemplate: toEServiceTemplateV2(eserviceTemplate) },
  };
  const eventToWrite: StoredEvent<EServiceTemplateEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: eserviceTemplateEvent.data.eserviceTemplate!.id,
    version: 0,
    event: eserviceTemplateEvent,
  };

  await writeInEventstore(eventToWrite, "eservice_template", postgresDB);
};

export const addOneEServiceTemplate = async (
  eserviceTemplate: EServiceTemplate
): Promise<void> => {
  await writeEServiceTemplateInEventstore(eserviceTemplate);
  await writeInReadmodel(eserviceTemplate, eserviceTemplates);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const readLastEserviceTemplateEvent = async (
  eserviceTemplateId: EServiceTemplateId
): Promise<ReadEvent<EServiceTemplateEvent>> =>
  await readLastEventByStreamId(
    eserviceTemplateId,
    "eservice_template",
    postgresDB
  );

export const buildRiskAnalysisSeed = (
  riskAnalysis: RiskAnalysis
): eserviceTemplateApi.EServiceRiskAnalysisSeed => ({
  name: riskAnalysis.name,
  riskAnalysisForm: riskAnalysisFormToRiskAnalysisFormToValidate(
    riskAnalysis.riskAnalysisForm
  ),
});

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};

export const eserviceTemplateToApiEServiceTemplateSeed = (
  eserviceTemplate: EServiceTemplate
): eserviceTemplateApi.EServiceTemplateSeed => {
  const apiEserviceTemplate =
    eserviceTemplateToApiEServiceTemplate(eserviceTemplate);

  return {
    ...apiEserviceTemplate,
    version: apiEserviceTemplate.versions[0],
  };
};

export const eserviceTemplateToApiUpdateEServiceTemplateSeed = (
  eserviceTemplate: EServiceTemplate
): eserviceTemplateApi.UpdateEServiceTemplateSeed => ({
  name: eserviceTemplate.name,
  audienceDescription: eserviceTemplate.audienceDescription,
  eserviceDescription: eserviceTemplate.eserviceDescription,
  technology: technologyToApiTechnology(eserviceTemplate.technology),
  mode: eServiceModeToApiEServiceMode(eserviceTemplate.mode),
  isSignalHubEnabled: eserviceTemplate.isSignalHubEnabled,
});
