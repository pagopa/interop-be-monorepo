/* eslint-disable functional/immutable-data */
import { DelegationEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";

export async function handleDelegationMessageV2(
  decodedMessage: DelegationEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved"
        ),
      },
      async (msg): Promise<void> => {
        logger.info(`Delegation event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked",
          "ConsumerDelegationSubmitted",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked",
          "ProducerDelegationSubmitted"
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}
