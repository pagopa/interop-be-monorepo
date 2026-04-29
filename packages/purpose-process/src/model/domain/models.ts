import { z } from "zod";

export const UpdatedQuotas = z.object({
  currentConsumerCalls: z.number().int().nonnegative(),
  currentTotalCalls: z.number().int().nonnegative(),
  maxDailyCallsPerConsumer: z.number().int().nonnegative(),
  maxDailyCallsTotal: z.number().int().nonnegative(),
});
export type UpdatedQuotas = z.infer<typeof UpdatedQuotas>;

export const RemainingDailyCalls = z.object({
  remainingDailyCallsPerConsumer: z.number(),
  remainingDailyCallsTotal: z.number(),
});
export type RemainingDailyCalls = z.infer<typeof RemainingDailyCalls>;
