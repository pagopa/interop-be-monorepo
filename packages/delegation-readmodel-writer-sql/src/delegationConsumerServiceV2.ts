import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { DelegationWriterService } from "./delegationWriterService.js";

export async function handleMessageV2(
  message: DelegationEventEnvelopeV2,
  delegationWriterService: DelegationWriterService
): Promise<void> {
  await match(message)
    .with(
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ProducerDelegationSubmitted" },
      { type: "ConsumerDelegationSubmitted" },
      { type: "ConsumerDelegationApproved" },
      { type: "ConsumerDelegationRejected" },
      { type: "ConsumerDelegationRevoked" },
      { type: "DelegationContractGenerated" },
      async (message) => {
        if (!message.data.delegation) {
          throw missingKafkaMessageDataError("delegation", message.type);
        }
        await delegationWriterService.upsertDelegation(
          fromDelegationV2(message.data.delegation),
          message.version
        );
      }
    )
    .exhaustive();
}
