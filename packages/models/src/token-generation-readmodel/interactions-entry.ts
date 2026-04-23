import { z } from "zod";
import {
  ClientId,
  DescriptorId,
  EServiceId,
  InteractionId,
  InteractionsPK,
  PurposeId,
  TenantId,
} from "../brandedIds.js";

export const interactionState = {
  startInteraction: "start_interaction",
  callbackInvocation: "callback_invocation",
  getResource: "get_resource",
  confirmation: "confirmation",
} as const;

export const InteractionState = z.enum([
  Object.values(interactionState)[0],
  ...Object.values(interactionState).slice(1),
]);
export type InteractionState = z.infer<typeof InteractionState>;

export const Interaction = z.object({
  PK: InteractionsPK,
  interactionId: InteractionId,
  clientId: ClientId,
  purposeId: PurposeId,
  consumerId: TenantId,
  eServiceId: EServiceId,
  descriptorId: DescriptorId,
  state: InteractionState,
  startInteractionTokenIssuedAt: z.string().datetime().optional(),
  callbackInvocationTokenIssuedAt: z.string().datetime().optional(),
  confirmationTokenIssuedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
  ttl: z.number(),
});
export type Interaction = z.infer<typeof Interaction>;
