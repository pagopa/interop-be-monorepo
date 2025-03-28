import { DelegationEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleDelegationMessageV2(
  message: DelegationEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "ProducerDelegationApproved",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked",
          "ProducerDelegationSubmitted",
          "ConsumerDelegationSubmitted",
          "ConsumerDelegationApproved",
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked"
        ),
      },
      async () => Promise.resolve()
    )
    .exhaustive();
}
