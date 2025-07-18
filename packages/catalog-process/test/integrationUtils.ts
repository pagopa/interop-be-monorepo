import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  attributeReadModelServiceBuilder,
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
  toReadModelEService,
  Attribute,
  toReadModelAttribute,
  Tenant,
  toReadModelTenant,
  Agreement,
  toReadModelAgreement,
  Delegation,
  EServiceId,
} from "pagopa-interop-models";
import {
  upsertAgreement,
  upsertDelegation,
} from "pagopa-interop-readmodel/testUtils";
import { catalogServiceBuilder } from "../src/services/catalogService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
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

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;
export const delegations = readModelRepository.delegations;
export const eserviceTemplates = readModelRepository.eserviceTemplates;

const attributeReadModelService = attributeReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const eserviceTemplateReadModelServiceSQL =
  eserviceTemplateReadModelServiceBuilder(readModelDB);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(
  readModelDB,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
  eserviceTemplateReadModelServiceSQL
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

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
  await writeInReadmodel(toReadModelEService(eservice), eservices);
  await catalogReadModelServiceSQL.upsertEService(eservice, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
  await attributeReadModelService.upsertAttribute(attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
  await tenantReadModelServiceSQL.upsertTenant(tenant, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await writeInReadmodel(toReadModelAgreement(agreement), agreements);
  await upsertAgreement(readModelDB, agreement, 0);
};

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
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
  await writeInReadmodel(eServiceTemplate, eserviceTemplates);
  await eserviceTemplateReadModelServiceSQL.upsertEServiceTemplate(
    eServiceTemplate,
    0
  );
};
