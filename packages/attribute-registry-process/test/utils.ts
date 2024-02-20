import {
  Attribute,
  AttributeEvent,
  Tenant,
  attributeEventToBinaryData,
  attributeKind,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import {
  AttributeCollection,
  AuthData,
  TenantCollection,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import { MessageType } from "@protobuf-ts/runtime";
import { toAttributeV1 } from "../src/model/domain/toEvent.js";

export const writeAttributeInEventstore = async (
  attribute: Attribute,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const attributeEvent: AttributeEvent = {
    type: "AttributeAdded",
    data: { attribute: toAttributeV1(attribute) },
  };
  const eventToWrite = {
    stream_id: attributeEvent.data.attribute?.id,
    version: 0,
    type: attributeEvent.type,
    data: Buffer.from(attributeEventToBinaryData(attributeEvent)),
  };

  await postgresDB.none(
    "INSERT INTO attribute.events(stream_id, version, type, data) VALUES ($1, $2, $3, $4)",
    [
      eventToWrite.stream_id,
      eventToWrite.version,
      eventToWrite.type,
      eventToWrite.data,
    ]
  );
};

export const writeAttributeInReadmodel = async (
  attribute: Attribute,
  attrbutes: AttributeCollection
): Promise<void> => {
  await attrbutes.insertOne({
    data: attribute,
    metadata: {
      version: 0,
    },
  });
};

export const writeTenantInReadmodel = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await tenants.insertOne({
    data: tenant,
    metadata: {
      version: 0,
    },
  });
};

export const addOneAttribute = async (
  attribute: Attribute,
  postgresDB: IDatabase<unknown>,
  attributes: AttributeCollection
): Promise<void> => {
  await writeAttributeInEventstore(attribute, postgresDB);
  await writeAttributeInReadmodel(attribute, attributes);
};

export const addOneTenant = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await writeTenantInReadmodel(tenant, tenants);
};

export const getMockAttribute = (): Attribute => ({
  id: uuidv4(),
  name: "attribute name",
  kind: attributeKind.certified,
  description: "attribute description",
  creationTime: new Date(),
  code: undefined,
  origin: undefined,
});

export const getMockTenant = (): Tenant => ({
  name: "tenant_Name",
  id: uuidv4(),
  createdAt: new Date(),
  attributes: [],
  externalId: {
    value: "1234",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

export const getMockAuthData = (organizationId?: string): AuthData => ({
  organizationId: organizationId || uuidv4(),
  userId: uuidv4(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});

export const readLastEventByStreamId = async (
  attributeId: string,
  postgresDB: IDatabase<unknown>
): Promise<any> => // eslint-disable-line @typescript-eslint/no-explicit-any
  await postgresDB.one(
    "SELECT * FROM attribute.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
    [attributeId]
  );

export function decodeProtobufPayload<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: Parameters<typeof Buffer.from>[0];
}): I {
  return messageType.fromBinary(Buffer.from(payload, "hex"));
}
