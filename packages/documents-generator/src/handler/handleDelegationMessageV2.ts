/* eslint-disable functional/immutable-data */
import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
} from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";
import { contractBuilder } from "../service/delegation/delegationContractBuilder.js";

export async function handleDelegationMessageV2(
  decodedMessage: DelegationEventEnvelopeV2,
  readModelService: any,
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
        if (!msg.data.delegation) {
          return;
        }
        const delegation = fromDelegationV2(msg.data.delegation);
        const delegator = await readModelDelegationServiceSQL.getTenantById(
          delegation.delegatorId
        );
        const delegate = await readModelDelegationServiceSQL.getTenantById(
          delegation.delegateId
        );
        const eservice = await readModelDelegationServiceSQL.getEServiceById(
          delegation.eserviceId
        );

        if (!delegator || !delegate || !eservice) {
          throw new Error("Missing data to create activation contract.");
        }
        const activationContract =
          await contractBuilder.createActivationContract({
            delegation: delegation,
            delegator: delegation.delegatorId, // to do get from read model
            delegate: delegation.delegateId, //todo get from readmodel
            eservice: delegation.eserviceId, //todo get from readmodel
            pdfGenerator,
            fileManager,
            config,
            logger,
          });
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
