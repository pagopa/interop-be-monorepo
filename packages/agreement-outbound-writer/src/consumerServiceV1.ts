import { match } from "ts-pattern";
import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { AgreementEvent as OutboundAgreementEvent } from "@pagopa/interop-outbound-models";
import {
  toOutboundAgreementDocumentV1,
  toOutboundAgreementV1,
} from "./converters/outboundDataV1Converters.js";

export function handleMessageV1(
  message: AgreementEventEnvelopeV1
): OutboundAgreementEvent {
  return match(message)
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "AgreementUpdated" },
      { type: "VerifiedAttributeUpdated" },
      (message) => ({
        type: message.type,
        event_version: message.event_version,
        data: {
          agreement:
            message.data.agreement &&
            toOutboundAgreementV1(message.data.agreement),
        },
      })
    )
    .with({ type: "AgreementDeleted" }, (message) => ({
      type: message.type,
      event_version: message.event_version,
      data: {
        agreementId: message.data.agreementId,
      },
    }))
    .with({ type: "AgreementConsumerDocumentAdded" }, (message) => ({
      type: message.type,
      event_version: message.event_version,
      data: {
        agreementId: message.data.agreementId,
        document:
          message.data.document &&
          toOutboundAgreementDocumentV1(message.data.document),
      },
    }))
    .with({ type: "AgreementConsumerDocumentRemoved" }, (message) => ({
      type: message.type,
      event_version: message.event_version,
      data: {
        agreementId: message.data.agreementId,
        documentId: message.data.documentId,
      },
    }))
    .with({ type: "AgreementContractAdded" }, (message) => ({
      type: message.type,
      event_version: message.event_version,
      data: {
        agreementId: message.data.agreementId,
        contract:
          message.data.contract &&
          toOutboundAgreementDocumentV1(message.data.contract),
      },
    }))
    .exhaustive();
}
