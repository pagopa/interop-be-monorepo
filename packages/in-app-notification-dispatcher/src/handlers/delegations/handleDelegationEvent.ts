import {
  DelegationEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";

export async function handleDelegationEvent(
  decodedMessage: DelegationEventEnvelopeV2,
  logger: Logger,
  _readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
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
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
