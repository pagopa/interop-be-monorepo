import {
  EmailNotificationMessagePayload,
  DelegationEventV2,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handleProducerDelegationApproved } from "./handleProducerDelegationApproved.js";
import { handleConsumerDelegationApproved } from "./handleConsumerDelegationApproved.js";
import { handleConsumerDelegationRejected } from "./handleConsumerDelegationRejected.js";
import { handleProducerDelegationRejected } from "./handleProducerDelegationRejected.js";

export async function handleDelegationEvent(
  params: HandlerParams<typeof DelegationEventV2>
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
    .with({ type: "ProducerDelegationApproved" }, ({ data: { delegation } }) =>
      handleProducerDelegationApproved({
        delegationV2Msg: delegation,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "ProducerDelegationRejected" }, ({ data: { delegation } }) =>
      handleProducerDelegationRejected({
        delegationV2Msg: delegation,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "ConsumerDelegationApproved" }, ({ data: { delegation } }) =>
      handleConsumerDelegationApproved({
        delegationV2Msg: delegation,
        logger,
        readModelService,
        templateService,
        userService,
        correlationId,
      })
    )
    .with({ type: "ConsumerDelegationRejected" }, ({ data: { delegation } }) =>
      handleConsumerDelegationRejected({
        delegationV2Msg: delegation,
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
          "ProducerDelegationSubmitted",
          "ProducerDelegationRevoked",
          "ConsumerDelegationSubmitted",
          "ConsumerDelegationRevoked",
          "DelegationContractAdded"
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
