import z from "zod";

export const persistentAgreementState = z.enum([
  "DRAFT",
  "SUSPENDED",
  "ARCHIVED",
  "PENDING",
  "ACTIVE",
  "MISSING_CERTIFIED_ATTRIBUTES",
  "REJECTED",
]);

const persistentAttribute = z.object({ id: z.string().uuid() });

const persistentAgreementDocument = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.date(),
});

const persistentStamp = z.object({
  who: z.string().uuid(),
  when: z.date(),
});

const persistentStamps = z.object({
  submission: persistentStamp.optional(),
  activation: persistentStamp.optional(),
  rejection: persistentStamp.optional(),
  suspensionByProducer: persistentStamp.optional(),
  suspensionByConsumer: persistentStamp.optional(),
  upgrade: persistentStamp.optional(),
  archiving: persistentStamp.optional(),
});

export const persistentAgreement = z.object({
  id: z.string().uuid(),
  eserviceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  producerId: z.string().uuid(),
  consumerId: z.string().uuid(),
  state: persistentAgreementState,
  verifiedAttributes: z.array(persistentAttribute),
  certifiedAttributes: z.array(persistentAttribute),
  declaredAttributes: z.array(persistentAttribute),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  suspendedByPlatform: z.boolean().optional(),
  consumerDocuments: z.array(persistentAgreementDocument),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  consumerNotes: z.string().optional(),
  contract: persistentAgreementDocument.optional(),
  stamps: persistentStamps,
  rejectionReason: z.string().optional(),
  suspendedAt: z.date().optional(),
});

export type PersistentAgreementState = z.infer<typeof persistentAgreementState>;
export type PersistentAgreement = z.infer<typeof persistentAgreement>;
