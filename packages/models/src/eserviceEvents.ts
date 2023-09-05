// import z from "zod";
// import { EService, Descriptor, Document } from "./eservice.js";

import {
  ClonedEServiceAddedV1,
  EServiceV1AddedV1,
  EServiceUpdatedV1,
  EServiceWithDescriptorsDeletedV1,
  EServiceDocumentUpdatedV1,
  EServiceDeletedV1,
  EServiceDocumentAddedV1,
  EServiceDocumentDeletedV1,
  EServiceDescriptorAddedV1,
  EServiceDescriptorUpdatedV1,
  MovedAttributesFromEserviceToDescriptorsV1,
} from "./gen/v1/events.js";

// export const EServiceAdded = z.object({
//   eService: EService,
// });
// export type EServiceAdded = z.infer<typeof EServiceAdded>;

// export const ClonedEServiceAdded = z.object({
//   eService: EService,
// });
// export type ClonedEServiceAdded = z.infer<typeof ClonedEServiceAdded>;

// export const EServiceUpdated = z.object({
//   eService: EService,
// });
// export type EServiceUpdated = z.infer<typeof EServiceUpdated>;

// // This event leads just the deletion of the descriptor. The old name has been kept to maintain data retrocompatibility
// export const EServiceWithDescriptorsDeleted = z.object({
//   eService: EService,
//   descriptorId: z.string().uuid(),
// });
// export type EServiceWithDescriptorsDeleted = z.infer<
//   typeof EServiceWithDescriptorsDeleted
// >;

// export const EServiceDocumentUpdated = z.object({
//   eServiceId: z.string().uuid(),
//   descriptorId: z.string().uuid(),
//   documentId: z.string().uuid(),
//   updatedDocument: Document,
//   serverUrls: z.array(z.string()),
// });
// export type EServiceDocumentUpdated = z.infer<typeof EServiceDocumentUpdated>;

// export const EServiceDeleted = z.object({
//   eServiceId: z.string().uuid(),
// });
// export type EServiceDeleted = z.infer<typeof EServiceDeleted>;

// export const EServiceDocumentAdded = z.object({
//   eServiceId: z.string().uuid(),
//   descriptorId: z.string().uuid(),
//   document: Document,
//   isInterface: z.boolean(),
//   serverUrls: z.array(z.string()),
// });
// export type EServiceDocumentAdded = z.infer<typeof EServiceDocumentAdded>;

// export const EServiceDocumentDeleted = z.object({
//   eServiceId: z.string().uuid(),
//   descriptorId: z.string().uuid(),
//   documentId: z.string().uuid(),
// });
// export type EServiceDocumentDeleted = z.infer<typeof EServiceDocumentDeleted>;

// export const EServiceDescriptorAdded = z.object({
//   eServiceId: z.string().uuid(),
//   eServiceDescriptor: Descriptor,
// });
// export type EServiceDescriptorAdded = z.infer<typeof EServiceDescriptorAdded>;

// export const EServiceDescriptorUpdated = z.object({
//   eServiceId: z.string().uuid(),
//   eServiceDescriptor: Descriptor,
// });
// export type EServiceDescriptorUpdated = z.infer<
//   typeof EServiceDescriptorUpdated
// >;

// export const MovedAttributesFromEserviceToDescriptors = z.object({
//   eService: EService,
// });
// export type MovedAttributesFromEserviceToDescriptors = z.infer<
//   typeof MovedAttributesFromEserviceToDescriptors
// >;

export type EServiceEvent =
  | { type: "EServiceAdded"; data: EServiceV1AddedV1 }
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
