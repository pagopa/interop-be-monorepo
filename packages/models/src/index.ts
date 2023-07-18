import z from "zod";
import { descriptorState } from "./catalogItem.js";
import { persistentAgreementState } from "./agreement.js";

export * from "./catalogItem.js";
export * from "./agreement.js";

export const consumer = z.object({
  descriptorVersion: z.string(),
  descriptorState,
  agreementState: persistentAgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export type Consumer = z.infer<typeof consumer>;
