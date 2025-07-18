import {
  DelegationEventEnvelopeV2,
  fromDelegationV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { ReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: DelegationEventEnvelopeV2,
  readModelService: ReadModelService
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
      async (message) => {
        if (!message.data.delegation) {
          throw missingKafkaMessageDataError("delegation", message.type);
        }
        await readModelService.upsertDelegation(
          fromDelegationV2(message.data.delegation),
          message.version
        );
      }
    )
    .exhaustive();
}
