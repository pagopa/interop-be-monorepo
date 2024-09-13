import { z } from "zod";

const PublicEServiceAttribute = z.object({
  name: z.string(),
  description: z.string(),
});

const PublicEServiceAttributeSingle = z.object({
  single: PublicEServiceAttribute,
});

const PublicEServiceAttributesGroup = z.object({
  group: z.array(PublicEServiceAttribute),
});

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

const PublicEServiceDoc = z.object({
  filename: z.string(),
  prettyName: z.string(),
});

const PublicEServiceDescriptor = z.object({
  id: z.string(),
  state: z.enum(["PUBLISHED", "SUSPENDED"]),
  version: z.string(),
});

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
export type PublicEServiceDoc = z.infer<typeof PublicEServiceDoc>;
export type PublicEServiceDescriptor = z.infer<typeof PublicEServiceDescriptor>;
export type PublicEServiceAttribute = z.infer<typeof PublicEServiceAttribute>;
export type PublicEServiceAttributes = z.infer<typeof PublicEServiceAttributes>;

export const PublicEServices = z.array(PublicEService);
export type PublicEServices = z.infer<typeof PublicEServices>;
