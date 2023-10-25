import { match } from "ts-pattern";
import {
  AttributeAddedV1,
  AttributeDeletedV1,
} from "../gen/v1/attribute/events.js";

export function attributeEventToBinaryData(event: AttributeEvent): Uint8Array {
  return match(event)
    .with({ type: "AttributeDeleted" }, ({ data }) =>
      AttributeDeletedV1.toBinary(data)
    )
    .with({ type: "AttributeAdded" }, ({ data }) =>
      AttributeAddedV1.toBinary(data)
    )
    .exhaustive();
}

export type AttributeEvent =
  | { type: "AttributeAdded"; data: AttributeAddedV1 }
  | {
      type: "AttributeDeleted";
      data: AttributeDeletedV1;
    };
