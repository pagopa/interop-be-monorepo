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

const PublicEServiceDoc = z.object({
  filename: z.string(),
  prettyName: z.string(),
});
export type PublicEServiceDoc = z.infer<typeof PublicEServiceDoc>;

const PublicEServiceDescriptor = z.object({
  id: z.string(),
  state: z.enum(["PUBLISHED", "SUSPENDED"]),
  version: z.string(),
});
export type PublicEServiceDescriptor = z.infer<typeof PublicEServiceDescriptor>;

export const PublicEService = z.object({
  activeDescriptor: PublicEServiceDescriptor,
  technology: z.enum(["REST", "SOAP"]),
  producerName: z.string(),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  attributes: PublicEServiceAttributes,
});
export type PublicEService = z.infer<typeof PublicEService>;
