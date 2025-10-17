import {
  DelegationEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleDelegationApprovedRejectedToDelegator } from "./handleDelegationApprovedRejectedToDelegator.js";
import { handleDelegationSubmittedRevokedToDelegate } from "./handleDelegationSubmittedRevokedToDelegate.js";

export async function handleDelegationEvent(
  decodedMessage: DelegationEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationSubmitted",
          "ConsumerDelegationSubmitted",
          "ProducerDelegationRevoked",
          "ConsumerDelegationRevoked"
        ),
      },
      ({ data: { delegation }, type }) =>
        handleDelegationSubmittedRevokedToDelegate(
          delegation,
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved",
          "ProducerDelegationRejected",
          "ConsumerDelegationRejected"
        ),
      },
      ({ data: { delegation }, type }) =>
        handleDelegationApprovedRejectedToDelegator(
          delegation,
          logger,
          readModelService,
          type
        )
    )
    .with({ type: "DelegationContractAdded" }, () => {
      logger.info(
        `No need to send an in-app notification for ${decodedMessage.type} message`
      );
      return [];
    })
    .exhaustive();
}
