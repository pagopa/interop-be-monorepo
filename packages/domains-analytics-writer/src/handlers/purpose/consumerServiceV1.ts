/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  fromPurposeV1,
  fromPurposeVersionV1,
  genericInternalError,
  PurposeEventEnvelopeV1,
  PurposeId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import {
  splitPurposeIntoObjectsSQL,
  splitPurposeVersionIntoObjectsSQL,
} from "pagopa-interop-readmodel";
import {
  PurposeItemsSQL,
  PurposeVersionSQL,
  PurposeVersionDocumentSQL,
} from "pagopa-interop-readmodel-models";
import { purposeServiceBuilder } from "../../service/purposeService.js";
import { DBContext } from "../../db/db.js";

export async function handlePurposeMessageV1(
  messages: PurposeEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const purposeService = purposeServiceBuilder(dbContext);

  const upsertPurposeBatch: PurposeItemsSQL[] = [];
  const upsertVersionBatch: Array<{
    versionSQL: PurposeVersionSQL;
    versionDocumentSQL?: PurposeVersionDocumentSQL;
  }> = [];
  const deletePurposeBatch: string[] = [];
  const deleteVersionBatch: string[] = [];

  for (const msg of messages) {
    match(msg)
      .with(
        {
          type: P.union(
            "PurposeCreated",
            "PurposeUpdated",
            "PurposeVersionActivated",
            "PurposeVersionSuspended",
            "PurposeVersionArchived",
            "PurposeVersionWaitedForApproval",
            "PurposeVersionRejected"
          ),
        },
        (m) => {
          if (!m.data.purpose) {
            throw genericInternalError(
              `Purpose can't be missing in the event message`
            );
          }
          const item = splitPurposeIntoObjectsSQL(
            fromPurposeV1(m.data.purpose),
            m.version
          );
          upsertPurposeBatch.push(item);
        }
      )
      .with(
        { type: P.union("PurposeVersionCreated", "PurposeVersionUpdated") },
        (m) => {
          if (!m.data.version) {
            throw genericInternalError(
              `Purpose version can't be missing in the event message`
            );
          }
          const { versionSQL, versionDocumentSQL } =
            splitPurposeVersionIntoObjectsSQL(
              unsafeBrandId<PurposeId>(m.data.purposeId),
              fromPurposeVersionV1(m.data.version),
              m.version
            );
          upsertVersionBatch.push({ versionSQL, versionDocumentSQL });
        }
      )
      .with({ type: "PurposeDeleted" }, (m) => {
        deletePurposeBatch.push(m.data.purposeId);
      })
      .with({ type: "PurposeVersionDeleted" }, (m) => {
        deleteVersionBatch.push(m.data.versionId);
      })
      .exhaustive();
  }

  if (upsertPurposeBatch.length) {
    await purposeService.upsertBatchPurpose(upsertPurposeBatch, dbContext);
  }
  if (upsertVersionBatch.length) {
    await purposeService.upsertBatchPurposeVersion(
      upsertVersionBatch,
      dbContext
    );
  }
  if (deletePurposeBatch.length) {
    await purposeService.deleteBatchPurpose(deletePurposeBatch, dbContext);
  }
  if (deleteVersionBatch.length) {
    await purposeService.deleteBatchPurposeVersion(
      deleteVersionBatch,
      dbContext
    );
  }
}
