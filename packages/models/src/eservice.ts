import z from "zod";

const Technology = z.enum(["REST", "SOAP"]);

const AttributeValue = z.object({
  id: z.string().uuid(),
  explicitAttributeVerification: z.boolean(),
});

export const Attribute = z.union([
  z.object({
    type: z.literal("SingleAttribute"),
    id: AttributeValue,
  }),
  z.object({
    type: z.literal("GroupAttribute"),
    ids: z.array(AttributeValue),
  }),
]);

const Attributes = z.object({
  certified: z.array(Attribute),
  declared: z.array(Attribute),
  verified: z.array(Attribute),
});

export const Document = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
  checksum: z.string(),
  uploadDate: z.coerce.date(),
});

export const DescriptorState = z.enum([
  "DRAFT",
  "PUBLISHED",
  "DEPRECATED",
  "SUSPENDED",
  "ARCHIVED",
]);

const Descriptor = z.object({
  id: z.string().uuid(),
  version: z.string(),
  description: z.string().optional(),
  interface: Document.optional(),
  docs: z.array(Document),
  state: DescriptorState,
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int(),
  dailyCallsTotal: z.number().int(),
  agreementApprovalPolicy: z.enum(["MANUAL", "AUTOMATIC"]).optional(),
  createdAt: z.coerce.date(),
  serverUrls: z.array(z.string()),
  publishedAt: z.coerce.date().optional(),
  suspendedAt: z.coerce.date().optional(),
  deprecatedAt: z.coerce.date().optional(),
  archivedAt: z.coerce.date().optional(),
  attributes: Attributes,
});

export const EService = z.object({
  id: z.string().uuid(),
  producerId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  technology: Technology,
  attribute: Attributes.optional(),
  descriptors: z.array(Descriptor),
  createdAt: z.coerce.date(),
});

export type DescriptorState = z.infer<typeof DescriptorState>;
export type Descriptor = z.infer<typeof Descriptor>;
export type EService = z.infer<typeof EService>;
export type Document = z.infer<typeof Document>;
export type Attribute = z.infer<typeof Attribute>;
