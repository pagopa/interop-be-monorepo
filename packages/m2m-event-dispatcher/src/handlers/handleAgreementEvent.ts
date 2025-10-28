import {
  AgreementEventEnvelopeV2,
  fromAgreementV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match, P } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { assertAgreementExistsInEvent } from "../services/validators.js";
import { toAgreementM2MEventSQL } from "../models/agreementM2MEventAdapterSQL.js";
import { createAgreementM2MEvent } from "../services/event-builders/agreementM2MEventBuilder.js";

export async function handleAgreementEvent(
  decodedMessage: AgreementEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  assertAgreementExistsInEvent(decodedMessage);
  const agreement = fromAgreementV2(decodedMessage.data.agreement);

  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "AgreementSuspendedByConsumer",
          "AgreementUnsuspendedByConsumer",
          "AgreementSuspendedByProducer",
          "AgreementUnsuspendedByProducer",
          "AgreementSuspendedByPlatform",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementSubmitted",
          "AgreementUpgraded",
          "AgreementActivated",
          "AgreementRejected",
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementArchivedByUpgrade",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation",
          "AgreementContractGenerated"
        ),
      },
      async (event) => {
        logger.info(
          `Creating Agreement M2M Event - type ${event.type}, agreementId ${agreement.id}`
        );
        const m2mEvent = await createAgreementM2MEvent(
          agreement,
          event.type,
          eventTimestamp,
          await readModelService.getActiveDelegationsForAgreement(agreement)
        );

        await m2mEventWriterService.insertAgreementM2MEvent(
          toAgreementM2MEventSQL(m2mEvent)
        );
      }
    )
    .exhaustive();
}
