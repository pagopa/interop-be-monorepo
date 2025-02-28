import { match } from "ts-pattern";
import {
  AttributeEventEnvelope,
  fromAttributeV1,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ReadModelAttributeServiceSQL } from "pagopa-interop-readmodel";

export async function handleMessage(
  message: AttributeEventEnvelope,
  readModelAttributeService: ReadModelAttributeServiceSQL
): Promise<void> {
  await match(message)
    .with({ type: "AttributeAdded" }, async (msg) => {
      if (!msg.data.attribute) {
        throw genericInternalError(`Attribute not found in message data`);
      }

      await readModelAttributeService.upsertAttribute({
        data: fromAttributeV1(msg.data.attribute),
        metadata: { version: msg.version },
      });
    })
    .with({ type: "MaintenanceAttributeDeleted" }, async (msg) => {
      await readModelAttributeService.deleteAttributeById(
        unsafeBrandId(msg.stream_id),
        msg.version
      );
    })
    .exhaustive();
}
