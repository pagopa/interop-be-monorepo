import { z } from "zod";

export const BaseEventSchema = z.object({
  event_name: z.string(),
  id: z.string().optional(),
  state: z.string().optional(),
  eventTimestamp: z.date(),
  correlationId: z.string(),
});

export const PurposeEventSchema = BaseEventSchema.extend({
  versionId: z.string().optional(),
});

export const AgreementEventSchema = BaseEventSchema;

export const AuthorizationEventSchema = BaseEventSchema.extend({
  kid: z.string().optional(),
  user_id: z.string().optional(),
  timestamp: z.string().optional(),
});

export const CatalogEventSchema = BaseEventSchema.extend({
  descriptor_id: z.string().optional(),
});

export const DelegationEventSchema = BaseEventSchema;

export type BaseEventData = z.infer<typeof BaseEventSchema>;
export type PurposeEventData = z.infer<typeof PurposeEventSchema>;
export type AgreementEventData = z.infer<typeof AgreementEventSchema>;
export type AuthorizationEventData = z.infer<typeof AuthorizationEventSchema>;
export type CatalogEventData = z.infer<typeof CatalogEventSchema>;
export type DelegationEventData = z.infer<typeof DelegationEventSchema>;

export const AllEventSchemas = z.union([
  PurposeEventSchema,
  AgreementEventSchema,
  AuthorizationEventSchema,
  CatalogEventSchema,
  DelegationEventSchema,
]);

export type AllEventData = z.infer<typeof AllEventSchemas>;
