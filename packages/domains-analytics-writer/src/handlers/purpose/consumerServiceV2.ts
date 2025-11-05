/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
import {
  PurposeEventEnvelopeV2,
  fromPurposeV2,
  genericInternalError,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { splitPurposeIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { purposeServiceBuilder } from "../../service/purposeService.js";
import { DBContext } from "../../db/db.js";
import {
  PurposeDeletingSchema,
  PurposeItemsSchema,
} from "../../model/purpose/purpose.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handlePurposeMessageV2(
  messages: PurposeEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const purposeService = purposeServiceBuilder(dbContext);

  const upsertPurposeBatch: PurposeItemsSchema[] = [];
  const deletePurposeBatch: PurposeDeletingSchema[] = [];

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
            "PurposeVersionArchivedByRevokedDelegation",
            "WaitingForApprovalPurposeVersionDeleted"
          ),
        },
        (msg) => {
          if (!msg.data.purpose) {
            throw genericInternalError(
              `Purpose can't be missing in the event message`
            );
          }
          const splitResult = splitPurposeIntoObjectsSQL(
            fromPurposeV2(msg.data.purpose),
            msg.version
          );

          upsertPurposeBatch.push(
            PurposeItemsSchema.parse({
              purposeSQL: splitResult.purposeSQL,
              riskAnalysisFormSQL: splitResult.riskAnalysisFormSQL,
              riskAnalysisAnswersSQL: splitResult.riskAnalysisAnswersSQL,
              versionsSQL: splitResult.versionsSQL,
              versionDocumentsSQL: splitResult.versionDocumentsSQL,
              versionStampsSQL: splitResult.versionStampsSQL,
            } satisfies z.input<typeof PurposeItemsSchema>)
          );
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
        (msg) => {
          if (!msg.data.purpose) {
            throw genericInternalError(
              `Purpose can't be missing in the event message`
            );
          }
          deletePurposeBatch.push(
            PurposeDeletingSchema.parse({
              id: msg.data.purpose.id,
              deleted: true,
            } satisfies z.input<typeof PurposeDeletingSchema>)
          );
        }
      );
  }

  if (upsertPurposeBatch.length > 0) {
    await purposeService.upsertBatchPurpose(dbContext, upsertPurposeBatch);
  }

  if (deletePurposeBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deletePurposeBatch,
      PurposeDeletingSchema,
      ["id"]
    );
    await purposeService.deleteBatchPurpose(dbContext, distinctBatch);
  }
}
