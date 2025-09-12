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
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import {
  PurposeItemsSchema,
  PurposeDeletingSchema,
} from "../../model/purpose/purpose.js";
import {
  PurposeVersionItemsSchema,
  PurposeVersionDeletingSchema,
} from "../../model/purpose/purposeVersion.js";
import { purposeServiceBuilder } from "../../service/purposeService.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handlePurposeMessageV1(
  messages: PurposeEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const purposeService = purposeServiceBuilder(dbContext);

  const upsertPurposeBatch: PurposeItemsSchema[] = [];
  const upsertVersionBatch: PurposeVersionItemsSchema[] = [];
  const deletePurposeBatch: PurposeDeletingSchema[] = [];
  const deleteVersionBatch: PurposeVersionDeletingSchema[] = [];

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
        (msg) => {
          if (!msg.data.purpose) {
            throw genericInternalError(
              `Purpose can't be missing in the event message`
            );
          }
          const splitResult = splitPurposeIntoObjectsSQL(
            fromPurposeV1(msg.data.purpose),
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
        { type: P.union("PurposeVersionCreated", "PurposeVersionUpdated") },
        (msg) => {
          if (!msg.data.version) {
            throw genericInternalError(
              `Purpose version can't be missing in the event message`
            );
          }
          const splitResult = splitPurposeVersionIntoObjectsSQL(
            unsafeBrandId<PurposeId>(msg.data.purposeId),
            fromPurposeVersionV1(msg.data.version),
            msg.version
          );
          upsertVersionBatch.push(
            PurposeVersionItemsSchema.parse({
              versionSQL: splitResult.versionSQL,
              versionDocumentSQL: splitResult.versionDocumentSQL,
            } satisfies z.input<typeof PurposeVersionItemsSchema>)
          );
        }
      )
      .with({ type: "PurposeDeleted" }, (msg) => {
        deletePurposeBatch.push(
          PurposeDeletingSchema.parse({
            id: msg.data.purposeId,
            deleted: true,
          } satisfies z.input<typeof PurposeDeletingSchema>)
        );
      })
      .with({ type: "PurposeVersionDeleted" }, (msg) => {
        deleteVersionBatch.push(
          PurposeVersionDeletingSchema.parse({
            id: msg.data.versionId,
          } satisfies z.input<typeof PurposeDeletingSchema>)
        );
      })
      .exhaustive();
  }

  if (upsertPurposeBatch.length) {
    await purposeService.upsertBatchPurpose(dbContext, upsertPurposeBatch);
  }

  if (upsertVersionBatch.length) {
    await purposeService.upsertBatchPurposeVersion(
      dbContext,
      upsertVersionBatch
    );
  }

  if (deletePurposeBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deletePurposeBatch,
      PurposeDeletingSchema,
      ["id"]
    );
    await purposeService.deleteBatchPurpose(dbContext, distinctBatch);
  }

  if (deleteVersionBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteVersionBatch,
      PurposeVersionDeletingSchema,
      ["id"]
    );
    await purposeService.deleteBatchPurposeVersion(dbContext, distinctBatch);
  }
}
