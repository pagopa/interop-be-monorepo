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
import { splitAttributeIntoObjectsSQL } from "pagopa-interop-readmodel";
import { DBContext } from "../../db/db.js";
import { attributeServiceBuilder } from "../../service/attributeService.js";
import {
  AttributeSchema,
  AttributeDeletingSchema,
} from "../../model/attribute/attribute.js";

export async function handleAttributeMessageV1(
  messages: AttributeEventEnvelope[],
  dbContext: DBContext
): Promise<void> {
  const attributeService = attributeServiceBuilder(dbContext);

  const upsertBatch: AttributeSchema[] = [];
  const deleteBatch: AttributeDeletingSchema[] = [];

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
        const attribute = AttributeSchema.parse(attributeSql);
        upsertBatch.push(attribute);
      })
      .with({ type: "MaintenanceAttributeDeleted" }, (msg) => {
        const attributeId = unsafeBrandId<AttributeId>(msg.data.id);
        deleteBatch.push({
          id: attributeId,
          deleted: true,
        });
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
