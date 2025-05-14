/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  PurposeEventEnvelopeV2,
  fromPurposeV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitPurposeIntoObjectsSQL } from "pagopa-interop-readmodel";
import { PurposeItemsSQL } from "pagopa-interop-readmodel-models";
import { purposeServiceBuilder } from "../../service/purposeService.js";
import { DBContext } from "../../db/db.js";

export async function handlePurposeMessageV2(
  messages: PurposeEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const purposeService = purposeServiceBuilder(dbContext);

  const upsertPurposeBatch: PurposeItemsSQL[] = [];
  const deletePurposeBatch: string[] = [];
  const deleteVersionBatch: string[] = [];

  for (const msg of messages) {
    match(msg)
      .with(
        {
          type: P.union(
            "PurposeAdded",
            "DraftPurposeUpdated",
            "PurposeWaitingForApproval",
            "PurposeActivated",
            "PurposeArchived",
            "NewPurposeVersionActivated",
            "NewPurposeVersionWaitingForApproval",
            "PurposeVersionActivated",
            "PurposeVersionUnsuspendedByProducer",
            "PurposeVersionUnsuspendedByConsumer",
            "PurposeVersionSuspendedByProducer",
            "PurposeVersionSuspendedByConsumer",
            "PurposeVersionOverQuotaUnsuspended",
            "PurposeVersionRejected",
            "PurposeCloned",
            "PurposeVersionArchivedByRevokedDelegation"
          ),
        },
        (m) => {
          if (!m.data.purpose) {
            throw genericInternalError("Missing purpose");
          }
          const item = splitPurposeIntoObjectsSQL(
            fromPurposeV2(m.data.purpose),
            m.version
          );
          upsertPurposeBatch.push(item);
        }
      )
      .with(
        {
          type: P.union(
            "DraftPurposeDeleted",
            "WaitingForApprovalPurposeDeleted",
            "PurposeDeletedByRevokedDelegation"
          ),
        },
        (m) => {
          if (!m.data.purpose) {
            throw genericInternalError("Missing purpose");
          }
          deletePurposeBatch.push(m.data.purpose?.id);
        }
      )
      .with(
        {
          type: P.union("WaitingForApprovalPurposeVersionDeleted"),
        },
        (m) => {
          deleteVersionBatch.push(m.data.versionId);
        }
      )
      .exhaustive();
  }

  if (upsertPurposeBatch.length) {
    await purposeService.upsertBatchPurpose(upsertPurposeBatch, dbContext);
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
