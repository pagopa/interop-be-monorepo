import { z } from "zod";
import { AuthData } from "./auth/authData.js";

export const ctx = z.object({
  authData: AuthData,
  correlationId: z.string().uuid(),
  ip: z.string().ip().nullish(),
});

export type AppContext = z.infer<typeof ctx>;
