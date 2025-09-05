import { DelegationEventEnvelopeV2 } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { M2MEventServiceSQL } from "../services/m2mEventServiceSQL.js";

export async function handleDelegationEvent(
  decodedMessage: DelegationEventEnvelopeV2,
  _logger: Logger,
  _m2mEventService: M2MEventServiceSQL,
  _readModelService: ReadModelServiceSQL
): Promise<void> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "ConsumerDelegationSubmitted",
          "ConsumerDelegationApproved",
          "ConsumerDelegationRejected",
          "ConsumerDelegationRevoked",
          "ProducerDelegationSubmitted",
          "ProducerDelegationApproved",
          "ProducerDelegationRejected",
          "ProducerDelegationRevoked"
        ),
      },
      () => Promise.resolve(void 0)
    )
    .exhaustive();
}
