/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { match, P } from "ts-pattern";
import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
  genericInternalError,
} from "pagopa-interop-models";
import { splitAgreementIntoObjectsSQL } from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { agreementServiceBuilder } from "../../service/agreementService.js";
import {
  AgreementItemsSchema,
  AgreementDeletingSchema,
} from "../../model/agreement/agreement.js";
import { AgreementConsumerDocumentDeletingSchema } from "../../model/agreement/agreementConsumerDocument.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleAgreementMessageV2(
  messages: AgreementEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const agreementService = agreementServiceBuilder(dbContext);

  const upsertAgreementBatch: AgreementItemsSchema[] = [];
  const deleteAgreementBatch: AgreementDeletingSchema[] = [];
  const deleteDocumentBatch: AgreementConsumerDocumentDeletingSchema[] = [];

  for (const message of messages) {
    match(message)
      .with(
        {
          type: P.union(
            "AgreementDeleted",
            "AgreementDeletedByRevokedDelegation"
          ),
        },
        (msg) => {
          if (!msg.data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }

          deleteAgreementBatch.push(
            AgreementDeletingSchema.parse({
              id: msg.data.agreement.id,
              deleted: true,
            } satisfies z.input<typeof AgreementDeletingSchema>)
          );
        }
      )
      .with({ type: "AgreementConsumerDocumentRemoved" }, (msg) => {
        deleteDocumentBatch.push(
          AgreementConsumerDocumentDeletingSchema.parse({
            id: msg.data.documentId,
            deleted: true,
          } satisfies z.input<typeof AgreementConsumerDocumentDeletingSchema>)
        );
      })
      .with(
        {
          type: P.union(
            "AgreementAdded",
            "DraftAgreementUpdated",
            "AgreementSubmitted",
            "AgreementActivated",
            "AgreementUpgraded",
            "AgreementUnsuspendedByProducer",
            "AgreementUnsuspendedByConsumer",
            "AgreementUnsuspendedByPlatform",
            "AgreementArchivedByConsumer",
            "AgreementArchivedByUpgrade",
            "AgreementSuspendedByProducer",
            "AgreementSuspendedByConsumer",
            "AgreementSuspendedByPlatform",
            "AgreementRejected",
            "AgreementConsumerDocumentAdded",
            "AgreementSetDraftByPlatform",
            "AgreementSetMissingCertifiedAttributesByPlatform",
            "AgreementArchivedByRevokedDelegation"
          ),
        },
        (msg) => {
          if (!msg.data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }

          const result = splitAgreementIntoObjectsSQL(
            fromAgreementV2(msg.data.agreement),
            msg.version
          );

          upsertAgreementBatch.push(
            AgreementItemsSchema.parse({
              agreementSQL: result.agreementSQL,
              attributesSQL: result.attributesSQL,
              consumerDocumentsSQL: result.consumerDocumentsSQL,
              contractSQL: result.contractSQL,
              stampsSQL: result.stampsSQL,
            } satisfies z.input<typeof AgreementItemsSchema>)
          );
        }
      )
      .exhaustive();
  }

  if (upsertAgreementBatch.length > 0) {
    await agreementService.upsertBatchAgreement(
      dbContext,
      upsertAgreementBatch
    );
  }

  if (deleteAgreementBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteAgreementBatch,
      AgreementDeletingSchema,
      ["id"]
    );
    await agreementService.deleteBatchAgreement(dbContext, distinctBatch);
  }

  if (deleteDocumentBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteDocumentBatch,
      AgreementConsumerDocumentDeletingSchema,
      ["id"]
    );
    await agreementService.deleteBatchAgreementDocument(
      dbContext,
      distinctBatch
    );
  }
}
