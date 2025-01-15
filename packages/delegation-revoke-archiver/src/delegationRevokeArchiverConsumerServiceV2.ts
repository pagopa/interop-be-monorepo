import {
  CorrelationId,
  DelegationEventEnvelopeV2,
  generateId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  // getInteropHeaders,
  logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
// import { getInteropBeClients } from "./clients/clientsProvider.js";

// const { agreementProcessClient, purposeProcessClient } = getInteropBeClients();

export async function handleMessageV2({
  decodedKafkaMessage,
  // refreshableToken,
  partition,
  offset,
}: {
  decodedKafkaMessage: DelegationEventEnvelopeV2;
  refreshableToken: RefreshableInteropToken;
  partition: number;
  offset: string;
}): Promise<void> {
  await match(decodedKafkaMessage)
    .with({ type: "ConsumerDelegationRevoked" }, async (delegationMsg) => {
      const correlationId = delegationMsg.correlation_id
        ? unsafeBrandId<CorrelationId>(delegationMsg.correlation_id)
        : generateId<CorrelationId>();

      const loggerInstance = logger({
        serviceName: "delegation-revoke-archiver",
        eventType: delegationMsg.type,
        eventVersion: delegationMsg.event_version,
        streamId: delegationMsg.stream_id,
        correlationId,
      });

      loggerInstance.info(
        `Processing ${delegationMsg.type} message - Partition number: ${partition} - Offset: ${offset}`
      );

      if (!delegationMsg.data.delegation) {
        throw missingKafkaMessageDataError("delegation", delegationMsg.type);
      }

      // const token = (await refreshableToken.get()).serialized;
      // TODO: implement archiving logic
    })
    .with(
      { type: "ProducerDelegationSubmitted" },
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ConsumerDelegationSubmitted" },
      { type: "ConsumerDelegationApproved" },
      { type: "ConsumerDelegationRejected" },
      () => Promise.resolve
    )
    .exhaustive();
}
