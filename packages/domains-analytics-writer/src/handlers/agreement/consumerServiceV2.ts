/* eslint-disable functional/immutable-data */
import { match, P } from "ts-pattern";
import {
  Agreement,
  AgreementEventEnvelopeV2,
  AgreementId,
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
          if (data.agreement?.id) {
            deleteAgreements.push(
              unsafeBrandId<AgreementId>(data.agreement.id)
            );
          }
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
            "AgreementConsumerDocumentRemoved",
            "AgreementSetDraftByPlatform",
            "AgreementSetMissingCertifiedAttributesByPlatform",
            "AgreementArchivedByRevokedDelegation"
          ),
        },
        ({ data, version }) => {
          upsertAgreements.push(
            splitAgreementIntoObjectsSQL(
              Agreement.parse(data.agreement),
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
}
