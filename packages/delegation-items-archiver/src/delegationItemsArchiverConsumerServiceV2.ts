import {
  CorrelationId,
  DelegationEventEnvelopeV2,
  DelegationId,
  fromDelegationV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  getInteropHeaders,
  Logger,
  RefreshableInteropToken,
} from "pagopa-interop-commons";
import {
  AgreementProcessClient,
  PurposeProcessClient,
} from "./clients/clientsProvider.js";
import {
  processAgreement,
  processPurposes,
} from "./delegationItemsArchiverProcessors.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

export async function handleMessageV2({
  decodedMessage,
  refreshableToken,
  partition,
  offset,
  correlationId,
  logger,
  readModelService,
  agreementProcessClient,
  purposeProcessClient,
}: {
  decodedMessage: DelegationEventEnvelopeV2;
  refreshableToken: RefreshableInteropToken;
  partition: number;
  offset: string;
  correlationId: CorrelationId;
  logger: Logger;
  readModelService: ReadModelServiceSQL;
  agreementProcessClient: AgreementProcessClient;
  purposeProcessClient: PurposeProcessClient;
}): Promise<void> {
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

      const delegation = fromDelegationV2(delegationMsg.data.delegation);

      await Promise.all([
        processPurposes({
          readModelService,
          purposeProcessClient,
          headers,
          delegationId: unsafeBrandId<DelegationId>(
            delegationMsg.data.delegation.id
          ),
        }),

        processAgreement({
          agreementProcessClient,
          headers,
          delegation,
          readModelService,
        }),
      ]);
    })
    .with(
      { type: "ConsumerDelegationApproved" },
      { type: "ProducerDelegationSubmitted" },
      { type: "ProducerDelegationApproved" },
      { type: "ProducerDelegationRejected" },
      { type: "ProducerDelegationRevoked" },
      { type: "ConsumerDelegationSubmitted" },
      { type: "ConsumerDelegationRejected" },
      () => Promise.resolve()
    )
    .exhaustive();
}
