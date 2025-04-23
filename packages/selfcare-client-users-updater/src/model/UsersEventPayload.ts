import { z } from "zod";

export const EventType = z.enum(["ADD", "UPDATE"]);
export const RelationshipStatus = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);

const UserEvent = z.object({
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
  eventType: EventType,
  user: UserEvent,
});
export type UsersEventPayload = z.infer<typeof UsersEventPayload>;
