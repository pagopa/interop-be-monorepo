import {
  ReadEvent,
  readLastEventByStreamId,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Attribute,
  EService,
  EServiceTemplate,
  EServiceTemplateEvent,
  EServiceTemplateId,
  Tenant,
  toEServiceTemplateV2,
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
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";

export const { cleanup, postgresDB, fileManager, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    inject("fileManagerConfig"),
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  eserviceTemplateReadModelServiceSQL,
  tenantReadModelServiceSQL,
  attributeReadModelServiceSQL,
});

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
  await upsertEServiceTemplate(readModelDB, eserviceTemplate, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneEService = async (eservice: EService): Promise<void> => {
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
  await upsertTenant(readModelDB, tenant, 0);
};
