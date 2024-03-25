import {
  Attribute,
  AttributeEvent,
  AttributeId,
  Tenant,
  TenantId,
  attributeEventToBinaryData,
  attributeKind,
  generateId,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  AttributeCollection,
  AuthDataUI,
  TenantCollection,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import {
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import { toAttributeV1 } from "../src/model/domain/toEvent.js";

export const getMockAttribute = (): Attribute => ({
  id: generateId(),
  name: "attribute name",
  kind: attributeKind.certified,
  description: "attribute description",
  creationTime: new Date(),
  code: undefined,
  origin: undefined,
});

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

export const getMockAuthData = (organizationId?: TenantId): AuthDataUI => ({
  tokenType: "ui",
  organizationId: organizationId || generateId(),
  userId: uuidv4(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});

export const writeAttributeInEventstore = async (
  attribute: Attribute,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const attributeEvent: AttributeEvent = {
    type: "AttributeAdded",
    event_version: 1,
    data: { attribute: toAttributeV1(attribute) },
  };
  const eventToWrite = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: attributeEvent.data.attribute!.id,
    version: "0",
    type: attributeEvent.type,
    event_version: attributeEvent.event_version,
    data: attributeEventToBinaryData(attributeEvent),
  };

  await writeInEventstore(eventToWrite, "attribute", postgresDB);
};

export const addOneAttribute = async (
  attribute: Attribute,
  postgresDB: IDatabase<unknown>,
  attributes: AttributeCollection
): Promise<void> => {
  await writeAttributeInEventstore(attribute, postgresDB);
  await writeInReadmodel(attribute, attributes);
};

export const addOneTenant = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAttributeEvent = async (
  attributeId: AttributeId,
  postgresDB: IDatabase<unknown>
): Promise<StoredEvent> =>
  await readLastEventByStreamId(attributeId, "attribute", postgresDB);
