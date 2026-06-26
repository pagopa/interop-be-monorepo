import { z } from "zod";
import {
  ClientId,
  DescriptorId,
  EServiceId,
  GSIPKInteractionId,
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
  GSIPK_interactionId: GSIPKInteractionId.optional(),
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

/**
 * For a given requested scope, the interaction states from which that scope
 * may be requested. This is the single source of truth for async interaction
 * state-transition validation, shared by every service that validates async
 * token requests (authorization-server, backend-for-frontend).
 */
const interactionStateAllowedByScope: Record<
  InteractionState,
  InteractionState[]
> = {
  [interactionState.startInteraction]: [],
  [interactionState.callbackInvocation]: [
    interactionState.startInteraction,
    interactionState.callbackInvocation,
  ],
  [interactionState.getResource]: [
    interactionState.callbackInvocation,
    interactionState.getResource,
  ],
  [interactionState.confirmation]: [
    interactionState.callbackInvocation,
    interactionState.getResource,
    interactionState.confirmation,
  ],
};

export const isInteractionStateAllowedForScope = ({
  currentState,
  scope,
}: {
  currentState: InteractionState;
  scope: InteractionState;
}): boolean => interactionStateAllowedByScope[scope].includes(currentState);
