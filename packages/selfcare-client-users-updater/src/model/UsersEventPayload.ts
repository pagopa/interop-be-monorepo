import { UserRole } from "pagopa-interop-commons";
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
  rejected: "REJECTED",
} as const;
export const RelationshipStatus = z.enum([
  Object.values(relationshipStatus)[0],
  ...Object.values(relationshipStatus).slice(1),
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatus>;

const SCUser = z.object({
  userId: z.string().uuid().nullish(),
  name: z.string(),
  familyName: z.string(),
  email: z.string(),
  role: z.string(),
  productRole: UserRole,
  relationshipStatus: z.string(),
  mobilePhone: z.string().nullish(),
});

export const UsersEventPayload = z.object({
  id: z.string(),
  institutionId: z.string().trim().min(1), // Selfcare ID
  productId: z.string().trim().min(1),
  onboardingTokenId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
  eventType: SelfcareUserEventType,
  user: SCUser,
});
export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
