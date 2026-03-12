/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { setupTestContainersVitest } from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  Attribute,
  AttributeEvent,
  AttributeId,
  Tenant,
  toAttributeV1,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
} from "pagopa-interop-commons-test";
import {
  attributeReadModelServiceBuilder,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import {
  upsertAttribute,
  upsertTenant,
} from "pagopa-interop-readmodel/testUtils";
import { attributeRegistryServiceBuilder } from "../src/services/attributeRegistryService.js";
import { readModelServiceBuilderSQL } from "../src/services/readModelServiceSQL.js";

export const { cleanup, postgresDB, readModelDB } =
  await setupTestContainersVitest(
    inject("eventStoreConfig"),
    undefined,
    undefined,
    undefined,
    undefined,
    inject("readModelSQLConfig")
  );

afterEach(cleanup);

const attributeReadModelServiceSQL =
  attributeReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);

export const readModelService = readModelServiceBuilderSQL({
  readModelDB,
  attributeReadModelServiceSQL,
  tenantReadModelServiceSQL,
});

export const attributeRegistryService = attributeRegistryServiceBuilder(
  postgresDB,
  readModelService
);

const writeAttributeInEventstore = async (
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
  await upsertAttribute(readModelDB, attribute, 0);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await upsertTenant(readModelDB, tenant, 0);
};

export const readLastAttributeEvent = async (
  attributeId: AttributeId
): Promise<ReadEvent<AttributeEvent>> =>
  await readLastEventByStreamId(attributeId, "attribute", postgresDB);
