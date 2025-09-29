import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  catalogReadModelServiceBuilder,
  eserviceTemplateReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  EService,
  EServiceEvent,
  toEServiceV2,
  EServiceTemplate,
  EServiceTemplateEvent,
  toEServiceTemplateV2,
  Attribute,
  Tenant,
  Agreement,
  Delegation,
  EServiceId,
} from "pagopa-interop-models";
import {
  upsertAgreement,
  upsertAttribute,
  upsertDelegation,
  upsertEService,
  upsertEServiceTemplate,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

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

const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL(
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  eserviceTemplateReadModelServiceSQL
);

export const catalogService = catalogServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);
export const writeEServiceInEventstore = async (
  eservice: EService
): Promise<void> => {
  const eserviceEvent: EServiceEvent = {
    type: "EServiceAdded",
    event_version: 2,
    data: { eservice: toEServiceV2(eservice) },
  };
  const eventToWrite: StoredEvent<EServiceEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: eserviceEvent.data.eservice!.id,
    version: 0,
    event: eserviceEvent,
  };

  await writeInEventstore(eventToWrite, "catalog", postgresDB);
};

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

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeEServiceInEventstore(eservice);
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await upsertDelegation(readModelDB, delegation, 0);
};

export const readLastEserviceEvent = async (
  eserviceId: EServiceId
): Promise<ReadEvent<EServiceEvent>> =>
  await readLastEventByStreamId(eserviceId, "catalog", postgresDB);

export const addOneEServiceTemplate = async (
  eServiceTemplate: EServiceTemplate
): Promise<void> => {
  await writeEServiceTemplateInEventstore(eServiceTemplate);
  await upsertEServiceTemplate(readModelDB, eServiceTemplate, 0);
};
