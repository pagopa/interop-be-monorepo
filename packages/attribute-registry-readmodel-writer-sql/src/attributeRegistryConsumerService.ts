import { match } from "ts-pattern";
import {
  AttributeEventEnvelope,
  fromAttributeV1,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { AttributeWriterService } from "./attributeWriterService.js";

export async function handleMessage(
  message: AttributeEventEnvelope,
  attributeWriterService: AttributeWriterService
): Promise<void> {
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      if (!msg.data.attribute) {
        throw genericInternalError(`Attribute not found in message data`);
      }

      await attributeWriterService.upsertAttribute(
        fromAttributeV1(msg.data.attribute),
        msg.version
      );
    })
    .with({ type: "MaintenanceAttributeDeleted" }, async (msg) => {
      await attributeWriterService.deleteAttributeById(
        unsafeBrandId(msg.stream_id),
        msg.version
      );
    })
    .exhaustive();
}
