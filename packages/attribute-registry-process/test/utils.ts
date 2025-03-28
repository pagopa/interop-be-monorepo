/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  Attribute,
  AttributeEvent,
  AttributeId,
  Tenant,
  generateId,
  toAttributeV1,
  toReadModelAttribute,
  toReadModelTenant,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { attributeRegistryServiceBuilder } from "../src/services/attributeRegistryService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";
import { config } from "../src/config/config.js";

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    undefined,
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

const db = makeDrizzleConnection(inject("readModelSQLConfig")!);
const attributeReadModelServiceSQL = attributeReadModelServiceBuilder(db);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(db);

const oldReadModelService = readModelServiceBuilder(readModelRepository);
const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL
);

export const readModelService = config.featureFlagSQL
  ? readModelServiceSQL
  : oldReadModelService;

export const attributeRegistryService = attributeRegistryServiceBuilder(
  postgresDB,
  readModelService
);

export const writeAttributeInEventstore = async (
  attribute: Attribute
): Promise<void> => {
  const attributeEvent: AttributeEvent = {
    type: "AttributeAdded",
    event_version: 1,
    data: { attribute: toAttributeV1(attribute) },
  };
  const eventToWrite: StoredEvent<AttributeEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: attributeEvent.data.attribute!.id,
    version: 0,
    event: attributeEvent,
  };

  await writeInEventstore(eventToWrite, "attribute", postgresDB);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeAttributeInEventstore(attribute);
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
  await attributeReadModelServiceSQL.upsertAttribute(attribute, 1);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
  await tenantReadModelServiceSQL.upsertTenant(tenant, 1);
};

export const readLastAttributeEvent = async (
  attributeId: AttributeId
): Promise<ReadEvent<AttributeEvent>> =>
  await readLastEventByStreamId(attributeId, "attribute", postgresDB);

export const getMockTenant = (): Tenant => ({
  name: "tenant_Name",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  externalId: {
    value: "1234",
    origin: "IPA",
  },
  features: [],
  mails: [],
});
