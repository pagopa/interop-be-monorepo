import z from "zod";

export const persistentAgreementState = {
  draft: "Draft",
  suspended: "Suspended",
  archived: "Archived",
  pending: "Pending",
  active: "Active",
  missingCertifiedAttributes: "MissingCertifiedAttributes",
  rejected: "Rejected",
} as const;
export const PersistentAgreementState = z.enum([
  Object.values(persistentAgreementState)[0],
  ...Object.values(persistentAgreementState).slice(1),
]);
export type PersistentAgreementState = z.infer<typeof PersistentAgreementState>;

const PersistentAttribute = z.object({ id: z.string().uuid() });

const PersistentAgreementDocument = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.date(),
});

const PersistentStamp = z.object({
  who: z.string().uuid(),
  when: z.date(),
});

const PersistentStamps = z.object({
  submission: PersistentStamp.optional(),
  activation: PersistentStamp.optional(),
  rejection: PersistentStamp.optional(),
  suspensionByProducer: PersistentStamp.optional(),
  suspensionByConsumer: PersistentStamp.optional(),
  upgrade: PersistentStamp.optional(),
  archiving: PersistentStamp.optional(),
});

export const PersistentAgreement = z.object({
  id: z.string().uuid(),
  eserviceId: z.string().uuid(),
  descriptorId: z.string().uuid(),
  producerId: z.string().uuid(),
  consumerId: z.string().uuid(),
  state: PersistentAgreementState,
  verifiedAttributes: z.array(PersistentAttribute),
  certifiedAttributes: z.array(PersistentAttribute),
  declaredAttributes: z.array(PersistentAttribute),
  suspendedByConsumer: z.boolean().optional(),
  suspendedByProducer: z.boolean().optional(),
  suspendedByPlatform: z.boolean().optional(),
  consumerDocuments: z.array(PersistentAgreementDocument),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
  consumerNotes: z.string().optional(),
  contract: PersistentAgreementDocument.optional(),
  stamps: PersistentStamps,
  rejectionReason: z.string().optional(),
  suspendedAt: z.date().optional(),
});
export type PersistentAgreement = z.infer<typeof PersistentAgreement>;
