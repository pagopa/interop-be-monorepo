import { z } from "zod";
import { PurposeId, TenantId } from "../brandedIds.js";

export const clientKind = {
  consumer: "Consumer",
  api: "Api",
} as const;
export const ClientKind = z.enum([
  Object.values(clientKind)[0],
  ...Object.values(clientKind).slice(1),
]);
export type ClientKind = z.infer<typeof ClientKind>;

export const Client = z.object({
  id: z.string(),
  consumerId: TenantId,
  name: z.string(),
  purposes: z.array(PurposeId),
  description: z.string().optional(),
  relationships: z.array(z.string()),
  kind: ClientKind,
  createdAt: z.coerce.date(),
});

export type Client = z.infer<typeof Client>;
