import {
  DelegationEventEnvelopeV2,
  delegationKind,
  fromDelegationV2,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { M2MEventWriterServiceSQL } from "../services/m2mEventWriterServiceSQL.js";
import { assertDelegationExistsInEvent } from "../services/validators.js";
import { createDelegationM2MEvent } from "../services/event-builders/delegationM2MEventBuilder.js";
import {
  toConsumerDelegationM2MEventSQL,
  toProducerDelegationM2MEventSQL,
} from "../models/delegationM2MEventAdapterSQL.js";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";

export async function handleDelegationEvent(
  decodedMessage: DelegationEventEnvelopeV2,
  eventTimestamp: Date,
  logger: Logger,
  m2mEventWriterService: M2MEventWriterServiceSQL,
  readModelService: ReadModelServiceSQL
): Promise<void> {
  assertDelegationExistsInEvent(decodedMessage);
  const delegation = fromDelegationV2(decodedMessage.data.delegation);

  logger.info(
    `Creating ${delegation.kind} M2M Event - type ${decodedMessage.type}, delegationId ${delegation.id}`
  );

  return (
    match(decodedMessage)
      .with(
        {
          type: P.union(
            "ConsumerDelegationSubmitted",
            "ConsumerDelegationApproved",
            "ConsumerDelegationRejected",
            "ConsumerDelegationRevoked"
          ),
        },
        async (event) => {
          const m2mEvent = createDelegationM2MEvent(
            delegation,
            event.version,
            event.type,
            eventTimestamp
          );

          /**
           * When a consumer delegation is revoked, remove all consumer delegation-related data
           * from existing m2m events so delegates lose access to past events.
           */
          if (event.type === "ConsumerDelegationRevoked") {
            await m2mEventWriterService.removeConsumerDelegationVisibility(
              delegation.id
            );
          }

          await m2mEventWriterService.insertConsumerDelegationM2MEvent(
            toConsumerDelegationM2MEventSQL(m2mEvent)
          );
        }
      )
      .with(
        {
          type: P.union(
            "ProducerDelegationSubmitted",
            "ProducerDelegationApproved",
            "ProducerDelegationRejected",
            "ProducerDelegationRevoked"
          ),
        },
        async (event) => {
          const m2mEvent = createDelegationM2MEvent(
            delegation,
            event.version,
            event.type,
            eventTimestamp
          );

          /**
           * When a producer delegation is approved, add all producer delegation-related data
           * from existing m2m events so delegates gain access to past events.
           */
          if (event.type === "ProducerDelegationApproved") {
            const [relatedAgreementsIds, relatedPurposeIds] = await Promise.all(
              [
                readModelService.getEServiceAgreementIds(delegation.eserviceId),
                readModelService.getEServicePurposeIds(delegation.eserviceId),
              ]
            );
            await m2mEventWriterService.addProducerDelegationVisibility(
              delegation.eserviceId,
              delegation.id,
              delegation.delegateId,
              relatedAgreementsIds,
              relatedPurposeIds
            );
          }

          /**
           * When a producer delegation is revoked, remove all producer delegation-related data
           * from existing m2m events so delegates lose access to past events.
           */
          if (event.type === "ProducerDelegationRevoked") {
            await m2mEventWriterService.removeProducerDelegationVisibility(
              delegation.id
            );
          }

          await m2mEventWriterService.insertProducerDelegationM2MEvent(
            toProducerDelegationM2MEventSQL(m2mEvent)
          );
        }
      )
      /**
       * Here we handle the events which we don't know from the event name the kind of delegation.
       * We need to check the kind of delegation in order to store the M2M event
       * in the correct table.
       */
      .with(
        { type: P.union("DelegationSignedContractGenerated") },
        async (event) => {
          const m2mEvent = createDelegationM2MEvent(
            delegation,
            event.version,
            event.type,
            eventTimestamp
          );

          await match(delegation.kind)
            .with(delegationKind.delegatedConsumer, () =>
              m2mEventWriterService.insertConsumerDelegationM2MEvent(
                toConsumerDelegationM2MEventSQL(m2mEvent)
              )
            )
            .with(delegationKind.delegatedProducer, () =>
              m2mEventWriterService.insertProducerDelegationM2MEvent(
                toProducerDelegationM2MEventSQL(m2mEvent)
              )
            )
            .exhaustive();
        }
      )
      .with(
        {
          /**
           * We avoid exposing the unsigned document generation.
           * The user will only be able to see the signed one.
           */
          type: P.union("DelegationContractGenerated"),
        },
        () => Promise.resolve(void 0)
      )
      .exhaustive()
  );
}
