import { z } from "zod";

export const authJWTToken = z.object({
  organizationId: z.string().uuid(),
});
export type AuthJWTToken = z.infer<typeof authJWTToken>;

export const authData = z.object({
  authData: z.object({
    organizationId: z.string().uuid(),
  }),
});

export type AuthData = z.infer<typeof authData>;
