/* eslint-disable functional/immutable-data */
import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import { contractBuilder } from "../service/delegationContractBuilder.js";

export async function handleDelegationMessageV2(
  decodedMessage: DelegationEventEnvelopeV2,
  logger: Logger,
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ConsumerDelegationApproved",
        ),
      },
      async (msg): Promise<void> => {
        if (!msg.data.delegation) {
          return;
        }
        const delegation = fromDelegationV2(msg.data.delegation);
        const activationContract =
          await contractBuilder.createActivationContract({
            delegation: delegation,
            delegator: delegation.delegatorId, // to do get from read model
            delegate: delegation.delegateId,
            eservice: delegation.eserviceId,
            pdfGenerator,
            fileManager,
            config,
            logger,
          });
        logger.info(`Delegation event ${msg.type} handled successfully`);
      },
    )
    .with(
      {
        type: P.union(
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked",
          "ConsumerDelegationSubmitted",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked",
          "ProducerDelegationSubmitted",
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`,
        );
      },
    )
    .exhaustive();
}
