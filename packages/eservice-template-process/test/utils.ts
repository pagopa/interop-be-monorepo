import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Attribute,
  EServiceTemplate,
  EServiceTemplateEvent,
  EServiceTemplateId,
  EServiceTemplateVersion,
  toEServiceTemplateV2,
  toReadModelAttribute,
} from "pagopa-interop-models";
import { eserviceTemplateApi } from "pagopa-interop-api-clients";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";

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

export const eserviceTemplateService = eserviceTemplateServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);

export const writeEServiceInEventstore = async (
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
  await writeEServiceInEventstore(eserviceTemplate);
  await writeInReadmodel(eserviceTemplate, eserviceTemplates);
};

export const readLastEserviceTemplateEvent = async (
  eserviceTemplateId: EServiceTemplateId
): Promise<ReadEvent<EServiceTemplateEvent>> =>
  await readLastEventByStreamId(
    eserviceTemplateId,
    "eservice_template",
    postgresDB
  );

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const buildUpdateVersionSeed = (
  version: EServiceTemplateVersion
): eserviceTemplateApi.UpdateEServiceTemplateVersionSeed => ({
  voucherLifespan: version.voucherLifespan,
  dailyCallsPerConsumer: version.dailyCallsPerConsumer,
  dailyCallsTotal: version.dailyCallsTotal,
  agreementApprovalPolicy: "AUTOMATIC",
  description: version.description,
  attributes: {
    certified: [],
    declared: [],
    verified: [],
  },
});
