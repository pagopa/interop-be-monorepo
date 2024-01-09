import { match } from "ts-pattern";
import {
  AgreementAddedV1,
  AgreementDeletedV1,
  AgreementUpdatedV1,
  AgreementContractAddedV1,
  AgreementConsumerDocumentAddedV1,
  AgreementConsumerDocumentRemovedV1,
} from "../gen/v1/agreement/events.js";

export function agreementEventToBinaryData(event: AgreementEvent): Uint8Array {
  return match(event)
    .with({ type: "AgreementDeleted" }, ({ data }) =>
      AgreementDeletedV1.toBinary(data)
    )
    .with({ type: "AgreementAdded" }, ({ data }) =>
      AgreementAddedV1.toBinary(data)
    )
    .with({ type: "AgreementUpdated" }, ({ data }) =>
      AgreementUpdatedV1.toBinary(data)
    )
    .with({ type: "AgreementContractAdded" }, ({ data }) =>
      AgreementContractAddedV1.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, ({ data }) =>
      AgreementConsumerDocumentAddedV1.toBinary(data)
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, ({ data }) =>
      AgreementConsumerDocumentRemovedV1.toBinary(data)
    )
    .exhaustive();
}

export type AgreementUpdateEvent = {
  type: "AgreementUpdated";
  data: AgreementUpdatedV1;
};

export type AgreementConsumerDocumentAdded = {
  type: "AgreementConsumerDocumentAdded";
  data: AgreementConsumerDocumentAddedV1;
};

export type AgreementConsumerDocumentRemoved = {
  type: "AgreementConsumerDocumentRemoved";
  data: AgreementConsumerDocumentRemovedV1;
};

export type AgreementEvent =
  | { type: "AgreementAdded"; data: AgreementAddedV1 }
  | AgreementUpdateEvent
  | AgreementConsumerDocumentAdded
  | AgreementConsumerDocumentRemoved
  | {
    type: "AgreementDeleted";
    data: AgreementDeletedV1;
  }
  | {
    type: "AgreementContractAdded";
    data: AgreementContractAddedV1;
  };
