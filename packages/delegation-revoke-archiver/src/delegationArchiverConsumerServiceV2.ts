import {
  CorrelationId,
  DelegationEventEnvelopeV2,
  missingKafkaMessageDataError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "./clients/clientsProvider.js";

export async function handleMessageV2(
  {
    decodedMessage,
    refreshableToken,
    partition,
    offset,
    correlationId,
    logger,
  }: {
    decodedMessage: DelegationEventEnvelopeV2;
    refreshableToken: RefreshableInteropToken;
    partition: number;
    offset: string;
    correlationId: CorrelationId;
    logger: Logger;
  },
  { agreementProcessClient, purposeProcessClient }: PagoPAInteropBeClients
): Promise<void> {
  await match(decodedMessage)
    .with({ type: "ConsumerDelegationRevoked" }, async (delegationMsg) => {
      logger.info(
        `Processing ${delegationMsg.type} message - Partition number: ${partition} - Offset: ${offset}`
      );

      if (!delegationMsg.data.delegation) {
        throw missingKafkaMessageDataError("delegation", delegationMsg.type);
      }

      const token = (await refreshableToken.get()).serialized;

      // TODO: implement archiving logic

      await purposeProcessClient.archivePurposeVersion(undefined, {
        params: {
          purposeId: "delegationMsg.data.delegation.purposeId",
          versionId: "delegationMsg.data.delegation.versionId",
        },
        headers: getInteropHeaders({
          token,
          correlationId,
        }),
      });

      await agreementProcessClient.archiveAgreement(undefined, {
        params: {
          agreementId: "delegationMsg.data.delegation.agreementId",
        },
        headers: getInteropHeaders({
          token,
          correlationId,
        }),
      });
    })
    .with({ type: "ConsumerDelegationApproved" }, async (delegationMsg) => {
      logger.info(
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
      { type: "ConsumerDelegationRejected" },
      () => Promise.resolve
    )
    .exhaustive();
}
