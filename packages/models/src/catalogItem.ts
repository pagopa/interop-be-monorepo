import z from "zod";

const technology = z.enum(["REST", "SOAP"]);

const attributeValue = z.object({
  id: z.string().uuid(),
  explicitAttributeVerification: z.boolean(),
});

export const attribute = z.union([
  z.object({
    type: z.literal("SingleAttribute"),
    id: attributeValue,
  }),
  z.object({
    type: z.literal("GroupAttribute"),
    ids: z.array(attributeValue),
  }),
]);

const attributes = z.object({
  certified: z.array(attribute),
  declared: z.array(attribute),
  verified: z.array(attribute),
});

export const document = z.object({
  id: z.string().uuid(),
  name: z.string(),
  contentType: z.string(),
  prettyName: z.string(),
  path: z.string(),
  checksum: z.string(),
  uploadDate: z.date(),
});

export const descriptorState = z.enum([
  "DRAFT",
  "PUBLISHED",
  "DEPRECATED",
  "SUSPENDED",
  "ARCHIVED",
]);

const descriptor = z.object({
  id: z.string().uuid(),
  version: z.string(),
  description: z.string().optional(),
  interface: document.optional(),
  docs: z.array(document),
  state: descriptorState,
  audience: z.array(z.string()),
  voucherLifespan: z.number().int(),
  dailyCallsPerConsumer: z.number().int(),
  dailyCallsTotal: z.number().int(),
  agreementApprovalPolicy: z.enum(["MANUAL", "AUTOMATIC"]).optional(),
  createdAt: z.string().datetime(),
  serverUrls: z.array(z.string()),
  publishedAt: z.string().datetime().optional(),
  suspendedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional(),
  attributes,
});

export const catalogItem = z.object({
  id: z.string().uuid(),
  producerId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  technology,
  attribute: attributes.optional(),
  descriptors: z.array(descriptor),
  createdAt: z.coerce.date(),
});

export type DescriptorState = z.infer<typeof descriptorState>;
export type CatalogItem = z.infer<typeof catalogItem>;
export type Document = z.infer<typeof document>;
