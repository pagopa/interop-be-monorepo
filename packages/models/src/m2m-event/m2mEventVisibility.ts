import { z } from "zod";

export const m2mEventVisibility = {
  public: "Public",
  restricted: "Restricted",
} as const;
export const M2MEventVisibility = z.enum([
  Object.values(m2mEventVisibility)[0],
  ...Object.values(m2mEventVisibility).slice(1),
]);
export type M2MEventVisibility = z.infer<typeof M2MEventVisibility>;
