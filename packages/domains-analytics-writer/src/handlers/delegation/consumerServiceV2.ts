import { DelegationEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleDelegationMessageV2(
  message: DelegationEventEnvelopeV2
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
      async () => Promise.resolve()
    )
    .exhaustive();
}
