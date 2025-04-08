/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  AttributeEventEnvelope,
  Attribute,
  AttributeId,
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
        const parsed = Attribute.parse(msg.data.attribute);
        const attributeSql = splitAttributeIntoObjectsSQL(parsed, msg.version);
        upsertBatch.push(attributeSql);
      })
      .with({ type: "MaintenanceAttributeDeleted" }, (msg) => {
        const attributeId = AttributeId.parse(msg.data.id);
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
