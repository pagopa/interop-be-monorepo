import {
  ReadEvent,
  readLastEventByStreamId,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  EService,
  Tenant,
  Attribute,
  EServiceId,
  EServiceEvent,
  Agreement,
} from "pagopa-interop-models";
import {
  upsertAgreement,
  upsertAttribute,
  upsertEService,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { catalogProcessClientBuilder } from "../src/services/catalogProcessClient.js";
import { config } from "../src/config/config.js";

export const { cleanup, postgresDB, fileManager, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

export const readModelService = readModelServiceBuilderSQL(readModelDB);

export const catalogService = catalogProcessClientBuilder(
  config.catalogProcessUrl
);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await upsertEService(readModelDB, eservice, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneAgreement = async (agreement: Agreement): Promise<void> => {
  await upsertAgreement(readModelDB, agreement, 0);
};

export const readLastEserviceEvent = async (
  eserviceId: EServiceId
): Promise<ReadEvent<EServiceEvent>> =>
  await readLastEventByStreamId(eserviceId, "catalog", postgresDB);
