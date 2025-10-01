import {
  AgreementEventV2,
  EmailNotificationMessagePayload,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleAgreementActivatedToConsumer } from "./handleAgreementActivatedToConsumer.js";
import { handleAgreementRejected } from "./handleAgreementRejected.js";
import { handleAgreementSubmitted } from "./handleAgreementSubmitted.js";
import { handleAgreementUpgraded } from "./handleAgreementUpgraded.js";
import { handleAgreementSuspendedByConsumer } from "./handleAgreementSuspendedByConsumer.js";
import { handleAgreementSuspendedByPlatform } from "./handleAgreementSuspendedByPlatform.js";
import { handleAgreementUnsuspendedByConsumer } from "./handleAgreementUnsuspendedByConsumer.js";
import { handleAgreementUnsuspendedByPlatform } from "./handleAgreementUnsuspendedByPlatform.js";
import { handleAgreementActivatedToProducer } from "./handleAgreementActivatedToProducer.js";

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
  return match(params.decodedMessage)
    .with({ type: "AgreementActivated" }, async ({ data: { agreement } }) => [
      ...(await handleAgreementActivatedToProducer({
        agreementV2Msg: agreement,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })),
      ...(await handleAgreementActivatedToConsumer({
        agreementV2Msg: agreement,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })),
    ])
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
    .with({ type: "AgreementSuspendedByConsumer" }, ({ data: { agreement } }) =>
      handleAgreementSuspendedByConsumer({
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
      { type: "AgreementUnsuspendedByConsumer" },
      ({ data: { agreement } }) =>
        handleAgreementUnsuspendedByConsumer({
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
      { type: "AgreementUnsuspendedByPlatform" },
      ({ data: { agreement } }) =>
        handleAgreementUnsuspendedByPlatform({
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
          "AgreementUnsuspendedByProducer",
          "AgreementArchivedByConsumer",
          "AgreementArchivedByUpgrade",
          "AgreementSuspendedByProducer",
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
          `No need to send an email notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
