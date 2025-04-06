import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleAgreementMessageV1(
  messages: AgreementEventEnvelopeV1[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with({ type: P.union("AgreementAdded", "AgreementDeleted") }, async () =>
        Promise.resolve()
      )
      .with(
        {
          type: P.union(
            "AgreementUpdated",
            "AgreementActivated",
            "AgreementSuspended",
            "AgreementDeactivated",
            "VerifiedAttributeUpdated"
          ),
        },
        async () => Promise.resolve()
      )
      .with(
        {
          type: P.union(
            "AgreementConsumerDocumentAdded",
            "AgreementConsumerDocumentRemoved",
            "AgreementContractAdded"
          ),
        },
        async () => Promise.resolve()
      )
      .exhaustive();
  }
}
