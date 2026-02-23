import { z } from "zod";

export const ownership = {
  CONSUMER: "CONSUMER",
  PRODUCER: "PRODUCER",
  SELF_CONSUMER: "SELF_CONSUMER",
} as const;
export const Ownership = z.enum([
  Object.values(ownership)[0],
  ...Object.values(ownership).slice(1),
]);
export type Ownership = z.infer<typeof Ownership>;
