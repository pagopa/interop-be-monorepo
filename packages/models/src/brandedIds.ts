import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

export const EServiceId = z.string().uuid().brand("EServiceId");
export type EServiceId = z.infer<typeof EServiceId>;

export const AgreementId = z.string().uuid().brand("AgreementId");
export type AgreementId = z.infer<typeof AgreementId>;

export const AgreementDocumentId = z
  .string()
  .uuid()
  .brand("AgreementDocumentId");
export type AgreementDocumentId = z.infer<typeof AgreementDocumentId>;

export const AttributeId = z.string().uuid().brand("AttributeId");
export type AttributeId = z.infer<typeof AttributeId>;

export const DescriptorId = z.string().uuid().brand("DescriptorId");
export type DescriptorId = z.infer<typeof DescriptorId>;

type IDS =
  | EServiceId
  | AgreementId
  | AgreementDocumentId
  | DescriptorId
  | AttributeId;

// This function is used to generate a new ID for a new object
// it infers the type of the ID based on how is used the result
// the 'as' is used to cast the uuid string to the inferred type
export function generateId<T extends IDS>(): T {
  return uuidv4() as T;
}

// This function is used to get a branded ID from a string
// it's an unsafe function because it doesn't check if the string
// is a valid uuid and it doen't check if the string rappresent
// a valid ID for the type.
// The user of this function must be sure that the string is a valid
// uuid and that the string rappresent a valid ID for the type
export function unsafeBrandId<T extends IDS>(id: string): T {
  return id as T;
}
