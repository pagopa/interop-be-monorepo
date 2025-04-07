import { DelegationEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleDelegationMessageV2(
  messages: DelegationEventEnvelopeV2[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
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
}
