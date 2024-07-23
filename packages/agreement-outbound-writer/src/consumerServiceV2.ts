import { match } from "ts-pattern";
import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { AgreementEvent as OutboundAgreementEvent } from "@pagopa/interop-outbound-models";
import { toOutboundAgreementV2 } from "./converters/outboundDataV2Converters.js";

export function handleMessageV2(
  message: AgreementEventEnvelopeV2
): OutboundAgreementEvent {
  return match(message)
    .with(
      { type: "AgreementDeleted" },
      { type: "AgreementAdded" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementActivated" },
      { type: "AgreementUpgraded" },
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      { type: "AgreementRejected" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      (message) => ({
        type: message.type,
        event_version: message.event_version,
        data: {
          agreement:
            message.data.agreement &&
            toOutboundAgreementV2(message.data.agreement),
        },
      })
    )
    .with(
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      (message) => ({
        type: message.type,
        event_version: message.event_version,
        data: {
          documentId: message.data.documentId,
          agreement:
            message.data.agreement &&
            toOutboundAgreementV2(message.data.agreement),
        },
      })
    )
    .exhaustive();
}
