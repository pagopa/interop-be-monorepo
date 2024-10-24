import { match } from "ts-pattern";
import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function handleMessageV1(
  message: AgreementEventEnvelopeV1,
  _dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "AgreementDeleted" },
      { type: "VerifiedAttributeUpdated" },
      { type: "AgreementUpdated" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementContractAdded" },
      async () => Promise.resolve()
    )
    .exhaustive();
}
