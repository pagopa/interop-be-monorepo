import {
  Attribute,
  AttributeEvent,
  attributeEventToBinaryData,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { AttributeCollection } from "pagopa-interop-commons";
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

export const getMockAttribute = (): Attribute => ({
  id: uuidv4(),
  name: "attribute name",
  kind: "Certified",
  description: "attribute dscription",
  creationTime: new Date(),
  code: undefined,
  origin: undefined,
});

export function decode<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}): I {
  return messageType.fromBinary(Buffer.from(payload, "hex"));
}
