import {
  CorrelationId,
  DelegationEventEnvelopeV2,
  DelegationId,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import { PagoPAInteropBeClients } from "./clients/clientsProvider.js";
import { ReadModelService } from "./readModelService.js";
import { processPurposes } from "./delegationItemsArchiverProcessors.js";

export async function handleMessageV2(
  {
    decodedMessage,
    refreshableToken,
    partition,
    offset,
    correlationId,
    logger,
    readModelService,
  }: {
    decodedMessage: DelegationEventEnvelopeV2;
    refreshableToken: RefreshableInteropToken;
    partition: number;
    offset: string;
    correlationId: CorrelationId;
    logger: Logger;
    readModelService: ReadModelService;
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
      const headers = getInteropHeaders({
        token,
        correlationId,
      });

      const delegationId = unsafeBrandId<DelegationId>(
        delegationMsg.data.delegation.id
      );

      await processPurposes({
        readModelService,
        purposeProcessClient,
        headers,
        delegationId,
      });

      // TODO: Implement agreement archiving
      logger.debug(agreementProcessClient.baseURL);
      // await agreementProcessClient.archiveAgreement(undefined, {
      //   params: {
      //     agreementId: "delegationMsg.data.delegation.agreementId",
      //   },
      //   headers: getInteropHeaders({
      //     token,
      //     correlationId,
      //   }),
      // });
    })
    .with(
      { type: "ConsumerDelegationApproved" },
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
