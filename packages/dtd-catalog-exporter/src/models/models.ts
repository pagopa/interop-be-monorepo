import { AttributeKind, TenantId } from "pagopa-interop-models";
import { z } from "zod";

const PublicEServiceAttribute = z.object({
  name: z.string(),
  description: z.string(),
});
export type PublicEServiceAttribute = z.infer<typeof PublicEServiceAttribute>;

const PublicEServiceAttributeSingle = z.object({
  single: PublicEServiceAttribute,
});
export type PublicEServiceAttributeSingle = z.infer<
  typeof PublicEServiceAttributeSingle
>;

const PublicEServiceAttributesGroup = z.object({
  group: z.array(PublicEServiceAttribute),
});
export type PublicEServiceAttributeGroup = z.infer<
  typeof PublicEServiceAttributesGroup
>;

const PublicEServiceAttributes = z.object({
  certified: z.array(
    z.union([PublicEServiceAttributeSingle, PublicEServiceAttributesGroup])
  ),
  verified: z.array(
    z.union([PublicEServiceAttributeSingle, PublicEServiceAttributesGroup])
  ),
  declared: z.array(
    z.union([PublicEServiceAttributeSingle, PublicEServiceAttributesGroup])
  ),
});
export type PublicEServiceAttributes = z.infer<typeof PublicEServiceAttributes>;

const PublicEServiceDescriptor = z.object({
  id: z.string(),
  state: z.enum(["PUBLISHED", "SUSPENDED"]),
  version: z.string(),
});
type PublicEServiceDescriptor = z.infer<typeof PublicEServiceDescriptor>;

export const PublicEService = z.object({
  id: z.string(),
  activeDescriptor: PublicEServiceDescriptor,
  technology: z.enum(["REST", "SOAP"]),
  producerName: z.string(),
  producerId: z.string(),
  producerIpaCode: z.string().nullable(),
  producerFiscalCode: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  attributes: PublicEServiceAttributes,
});
export type PublicEService = z.infer<typeof PublicEService>;

export const FlattenedPublicEService = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  technology: z.enum(["REST", "SOAP"]),
  producerId: z.string(),
  producerName: z.string(),
  producerIpaCode: z.string().nullable(),
  producerFiscalCode: z.string().nullable(),
  attributes: z.string(),
  activeDescriptorId: z.string(),
  activeDescriptorState: z.enum(["PUBLISHED", "SUSPENDED"]),
  activeDescriptorVersion: z.string(),
});
export type FlattenedPublicEService = z.infer<typeof FlattenedPublicEService>;

export const PublicTenantAttribute = z.object({
  name: z.string(),
  type: AttributeKind,
});
export type PublicTenantAttribute = z.infer<typeof PublicTenantAttribute>;

export const PublicTenant = z.object({
  id: TenantId,
  name: z.string(),
  ipaCode: z.string().nullable(),
  fiscalCode: z.string().nullable(),
  attributes: z.array(PublicTenantAttribute),
});
export type PublicTenant = z.infer<typeof PublicTenant>;

export const FlattenedPublicTenant = z.object({
  id: TenantId,
  name: z.string(),
  ipaCode: z.string().nullable(),
  fiscalCode: z.string().nullable(),
  attributes: z.string(),
});
export type FlattenedPublicTenant = z.infer<typeof FlattenedPublicTenant>;
