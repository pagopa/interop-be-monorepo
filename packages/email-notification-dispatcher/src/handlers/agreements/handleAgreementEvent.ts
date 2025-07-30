import {
  AgreementEventEnvelopeV2,
  CorrelationId,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { HtmlTemplateService, Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { config } from "../../config/config.js";
import { handleAgreementActivated } from "./handleAgreementActivated.js";

const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleAgreementEvent(
  decodedMessage: AgreementEventEnvelopeV2,
  correlationId: CorrelationId,
  logger: Logger,
  readModelService: ReadModelServiceSQL,
  templateService: HtmlTemplateService
): Promise<EmailNotificationMessagePayload[]> {
  return match(decodedMessage)
    .with({ type: "AgreementActivated" }, ({ data: { agreement } }) =>
      handleAgreementActivated({
        agreementV2Msg: agreement,
        interopFeBaseUrl,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      {
        type: P.union(
          "AgreementSubmitted",
          "AgreementRejected",
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementUnsuspendedByProducer",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementArchivedByUpgrade",
          "AgreementUpgraded",
          "AgreementSuspendedByProducer",
          "AgreementSuspendedByConsumer",
          "AgreementSuspendedByPlatform",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation"
        ),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
