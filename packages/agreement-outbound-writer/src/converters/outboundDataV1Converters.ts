import {
  AgreementDocumentV1,
  AgreementV1,
  StampV1,
  StampsV1,
} from "pagopa-interop-models";
import {
  AgreementDocumentV1 as OutboundAgreementDocumentV1,
  AgreementV1 as OutboundAgreementV1,
  StampV1 as OutboundStampV1,
  StampsV1 as OutboundStampsV1,
} from "@pagopa/interop-outbound-models";
import { Exact } from "../utils.js";

export function toOutboundStampV1(
  stamp: StampV1
): Exact<OutboundStampV1, StampV1> {
  return {
    when: stamp.when,
    who: undefined,
  };
}

export function toOutboundStampsV1(
  stamp: StampsV1
): Exact<OutboundStampsV1, StampsV1> {
  return {
    activation: stamp.activation && toOutboundStampV1(stamp.activation),
    archiving: stamp.archiving && toOutboundStampV1(stamp.archiving),
    rejection: stamp.rejection && toOutboundStampV1(stamp.rejection),
    submission: stamp.submission && toOutboundStampV1(stamp.submission),
    suspensionByConsumer:
      stamp.suspensionByConsumer &&
      toOutboundStampV1(stamp.suspensionByConsumer),
    suspensionByProducer:
      stamp.suspensionByProducer &&
      toOutboundStampV1(stamp.suspensionByProducer),
    upgrade: stamp.upgrade && toOutboundStampV1(stamp.upgrade),
  };
}

export function toOutboundAgreementV1(
  agreement: AgreementV1
): Exact<OutboundAgreementV1, AgreementV1> {
  return {
    ...agreement,
    consumerDocuments: agreement.consumerDocuments.map(
      toOutboundAgreementDocumentV1
    ),
    contract:
      agreement.contract && toOutboundAgreementDocumentV1(agreement.contract),
    stamps: agreement.stamps && toOutboundStampsV1(agreement.stamps),
  };
}

export function toOutboundAgreementDocumentV1(
  document: AgreementDocumentV1
): Exact<OutboundAgreementDocumentV1, AgreementDocumentV1> {
  return {
    id: document.id,
    contentType: document.contentType,
    createdAt: document.createdAt,
    name: document.name,
    prettyName: document.prettyName,
    path: undefined,
  };
}
