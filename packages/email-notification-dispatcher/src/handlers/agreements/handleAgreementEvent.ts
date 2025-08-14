import {
  AgreementEventV2,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleAgreementActivated } from "./handleAgreementActivated.js";
import { handleAgreementRejected } from "./handleAgreementRejected.js";
import { handleAgreementSubmitted } from "./handleAgreementSubmitted.js";
import { handleAgreementUpgraded } from "./handleAgreementUpgraded.js";
import { handleAgreementSuspendedByProducer } from "./handleAgreementSuspendedByProducer.js";
import { handleAgreementUnsuspendedByProducer } from "./handleAgreementUnsuspendedByProducer.js";
import { handleAgreementSuspendedByPlatform } from "./handleAgreementSuspendedByPlatform.js";

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
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "AgreementSubmitted" }, ({ data: { agreement } }) =>
      handleAgreementSubmitted({
        agreementV2Msg: agreement,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "AgreementUpgraded" }, ({ data: { agreement } }) =>
      handleAgreementUpgraded({
        agreementV2Msg: agreement,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "AgreementSuspendedByProducer" }, ({ data: { agreement } }) =>
      handleAgreementSuspendedByProducer({
        agreementV2Msg: agreement,
        interopFeBaseUrl,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "AgreementSuspendedByPlatform" }, ({ data: { agreement } }) =>
      handleAgreementSuspendedByPlatform({
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
      { type: "AgreementUnsuspendedByProducer" },
      ({ data: { agreement } }) =>
        handleAgreementUnsuspendedByProducer({
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
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementArchivedByUpgrade",
          "AgreementSuspendedByConsumer",
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
