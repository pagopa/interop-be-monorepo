import z from "zod";
import { EService, Descriptor, Document } from "./eservice.js";

export const EServiceAdded = z.object({
  eService: EService,
});
export type EServiceAdded = z.infer<typeof EServiceAdded>;

export const ClonedEServiceAdded = z.object({
  eService: EService,
});
export type ClonedEServiceAdded = z.infer<typeof ClonedEServiceAdded>;

export const EServiceUpdated = z.object({
  eService: EService,
});
export type EServiceUpdated = z.infer<typeof EServiceUpdated>;

// This event leads just the deletion of the descriptor. The old name has been kept to maintain data retrocompatibility
export const EServiceWithDescriptorsDeleted = z.object({
  eService: EService,
  descriptorId: z.string().uuid(),
});
export type EServiceWithDescriptorsDeleted = z.infer<
  typeof EServiceWithDescriptorsDeleted
>;

export const EServiceDocumentUpdated = z.object({
  eServiceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  documentId: z.string().uuid(),
  updatedDocument: Document,
  serverUrls: z.array(z.string()),
});
export type EServiceDocumentUpdated = z.infer<typeof EServiceDocumentUpdated>;

export const EServiceDeleted = z.object({
  eServiceId: z.string().uuid(),
});
export type EServiceDeleted = z.infer<typeof EServiceDeleted>;

export const EServiceDocumentAdded = z.object({
  eServiceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  document: Document,
  isInterface: z.boolean(),
  serverUrls: z.array(z.string()),
});
export type EServiceDocumentAdded = z.infer<typeof EServiceDocumentAdded>;

export const EServiceDocumentDeleted = z.object({
  eServiceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  documentId: z.string().uuid(),
});
export type EServiceDocumentDeleted = z.infer<typeof EServiceDocumentDeleted>;

export const EServiceDescriptorAdded = z.object({
  eServiceId: z.string().uuid(),
  eServiceDescriptor: Descriptor,
});
export type EServiceDescriptorAdded = z.infer<typeof EServiceDescriptorAdded>;

export const EServiceDescriptorUpdated = z.object({
  eServiceId: z.string().uuid(),
  eServiceDescriptor: Descriptor,
});
export type EServiceDescriptorUpdated = z.infer<
  typeof EServiceDescriptorUpdated
>;

export const MovedAttributesFromEserviceToDescriptors = z.object({
  eService: EService,
});
export type MovedAttributesFromEserviceToDescriptors = z.infer<
  typeof MovedAttributesFromEserviceToDescriptors
>;

export type EServiceEvent =
  | { type: "EServiceAdded"; data: EServiceAdded }
  | { type: "ClonedEServiceAdded"; data: ClonedEServiceAdded }
  | { type: "EServiceUpdated"; data: EServiceUpdated }
  | {
      type: "EServiceWithDescriptorsDeleted";
      data: EServiceWithDescriptorsDeleted;
    }
  | { type: "EServiceDocumentUpdated"; data: EServiceDocumentUpdated }
  | { type: "EServiceDeleted"; data: EServiceDeleted }
  | { type: "EServiceDocumentAdded"; data: EServiceDocumentAdded }
  | { type: "EServiceDocumentDeleted"; data: EServiceDocumentDeleted }
  | { type: "EServiceDescriptorAdded"; data: EServiceDescriptorAdded }
  | { type: "EServiceDescriptorUpdated"; data: EServiceDescriptorUpdated }
  | {
      type: "MovedAttributesFromEserviceToDescriptors";
      data: MovedAttributesFromEserviceToDescriptors;
    };
