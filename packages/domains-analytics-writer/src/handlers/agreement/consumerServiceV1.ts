/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { match, P } from "ts-pattern";
import {
  AgreementEventEnvelopeV1,
  AgreementId,
  unsafeBrandId,
  genericInternalError,
  fromAgreementV1,
  fromAgreementDocumentV1,
} from "pagopa-interop-models";

import {
  splitAgreementIntoObjectsSQL,
  agreementDocumentToAgreementDocumentSQL,
  agreementConsumerDocumentToAgreementConsumerDocumentSQL,
} from "pagopa-interop-readmodel";
import { z } from "zod";
import { DBContext } from "../../db/db.js";
import { agreementServiceBuilder } from "../../service/agreementService.js";
import {
  AgreementConsumerDocumentDeletingSchema,
  AgreementConsumerDocumentSchema,
} from "../../model/agreement/agreementConsumerDocument.js";
import {
  AgreementDeletingSchema,
  AgreementItemsSchema,
} from "../../model/agreement/agreement.js";
import { AgreementContractSchema } from "../../model/agreement/agreementContract.js";
import { distinctByKeys } from "../../utils/sqlQueryHelper.js";

export async function handleAgreementMessageV1(
  messages: AgreementEventEnvelopeV1[],
  dbContext: DBContext
): Promise<void> {
  const agreementService = agreementServiceBuilder(dbContext);

  const upsertAgreementBatch: AgreementItemsSchema[] = [];
  const upsertDocumentBatch: AgreementConsumerDocumentSchema[] = [];
  const upsertContractBatch: AgreementContractSchema[] = [];
  const deleteDocumentBatch: AgreementConsumerDocumentDeletingSchema[] = [];
  const deleteAgreementBatch: AgreementDeletingSchema[] = [];

  for (const message of messages) {
    match(message)
      .with(
        {
          type: P.union(
            "AgreementAdded",
            "AgreementUpdated",
            "AgreementActivated",
            "AgreementSuspended",
            "AgreementDeactivated",
            "VerifiedAttributeUpdated"
          ),
        },
        (msg) => {
          if (!msg.data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }

          const result = splitAgreementIntoObjectsSQL(
            fromAgreementV1(msg.data.agreement),
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
      .with({ type: "AgreementConsumerDocumentAdded" }, (msg) => {
        if (!msg.data.document) {
          throw genericInternalError(
            `Agreement document can't be missing in the event message`
          );
        }

        const document =
          agreementConsumerDocumentToAgreementConsumerDocumentSQL(
            fromAgreementDocumentV1(msg.data.document),
            unsafeBrandId<AgreementId>(msg.data.agreementId),
            msg.version
          );

        upsertDocumentBatch.push(
          AgreementConsumerDocumentSchema.parse(
            document satisfies z.input<typeof AgreementConsumerDocumentSchema>
          )
        );
      })
      .with({ type: "AgreementConsumerDocumentRemoved" }, (msg) => {
        deleteDocumentBatch.push(
          AgreementConsumerDocumentDeletingSchema.parse({
            id: msg.data.documentId,
          } satisfies z.input<typeof AgreementConsumerDocumentDeletingSchema>)
        );
      })
      .with({ type: "AgreementContractAdded" }, (msg) => {
        if (!msg.data.contract) {
          throw genericInternalError(
            `Agreement contract can't be missing in the event message`
          );
        }

        const contract = agreementDocumentToAgreementDocumentSQL(
          fromAgreementDocumentV1(msg.data.contract),
          unsafeBrandId<AgreementId>(msg.data.agreementId),
          msg.version
        );

        upsertContractBatch.push(
          AgreementContractSchema.parse(
            contract satisfies z.input<typeof AgreementContractSchema>
          )
        );
      })
      .with({ type: "AgreementDeleted" }, (msg) => {
        deleteAgreementBatch.push(
          AgreementDeletingSchema.parse({
            id: msg.data.agreementId,
            deleted: true,
          } satisfies z.input<typeof AgreementDeletingSchema>)
        );
      })
      .exhaustive();
  }

  if (upsertAgreementBatch.length > 0) {
    await agreementService.upsertBatchAgreement(
      dbContext,
      upsertAgreementBatch
    );
  }

  if (upsertDocumentBatch.length > 0) {
    await agreementService.upsertBatchAgreementDocument(
      dbContext,
      upsertDocumentBatch
    );
  }

  if (upsertContractBatch.length > 0) {
    await agreementService.upsertBatchAgreementContract(
      dbContext,
      upsertContractBatch
    );
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

  if (deleteAgreementBatch.length > 0) {
    const distinctBatch = distinctByKeys(
      deleteAgreementBatch,
      AgreementDeletingSchema,
      ["id"]
    );
    await agreementService.deleteBatchAgreement(dbContext, distinctBatch);
  }
}
