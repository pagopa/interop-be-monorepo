/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  AttributeEventEnvelope,
  AttributeId,
  fromAttributeV1,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { AttributeSQL } from "pagopa-interop-readmodel-models";
import { splitAttributeIntoObjectsSQL } from "pagopa-interop-readmodel";
import { DBContext } from "../../db/db.js";
import { attributeServiceBuilder } from "../../service/attributeService.js";

export async function handleAttributeMessageV1(
  messages: AttributeEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const attributeService = attributeServiceBuilder(dbContext);

  const upsertBatch: AttributeSQL[] = [];
  const deleteBatch: AttributeId[] = [];

  for (const message of messages) {
    match(message)
      .with({ type: "AttributeAdded" }, (msg) => {
        if (!msg.data.attribute) {
          throw genericInternalError(
            `Attribute can't be missing in the event message`
          );
        }
        const attributeSql = splitAttributeIntoObjectsSQL(
          fromAttributeV1(msg.data.attribute),
          msg.version
        );
        upsertBatch.push(attributeSql);
      })
      .with({ type: "MaintenanceAttributeDeleted" }, (msg) => {
        const attributeId = unsafeBrandId<AttributeId>(msg.data.id);
        deleteBatch.push(attributeId);
      })
      .exhaustive();
  }

  if (upsertBatch.length > 0) {
    await attributeService.upsertBatchAttribute(upsertBatch, dbContext);
  }

  if (deleteBatch.length > 0) {
    await attributeService.deleteBatchAttribute(deleteBatch, dbContext);
  }
}
