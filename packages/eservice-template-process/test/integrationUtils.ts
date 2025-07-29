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
  EService,
  EServiceTemplate,
  EServiceTemplateEvent,
  EServiceTemplateId,
  Tenant,
  toReadModelTenant,
  toEServiceTemplateV2,
  toReadModelAttribute,
  toReadModelEService,
} from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAttribute,
  upsertEService,
  upsertEServiceTemplate,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";
import { config } from "../src/config/config.js";

export const {
  cleanup,
  readModelRepository,
  postgresDB,
  fileManager,
  readModelDB,
} = await setupTestContainersVitest(
  inject("readModelConfig"),
  inject("eventStoreConfig"),
  inject("fileManagerConfig"),
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const eserviceTemplates = readModelRepository.eserviceTemplates;
export const attributes = readModelRepository.attributes;

const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  eserviceTemplateReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
});
export const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const tenants = readModelRepository.tenants;
export const eservices = readModelRepository.eservices;

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

  await upsertEServiceTemplate(readModelDB, eserviceTemplate, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);

  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);

  await upsertEService(readModelDB, eservice, 0);
};

export const readLastEserviceTemplateEvent = async (
  eserviceTemplateId: EServiceTemplateId
): Promise<ReadEvent<EServiceTemplateEvent>> =>
  await readLastEventByStreamId(
    eserviceTemplateId,
    "eservice_template",
    postgresDB
  );

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);

  await upsertTenant(readModelDB, tenant, 0);
};
