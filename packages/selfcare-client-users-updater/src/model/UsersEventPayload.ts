import { z } from "zod";

export const selfcareUserEventType = {
  add: "ADD",
  update: "UPDATE",
} as const;

export const SelfcareUserEventType = z.enum([
  Object.values(selfcareUserEventType)[0],
  ...Object.values(selfcareUserEventType).slice(1),
]);
export type SelfcareUserEventType = z.infer<typeof SelfcareUserEventType>;

export const relationshipStatus = {
  active: "ACTIVE",
  suspended: "SUSPENDED",
  deleted: "DELETED",
} as const;
export const RelationshipStatus = z.enum([
  Object.values(relationshipStatus)[0],
  ...Object.values(relationshipStatus).slice(1),
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatus>;

const SCUser = z.object({
  userId: z.string().uuid().optional(),
  name: z.string(),
  familyName: z.string(),
  email: z.string().email(),
  role: z.string(),
  productRole: z.string(),
  relationshipStatus: RelationshipStatus,
  mobilePhone: z.string().optional(),
});

export const UsersEventPayload = z.object({
  id: z.string(),
  institutionId: z.string().trim().min(1), // Selfcare ID
  productId: z.string().trim().min(1),
  onboardingTokenId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  eventType: SelfcareUserEventType,
  user: SCUser,
});
export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
