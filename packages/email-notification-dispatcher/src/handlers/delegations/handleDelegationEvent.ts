import {
  EmailNotificationMessagePayload,
  DelegationEventV2,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";

// const interopFeBaseUrl = config.interopFeBaseUrl;

export async function handleDelegationEvent(
  params: HandlerParams<typeof DelegationEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    // readModelService,
    // templateService,
    // userService,
    // correlationId,
  } = params;
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationSubmitted",
          "ProducerDelegationApproved",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked",
          "ConsumerDelegationSubmitted",
          "ConsumerDelegationApproved",
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked"
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
