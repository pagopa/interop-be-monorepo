/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  AgreementEventEnvelopeV2,
  AgreementId,
  fromAgreementV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { splitAgreementIntoObjectsSQL } from "pagopa-interop-readmodel";
import { AgreementItemsSQL } from "pagopa-interop-readmodel-models";
import { agreementServiceBuilder } from "../../service/agreementService.js";
import { DBContext } from "../../db/db.js";

export async function handleAgreementMessageV2(
  messages: AgreementEventEnvelopeV2[],
  dbContext: DBContext
): Promise<void> {
  const agreementService = agreementServiceBuilder(dbContext);

  const upsertAgreements: AgreementItemsSQL[] = [];
  const deleteAgreements: AgreementId[] = [];
  const deleteConsumerDocument: AgreementId[] = [];

  for (const msg of messages) {
    match(msg)
      .with(
        {
          type: P.union(
            "AgreementDeleted",
            "AgreementDeletedByRevokedDelegation"
          ),
        },
        ({ data }) => {
          if (!data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }
          deleteAgreements.push(unsafeBrandId<AgreementId>(data.agreement.id));
        }
      )
      .with(
        {
          type: P.union("AgreementConsumerDocumentRemoved"),
        },
        ({ data }) => {
          if (!data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }
          deleteConsumerDocument.push(
            unsafeBrandId<AgreementId>(data.documentId)
          );
        }
      )

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
        ({ data, version }) => {
          if (!data.agreement) {
            throw genericInternalError(
              `Agreement can't be missing in the event message`
            );
          }
          upsertAgreements.push(
            splitAgreementIntoObjectsSQL(
              fromAgreementV2(data.agreement),
              version
            )
          );
        }
      )
      .exhaustive();
  }

  if (upsertAgreements.length) {
    await agreementService.upsertBatchAgreement(upsertAgreements, dbContext);
  }
  if (deleteAgreements.length) {
    await agreementService.deleteBatchAgreement(deleteAgreements, dbContext);
  }
  if (deleteConsumerDocument.length) {
    await agreementService.deleteBatchAgreementDocument(
      deleteConsumerDocument,
      dbContext
    );
  }
}
