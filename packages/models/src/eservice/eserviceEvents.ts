import { match } from "ts-pattern";
import {
  ClonedEServiceAddedV1,
  EServiceAddedV1,
  EServiceDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  MovedAttributesFromEserviceToDescriptorsV1,
} from "./gen/v1/eservice/events.js";

export function toBinaryData(event: EServiceEvent): Uint8Array {
  return match(event)
    .with({ type: "EServiceAdded" }, ({ data }) =>
      EServiceAddedV1.toBinary(data)
    )
    .with({ type: "ClonedEServiceAdded" }, ({ data }) =>
      ClonedEServiceAddedV1.toBinary(data)
    )
    .with({ type: "EServiceUpdated" }, ({ data }) =>
      EServiceUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceWithDescriptorsDeleted" }, ({ data }) =>
      EServiceWithDescriptorsDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentUpdated" }, ({ data }) =>
      EServiceDocumentUpdatedV1.toBinary(data)
    )
    .with({ type: "EServiceDeleted" }, ({ data }) =>
      EServiceDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentAdded" }, ({ data }) =>
      EServiceDocumentAddedV1.toBinary(data)
    )
    .with({ type: "EServiceDocumentDeleted" }, ({ data }) =>
      EServiceDocumentDeletedV1.toBinary(data)
    )
    .with({ type: "EServiceDescriptorAdded" }, ({ data }) =>
      EServiceDescriptorAddedV1.toBinary(data)
    )
    .with({ type: "EServiceDescriptorUpdated" }, ({ data }) =>
      EServiceDescriptorUpdatedV1.toBinary(data)
    )
    .with({ type: "MovedAttributesFromEserviceToDescriptors" }, ({ data }) =>
      MovedAttributesFromEserviceToDescriptorsV1.toBinary(data)
    )
    .exhaustive();
}

export type EServiceEvent =
  | { type: "EServiceAdded"; data: EServiceAddedV1 }
  | { type: "ClonedEServiceAdded"; data: ClonedEServiceAddedV1 }
  | { type: "EServiceUpdated"; data: EServiceUpdatedV1 }
  | {
      type: "EServiceWithDescriptorsDeleted";
      data: EServiceWithDescriptorsDeletedV1;
    }
  | { type: "EServiceDocumentUpdated"; data: EServiceDocumentUpdatedV1 }
  | { type: "EServiceDeleted"; data: EServiceDeletedV1 }
  | { type: "EServiceDocumentAdded"; data: EServiceDocumentAddedV1 }
  | { type: "EServiceDocumentDeleted"; data: EServiceDocumentDeletedV1 }
  | { type: "EServiceDescriptorAdded"; data: EServiceDescriptorAddedV1 }
  | { type: "EServiceDescriptorUpdated"; data: EServiceDescriptorUpdatedV1 }
  | {
      type: "MovedAttributesFromEserviceToDescriptors";
      data: MovedAttributesFromEserviceToDescriptorsV1;
    };
