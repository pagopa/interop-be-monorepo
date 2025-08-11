import {
  AgreementEventV2,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { config } from "../../config/config.js";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleAgreementActivated } from "./handleAgreementActivated.js";
import { handleAgreementRejected } from "./handleAgreementRejected.js";

const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleAgreementEvent(
  params: HandlerParams<typeof AgreementEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    userService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with({ type: "AgreementActivated" }, ({ data: { agreement } }) =>
      handleAgreementActivated({
        agreementV2Msg: agreement,
        interopFeBaseUrl,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "AgreementRejected" }, ({ data: { agreement } }) =>
      handleAgreementRejected({
        agreementV2Msg: agreement,
        interopFeBaseUrl,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with(
      {
        type: P.union(
          "AgreementSubmitted",
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
