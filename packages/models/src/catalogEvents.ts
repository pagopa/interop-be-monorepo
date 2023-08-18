import z from "zod";
import { catalogItem, descriptor, document } from "./catalogItem.js";

export const CatalogItemAdded = z.object({
  catalogItem,
});
export type CatalogItemAdded = z.infer<typeof CatalogItemAdded>;

export const ClonedCatalogItemAdded = z.object({
  catalogItem,
});
export type ClonedCatalogItemAdded = z.infer<typeof ClonedCatalogItemAdded>;

export const CatalogItemUpdated = z.object({
  catalogItem,
});
export type CatalogItemUpdated = z.infer<typeof CatalogItemUpdated>;

// This event leads just the deletion of the descriptor. The old name has been kept to maintain data retrocompatibility
export const CatalogItemWithDescriptorsDeleted = z.object({
  catalogItem,
  descriptorId: z.string().uuid(),
});
export type CatalogItemWithDescriptorsDeleted = z.infer<
  typeof CatalogItemWithDescriptorsDeleted
>;

export const CatalogItemDocumentUpdated = z.object({
  eServiceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  documentId: z.string().uuid(),
  updatedDocument: document,
  serverUrls: z.array(z.string()),
});
export type CatalogItemDocumentUpdated = z.infer<
  typeof CatalogItemDocumentUpdated
>;

export const CatalogItemDeleted = z.object({
  catalogItemId: z.string().uuid(),
});
export type CatalogItemDeleted = z.infer<typeof CatalogItemDeleted>;

export const CatalogItemDocumentAdded = z.object({
  eServiceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  document,
  isInterface: z.boolean(),
  serverUrls: z.array(z.string()),
});
export type CatalogItemDocumentAdded = z.infer<typeof CatalogItemDocumentAdded>;

export const CatalogItemDocumentDeleted = z.object({
  eServiceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  documentId: z.string().uuid(),
});
export type CatalogItemDocumentDeleted = z.infer<
  typeof CatalogItemDocumentDeleted
>;

export const CatalogItemDescriptorAdded = z.object({
  eServiceId: z.string().uuid(),
  catalogDescriptor: descriptor,
});
export type CatalogItemDescriptorAdded = z.infer<
  typeof CatalogItemDescriptorAdded
>;

export const CatalogItemDescriptorUpdated = z.object({
  eServiceId: z.string().uuid(),
  catalogDescriptor: descriptor,
});
export type CatalogItemDescriptorUpdated = z.infer<
  typeof CatalogItemDescriptorUpdated
>;

export const MovedAttributesFromEserviceToDescriptors = z.object({
  catalogItem,
});
export type MovedAttributesFromEserviceToDescriptors = z.infer<
  typeof MovedAttributesFromEserviceToDescriptors
>;

export type CatalogEvent =
  | { type: "CatalogItemAdded"; data: CatalogItemAdded }
  | { type: "ClonedCatalogItemAdded"; data: ClonedCatalogItemAdded }
  | { type: "CatalogItemUpdated"; data: CatalogItemUpdated }
  | {
      type: "CatalogItemWithDescriptorsDeleted";
      data: CatalogItemWithDescriptorsDeleted;
    }
  | { type: "CatalogItemDocumentUpdated"; data: CatalogItemDocumentUpdated }
  | { type: "CatalogItemDeleted"; data: CatalogItemDeleted }
  | { type: "CatalogItemDocumentAdded"; data: CatalogItemDocumentAdded }
  | { type: "CatalogItemDocumentDeleted"; data: CatalogItemDocumentDeleted }
  | { type: "CatalogItemDescriptorAdded"; data: CatalogItemDescriptorAdded }
  | { type: "CatalogItemDescriptorUpdated"; data: CatalogItemDescriptorUpdated }
  | {
      type: "MovedAttributesFromEserviceToDescriptors";
      data: MovedAttributesFromEserviceToDescriptors;
    };
