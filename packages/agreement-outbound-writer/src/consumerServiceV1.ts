import { match } from "ts-pattern";
import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { AgreementEvent as OutboundAgreementEvent } from "@pagopa/interop-outbound-models";
import { CreateEvent } from "pagopa-interop-commons";
import {
  toOutboundAgreementDocumentV1,
  toOutboundAgreementV1,
} from "./converters/outboundDataV1Converters.js";
import { createAgreementOutboundEvent } from "./utils.js";

export function handleMessageV1(
  message: AgreementEventEnvelopeV1
): CreateEvent<OutboundAgreementEvent> {
  return match(message)
    .with(
      { type: "AgreementAdded" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "AgreementUpdated" },
      { type: "VerifiedAttributeUpdated" },
      (message) =>
        createAgreementOutboundEvent({
          eventVersion: 1,
          message,
          outboundData: {
            agreement:
              message.data.agreement &&
              toOutboundAgreementV1(message.data.agreement),
          },
        })
    )
    .with({ type: "AgreementDeleted" }, (message) =>
      createAgreementOutboundEvent({
        eventVersion: 1,
        message,
        outboundData: {
          agreementId: message.data.agreementId,
        },
      })
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, (message) =>
      createAgreementOutboundEvent({
        eventVersion: 1,
        message,
        outboundData: {
          agreementId: message.data.agreementId,
          document:
            message.data.document &&
            toOutboundAgreementDocumentV1(message.data.document),
        },
      })
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, (message) =>
      createAgreementOutboundEvent({
        eventVersion: 1,
        message,
        outboundData: {
          agreementId: message.data.agreementId,
          documentId: message.data.documentId,
        },
      })
    )
    .with({ type: "AgreementContractAdded" }, (message) =>
      createAgreementOutboundEvent({
        eventVersion: 1,
        message,
        outboundData: {
          agreementId: message.data.agreementId,
          contract:
            message.data.contract &&
            toOutboundAgreementDocumentV1(message.data.contract),
        },
      })
    )
    .exhaustive();
}
